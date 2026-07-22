using Dapper;
using Skin.Core;
using Skin.Core.Dtos;
using Skin.Data;

namespace Skin.Services.BasicData;

/// <summary>時段主檔 CRUD + 排序（Dapper，reused DB，schema 不可改）。</summary>
public sealed class PeriodAdminService(IDbConnectionFactory db) : IPeriodAdminService
{
    // Periods.Title nvarchar(100) bytes = 50 字（真實 DB 已查證）
    private const int TitleMaxLength = 50;

    private const string SelectColumns = """
        p.PeriodID AS PeriodId, p.BranchID AS BranchId, p.OutpatientTimeID AS OutpatientTimeId,
        ot.Title AS OutpatientTimeTitle, p.Clinic, p.Title, p.StartNumber, p.Patients, p.Sort
        """;

    private static void ValidateTitle(string? title)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new BusinessException("時段名稱不可空白", "INVALID_TITLE");
        if (title.Trim().Length > TitleMaxLength)
            throw new BusinessException($"時段名稱不可超過 {TitleMaxLength} 字", "TITLE_TOO_LONG");
    }

    public async Task<IReadOnlyList<PeriodAdminDto>> ListAsync(Guid branchId, string clinic, CancellationToken ct = default)
    {
        using var conn = db.Create();
        var rows = await conn.QueryAsync<PeriodAdminDto>(new CommandDefinition($"""
            SELECT {SelectColumns}
            FROM Periods p JOIN OutpatientTimes ot ON ot.OutpatientTimeID = p.OutpatientTimeID
            WHERE p.BranchID = @branchId AND p.Clinic = @clinic
            ORDER BY p.Sort
            """, new { branchId, clinic }, cancellationToken: ct));
        return rows.AsList();
    }

    public async Task<PeriodAdminDto?> GetAsync(Guid id, CancellationToken ct = default)
    {
        using var conn = db.Create();
        return await conn.QueryFirstOrDefaultAsync<PeriodAdminDto>(new CommandDefinition($"""
            SELECT {SelectColumns}
            FROM Periods p JOIN OutpatientTimes ot ON ot.OutpatientTimeID = p.OutpatientTimeID
            WHERE p.PeriodID = @id
            """, new { id }, cancellationToken: ct));
    }

    public async Task<Guid> CreateAsync(Guid branchId, string clinic, PeriodUpsertRequest req, CancellationToken ct = default)
    {
        ValidateTitle(req.Title);
        if (req.Patients < 0)
            throw new BusinessException("容量不可為負數", "INVALID_PATIENTS");

        var id = Guid.NewGuid();
        using var conn = db.Create();
        var nextSort = await conn.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT ISNULL(MAX(Sort), 0) + 1 FROM Periods WHERE BranchID = @branchId AND Clinic = @clinic",
            new { branchId, clinic }, cancellationToken: ct));
        await conn.ExecuteAsync(new CommandDefinition("""
            INSERT INTO Periods (PeriodID, BranchID, OutpatientTimeID, Clinic, Title, StartNumber, Patients, Sort)
            VALUES (@id, @branchId, @OutpatientTimeId, @clinic, @Title, @StartNumber, @Patients, @nextSort)
            """, new
        {
            id, branchId, clinic, req.OutpatientTimeId, req.Title, req.StartNumber, req.Patients, nextSort,
        }, cancellationToken: ct));
        return id;
    }

    public async Task UpdateAsync(Guid id, PeriodUpsertRequest req, CancellationToken ct = default)
    {
        ValidateTitle(req.Title);
        if (req.Patients < 0)
            throw new BusinessException("容量不可為負數", "INVALID_PATIENTS");

        using var conn = db.Create();
        var affected = await conn.ExecuteAsync(new CommandDefinition("""
            UPDATE Periods
            SET OutpatientTimeID = @OutpatientTimeId, Title = @Title, StartNumber = @StartNumber, Patients = @Patients
            WHERE PeriodID = @id
            """, new { id, req.OutpatientTimeId, req.Title, req.StartNumber, req.Patients }, cancellationToken: ct));
        if (affected == 0)
            throw new BusinessException("找不到時段", "NOT_FOUND");
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        using var conn = db.Create();
        var refs = await conn.ExecuteScalarAsync<int>(new CommandDefinition("""
            SELECT
                (SELECT COUNT(*) FROM Appointments WHERE PeriodID = @id) +
                (SELECT COUNT(*) FROM RosterPeriods WHERE PeriodID = @id)
            """, new { id }, cancellationToken: ct));
        if (refs > 0)
            throw new BusinessException("時段已有預約或排班容量設定，無法刪除", "PERIOD_IN_USE");

        var affected = await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM Periods WHERE PeriodID = @id", new { id }, cancellationToken: ct));
        if (affected == 0)
            throw new BusinessException("找不到時段", "NOT_FOUND");
    }

    public async Task ReorderAsync(Guid branchId, string clinic, List<SortItem> items, CancellationToken ct = default)
    {
        using var conn = db.Create();
        conn.Open();
        using var tx = conn.BeginTransaction();
        try
        {
            foreach (var item in items)
            {
                await conn.ExecuteAsync(new CommandDefinition(
                    "UPDATE Periods SET Sort = @Sort WHERE PeriodID = @Id AND BranchID = @branchId AND Clinic = @clinic",
                    new { item.Id, item.Sort, branchId, clinic }, tx, cancellationToken: ct));
            }
            tx.Commit();
        }
        catch
        {
            try { tx.Rollback(); } catch { /* ignore */ }
            throw;
        }
    }

    public async Task<IReadOnlyList<OutpatientTimeDto>> ListOutpatientTimesAsync(CancellationToken ct = default)
    {
        using var conn = db.Create();
        var rows = await conn.QueryAsync<OutpatientTimeDto>(new CommandDefinition(
            "SELECT OutpatientTimeID AS OutpatientTimeId, Title FROM OutpatientTimes ORDER BY OutpatientTimeID",
            cancellationToken: ct));
        return rows.AsList();
    }

    public async Task<bool> GetBranchIsAutoRowNumberAsync(Guid branchId, CancellationToken ct = default)
    {
        using var conn = db.Create();
        return await conn.ExecuteScalarAsync<bool>(new CommandDefinition(
            "SELECT IsAutoRowNumber FROM Branchs WHERE BranchID = @branchId",
            new { branchId }, cancellationToken: ct));
    }
}
