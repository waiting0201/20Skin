using Dapper;
using Skin.Core;
using Skin.Core.Dtos;
using Skin.Data;

namespace Skin.Services.BasicData;

/// <summary>問卷類型主檔 CRUD + 排序（Dapper，reused DB，schema 不可改）。</summary>
public sealed class QuestionTypeAdminService(IDbConnectionFactory db) : IQuestionTypeAdminService
{
    // QuestionTypes.Title nvarchar(100) bytes = 50 字（真實 DB 已查證）
    private const int TitleMaxLength = 50;

    private const string SelectColumns = """
        qt.QuestionTypeID AS QuestionTypeId, qt.CategoryID AS CategoryId, c.Title AS CategoryTitle,
        qt.Title, qt.Sort, qt.IsEnabled
        """;
    private const string FromJoin = "FROM QuestionTypes qt JOIN Categorys c ON c.CategoryID = qt.CategoryID";

    private static void ValidateTitle(string? title)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new BusinessException("問卷名稱不可空白", "INVALID_TITLE");
        if (title.Trim().Length > TitleMaxLength)
            throw new BusinessException($"問卷名稱不可超過 {TitleMaxLength} 字", "TITLE_TOO_LONG");
    }

    public async Task<IReadOnlyList<QuestionTypeAdminDto>> ListAsync(Guid? categoryId, CancellationToken ct = default)
    {
        using var conn = db.Create();
        var rows = await conn.QueryAsync<QuestionTypeAdminDto>(new CommandDefinition($"""
            SELECT {SelectColumns} {FromJoin}
            WHERE @categoryId IS NULL OR qt.CategoryID = @categoryId
            ORDER BY qt.Sort
            """, new { categoryId }, cancellationToken: ct));
        return rows.AsList();
    }

    public async Task<QuestionTypeAdminDto?> GetAsync(Guid id, CancellationToken ct = default)
    {
        using var conn = db.Create();
        return await conn.QueryFirstOrDefaultAsync<QuestionTypeAdminDto>(new CommandDefinition(
            $"SELECT {SelectColumns} {FromJoin} WHERE qt.QuestionTypeID = @id", new { id }, cancellationToken: ct));
    }

    public async Task<Guid> CreateAsync(QuestionTypeUpsertRequest req, CancellationToken ct = default)
    {
        ValidateTitle(req.Title);

        var id = Guid.NewGuid();
        using var conn = db.Create();
        var nextSort = await conn.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT ISNULL(MAX(Sort), 0) + 1 FROM QuestionTypes WHERE CategoryID = @CategoryId",
            new { req.CategoryId }, cancellationToken: ct));
        await conn.ExecuteAsync(new CommandDefinition("""
            INSERT INTO QuestionTypes (QuestionTypeID, CategoryID, Title, Sort, IsEnabled)
            VALUES (@id, @CategoryId, @Title, @nextSort, 1)
            """, new { id, req.CategoryId, req.Title, nextSort }, cancellationToken: ct));
        return id;
    }

    public async Task UpdateAsync(Guid id, QuestionTypeUpsertRequest req, CancellationToken ct = default)
    {
        ValidateTitle(req.Title);

        using var conn = db.Create();
        var affected = await conn.ExecuteAsync(new CommandDefinition(
            "UPDATE QuestionTypes SET CategoryID = @CategoryId, Title = @Title WHERE QuestionTypeID = @id",
            new { id, req.CategoryId, req.Title }, cancellationToken: ct));
        if (affected == 0)
            throw new BusinessException("找不到問卷", "NOT_FOUND");
    }

    /// <summary>軟刪（IsEnabled=false），沿用舊系統；不做硬刪、不查引用。</summary>
    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        using var conn = db.Create();
        var affected = await conn.ExecuteAsync(new CommandDefinition(
            "UPDATE QuestionTypes SET IsEnabled = 0 WHERE QuestionTypeID = @id", new { id }, cancellationToken: ct));
        if (affected == 0)
            throw new BusinessException("找不到問卷", "NOT_FOUND");
    }

    public async Task ReorderAsync(List<SortItem> items, CancellationToken ct = default)
    {
        using var conn = db.Create();
        conn.Open();
        using var tx = conn.BeginTransaction();
        try
        {
            foreach (var item in items)
            {
                await conn.ExecuteAsync(new CommandDefinition(
                    "UPDATE QuestionTypes SET Sort = @Sort WHERE QuestionTypeID = @Id",
                    new { item.Id, item.Sort }, tx, cancellationToken: ct));
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
