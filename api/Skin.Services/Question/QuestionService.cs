using System.Data;
using Dapper;
using Skin.Core;
using Skin.Core.Dtos;
using Skin.Data;

namespace Skin.Services.Question;

public sealed class QuestionService(IDbConnectionFactory db) : IQuestionService
{
    public async Task<IReadOnlyList<QuestionnaireCategoryDto>> GetCategoriesAsync(
        Guid memberId, string? clinic, Guid? categoryId, CancellationToken ct = default)
    {
        // 只列有「啟用問卷」的 Category（忠於舊 QuestionTypes()：Where(IsEnabled) + 依 Clinic/Sort 排序）。
        const string sql = """
            SELECT c.CategoryID AS CategoryId, c.Clinic, c.Title, c.Intro, c.Photo,
                   qt.QuestionTypeID AS QuestionTypeId, qt.Title AS QtTitle, qt.Sort AS QtSort
            FROM QuestionTypes qt
            JOIN Categorys c ON c.CategoryID = qt.CategoryID
            WHERE qt.IsEnabled = 1
              AND (@clinic IS NULL OR c.Clinic = @clinic)
              AND (@categoryId IS NULL OR c.CategoryID = @categoryId)
            ORDER BY c.Clinic, c.Sort, qt.Sort
            """;
        using var conn = db.Create();
        var rows = (await conn.QueryAsync<CategoryRow>(
            new CommandDefinition(sql, new { clinic, categoryId }, cancellationToken: ct))).AsList();

        // 會員已作答的 QuestionTypeID 集合。
        var answered = (await conn.QueryAsync<Guid>(new CommandDefinition(
            "SELECT DISTINCT QuestionTypeID FROM MemberQuestions WHERE MemberID = @memberId",
            new { memberId }, cancellationToken: ct))).ToHashSet();

        var result = new List<QuestionnaireCategoryDto>();
        foreach (var group in rows.GroupBy(r => r.CategoryId))
        {
            var first = group.First();
            var entries = group
                .Select(r => new QuestionnaireEntryDto(r.QuestionTypeId, r.QtTitle, r.QtSort, answered.Contains(r.QuestionTypeId)))
                .ToList();
            result.Add(new QuestionnaireCategoryDto(
                first.CategoryId, first.Clinic, first.Title, first.Intro, first.Photo, entries));
        }
        return result;
    }

    public async Task<QuestionFormDto?> GetFormAsync(Guid memberId, Guid questionTypeId, CancellationToken ct = default)
    {
        using var conn = db.Create();

        var qt = await conn.QueryFirstOrDefaultAsync<QuestionTypeRow>(new CommandDefinition("""
            SELECT QuestionTypeID AS QuestionTypeId, CategoryID AS CategoryId, Title
            FROM QuestionTypes WHERE QuestionTypeID = @questionTypeId AND IsEnabled = 1
            """, new { questionTypeId }, cancellationToken: ct));
        if (qt is null) return null;

        var questions = (await conn.QueryAsync<QuestionRow>(new CommandDefinition("""
            SELECT QuestionID AS QuestionId, Title, OptionType, IsOther, OtherTitle, Sort
            FROM Questions WHERE QuestionTypeID = @questionTypeId AND IsEnabled = 1 ORDER BY Sort
            """, new { questionTypeId }, cancellationToken: ct))).AsList();

        var qids = questions.Select(q => q.QuestionId).ToArray();
        var answersByQuestion = new Dictionary<Guid, List<QuestionAnswerDto>>();
        if (qids.Length > 0)
        {
            var answers = await conn.QueryAsync<AnswerRow>(new CommandDefinition("""
                SELECT QuestionAnswerID AS QuestionAnswerId, QuestionID AS QuestionId, Title, Sort
                FROM QuestionAnswers WHERE QuestionID IN @qids ORDER BY Sort
                """, new { qids }, cancellationToken: ct));
            foreach (var a in answers)
            {
                if (!answersByQuestion.TryGetValue(a.QuestionId, out var list))
                    answersByQuestion[a.QuestionId] = list = [];
                list.Add(new QuestionAnswerDto(a.QuestionAnswerId, a.Title, a.Sort));
            }
        }

        // 會員既有作答（pre-fill）。legacy 資料可能同題多筆（無時間欄無法定序）→ 取聯集，最佳努力。
        var prior = await conn.QueryAsync<PriorRow>(new CommandDefinition("""
            SELECT mq.QuestionID AS QuestionId, mq.Other, mqa.QuestionAnswerID AS QuestionAnswerId
            FROM MemberQuestions mq
            LEFT JOIN MemberQuestionAnswers mqa ON mqa.MemberQuestionID = mq.MemberQuestionID
            WHERE mq.MemberID = @memberId AND mq.QuestionTypeID = @questionTypeId
            """, new { memberId, questionTypeId }, cancellationToken: ct));

        var selectedByQuestion = new Dictionary<Guid, HashSet<Guid>>();
        var otherByQuestion = new Dictionary<Guid, string?>();
        var answeredAny = false;
        foreach (var p in prior)
        {
            if (p.QuestionId is not { } qid) continue;
            answeredAny = true;
            if (p.QuestionAnswerId is { } ansId)
            {
                if (!selectedByQuestion.TryGetValue(qid, out var set))
                    selectedByQuestion[qid] = set = [];
                set.Add(ansId);
            }
            if (!string.IsNullOrEmpty(p.Other)) otherByQuestion[qid] = p.Other;
        }

        var items = questions.Select(q => new QuestionFormItemDto(
            q.QuestionId, q.Title, q.OptionType, q.IsOther, q.OtherTitle,
            answersByQuestion.TryGetValue(q.QuestionId, out var ans) ? ans : [],
            selectedByQuestion.TryGetValue(q.QuestionId, out var sel) ? sel.ToList() : [],
            otherByQuestion.TryGetValue(q.QuestionId, out var oth) ? oth : null)).ToList();

        return new QuestionFormDto(qt.QuestionTypeId, qt.CategoryId, qt.Title, answeredAny, items);
    }

    public async Task SubmitAsync(Guid memberId, SaveMemberQuestionsRequest req, CancellationToken ct = default)
    {
        if (req.Answers is null || req.Answers.Count == 0)
            throw new BusinessException("未填寫任何答案", "EMPTY_ANSWERS");

        using var conn = db.Create();
        conn.Open();

        // 驗證：問卷須存在且啟用。
        var exists = await conn.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT COUNT(*) FROM QuestionTypes WHERE QuestionTypeID = @id AND IsEnabled = 1",
            new { id = req.QuestionTypeId }, cancellationToken: ct));
        if (exists == 0) throw new BusinessException("問卷不存在或已停用", "QUESTIONNAIRE_NOT_FOUND");

        // 取此問卷下「啟用題目 → 合法選項」對照，用以過濾非法 questionId/answerId（該表無 FK 到 QuestionAnswers）。
        var valid = await conn.QueryAsync<ValidPair>(new CommandDefinition("""
            SELECT q.QuestionID AS QuestionId, qa.QuestionAnswerID AS QuestionAnswerId
            FROM Questions q
            LEFT JOIN QuestionAnswers qa ON qa.QuestionID = q.QuestionID
            WHERE q.QuestionTypeID = @id AND q.IsEnabled = 1
            """, new { id = req.QuestionTypeId }, cancellationToken: ct));
        var validQuestions = new HashSet<Guid>();
        var validAnswers = new HashSet<Guid>();
        foreach (var v in valid)
        {
            validQuestions.Add(v.QuestionId);
            if (v.QuestionAnswerId is { } a) validAnswers.Add(a);
        }

        using var tx = conn.BeginTransaction();
        try
        {
            // 重填語義：先刪該會員此問卷舊作答（含答案，交易內），再寫入本次（冪等）。
            await conn.ExecuteAsync(new CommandDefinition("""
                DELETE mqa FROM MemberQuestionAnswers mqa
                JOIN MemberQuestions mq ON mq.MemberQuestionID = mqa.MemberQuestionID
                WHERE mq.MemberID = @memberId AND mq.QuestionTypeID = @id
                """, new { memberId, id = req.QuestionTypeId }, tx, cancellationToken: ct));
            await conn.ExecuteAsync(new CommandDefinition(
                "DELETE FROM MemberQuestions WHERE MemberID = @memberId AND QuestionTypeID = @id",
                new { memberId, id = req.QuestionTypeId }, tx, cancellationToken: ct));

            foreach (var input in req.Answers)
            {
                if (!validQuestions.Contains(input.QuestionId)) continue;
                var answerIds = (input.AnswerIds ?? []).Where(validAnswers.Contains).Distinct().ToList();
                var other = string.IsNullOrWhiteSpace(input.Other) ? null : input.Other.Trim();
                if (answerIds.Count == 0 && other is null) continue;   // 該題未作答 → 跳過

                var memberQuestionId = Guid.NewGuid();
                await conn.ExecuteAsync(new CommandDefinition("""
                    INSERT INTO MemberQuestions (MemberQuestionID, MemberID, QuestionTypeID, QuestionID, Other, Filename)
                    VALUES (@memberQuestionId, @memberId, @questionTypeId, @questionId, @other, NULL)
                    """, new { memberQuestionId, memberId, questionTypeId = req.QuestionTypeId, questionId = input.QuestionId, other },
                    tx, cancellationToken: ct));

                foreach (var answerId in answerIds)
                {
                    await conn.ExecuteAsync(new CommandDefinition("""
                        INSERT INTO MemberQuestionAnswers (MemberQuestionAnswerID, MemberQuestionID, QuestionAnswerID)
                        VALUES (@id, @memberQuestionId, @answerId)
                        """, new { id = Guid.NewGuid(), memberQuestionId, answerId }, tx, cancellationToken: ct));
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

    private sealed record CategoryRow(Guid CategoryId, string Clinic, string Title, string? Intro, string Photo,
        Guid QuestionTypeId, string QtTitle, int QtSort);
    private sealed record QuestionTypeRow(Guid QuestionTypeId, Guid CategoryId, string Title);
    private sealed record QuestionRow(Guid QuestionId, string Title, int OptionType, bool IsOther, string? OtherTitle, int Sort);
    private sealed record AnswerRow(Guid QuestionAnswerId, Guid QuestionId, string Title, int Sort);
    private sealed record PriorRow(Guid? QuestionId, string? Other, Guid? QuestionAnswerId);
    private sealed record ValidPair(Guid QuestionId, Guid? QuestionAnswerId);
}
