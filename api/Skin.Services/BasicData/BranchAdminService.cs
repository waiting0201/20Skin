using Dapper;
using Skin.Core;
using Skin.Core.Dtos;
using Skin.Data;

namespace Skin.Services.BasicData;

/// <summary>分院主檔 CRUD + 排序（Dapper，reused DB，schema 不可改）。</summary>
public sealed class BranchAdminService(IDbConnectionFactory db) : IBranchAdminService
{
    private const string SelectColumns =
        "BranchID AS BranchId, Title, BranchType, Photo, IsAutoRowNumber, Sort, IsEnabled";

    // Branchs.Title / Photo 皆 nvarchar(100) bytes = 50 字（真實 DB 已查證）
    private const int TitleMaxLength = 50;
    private const int PhotoMaxLength = 50;

    private static void Validate(BranchUpsertRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Title))
            throw new BusinessException("分院名稱不可空白", "INVALID_TITLE");
        if (req.Title.Trim().Length > TitleMaxLength)
            throw new BusinessException($"分院名稱不可超過 {TitleMaxLength} 字", "TITLE_TOO_LONG");
        if ((req.Photo?.Length ?? 0) > PhotoMaxLength)
            throw new BusinessException($"圖片檔名不可超過 {PhotoMaxLength} 字", "PHOTO_TOO_LONG");
    }

    public async Task<(IReadOnlyList<BranchAdminDto> Items, int Total)> ListAsync(int page, int pageSize, CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var offset = (page - 1) * pageSize;

        using var conn = db.Create();
        var total = await conn.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT COUNT(*) FROM Branchs", cancellationToken: ct));

        var rows = await conn.QueryAsync<BranchAdminDto>(new CommandDefinition(
            $"SELECT {SelectColumns} FROM Branchs ORDER BY Sort OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY",
            new { offset, pageSize }, cancellationToken: ct));
        return (rows.AsList(), total);
    }

    public async Task<IReadOnlyList<BranchAdminDto>> ListEnabledAsync(CancellationToken ct = default)
    {
        using var conn = db.Create();
        var rows = await conn.QueryAsync<BranchAdminDto>(new CommandDefinition(
            $"SELECT {SelectColumns} FROM Branchs WHERE IsEnabled = 1 ORDER BY Sort", cancellationToken: ct));
        return rows.AsList();
    }

    public async Task<BranchAdminDto?> GetAsync(Guid id, CancellationToken ct = default)
    {
        using var conn = db.Create();
        return await conn.QueryFirstOrDefaultAsync<BranchAdminDto>(new CommandDefinition(
            $"SELECT {SelectColumns} FROM Branchs WHERE BranchID = @id", new { id }, cancellationToken: ct));
    }

    public async Task<Guid> CreateAsync(BranchUpsertRequest req, CancellationToken ct = default)
    {
        Validate(req);

        var id = Guid.NewGuid();
        using var conn = db.Create();
        var nextSort = await conn.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT ISNULL(MAX(Sort), 0) + 1 FROM Branchs", cancellationToken: ct));
        await conn.ExecuteAsync(new CommandDefinition("""
            INSERT INTO Branchs (BranchID, Title, BranchType, Photo, IsAutoRowNumber, Sort, IsEnabled)
            VALUES (@id, @Title, @BranchType, @Photo, @IsAutoRowNumber, @nextSort, @IsEnabled)
            """, new
        {
            id, req.Title, req.BranchType, Photo = req.Photo ?? "", req.IsAutoRowNumber, nextSort, req.IsEnabled,
        }, cancellationToken: ct));
        return id;
    }

    public async Task UpdateAsync(Guid id, BranchUpsertRequest req, CancellationToken ct = default)
    {
        Validate(req);

        using var conn = db.Create();
        var affected = await conn.ExecuteAsync(new CommandDefinition("""
            UPDATE Branchs
            SET Title = @Title, BranchType = @BranchType, Photo = @Photo,
                IsAutoRowNumber = @IsAutoRowNumber, IsEnabled = @IsEnabled
            WHERE BranchID = @id
            """, new
        {
            id, req.Title, req.BranchType, Photo = req.Photo ?? "", req.IsAutoRowNumber, req.IsEnabled,
        }, cancellationToken: ct));
        if (affected == 0)
            throw new BusinessException("找不到分院", "NOT_FOUND");
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        using var conn = db.Create();
        var refs = await conn.ExecuteScalarAsync<int>(new CommandDefinition("""
            SELECT
                (SELECT COUNT(*) FROM Appointments WHERE BranchID = @id) +
                (SELECT COUNT(*) FROM Rosters WHERE BranchID = @id) +
                (SELECT COUNT(*) FROM Periods WHERE BranchID = @id)
            """, new { id }, cancellationToken: ct));
        if (refs > 0)
            throw new BusinessException("分院已有預約、排班或時段設定，無法刪除", "BRANCH_IN_USE");

        var affected = await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM Branchs WHERE BranchID = @id", new { id }, cancellationToken: ct));
        if (affected == 0)
            throw new BusinessException("找不到分院", "NOT_FOUND");
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
                    "UPDATE Branchs SET Sort = @Sort WHERE BranchID = @Id",
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
