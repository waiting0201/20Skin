using Dapper;
using Skin.Core;
using Skin.Core.Dtos;
using Skin.Data;

namespace Skin.Services.Roster;

/// <summary>排班主檔 CRUD + 重複展開（Dapper，reused DB，schema 不可改）。</summary>
public sealed class RosterAdminService(IDbConnectionFactory db) : IRosterAdminService
{
    private sealed record RosterRow(Guid RosterId, Guid BranchId, Guid? DoctorId, string? DoctorName, int? OutpatientTimeId, string? OutpatientTimeTitle, DateTime RosterDate, string Clinic, bool IsAppointment);

    private static void ValidateCategoriesAndPeriods(List<Guid> categoryIds, List<RosterPeriodInput> periods)
    {
        if (categoryIds is null || categoryIds.Count == 0)
            throw new BusinessException("至少需要選擇一個科別項目", "CATEGORIES_REQUIRED");
        if (periods is null || periods.Count == 0)
            throw new BusinessException("至少需要一個時段設定", "PERIODS_REQUIRED");
        foreach (var p in periods)
        {
            if (p.Patients < 0)
                throw new BusinessException("容量不可為負數", "INVALID_PATIENTS");
        }
    }

    private static List<DateTime> BuildDates(DateTime start, int repeatMode, DateTime? expireDate)
    {
        var dates = new List<DateTime> { start.Date };
        if (repeatMode == 0) return dates;

        if (repeatMode != 1 && repeatMode != 2)
            throw new BusinessException("重複模式僅支援 0(不重複)/1(每日)/2(每週)", "INVALID_REPEAT_MODE");
        if (expireDate is null)
            throw new BusinessException("重複排班需設定截止日", "EXPIRE_DATE_REQUIRED");
        if (expireDate.Value.Date < start.Date)
            throw new BusinessException("截止日不可早於排班日期", "INVALID_EXPIRE_DATE");

        var step = repeatMode == 1 ? 1 : 7;
        var next = start.Date.AddDays(step);
        while (next <= expireDate.Value.Date)
        {
            dates.Add(next);
            next = next.AddDays(step);
        }
        return dates;
    }

    public async Task<(IReadOnlyList<RosterListItemDto> Items, int Total)> ListAsync(
        Guid branchId, string clinic, DateTime? date, Guid? doctorId, int page, int pageSize, CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var offset = (page - 1) * pageSize;

        using var conn = db.Create();
        var total = await conn.ExecuteScalarAsync<int>(new CommandDefinition("""
            SELECT COUNT(*) FROM Rosters r
            WHERE r.BranchID = @branchId AND r.Clinic = @clinic
              AND (@date IS NULL OR r.RosterDate = @date)
              AND (@doctorId IS NULL OR r.DoctorID = @doctorId)
            """, new { branchId, clinic, date, doctorId }, cancellationToken: ct));

        var items = await conn.QueryAsync<RosterListItemDto>(new CommandDefinition("""
            SELECT r.RosterID AS RosterId, r.RosterDate, r.DoctorID AS DoctorId, d.Name AS DoctorName,
                   r.OutpatientTimeID AS OutpatientTimeId, ot.Title AS OutpatientTimeTitle, r.IsAppointment
            FROM Rosters r
            LEFT JOIN Doctors d ON d.DoctorID = r.DoctorID
            LEFT JOIN OutpatientTimes ot ON ot.OutpatientTimeID = r.OutpatientTimeID
            WHERE r.BranchID = @branchId AND r.Clinic = @clinic
              AND (@date IS NULL OR r.RosterDate = @date)
              AND (@doctorId IS NULL OR r.DoctorID = @doctorId)
            ORDER BY r.RosterDate DESC, r.DoctorID, r.OutpatientTimeID
            OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
            """, new { branchId, clinic, date, doctorId, offset, pageSize }, cancellationToken: ct));

        return (items.AsList(), total);
    }

    public async Task<RosterAdminDto?> GetAsync(Guid id, CancellationToken ct = default)
    {
        using var conn = db.Create();
        var roster = await conn.QueryFirstOrDefaultAsync<RosterRow>(new CommandDefinition("""
            SELECT r.RosterID AS RosterId, r.BranchID AS BranchId, r.DoctorID AS DoctorId, d.Name AS DoctorName,
                   r.OutpatientTimeID AS OutpatientTimeId, ot.Title AS OutpatientTimeTitle,
                   r.RosterDate, r.Clinic, r.IsAppointment
            FROM Rosters r
            LEFT JOIN Doctors d ON d.DoctorID = r.DoctorID
            LEFT JOIN OutpatientTimes ot ON ot.OutpatientTimeID = r.OutpatientTimeID
            WHERE r.RosterID = @id
            """, new { id }, cancellationToken: ct));
        if (roster is null) return null;

        var categoryIds = (await conn.QueryAsync<Guid>(new CommandDefinition(
            "SELECT CategoryID FROM RosterCategorys WHERE RosterID = @id", new { id }, cancellationToken: ct))).AsList();

        var periods = (await conn.QueryAsync<RosterPeriodAdminDto>(new CommandDefinition("""
            SELECT rp.PeriodID AS PeriodId, p.Title AS PeriodTitle, rp.StartNumber, rp.Patients, rp.Sort
            FROM RosterPeriods rp JOIN Periods p ON p.PeriodID = rp.PeriodID
            WHERE rp.RosterID = @id ORDER BY rp.Sort
            """, new { id }, cancellationToken: ct))).AsList();

        return new RosterAdminDto(roster.RosterId, roster.BranchId, roster.DoctorId, roster.DoctorName,
            roster.OutpatientTimeId, roster.OutpatientTimeTitle, roster.RosterDate, roster.Clinic, roster.IsAppointment,
            categoryIds, periods);
    }

    /// <summary>
    /// 新增排班（可展開）。每天即時查重：同分院+醫師+診別+日期已存在的排班若含任一送出的科別，
    /// 該天整批跳過（all-or-nothing）；沿用舊系統邏輯，但改為明確回報跳過的日期（見 IRosterAdminService）。
    /// 每個時段皆正確帶入 StartNumber（修正舊系統展開時遺漏該欄位的 bug）。
    /// </summary>
    public async Task<RosterCreateResult> CreateAsync(Guid branchId, string clinic, RosterCreateRequest req, CancellationToken ct = default)
    {
        ValidateCategoriesAndPeriods(req.CategoryIds, req.Periods);
        var dates = BuildDates(req.RosterDate, req.RepeatMode, req.ExpireDate);

        var created = new List<DateTime>();
        var skipped = new List<DateTime>();

        using var conn = db.Create();
        conn.Open();
        using var tx = conn.BeginTransaction();
        try
        {
            foreach (var date in dates)
            {
                var existingCategoryIds = (await conn.QueryAsync<Guid>(new CommandDefinition("""
                    SELECT DISTINCT rc.CategoryID
                    FROM Rosters r JOIN RosterCategorys rc ON rc.RosterID = r.RosterID
                    WHERE r.BranchID = @branchId AND r.Clinic = @clinic AND r.RosterDate = @date
                      AND (r.DoctorID = @doctorId OR (@doctorId IS NULL AND r.DoctorID IS NULL))
                    """, new { branchId, clinic, date, doctorId = req.DoctorId }, tx, cancellationToken: ct))).ToHashSet();

                if (existingCategoryIds.Overlaps(req.CategoryIds))
                {
                    skipped.Add(date);
                    continue;
                }

                var rosterId = Guid.NewGuid();
                await conn.ExecuteAsync(new CommandDefinition("""
                    INSERT INTO Rosters (RosterID, BranchID, DoctorID, OutpatientTimeID, RosterDate, IsAppointment, Clinic)
                    VALUES (@rosterId, @branchId, @doctorId, @outpatientTimeId, @date, @isAppointment, @clinic)
                    """, new
                {
                    rosterId, branchId, doctorId = req.DoctorId, outpatientTimeId = req.OutpatientTimeId,
                    date, isAppointment = req.IsAppointment, clinic,
                }, tx, cancellationToken: ct));

                foreach (var categoryId in req.CategoryIds)
                {
                    await conn.ExecuteAsync(new CommandDefinition(
                        "INSERT INTO RosterCategorys (RosterCategoryID, RosterID, CategoryID) VALUES (@rcId, @rosterId, @categoryId)",
                        new { rcId = Guid.NewGuid(), rosterId, categoryId }, tx, cancellationToken: ct));
                }

                var sort = 0;
                foreach (var period in req.Periods)
                {
                    sort++;
                    await conn.ExecuteAsync(new CommandDefinition("""
                        INSERT INTO RosterPeriods (RosterPeriodID, RosterID, PeriodID, StartNumber, Patients, Sort)
                        VALUES (@rpId, @rosterId, @periodId, @startNumber, @patients, @sort)
                        """, new
                    {
                        rpId = Guid.NewGuid(), rosterId, periodId = period.PeriodId,
                        startNumber = period.StartNumber, patients = period.Patients, sort,
                    }, tx, cancellationToken: ct));
                }

                created.Add(date);
            }
            tx.Commit();
            return new RosterCreateResult(created, skipped);
        }
        catch
        {
            try { tx.Rollback(); } catch { /* ignore */ }
            throw;
        }
    }

    /// <summary>
    /// 編輯排班：主表欄位直接覆寫；RosterCategorys 以 CategoryID 為鍵 diff；
    /// RosterPeriods 以 PeriodID 為鍵 diff（含正確更新 StartNumber，修正舊系統只更新 Patients 的 bug）。
    /// </summary>
    public async Task UpdateAsync(Guid id, RosterUpdateRequest req, CancellationToken ct = default)
    {
        ValidateCategoriesAndPeriods(req.CategoryIds, req.Periods);

        using var conn = db.Create();
        conn.Open();
        using var tx = conn.BeginTransaction();
        try
        {
            var affected = await conn.ExecuteAsync(new CommandDefinition("""
                UPDATE Rosters SET DoctorID = @DoctorId, OutpatientTimeID = @OutpatientTimeId, IsAppointment = @IsAppointment
                WHERE RosterID = @id
                """, new { id, req.DoctorId, req.OutpatientTimeId, req.IsAppointment }, tx, cancellationToken: ct));
            if (affected == 0)
                throw new BusinessException("找不到排班", "NOT_FOUND");

            // --- RosterCategorys diff ---
            var existingCategoryIds = (await conn.QueryAsync<Guid>(new CommandDefinition(
                "SELECT CategoryID FROM RosterCategorys WHERE RosterID = @id", new { id }, tx, cancellationToken: ct))).ToHashSet();
            var incomingCategoryIds = req.CategoryIds.ToHashSet();

            var categoriesToRemove = existingCategoryIds.Except(incomingCategoryIds).ToList();
            if (categoriesToRemove.Count > 0)
            {
                await conn.ExecuteAsync(new CommandDefinition(
                    "DELETE FROM RosterCategorys WHERE RosterID = @id AND CategoryID IN @categoriesToRemove",
                    new { id, categoriesToRemove }, tx, cancellationToken: ct));
            }
            foreach (var categoryId in incomingCategoryIds.Except(existingCategoryIds))
            {
                await conn.ExecuteAsync(new CommandDefinition(
                    "INSERT INTO RosterCategorys (RosterCategoryID, RosterID, CategoryID) VALUES (@rcId, @id, @categoryId)",
                    new { rcId = Guid.NewGuid(), id, categoryId }, tx, cancellationToken: ct));
            }

            // --- RosterPeriods diff（自然鍵 PeriodID：一個 Roster 對一個 Period 本來就是 1:1）---
            var existingPeriodIds = (await conn.QueryAsync<Guid>(new CommandDefinition(
                "SELECT PeriodID FROM RosterPeriods WHERE RosterID = @id", new { id }, tx, cancellationToken: ct))).ToHashSet();
            var incomingPeriodIds = req.Periods.Select(p => p.PeriodId).ToHashSet();

            var periodsToRemove = existingPeriodIds.Except(incomingPeriodIds).ToList();
            if (periodsToRemove.Count > 0)
            {
                await conn.ExecuteAsync(new CommandDefinition(
                    "DELETE FROM RosterPeriods WHERE RosterID = @id AND PeriodID IN @periodsToRemove",
                    new { id, periodsToRemove }, tx, cancellationToken: ct));
            }

            var sort = 0;
            foreach (var period in req.Periods)
            {
                sort++;
                if (existingPeriodIds.Contains(period.PeriodId))
                {
                    await conn.ExecuteAsync(new CommandDefinition("""
                        UPDATE RosterPeriods SET StartNumber = @StartNumber, Patients = @Patients, Sort = @sort
                        WHERE RosterID = @id AND PeriodID = @PeriodId
                        """, new { id, period.PeriodId, period.StartNumber, period.Patients, sort }, tx, cancellationToken: ct));
                }
                else
                {
                    await conn.ExecuteAsync(new CommandDefinition("""
                        INSERT INTO RosterPeriods (RosterPeriodID, RosterID, PeriodID, StartNumber, Patients, Sort)
                        VALUES (@rpId, @id, @PeriodId, @StartNumber, @Patients, @sort)
                        """, new { rpId = Guid.NewGuid(), id, period.PeriodId, period.StartNumber, period.Patients, sort }, tx, cancellationToken: ct));
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

    /// <summary>刪除前檢查：有任何 Appointments 引用（不論狀態）即擋（比舊系統嚴格，見 blueprint 設計決策）。</summary>
    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        using var conn = db.Create();
        var refs = await conn.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT COUNT(*) FROM Appointments WHERE RosterID = @id", new { id }, cancellationToken: ct));
        if (refs > 0)
            throw new BusinessException("排班已有預約引用，無法刪除", "ROSTER_IN_USE");

        var affected = await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM Rosters WHERE RosterID = @id", new { id }, cancellationToken: ct));
        if (affected == 0)
            throw new BusinessException("找不到排班", "NOT_FOUND");
    }
}
