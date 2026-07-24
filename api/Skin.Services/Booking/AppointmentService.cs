using System.Data;
using System.Text.RegularExpressions;
using Dapper;
using Microsoft.Extensions.Logging;
using Skin.Core;
using Skin.Core.Constants;
using Skin.Core.Dtos;
using Skin.Data;
using Skin.Services.Sms;

namespace Skin.Services.Booking;

public sealed partial class AppointmentService(IDbConnectionFactory db, BookingOptions options, ISmsSender sms, ILogger<AppointmentService> logger)
    : IAppointmentService
{
    private static DateTime TaiwanNow => DateTime.UtcNow.AddHours(8);

    public async Task<CreateAppointmentResult> CreateAsync(Guid memberId, CreateAppointmentRequest req, CancellationToken ct = default)
    {
        if (req.Amount < 1) throw new BusinessException("預約人數至少 1 人", "INVALID_AMOUNT");

        var dayStart = req.AppointmentDate.Date;
        var dayEnd = dayStart.AddDays(1);

        using var conn = db.Create();
        conn.Open();

        // 解析排班 + 容量 + 自動配號旗標 + 是否需問卷
        var ctx = await conn.QueryFirstOrDefaultAsync<RosterCtx>(new CommandDefinition("""
            SELECT TOP 1
                r.RosterID                              AS RosterId,
                rp.Patients                             AS Capacity,
                COALESCE(rp.StartNumber, p.StartNumber) AS StartNumber,
                b.IsAutoRowNumber                       AS IsAutoRowNumber,
                cat.IsQuestion                          AS IsQuestion,
                b.Title                                 AS BranchTitle,
                p.Title                                 AS PeriodTitle
            FROM Rosters r
            JOIN RosterCategorys rc ON rc.RosterID = r.RosterID AND rc.CategoryID = @CategoryId
            JOIN RosterPeriods rp   ON rp.RosterID = r.RosterID AND rp.PeriodID = @PeriodId
            JOIN Periods p          ON p.PeriodID = @PeriodId
            JOIN Branchs b          ON b.BranchID = r.BranchID
            JOIN Categorys cat      ON cat.CategoryID = @CategoryId
            WHERE r.BranchID = @BranchId AND r.Clinic = @Clinic
              AND r.IsAppointment = @IsAppointment
              AND r.RosterDate >= @DayStart AND r.RosterDate < @DayEnd
              AND (@DoctorId IS NULL OR r.DoctorID = @DoctorId)
            """,
            new
            {
                req.CategoryId, req.PeriodId, req.BranchId, req.Clinic,
                IsAppointment = req.IsAppointment, req.DoctorId, dayStart, dayEnd,
            }, cancellationToken: ct));

        if (ctx is null) throw new BusinessException("查無可預約時段", "NO_ROSTER");

        // 問卷強制
        if (ctx.IsQuestion && req.QuestionTypeId is null)
            throw new BusinessException("此項目需先填寫問卷", "QUESTIONNAIRE_REQUIRED");

        // 重複預約限制（依分院視窗，設定驅動）
        var window = options.WindowDaysFor(req.BranchId);
        var dupFrom = dayStart.AddDays(-window);
        var dupTo = dayStart.AddDays(window + 1);
        var dup = await conn.ExecuteScalarAsync<int>(new CommandDefinition("""
            SELECT COUNT(*) FROM Appointments
            WHERE MemberID = @memberId AND BranchID = @BranchId AND Clinic = @Clinic
              AND Status = @active AND AppointmentDate >= @dupFrom AND AppointmentDate < @dupTo
            """, new { memberId, req.BranchId, req.Clinic, active = AppointmentStatus.Active, dupFrom, dupTo }, cancellationToken: ct));
        if (dup > 0)
            throw new BusinessException(window > 0 ? $"前後 {window} 天內已有預約" : "當日已有預約", "DUPLICATE");

        // 會員手機（發簡訊用）+ 初診判斷
        var member = await conn.QueryFirstOrDefaultAsync<MemberRow>(new CommandDefinition("""
            SELECT TOP 1 m.Mobile AS Mobile, m.Name AS Name,
                   (SELECT COUNT(*) FROM Appointments a WHERE a.MemberID = m.MemberID AND a.Status = @active) AS Cnt
            FROM Members m WHERE m.MemberID = @memberId
            """, new { memberId, active = AppointmentStatus.Active }, cancellationToken: ct));
        if (member is null) throw new BusinessException("會員不存在", "MEMBER_NOT_FOUND");
        var isFirstVisit = member.Cnt == 0;

        using var tx = conn.BeginTransaction(IsolationLevel.Serializable);
        try
        {
            // 容量重查（交易內，防超賣）。以「人數」為單位：已用＝當日該段 Status=1 預約的 Amount 合計
            // （非筆數），加上本次 req.Amount 不得超過時段容量 Patients。否則單筆多人預約可塞爆 1 人時段。
            var used = await conn.ExecuteScalarAsync<int>(new CommandDefinition("""
                SELECT COALESCE(SUM(Amount), 0) FROM Appointments
                WHERE PeriodID = @PeriodId AND Status = @active
                  AND AppointmentDate >= @dayStart AND AppointmentDate < @dayEnd
                """, new { req.PeriodId, active = AppointmentStatus.Active, dayStart, dayEnd }, tx, cancellationToken: ct));
            if (used + req.Amount > ctx.Capacity)
            {
                var remaining = Math.Max(0, ctx.Capacity - used);
                throw new BusinessException(
                    remaining > 0 ? $"此時段僅剩 {remaining} 個名額，無法容納 {req.Amount} 人" : "此時段已額滿",
                    "FULL");
            }

            // 自動門診號：限「配號時段」＝自動配號分院 且 時段 StartNumber 有值，從 StartNumber 起每次 +2 取偶數找空缺。
            // StartNumber 為空的時段（台中比照二林的細時段）不配號 → 完成頁/簡訊顯示「請至現場取號」。
            int? outpatientNum = null;
            if (ctx.IsAutoRowNumber && ctx.StartNumber is not null)
            {
                var existing = (await conn.QueryAsync<int>(new CommandDefinition("""
                    SELECT OutpatientNum FROM Appointments
                    WHERE PeriodID = @PeriodId AND Status = @active AND OutpatientNum IS NOT NULL
                      AND AppointmentDate >= @dayStart AND AppointmentDate < @dayEnd
                    ORDER BY OutpatientNum
                    """, new { req.PeriodId, active = AppointmentStatus.Active, dayStart, dayEnd }, tx, cancellationToken: ct))).ToList();
                outpatientNum = NextOutpatientNumber(ctx.StartNumber.Value, existing);
            }

            var appointmentId = Guid.NewGuid();
            var now = TaiwanNow;
            await conn.ExecuteAsync(new CommandDefinition("""
                INSERT INTO Appointments
                    (AppointmentID, MemberID, PeriodID, CategoryID, RosterID, BranchID, DoctorID,
                     QuestionTypeID, Amount, AppointmentDate, Photo, IsFirstVisit, Clinic, OutpatientNum, Status, Createdate)
                VALUES
                    (@appointmentId, @memberId, @PeriodId, @CategoryId, @RosterId, @BranchId, @DoctorId,
                     @QuestionTypeId, @Amount, @AppointmentDate, @Photo, @isFirstVisit, @Clinic, @outpatientNum, @active, @now)
                """,
                new
                {
                    appointmentId, memberId, req.PeriodId, req.CategoryId, ctx.RosterId, req.BranchId, req.DoctorId,
                    req.QuestionTypeId, req.Amount, req.AppointmentDate, req.Photo, isFirstVisit, req.Clinic,
                    outpatientNum, active = AppointmentStatus.Active, now,
                }, tx, cancellationToken: ct));

            // 簡訊雙寫：即時 + 前一天提醒（Status=null 待發；即時列在下方發送、前一天列由 Timer 排程發）。
            // 內容一字不差照舊系統，依診別/是否配號差異化（見 Skin.Services.Sms.SmsDomain）。
            var (immediateBody, reminderBody) = SmsDomain.Compose(
                req.Clinic, ctx.BranchTitle, ctx.PeriodTitle, member.Name, req.AppointmentDate, outpatientNum);
            var immediateId = Guid.NewGuid();
            await conn.ExecuteAsync(new CommandDefinition("""
                INSERT INTO SmsStatus (SmsStatusID, AppointmentID, Mobile, SmsBody, SendDate, Status, CreateDate)
                VALUES (@id, @appointmentId, @mobile, @body, @send, NULL, @now)
                """, new { id = immediateId, appointmentId, mobile = member.Mobile, body = immediateBody, send = (DateTime)now, now }, tx, cancellationToken: ct));
            await conn.ExecuteAsync(new CommandDefinition("""
                INSERT INTO SmsStatus (SmsStatusID, AppointmentID, Mobile, SmsBody, SendDate, Status, CreateDate)
                VALUES (@id, @appointmentId, @mobile, @body, @send, NULL, @now)
                """, new { id = Guid.NewGuid(), appointmentId, mobile = member.Mobile, body = reminderBody,
                    send = req.AppointmentDate.Date.AddDays(-1), now }, tx, cancellationToken: ct));

            tx.Commit();

            // 即時簡訊發送（dev/總開關關閉時注入 NoOp、不真的發）→ 回寫狀態。
            // Status 存供應商原始 status（貼近舊系統），未知時退回 SENT/FAIL。
            var sent = await sms.SendAsync(member.Mobile, immediateBody, ct);
            await conn.ExecuteAsync(new CommandDefinition("""
                UPDATE SmsStatus SET Status = @st, UniqID = @uniq, Message = @msg, UpdateDate = @now
                WHERE SmsStatusID = @id
                """, new { st = sent.RawStatus ?? (sent.Success ? "SENT" : "FAIL"), uniq = sent.UniqId, msg = sent.Message, now = TaiwanNow, id = immediateId }, cancellationToken: ct));

            return new CreateAppointmentResult(appointmentId, outpatientNum);
        }
        catch
        {
            try { tx.Rollback(); } catch { /* ignore */ }
            throw;
        }
    }

    public async Task<(IReadOnlyList<AppointmentListItemDto> Items, int Total)> GetMineAsync(
        Guid memberId, int page, int pageSize, CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var offset = (page - 1) * pageSize;

        using var conn = db.Create();
        var total = await conn.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT COUNT(*) FROM Appointments WHERE MemberID = @memberId",
            new { memberId }, cancellationToken: ct));

        var items = await conn.QueryAsync<AppointmentListItemDto>(new CommandDefinition("""
            SELECT a.AppointmentID AS AppointmentId, a.AppointmentDate, a.Clinic,
                   b.Title AS BranchTitle, c.Title AS CategoryTitle, a.OutpatientNum, a.Status
            FROM Appointments a
            LEFT JOIN Branchs b   ON b.BranchID = a.BranchID
            LEFT JOIN Categorys c ON c.CategoryID = a.CategoryID
            WHERE a.MemberID = @memberId
            ORDER BY a.AppointmentDate DESC
            OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
            """, new { memberId, offset, pageSize }, cancellationToken: ct));

        return (items.AsList(), total);
    }

    public async Task<AppointmentDetailDto?> GetByIdAsync(Guid memberId, Guid appointmentId, CancellationToken ct = default)
    {
        using var conn = db.Create();
        // 歸屬檢查：MemberID 條件，非本人查不到（修 IDOR）。
        // PeriodTitle：「配號時段」（自動配號分院 且 COALESCE(rp.StartNumber, p.StartNumber) 有值，同 CreateAsync 配號條件）
        // 才顯示早晚診標題，其餘顯示 Periods.Title 時間文字（對齊舊 Complete.cshtml 對台中健保的分支；
        // 不可用「有無綁 OutpatientTimes」判斷，二林時段也全綁早上/下午/晚上，見 docs/gotchas.md）。
        // QuestionAnswered：比照舊系統 Complete.cshtml／AppointmentDetail.cshtml，以 Appointments.QuestionTypeID 是否已寫入判斷已填/未填。
        return await conn.QueryFirstOrDefaultAsync<AppointmentDetailDto>(new CommandDefinition("""
            SELECT a.AppointmentID AS AppointmentId, a.AppointmentDate, a.Clinic,
                   b.BranchID AS BranchId, b.Title AS BranchTitle,
                   c.Title AS CategoryTitle, d.Name AS DoctorName,
                   CASE WHEN b.IsAutoRowNumber = 1 AND COALESCE(rp.StartNumber, p.StartNumber) IS NOT NULL
                        THEN COALESCE(ot.Title, p.Title) ELSE p.Title END AS PeriodTitle,
                   a.Amount, a.OutpatientNum, a.IsFirstVisit, a.Status, a.QuestionTypeID AS QuestionTypeId, a.Photo,
                   CAST(COALESCE(c.IsQuestion, 0) AS BIT) AS IsQuestion,
                   CAST(CASE WHEN a.QuestionTypeID IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS QuestionAnswered
            FROM Appointments a
            LEFT JOIN Branchs b   ON b.BranchID = a.BranchID
            LEFT JOIN Categorys c ON c.CategoryID = a.CategoryID
            LEFT JOIN Doctors d   ON d.DoctorID = a.DoctorID
            LEFT JOIN Periods p   ON p.PeriodID = a.PeriodID
            LEFT JOIN RosterPeriods rp ON rp.RosterID = a.RosterID AND rp.PeriodID = a.PeriodID
            LEFT JOIN OutpatientTimes ot ON ot.OutpatientTimeID = p.OutpatientTimeID
            WHERE a.AppointmentID = @appointmentId AND a.MemberID = @memberId
            """, new { appointmentId, memberId }, cancellationToken: ct));
    }

    public async Task<(bool Ok, string? Message)> CancelAsync(Guid memberId, Guid appointmentId, CancellationToken ct = default)
    {
        using var conn = db.Create();
        conn.Open();

        var appt = await conn.QueryFirstOrDefaultAsync<CancelRow>(new CommandDefinition("""
            SELECT a.AppointmentDate, a.Status, p.Title AS PeriodTitle
            FROM Appointments a
            LEFT JOIN Periods p ON p.PeriodID = a.PeriodID
            WHERE a.AppointmentID = @appointmentId AND a.MemberID = @memberId
            """, new { appointmentId, memberId }, cancellationToken: ct));
        if (appt is null)
            return (false, "找不到預約");
        if (appt.Status != AppointmentStatus.Active)
            return (false, "此預約無法取消");

        var now = TaiwanNow;
        DateTime visitTime;
        if (appt.PeriodTitle is not null && TryGetSlotStart(appt.PeriodTitle, out var slotStart))
        {
            // 依 Periods.Title（如 "9:00~9:30"）解析出的實際看診時刻判斷（取代 AppointmentDate+1hr 簡化版）
            visitTime = appt.AppointmentDate.Date + slotStart;
        }
        else
        {
            // 防禦性 fallback：解析失敗（資料格式異常）不可讓例外往外拋，退回舊有「當天禁止取消」簡化規則並記警告 log
            logger.LogWarning(
                "取消預約時無法解析時段起始時間，退回 AppointmentDate+1hr 簡化規則。appointmentId={AppointmentId} periodTitle={PeriodTitle}",
                appointmentId, appt.PeriodTitle);
            visitTime = appt.AppointmentDate;
        }
        if (visitTime <= now.AddHours(1))
            return (false, "預約前 1 小時內無法取消");

        using var tx = conn.BeginTransaction();
        try
        {
            await conn.ExecuteAsync(new CommandDefinition(
                "UPDATE Appointments SET Status = @cancelled WHERE AppointmentID = @appointmentId",
                new { cancelled = AppointmentStatus.Cancelled, appointmentId }, tx, cancellationToken: ct));
            // 未發送的簡訊標記 CANCEL（不再發）
            await conn.ExecuteAsync(new CommandDefinition("""
                UPDATE SmsStatus SET Status = @cancel, UpdateDate = @now
                WHERE AppointmentID = @appointmentId AND Status IS NULL
                """, new { cancel = SmsStatusValue.Cancel, now = TaiwanNow, appointmentId }, tx, cancellationToken: ct));
            tx.Commit();
            return (true, "取消成功");
        }
        catch
        {
            try { tx.Rollback(); } catch { /* ignore */ }
            throw;
        }
    }

    /// <summary>
    /// Periods.Title 形如 "9:00~9:30"，擷取開頭 H:mm/HH:mm 作為看診起始時間；
    /// 解析失敗回 false（不拋例外——舊系統原始 DateTime.Parse 在多數格式下會直接拋例外，屬舊系統本身 bug，此處不複製）。
    /// </summary>
    private static bool TryGetSlotStart(string periodTitle, out TimeSpan start)
    {
        var match = SlotStartRegex().Match(periodTitle);
        if (match.Success
            && int.TryParse(match.Groups[1].Value, out var hour) && hour is >= 0 and < 24
            && int.TryParse(match.Groups[2].Value, out var minute) && minute is >= 0 and < 60)
        {
            start = new TimeSpan(hour, minute, 0);
            return true;
        }
        start = default;
        return false;
    }

    [GeneratedRegex(@"^\s*(\d{1,2}):(\d{2})")]
    private static partial Regex SlotStartRegex();

    /// <summary>從 startNumber 起每次 +2 取偶數，找第一個空缺（沿用舊系統演算法）。</summary>
    internal static int NextOutpatientNumber(int startNumber, IReadOnlyList<int> existingSorted)
    {
        var pcount = startNumber;
        var last = int.MinValue;
        foreach (var i in existingSorted)
        {
            if (i == last) continue;
            last = i;
            if (i == pcount) pcount += 2;
            else break;
        }
        return pcount;
    }

    private sealed class RosterCtx
    {
        public Guid RosterId { get; set; }
        public int Capacity { get; set; }
        public int? StartNumber { get; set; }
        public bool IsAutoRowNumber { get; set; }
        public bool IsQuestion { get; set; }
        public string BranchTitle { get; set; } = "";  // 簡訊文案用（Branchs.Title）
        public string PeriodTitle { get; set; } = "";   // 簡訊文案用（Periods.Title）
    }

    private sealed class MemberRow
    {
        public string Mobile { get; set; } = "";
        public string Name { get; set; } = "";  // 簡訊文案用（齒科）
        public int Cnt { get; set; }
    }

    private sealed class CancelRow
    {
        public DateTime AppointmentDate { get; set; }
        public int Status { get; set; }
        public string? PeriodTitle { get; set; }
    }
}
