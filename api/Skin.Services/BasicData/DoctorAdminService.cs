using Dapper;
using Skin.Core;
using Skin.Core.Dtos;
using Skin.Data;

namespace Skin.Services.BasicData;

/// <summary>醫師主檔 CRUD（Dapper，reused DB，schema 不可改）。</summary>
public sealed class DoctorAdminService(IDbConnectionFactory db) : IDoctorAdminService
{
    private const int NameMaxLength = 15; // Doctors.Name nvarchar(30) bytes = 15 字（真實 DB 已查證）

    private static void ValidateName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new BusinessException("醫師姓名不可空白", "INVALID_NAME");
        if (name.Trim().Length > NameMaxLength)
            throw new BusinessException($"醫師姓名不可超過 {NameMaxLength} 字", "NAME_TOO_LONG");
    }

    public async Task<IReadOnlyList<DoctorAdminDto>> ListAsync(CancellationToken ct = default)
    {
        using var conn = db.Create();
        var rows = await conn.QueryAsync<DoctorAdminDto>(new CommandDefinition(
            "SELECT DoctorID AS DoctorId, Name FROM Doctors ORDER BY Name", cancellationToken: ct));
        return rows.AsList();
    }

    public async Task<DoctorAdminDto?> GetAsync(Guid id, CancellationToken ct = default)
    {
        using var conn = db.Create();
        return await conn.QueryFirstOrDefaultAsync<DoctorAdminDto>(new CommandDefinition(
            "SELECT DoctorID AS DoctorId, Name FROM Doctors WHERE DoctorID = @id", new { id }, cancellationToken: ct));
    }

    public async Task<Guid> CreateAsync(DoctorUpsertRequest req, CancellationToken ct = default)
    {
        ValidateName(req.Name);

        var id = Guid.NewGuid();
        using var conn = db.Create();
        await conn.ExecuteAsync(new CommandDefinition(
            "INSERT INTO Doctors (DoctorID, Name) VALUES (@id, @Name)",
            new { id, req.Name }, cancellationToken: ct));
        return id;
    }

    public async Task UpdateAsync(Guid id, DoctorUpsertRequest req, CancellationToken ct = default)
    {
        ValidateName(req.Name);

        using var conn = db.Create();
        var affected = await conn.ExecuteAsync(new CommandDefinition(
            "UPDATE Doctors SET Name = @Name WHERE DoctorID = @id",
            new { id, req.Name }, cancellationToken: ct));
        if (affected == 0)
            throw new BusinessException("找不到醫師", "NOT_FOUND");
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        using var conn = db.Create();
        var refs = await conn.ExecuteScalarAsync<int>(new CommandDefinition("""
            SELECT
                (SELECT COUNT(*) FROM Appointments WHERE DoctorID = @id) +
                (SELECT COUNT(*) FROM Rosters WHERE DoctorID = @id)
            """, new { id }, cancellationToken: ct));
        if (refs > 0)
            throw new BusinessException("醫師已有預約或排班，無法刪除", "DOCTOR_IN_USE");

        var affected = await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM Doctors WHERE DoctorID = @id", new { id }, cancellationToken: ct));
        if (affected == 0)
            throw new BusinessException("找不到醫師", "NOT_FOUND");
    }
}
