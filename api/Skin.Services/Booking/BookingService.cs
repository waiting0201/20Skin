using System.Globalization;
using Dapper;
using Skin.Core.Constants;
using Skin.Core.Dtos;
using Skin.Data;
using Skin.Services.BasicData;

namespace Skin.Services.Booking;

public sealed class BookingService(IDbConnectionFactory db, BookingOptions options, PeriodsOptions branchAliases) : IBookingService
{
    private static DateTime TaiwanNow => DateTime.UtcNow.AddHours(8);

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

    /// <summary>
    /// IsAmountLocked：對應舊 Categorys.IsOnly（Ta）/ChIsOnly（Ch）/ChDentistIsOnly（ChDentist），
    /// 依 branchId 解析出的分院別名決定套用哪個旗標；別名查無對應（非此三分院）一律不鎖定。
    /// </summary>
    public async Task<IReadOnlyList<CategoryDto>> GetCategoriesByClinicAsync(Guid branchId, string clinic, CancellationToken ct = default)
    {
        const string sql = """
            SELECT CategoryID AS CategoryId, Clinic, Title, Intro, Photo, IsQuestion, IsOnly, ChIsOnly, ChDentistIsOnly
            FROM Categorys WHERE Clinic = @clinic ORDER BY Sort
            """;
        using var conn = db.Create();
        var rows = await conn.QueryAsync<CategoryRow>(new CommandDefinition(sql, new { clinic }, cancellationToken: ct));

        var alias = branchAliases.AliasFor(branchId);
        return rows.Select(r => new CategoryDto(r.CategoryId, r.Clinic, r.Title, r.Intro, r.Photo, r.IsQuestion,
            IsAmountLocked: alias switch
            {
                "Ta" => r.IsOnly,
                "Ch" => r.ChIsOnly,
                "ChDentist" => r.ChDentistIsOnly,
                _ => false,
            })).ToList();
    }

    public async Task<IReadOnlyList<TimeSlotDto>> GetTimeSlotsAsync(
        Guid branchId, string clinic, Guid categoryId, DateTime date, Guid? doctorId = null, CancellationToken ct = default)
    {
        // 週日不開放預約（沿用舊系統 GetRosters/GetDoctorRosters 的 dt.DayOfWeek != Sunday 判斷）
        if (date.DayOfWeek == DayOfWeek.Sunday) return Array.Empty<TimeSlotDto>();

        var dayStart = date.Date;
        var dayEnd = dayStart.AddDays(1);
        // doctorId=null → 不指定（IsAppointment=0）；有值 → 指定醫師（IsAppointment=1 且 DoctorID=doctorId）。
        // 容量＝RosterPeriods.Patients，已用＝當日該段 Status=1 預約的 Amount（人數）合計，非筆數；
        // 與 AppointmentService.CreateAsync 的容量閘門一致，餘額才會以人數呈現（單筆可多人）。
        // StartNumber（COALESCE 同 CreateAsync 配號來源）用於判斷「配號時段」：
        // 自動配號分院且 StartNumber 有值 → 早晚診呈現＋配號；否則一般時段呈現（見下方 numbered 判斷）。
        const string sql = """
            SELECT p.PeriodID                 AS PeriodId,
                   p.Title                    AS Title,
                   ot.OutpatientTimeID        AS OutpatientTimeId,
                   ot.Title                   AS OutpatientTimeTitle,
                   rp.Patients                AS Capacity,
                   COALESCE(rp.StartNumber, p.StartNumber) AS StartNumber,
                   b.IsAutoRowNumber          AS IsAutoRowNumber,
                   (SELECT COALESCE(SUM(a.Amount), 0) FROM Appointments a
                     WHERE a.PeriodID = p.PeriodID
                       AND a.Status = @active
                       AND a.AppointmentDate >= @dayStart AND a.AppointmentDate < @dayEnd) AS Used
            FROM Rosters r
            JOIN RosterCategorys rc ON rc.RosterID = r.RosterID AND rc.CategoryID = @categoryId
            JOIN RosterPeriods rp   ON rp.RosterID = r.RosterID
            JOIN Periods p          ON p.PeriodID = rp.PeriodID
            JOIN Branchs b          ON b.BranchID = r.BranchID
            LEFT JOIN OutpatientTimes ot ON ot.OutpatientTimeID = p.OutpatientTimeID
            WHERE r.BranchID = @branchId AND r.Clinic = @clinic
              AND r.IsAppointment = @isAppointment
              AND (@doctorId IS NULL OR r.DoctorID = @doctorId)
              AND r.RosterDate >= @dayStart AND r.RosterDate < @dayEnd
            ORDER BY rp.Sort
            """;
        using var conn = db.Create();
        var rows = await conn.QueryAsync<TimeSlotRow>(new CommandDefinition(sql,
            new { branchId, clinic, categoryId, dayStart, dayEnd, doctorId,
                  isAppointment = doctorId.HasValue ? 1 : 0, active = AppointmentStatus.Active }, cancellationToken: ct));

        var now = TaiwanNow;
        var dayAfterTomorrow = now.Date.AddDays(2);
        var results = new List<TimeSlotDto>();
        foreach (var row in rows)
        {
            // 額滿時段直接排除、不回傳（沿用舊系統 GetRosters/GetDoctorRosters：Amount < Patients 才顯示；
            // 額滿不再以「餘 0」呈現）
            if (row.Used >= row.Capacity) continue;

            if (doctorId.HasValue && row.IsAutoRowNumber)
            {
                // 指定醫師 + 自動配號分院：至少提前 2 天（沿用舊系統 GetDoctorRosters；該規則舊系統從未上線，
                // 因指定醫師整體被 1==2 停用，新系統啟用指定醫師功能後一併沿用）
                if (dayStart < dayAfterTomorrow) continue;
            }
            else if (TryGetSlotStart(dayStart, row.Title, out var slotStart) && slotStart <= now)
            {
                continue;
            }
            // 「配號時段」＝自動配號分院 且 StartNumber 有值（台中早/晚診）→ 以早晚診標題呈現；
            // 其餘（二林全部、台中無起始編號的細時段）一律回 null，前端顯示 Periods.Title 時間文字。
            // 不可用「有無綁 OutpatientTimes」判斷：真實資料中二林時段也全綁早上/下午/晚上（見 docs/gotchas.md）。
            var numbered = row.IsAutoRowNumber && row.StartNumber is not null;
            results.Add(new TimeSlotDto(row.PeriodId, row.Title,
                numbered ? row.OutpatientTimeId : null,
                numbered ? row.OutpatientTimeTitle : null,
                row.Capacity, row.Used));
        }
        return results;
    }

    /// <summary>Periods.Title 形如 "9:00~9:30"，取 "~" 前的起始時間；解析失敗則視為無法判斷（不擋）。</summary>
    private static bool TryGetSlotStart(DateTime date, string periodTitle, out DateTime start)
    {
        var startText = periodTitle.Split('~')[0].Trim();
        if (TimeSpan.TryParse(startText, CultureInfo.InvariantCulture, out var ts))
        {
            start = date.Date + ts;
            return true;
        }
        start = default;
        return false;
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
        // 台中分院（Ta 別名）獨立規則：預約日期＝當日一律不可預約，與重複視窗天數設定無關
        // （沿用舊系統 AjaxController.CheckAppointmentDate 對台中分院 cp==0 即 result=false 的判斷）
        if (branchAliases.AliasFor(branchId) == "Ta" && date.Date == TaiwanNow.Date)
            return new CheckAvailabilityResult(false, "台中院不開放預約當日診次，請選擇其他日期");

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

    private sealed class CategoryRow
    {
        public Guid CategoryId { get; set; }
        public string Clinic { get; set; } = "";
        public string Title { get; set; } = "";
        public string? Intro { get; set; }
        public string Photo { get; set; } = "";
        public bool IsQuestion { get; set; }
        public bool IsOnly { get; set; }
        public bool ChIsOnly { get; set; }
        public bool ChDentistIsOnly { get; set; }
    }

    private sealed class TimeSlotRow
    {
        public Guid PeriodId { get; set; }
        public string Title { get; set; } = "";
        public int? OutpatientTimeId { get; set; }
        public string? OutpatientTimeTitle { get; set; }
        public int Capacity { get; set; }
        public int? StartNumber { get; set; }
        public int Used { get; set; }
        public bool IsAutoRowNumber { get; set; }
    }
}
