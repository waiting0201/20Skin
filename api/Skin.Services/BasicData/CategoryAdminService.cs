using Dapper;
using Skin.Core;
using Skin.Core.Dtos;
using Skin.Data;

namespace Skin.Services.BasicData;

/// <summary>科別項目主檔 CRUD + 排序（Dapper，reused DB，schema 不可改）。</summary>
public sealed class CategoryAdminService(IDbConnectionFactory db) : ICategoryAdminService
{
    // Categorys.Title/Photo nvarchar(100) bytes = 50 字；Intro nvarchar(500) bytes = 250 字（真實 DB 已查證）
    private const int TitleMaxLength = 50;
    private const int IntroMaxLength = 250;
    private const int PhotoMaxLength = 50;

    private const string SelectColumns = """
        CategoryID AS CategoryId, Clinic, Title, Intro, Photo, IsQuestion, IsOnly, ChIsOnly, ChDentistIsOnly, Sort
        """;

    private static void Validate(CategoryUpsertRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Title))
            throw new BusinessException("項目名稱不可空白", "INVALID_TITLE");
        if (req.Title.Trim().Length > TitleMaxLength)
            throw new BusinessException($"項目名稱不可超過 {TitleMaxLength} 字", "TITLE_TOO_LONG");
        if ((req.Intro?.Length ?? 0) > IntroMaxLength)
            throw new BusinessException($"簡介不可超過 {IntroMaxLength} 字", "INTRO_TOO_LONG");
        if ((req.Photo?.Length ?? 0) > PhotoMaxLength)
            throw new BusinessException($"圖片檔名不可超過 {PhotoMaxLength} 字", "PHOTO_TOO_LONG");
    }

    public async Task<IReadOnlyList<CategoryAdminDto>> ListAsync(string clinic, CancellationToken ct = default)
    {
        using var conn = db.Create();
        var rows = await conn.QueryAsync<CategoryAdminDto>(new CommandDefinition(
            $"SELECT {SelectColumns} FROM Categorys WHERE Clinic = @clinic ORDER BY Sort",
            new { clinic }, cancellationToken: ct));
        return rows.AsList();
    }

    public async Task<CategoryAdminDto?> GetAsync(Guid id, CancellationToken ct = default)
    {
        using var conn = db.Create();
        return await conn.QueryFirstOrDefaultAsync<CategoryAdminDto>(new CommandDefinition(
            $"SELECT {SelectColumns} FROM Categorys WHERE CategoryID = @id", new { id }, cancellationToken: ct));
    }

    public async Task<Guid> CreateAsync(string clinic, CategoryUpsertRequest req, CancellationToken ct = default)
    {
        Validate(req);

        var id = Guid.NewGuid();
        using var conn = db.Create();
        var nextSort = await conn.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT ISNULL(MAX(Sort), 0) + 1 FROM Categorys WHERE Clinic = @clinic",
            new { clinic }, cancellationToken: ct));
        await conn.ExecuteAsync(new CommandDefinition("""
            INSERT INTO Categorys (CategoryID, Clinic, Title, Intro, Photo, IsQuestion, IsOnly, ChIsOnly, ChDentistIsOnly, Sort)
            VALUES (@id, @clinic, @Title, @Intro, @Photo, @IsQuestion, @IsOnly, @ChIsOnly, @ChDentistIsOnly, @nextSort)
            """, new
        {
            id, clinic, req.Title, req.Intro, Photo = req.Photo ?? "",
            req.IsQuestion, req.IsOnly, req.ChIsOnly, req.ChDentistIsOnly, nextSort,
        }, cancellationToken: ct));
        return id;
    }

    public async Task UpdateAsync(Guid id, CategoryUpsertRequest req, CancellationToken ct = default)
    {
        Validate(req);

        using var conn = db.Create();
        var affected = await conn.ExecuteAsync(new CommandDefinition("""
            UPDATE Categorys
            SET Title = @Title, Intro = @Intro, Photo = @Photo,
                IsQuestion = @IsQuestion, IsOnly = @IsOnly, ChIsOnly = @ChIsOnly, ChDentistIsOnly = @ChDentistIsOnly
            WHERE CategoryID = @id
            """, new
        {
            id, req.Title, req.Intro, Photo = req.Photo ?? "",
            req.IsQuestion, req.IsOnly, req.ChIsOnly, req.ChDentistIsOnly,
        }, cancellationToken: ct));
        if (affected == 0)
            throw new BusinessException("找不到項目", "NOT_FOUND");
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        using var conn = db.Create();
        var refs = await conn.ExecuteScalarAsync<int>(new CommandDefinition("""
            SELECT
                (SELECT COUNT(*) FROM Appointments WHERE CategoryID = @id) +
                (SELECT COUNT(*) FROM RosterCategorys WHERE CategoryID = @id) +
                (SELECT COUNT(*) FROM QuestionTypes WHERE CategoryID = @id)
            """, new { id }, cancellationToken: ct));
        if (refs > 0)
            throw new BusinessException("項目已有預約、排班或問卷設定，無法刪除", "CATEGORY_IN_USE");

        var affected = await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM Categorys WHERE CategoryID = @id", new { id }, cancellationToken: ct));
        if (affected == 0)
            throw new BusinessException("找不到項目", "NOT_FOUND");
    }

    public async Task ReorderAsync(string clinic, List<SortItem> items, CancellationToken ct = default)
    {
        using var conn = db.Create();
        conn.Open();
        using var tx = conn.BeginTransaction();
        try
        {
            foreach (var item in items)
            {
                await conn.ExecuteAsync(new CommandDefinition(
                    "UPDATE Categorys SET Sort = @Sort WHERE CategoryID = @Id AND Clinic = @clinic",
                    new { item.Id, item.Sort, clinic }, tx, cancellationToken: ct));
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
