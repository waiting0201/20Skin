using System.Data;
using Dapper;
using Skin.Core;
using Skin.Core.Dtos;
using Skin.Data;
using Skin.Data.Entities;

namespace Skin.Services.Admin;

/// <summary>
/// 管理員 + 權限資料存取（Dapper，reused DB，schema 不可改）。
/// AdminLims 編輯採「清空重建」（沿用舊 AuthorityMsController 差異寫入的等效簡化）。
/// </summary>
public sealed class AdminService(IDbConnectionFactory db) : IAdminService
{
    public async Task<Admins?> FindByUsernameAsync(string username, CancellationToken ct = default)
    {
        using var conn = db.Create();
        return await conn.QueryFirstOrDefaultAsync<Admins>(new CommandDefinition(
            "SELECT TOP 1 * FROM Admins WHERE Username = @username",
            new { username }, cancellationToken: ct));
    }

    public async Task<IReadOnlyList<AdminListItemDto>> ListAsync(CancellationToken ct = default)
    {
        using var conn = db.Create();
        var rows = await conn.QueryAsync<AdminListItemDto>(new CommandDefinition("""
            SELECT AdminID AS AdminId, Username, Name
            FROM Admins
            ORDER BY Username
            """, cancellationToken: ct));
        return rows.AsList();
    }

    public async Task<Admins?> GetByIdAsync(Guid adminId, CancellationToken ct = default)
    {
        using var conn = db.Create();
        return await conn.QueryFirstOrDefaultAsync<Admins>(new CommandDefinition(
            "SELECT TOP 1 * FROM Admins WHERE AdminID = @adminId",
            new { adminId }, cancellationToken: ct));
    }

    public async Task<IReadOnlyList<Lims>> ListLimsAsync(CancellationToken ct = default)
    {
        using var conn = db.Create();
        var rows = await conn.QueryAsync<Lims>(new CommandDefinition(
            "SELECT * FROM Lims ORDER BY Sort",
            cancellationToken: ct));
        return rows.AsList();
    }

    public async Task<IReadOnlyList<AdminLims>> GetAdminLimsAsync(Guid adminId, CancellationToken ct = default)
    {
        using var conn = db.Create();
        var rows = await conn.QueryAsync<AdminLims>(new CommandDefinition(
            "SELECT * FROM AdminLims WHERE AdminID = @adminId",
            new { adminId }, cancellationToken: ct));
        return rows.AsList();
    }

    public async Task<bool> UsernameExistsAsync(string username, Guid? excludeAdminId = null, CancellationToken ct = default)
    {
        using var conn = db.Create();
        var count = await conn.ExecuteScalarAsync<int>(new CommandDefinition("""
            SELECT COUNT(*) FROM Admins
            WHERE Username = @username AND (@exclude IS NULL OR AdminID <> @exclude)
            """, new { username, exclude = excludeAdminId }, cancellationToken: ct));
        return count > 0;
    }

    public async Task<Guid> CreateAsync(AdminUpsertRequest req, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(req.Username))
            throw new BusinessException("帳號不可空白", "INVALID_USERNAME");
        if (string.IsNullOrWhiteSpace(req.Password))
            throw new BusinessException("新增管理員需設定密碼", "PASSWORD_REQUIRED");
        if (await UsernameExistsAsync(req.Username.Trim(), null, ct))
            throw new BusinessException("帳號已存在", "USERNAME_EXISTS");

        var adminId = Guid.NewGuid();
        using var conn = db.Create();
        conn.Open();
        using var tx = conn.BeginTransaction();
        try
        {
            await conn.ExecuteAsync(new CommandDefinition("""
                INSERT INTO Admins (AdminID, Username, Password, Name)
                VALUES (@adminId, @Username, @Password, @Name)
                """, new { adminId, Username = req.Username.Trim(), req.Password, req.Name }, tx, cancellationToken: ct));

            await InsertAdminLimsAsync(conn, tx, adminId, req.Lims, ct);
            tx.Commit();
            return adminId;
        }
        catch
        {
            try { tx.Rollback(); } catch { /* ignore */ }
            throw;
        }
    }

    public async Task UpdateAsync(Guid adminId, AdminUpsertRequest req, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(req.Username))
            throw new BusinessException("帳號不可空白", "INVALID_USERNAME");
        if (await UsernameExistsAsync(req.Username.Trim(), adminId, ct))
            throw new BusinessException("帳號已存在", "USERNAME_EXISTS");

        using var conn = db.Create();
        conn.Open();
        using var tx = conn.BeginTransaction();
        try
        {
            // Password 空字串 → 保留原密碼（沿用「編輯不強制改密碼」）
            var changePassword = !string.IsNullOrWhiteSpace(req.Password);
            await conn.ExecuteAsync(new CommandDefinition("""
                UPDATE Admins
                SET Username = @Username,
                    Name = @Name,
                    Password = CASE WHEN @changePassword = 1 THEN @Password ELSE Password END
                WHERE AdminID = @adminId
                """, new { adminId, Username = req.Username.Trim(), req.Name, changePassword, req.Password }, tx, cancellationToken: ct));

            // 清空重建 AdminLims（無樂觀鎖，沿用舊系統後寫者勝）
            await conn.ExecuteAsync(new CommandDefinition(
                "DELETE FROM AdminLims WHERE AdminID = @adminId",
                new { adminId }, tx, cancellationToken: ct));
            await InsertAdminLimsAsync(conn, tx, adminId, req.Lims, ct);
            tx.Commit();
        }
        catch
        {
            try { tx.Rollback(); } catch { /* ignore */ }
            throw;
        }
    }

    public async Task DeleteAsync(Guid adminId, CancellationToken ct = default)
    {
        using var conn = db.Create();
        conn.Open();
        using var tx = conn.BeginTransaction();
        try
        {
            await conn.ExecuteAsync(new CommandDefinition(
                "DELETE FROM AdminLims WHERE AdminID = @adminId",
                new { adminId }, tx, cancellationToken: ct));
            await conn.ExecuteAsync(new CommandDefinition(
                "DELETE FROM Admins WHERE AdminID = @adminId",
                new { adminId }, tx, cancellationToken: ct));
            tx.Commit();
        }
        catch
        {
            try { tx.Rollback(); } catch { /* ignore */ }
            throw;
        }
    }

    /// <summary>只寫入有任一旗標為真的權限列（無權限的子功能不建列，沿用舊系統）。</summary>
    private static async Task InsertAdminLimsAsync(
        IDbConnection conn, IDbTransaction tx, Guid adminId, List<AdminLimInputDto>? lims, CancellationToken ct)
    {
        if (lims is null) return;
        foreach (var l in lims)
        {
            if (!l.IsAdd && !l.IsUpdate && !l.IsDelete) continue;
            await conn.ExecuteAsync(new CommandDefinition("""
                INSERT INTO AdminLims (AdminLimID, AdminID, LimID, IsAdd, IsUpdate, IsDelete)
                VALUES (@AdminLimID, @adminId, @LimId, @IsAdd, @IsUpdate, @IsDelete)
                """, new
            {
                AdminLimID = Guid.NewGuid(), adminId, l.LimId, l.IsAdd, l.IsUpdate, l.IsDelete,
            }, tx, cancellationToken: ct));
        }
    }
}
