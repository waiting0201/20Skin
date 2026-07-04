using Dapper;
using Skin.Core.Constants;
using Skin.Core.Dtos;
using Skin.Data;

namespace Skin.Services.Dashboard;

/// <summary>
/// 後台儀表板統計（Dapper，reused DB，schema 不可改）。見 docs/blueprints/admin-dashboard.md。
/// 全部為彙總查詢（COUNT/GROUP BY），無分頁熱路徑；初診判斷沿用預約列表頁的相關子查詢邏輯。
/// </summary>
public sealed class DashboardAdminService(IDbConnectionFactory db) : IDashboardAdminService
{
    /// <summary>趨勢天數（含今日）。</summary>
    private const int TrendDays = 7;

    private static DateTime TaiwanNow => DateTime.UtcNow.AddHours(8);

    public async Task<DashboardDto> GetAsync(
        IReadOnlyList<DashboardBranchInput> branches, bool includeMembers, CancellationToken ct = default)
    {
        var today = TaiwanNow.Date;
        using var conn = db.Create();

        var branchDtos = new List<DashboardBranchDto>();
        var trend = new List<DashboardTrendDayDto>();

        var validBranches = branches.Where(b => b.BranchId != Guid.Empty).ToList();
        if (validBranches.Count > 0)
        {
            var branchIds = validBranches.Select(b => b.BranchId).ToList();

            var titles = (await conn.QueryAsync<(Guid BranchId, string Title)>(new CommandDefinition(
                "SELECT BranchID AS BranchId, Title FROM Branchs WHERE BranchID IN @branchIds",
                new { branchIds }, cancellationToken: ct)))
                .ToDictionary(x => x.BranchId, x => x.Title);

            // 今日各分院×診別×狀態統計；FirstVisitCnt 只對 Status=1 列有意義（初診=該會員有效預約總數<=1，
            // 同 AppointmentAdminService.ListAsync 的動態判斷，不讀 Appointments.IsFirstVisit 欄位）。
            // 初診旗標在衍生表逐列先算再 SUM——SQL Server 不允許彙總函式內含子查詢（Error 130）。
            var todayRows = (await conn.QueryAsync<TodayRow>(new CommandDefinition("""
                SELECT t.BranchId, t.Clinic, t.Status, COUNT(*) AS Cnt, SUM(t.IsFirst) AS FirstVisitCnt
                FROM (
                    SELECT a.BranchID AS BranchId, a.Clinic, a.Status,
                           CASE WHEN (SELECT COUNT(*) FROM Appointments a2
                                      WHERE a2.MemberID = a.MemberID AND a2.Status = 1) <= 1
                                THEN 1 ELSE 0 END AS IsFirst
                    FROM Appointments a
                    WHERE a.BranchID IN @branchIds AND a.AppointmentDate = @today
                ) t
                GROUP BY t.BranchId, t.Clinic, t.Status
                """, new { branchIds, today }, cancellationToken: ct))).AsList();

            foreach (var b in validBranches)
            {
                var rows = todayRows.Where(r => r.BranchId == b.BranchId).ToList();
                var active = rows.Where(r => r.Status == AppointmentStatus.Active).ToList();
                var clinics = active
                    .GroupBy(r => r.Clinic)
                    .Select(g => new DashboardClinicStatDto(g.Key, Clinic.ToTitle(g.Key), g.Sum(r => r.Cnt)))
                    .OrderBy(c => c.Clinic)
                    .ToList();

                branchDtos.Add(new DashboardBranchDto(
                    b.Key,
                    titles.GetValueOrDefault(b.BranchId, b.Key),
                    active.Sum(r => r.Cnt),
                    active.Sum(r => r.FirstVisitCnt),
                    rows.Where(r => r.Status == AppointmentStatus.Cancelled).Sum(r => r.Cnt),
                    clinics));
            }

            // 未來 7 天（含今日）有效預約量趨勢
            var trendEnd = today.AddDays(TrendDays - 1);
            var trendRows = (await conn.QueryAsync<TrendRow>(new CommandDefinition("""
                SELECT BranchID AS BranchId, AppointmentDate, COUNT(*) AS Cnt
                FROM Appointments
                WHERE BranchID IN @branchIds AND AppointmentDate BETWEEN @today AND @trendEnd AND Status = 1
                GROUP BY BranchID, AppointmentDate
                """, new { branchIds, today, trendEnd }, cancellationToken: ct))).AsList();

            for (var i = 0; i < TrendDays; i++)
            {
                var date = today.AddDays(i);
                var perBranch = validBranches.ToDictionary(
                    b => b.Key,
                    b => trendRows.Where(r => r.BranchId == b.BranchId && r.AppointmentDate == date).Sum(r => r.Cnt));
                trend.Add(new DashboardTrendDayDto(date, perBranch.Values.Sum(), perBranch));
            }
        }

        DashboardMemberStatsDto? members = null;
        if (includeMembers)
        {
            var tomorrow = today.AddDays(1);
            var monthStart = new DateTime(today.Year, today.Month, 1);
            members = await conn.QuerySingleAsync<DashboardMemberStatsDto>(new CommandDefinition("""
                SELECT COUNT(*) AS TotalMembers,
                       SUM(CASE WHEN Createdate >= @today AND Createdate < @tomorrow THEN 1 ELSE 0 END) AS TodayNew,
                       SUM(CASE WHEN Createdate >= @monthStart THEN 1 ELSE 0 END) AS MonthNew,
                       SUM(CASE WHEN IsBlackList = 1 THEN 1 ELSE 0 END) AS BlacklistCount
                FROM Members
                """, new { today, tomorrow, monthStart }, cancellationToken: ct));
        }

        return new DashboardDto(today, branchDtos, trend, members);
    }

    private sealed record TodayRow(Guid BranchId, string Clinic, int Status, int Cnt, int FirstVisitCnt);
    private sealed record TrendRow(Guid BranchId, DateTime AppointmentDate, int Cnt);
}
