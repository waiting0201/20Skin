using Dapper;
using Skin.Core;
using Skin.Core.Dtos;
using Skin.Data;

namespace Skin.Services.BasicData;

/// <summary>問卷題目 + 選項 CRUD（Dapper，reused DB，schema 不可改）。見 IQuestionAdminService 註解。</summary>
public sealed class QuestionAdminService(IDbConnectionFactory db) : IQuestionAdminService
{
    // 真實 DB 已查證：Questions.Title nvarchar(500)=250 字、OtherTitle nvarchar(100)=50 字、
    // QuestionAnswers.Title nvarchar(100)=50 字
    private const int TitleMaxLength = 250;
    private const int OtherTitleMaxLength = 50;
    private const int AnswerTitleMaxLength = 50;

    private sealed record QuestionRow(Guid QuestionId, Guid QuestionTypeId, string Title, int OptionType, bool IsOther, string? OtherTitle, int Sort, bool IsEnabled);
    private sealed record AnswerRow(Guid QuestionId, Guid QuestionAnswerId, string Title, int Sort);

    private static void Validate(QuestionUpsertRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Title))
            throw new BusinessException("題目不可空白", "INVALID_TITLE");
        if (req.Title.Trim().Length > TitleMaxLength)
            throw new BusinessException($"題目不可超過 {TitleMaxLength} 字", "TITLE_TOO_LONG");
        // 真實 DB OptionType 僅 1=單選/2=複選，無文字/檔案題型（見 docs/gotchas.md）
        if (req.OptionType != 1 && req.OptionType != 2)
            throw new BusinessException("題型僅支援單選(1)或複選(2)", "INVALID_OPTION_TYPE");
        if ((req.OtherTitle?.Length ?? 0) > OtherTitleMaxLength)
            throw new BusinessException($"「其他」欄位標題不可超過 {OtherTitleMaxLength} 字", "OTHER_TITLE_TOO_LONG");
        if (req.Answers is null || req.Answers.Count == 0)
            throw new BusinessException("至少需要一個選項", "ANSWERS_REQUIRED");
        foreach (var a in req.Answers)
        {
            if (string.IsNullOrWhiteSpace(a.Title))
                throw new BusinessException("選項名稱不可空白", "INVALID_ANSWER_TITLE");
            if (a.Title.Trim().Length > AnswerTitleMaxLength)
                throw new BusinessException($"選項名稱不可超過 {AnswerTitleMaxLength} 字", "ANSWER_TITLE_TOO_LONG");
        }
    }

    public async Task<IReadOnlyList<QuestionAdminDto>> ListAsync(Guid questionTypeId, CancellationToken ct = default)
    {
        using var conn = db.Create();
        var questions = (await conn.QueryAsync<QuestionRow>(new CommandDefinition("""
            SELECT QuestionID AS QuestionId, QuestionTypeID AS QuestionTypeId, Title, OptionType, IsOther, OtherTitle, Sort, IsEnabled
            FROM Questions WHERE QuestionTypeID = @questionTypeId ORDER BY Sort
            """, new { questionTypeId }, cancellationToken: ct))).AsList();
        if (questions.Count == 0) return [];

        var ids = questions.Select(q => q.QuestionId).ToList();
        var answers = (await conn.QueryAsync<AnswerRow>(new CommandDefinition("""
            SELECT QuestionID AS QuestionId, QuestionAnswerID AS QuestionAnswerId, Title, Sort
            FROM QuestionAnswers WHERE QuestionID IN @ids ORDER BY Sort
            """, new { ids }, cancellationToken: ct))).AsList();

        var byQuestion = answers.GroupBy(a => a.QuestionId)
            .ToDictionary(g => g.Key, g => g.Select(a => new QuestionAnswerAdminDto(a.QuestionAnswerId, a.Title, a.Sort)).ToList());

        return questions.Select(q => new QuestionAdminDto(
            q.QuestionId, q.QuestionTypeId, q.Title, q.OptionType, q.IsOther, q.OtherTitle, q.Sort, q.IsEnabled,
            byQuestion.TryGetValue(q.QuestionId, out var a) ? a : [])).ToList();
    }

    public async Task<Guid> CreateAsync(Guid questionTypeId, QuestionUpsertRequest req, CancellationToken ct = default)
    {
        Validate(req);

        var id = Guid.NewGuid();
        using var conn = db.Create();
        conn.Open();
        using var tx = conn.BeginTransaction();
        try
        {
            var nextSort = await conn.ExecuteScalarAsync<int>(new CommandDefinition(
                "SELECT ISNULL(MAX(Sort), 0) + 1 FROM Questions WHERE QuestionTypeID = @questionTypeId",
                new { questionTypeId }, tx, cancellationToken: ct));
            await conn.ExecuteAsync(new CommandDefinition("""
                INSERT INTO Questions (QuestionID, QuestionTypeID, Title, OtherTitle, OptionType, IsOther, Sort, IsEnabled)
                VALUES (@id, @questionTypeId, @Title, @OtherTitle, @OptionType, @IsOther, @nextSort, 1)
                """, new { id, questionTypeId, req.Title, req.OtherTitle, req.OptionType, req.IsOther, nextSort },
                tx, cancellationToken: ct));

            foreach (var a in req.Answers)
            {
                await conn.ExecuteAsync(new CommandDefinition(
                    "INSERT INTO QuestionAnswers (QuestionAnswerID, QuestionID, Title, Sort) VALUES (@aid, @id, @Title, @Sort)",
                    new { aid = Guid.NewGuid(), id, a.Title, a.Sort }, tx, cancellationToken: ct));
            }
            tx.Commit();
            return id;
        }
        catch
        {
            try { tx.Rollback(); } catch { /* ignore */ }
            throw;
        }
    }

    /// <summary>
    /// 編輯題目 + 選項 diff：送上來有既有 ID 且屬於本題目→更新 Title/Sort；現有但送上來沒有→硬刪除
    /// （不查 MemberQuestionAnswers 引用，沿用舊系統，使用者已拍板接受孤兒資料風險）；
    /// 送上來無 ID 或 ID 偽造（不屬於本題目既有選項）→視為新增（沿用問卷讀取面「偽造 answerID 濾除」慣例）。
    /// </summary>
    public async Task UpdateAsync(Guid id, QuestionUpsertRequest req, CancellationToken ct = default)
    {
        Validate(req);

        using var conn = db.Create();
        conn.Open();
        using var tx = conn.BeginTransaction();
        try
        {
            var affected = await conn.ExecuteAsync(new CommandDefinition("""
                UPDATE Questions SET Title = @Title, OtherTitle = @OtherTitle, OptionType = @OptionType, IsOther = @IsOther
                WHERE QuestionID = @id
                """, new { id, req.Title, req.OtherTitle, req.OptionType, req.IsOther }, tx, cancellationToken: ct));
            if (affected == 0)
                throw new BusinessException("找不到題目", "NOT_FOUND");

            var existingIds = (await conn.QueryAsync<Guid>(new CommandDefinition(
                "SELECT QuestionAnswerID FROM QuestionAnswers WHERE QuestionID = @id",
                new { id }, tx, cancellationToken: ct))).ToHashSet();

            var incomingIds = req.Answers
                .Where(a => a.QuestionAnswerId.HasValue && existingIds.Contains(a.QuestionAnswerId.Value))
                .Select(a => a.QuestionAnswerId!.Value)
                .ToHashSet();

            var toDelete = existingIds.Except(incomingIds).ToList();
            if (toDelete.Count > 0)
            {
                await conn.ExecuteAsync(new CommandDefinition(
                    "DELETE FROM QuestionAnswers WHERE QuestionAnswerID IN @toDelete",
                    new { toDelete }, tx, cancellationToken: ct));
            }

            foreach (var a in req.Answers)
            {
                if (a.QuestionAnswerId.HasValue && incomingIds.Contains(a.QuestionAnswerId.Value))
                {
                    await conn.ExecuteAsync(new CommandDefinition(
                        "UPDATE QuestionAnswers SET Title = @Title, Sort = @Sort WHERE QuestionAnswerID = @aid",
                        new { aid = a.QuestionAnswerId.Value, a.Title, a.Sort }, tx, cancellationToken: ct));
                }
                else
                {
                    await conn.ExecuteAsync(new CommandDefinition(
                        "INSERT INTO QuestionAnswers (QuestionAnswerID, QuestionID, Title, Sort) VALUES (@aid, @id, @Title, @Sort)",
                        new { aid = Guid.NewGuid(), id, a.Title, a.Sort }, tx, cancellationToken: ct));
                }
            }
            tx.Commit();
        }
        catch
        {
            try { tx.Rollback(); } catch { /* ignore */ }
            throw;
        }
    }

    /// <summary>軟刪（IsEnabled=false），沿用舊系統；不硬刪、不動 QuestionAnswers。</summary>
    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        using var conn = db.Create();
        var affected = await conn.ExecuteAsync(new CommandDefinition(
            "UPDATE Questions SET IsEnabled = 0 WHERE QuestionID = @id", new { id }, cancellationToken: ct));
        if (affected == 0)
            throw new BusinessException("找不到題目", "NOT_FOUND");
    }

    public async Task ReorderAsync(Guid questionTypeId, List<SortItem> items, CancellationToken ct = default)
    {
        using var conn = db.Create();
        conn.Open();
        using var tx = conn.BeginTransaction();
        try
        {
            foreach (var item in items)
            {
                await conn.ExecuteAsync(new CommandDefinition(
                    "UPDATE Questions SET Sort = @Sort WHERE QuestionID = @Id AND QuestionTypeID = @questionTypeId",
                    new { item.Id, item.Sort, questionTypeId }, tx, cancellationToken: ct));
            }
            tx.Commit();
        }
        catch
        {
            try { tx.Rollback(); } catch { /* ignore */ }
            throw;
        }
    }
}
