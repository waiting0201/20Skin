using Dapper;
using Skin.Core.Constants;
using Skin.Core.Dtos;
using Skin.Data;

namespace Skin.Services.Booking;

public sealed class BookingService(IDbConnectionFactory db, BookingOptions options) : IBookingService
{
    public async Task<IReadOnlyList<BranchDto>> GetEnabledBranchesAsync(CancellationToken ct = default)
    {
        const string sql = """
            SELECT BranchID AS BranchId, Title, BranchType, Photo, IsAutoRowNumber
            FROM Branchs WHERE IsEnabled = 1 ORDER BY Sort
            """;
        using var conn = db.Create();
        var rows = await conn.QueryAsync<BranchDto>(new CommandDefinition(sql, cancellationToken: ct));
        return rows.AsList();
    }

    public async Task<IReadOnlyList<CategoryDto>> GetCategoriesByClinicAsync(string clinic, CancellationToken ct = default)
    {
        const string sql = """
            SELECT CategoryID AS CategoryId, Clinic, Title, Intro, Photo, IsQuestion
            FROM Categorys WHERE Clinic = @clinic ORDER BY Sort
            """;
        using var conn = db.Create();
        var rows = await conn.QueryAsync<CategoryDto>(new CommandDefinition(sql, new { clinic }, cancellationToken: ct));
        return rows.AsList();
    }

    public async Task<IReadOnlyList<TimeSlotDto>> GetTimeSlotsAsync(
        Guid branchId, string clinic, Guid categoryId, DateTime date, CancellationToken ct = default)
    {
        var dayStart = date.Date;
        var dayEnd = dayStart.AddDays(1);
        // 不指定醫師（IsAppointment=0）的排班；容量＝RosterPeriods.Patients，已用＝當日該段 Status=1 預約數。
        const string sql = """
            SELECT p.PeriodID                 AS PeriodId,
                   p.Title                    AS Title,
                   ot.OutpatientTimeID        AS OutpatientTimeId,
                   ot.Title                   AS OutpatientTimeTitle,
                   rp.Patients                AS Capacity,
                   (SELECT COUNT(*) FROM Appointments a
                     WHERE a.PeriodID = p.PeriodID
                       AND a.Status = @active
                       AND a.AppointmentDate >= @dayStart AND a.AppointmentDate < @dayEnd) AS Used
            FROM Rosters r
            JOIN RosterCategorys rc ON rc.RosterID = r.RosterID AND rc.CategoryID = @categoryId
            JOIN RosterPeriods rp   ON rp.RosterID = r.RosterID
            JOIN Periods p          ON p.PeriodID = rp.PeriodID
            LEFT JOIN OutpatientTimes ot ON ot.OutpatientTimeID = p.OutpatientTimeID
            WHERE r.BranchID = @branchId AND r.Clinic = @clinic
              AND r.IsAppointment = 0
              AND r.RosterDate >= @dayStart AND r.RosterDate < @dayEnd
            ORDER BY rp.Sort
            """;
        using var conn = db.Create();
        var rows = await conn.QueryAsync<TimeSlotDto>(new CommandDefinition(sql,
            new { branchId, clinic, categoryId, dayStart, dayEnd, active = AppointmentStatus.Active }, cancellationToken: ct));
        return rows.AsList();
    }

    public async Task<IReadOnlyList<DoctorDto>> GetDoctorsAsync(
        Guid branchId, string clinic, Guid categoryId, DateTime date, CancellationToken ct = default)
    {
        var dayStart = date.Date;
        var dayEnd = dayStart.AddDays(1);
        const string sql = """
            SELECT DISTINCT d.DoctorID AS DoctorId, d.Name
            FROM Rosters r
            JOIN RosterCategorys rc ON rc.RosterID = r.RosterID AND rc.CategoryID = @categoryId
            JOIN Doctors d ON d.DoctorID = r.DoctorID
            WHERE r.BranchID = @branchId AND r.Clinic = @clinic
              AND r.IsAppointment = 1 AND r.DoctorID IS NOT NULL
              AND r.RosterDate >= @dayStart AND r.RosterDate < @dayEnd
            ORDER BY d.Name
            """;
        using var conn = db.Create();
        var rows = await conn.QueryAsync<DoctorDto>(new CommandDefinition(sql,
            new { branchId, clinic, categoryId, dayStart, dayEnd }, cancellationToken: ct));
        return rows.AsList();
    }

    public async Task<CheckAvailabilityResult> CheckDuplicateAsync(
        Guid memberId, Guid branchId, string clinic, DateTime date, CancellationToken ct = default)
    {
        var window = options.WindowDaysFor(branchId);
        var from = date.Date.AddDays(-window);
        var to = date.Date.AddDays(window + 1); // 含視窗末日整天
        const string sql = """
            SELECT COUNT(*) FROM Appointments
            WHERE MemberID = @memberId AND BranchID = @branchId AND Clinic = @clinic
              AND Status = @active
              AND AppointmentDate >= @from AND AppointmentDate < @to
            """;
        using var conn = db.Create();
        var count = await conn.ExecuteScalarAsync<int>(new CommandDefinition(sql,
            new { memberId, branchId, clinic, active = AppointmentStatus.Active, from, to }, cancellationToken: ct));

        return count > 0
            ? new CheckAvailabilityResult(false, window > 0 ? $"前後 {window} 天內已有預約" : "當日已有預約")
            : new CheckAvailabilityResult(true);
    }
}
