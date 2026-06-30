using System.Data;
using Dapper;
using Skin.Core;
using Skin.Core.Constants;
using Skin.Core.Dtos;
using Skin.Data;
using Skin.Services.Sms;

namespace Skin.Services.Booking;

public sealed class AppointmentService(IDbConnectionFactory db, BookingOptions options, ISmsSender sms)
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
                cat.IsQuestion                          AS IsQuestion
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
            SELECT TOP 1 m.Mobile AS Mobile,
                   (SELECT COUNT(*) FROM Appointments a WHERE a.MemberID = m.MemberID AND a.Status = @active) AS Cnt
            FROM Members m WHERE m.MemberID = @memberId
            """, new { memberId, active = AppointmentStatus.Active }, cancellationToken: ct));
        if (member is null) throw new BusinessException("會員不存在", "MEMBER_NOT_FOUND");
        var isFirstVisit = member.Cnt == 0;

        using var tx = conn.BeginTransaction(IsolationLevel.Serializable);
        try
        {
            // 容量重查（交易內，防超賣）
            var used = await conn.ExecuteScalarAsync<int>(new CommandDefinition("""
                SELECT COUNT(*) FROM Appointments
                WHERE PeriodID = @PeriodId AND Status = @active
                  AND AppointmentDate >= @dayStart AND AppointmentDate < @dayEnd
                """, new { req.PeriodId, active = AppointmentStatus.Active, dayStart, dayEnd }, tx, cancellationToken: ct));
            if (used >= ctx.Capacity)
                throw new BusinessException("此時段已額滿", "FULL");

            // 自動門診號（IsAutoRowNumber）：從 StartNumber 起每次 +2 取偶數找空缺
            int? outpatientNum = null;
            if (ctx.IsAutoRowNumber)
            {
                var existing = (await conn.QueryAsync<int>(new CommandDefinition("""
                    SELECT OutpatientNum FROM Appointments
                    WHERE PeriodID = @PeriodId AND Status = @active AND OutpatientNum IS NOT NULL
                      AND AppointmentDate >= @dayStart AND AppointmentDate < @dayEnd
                    ORDER BY OutpatientNum
                    """, new { req.PeriodId, active = AppointmentStatus.Active, dayStart, dayEnd }, tx, cancellationToken: ct))).ToList();
                outpatientNum = NextOutpatientNumber(ctx.StartNumber ?? 2, existing);
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

            // 簡訊雙寫：即時 + 前一天提醒（Status=null 待發；實際發送見下方/排程，dev 不真發）
            var body = $"【20skin】您已預約 {req.AppointmentDate:yyyy-MM-dd} {Clinic.ToTitle(req.Clinic)}"
                       + (outpatientNum is null ? "，請至現場取號。" : $"，看診號碼 {outpatientNum} 號。");
            var immediateId = Guid.NewGuid();
            await conn.ExecuteAsync(new CommandDefinition("""
                INSERT INTO SmsStatus (SmsStatusID, AppointmentID, Mobile, SmsBody, SendDate, Status, CreateDate)
                VALUES (@id, @appointmentId, @mobile, @body, @send, NULL, @now)
                """, new { id = immediateId, appointmentId, mobile = member.Mobile, body, send = (DateTime)now, now }, tx, cancellationToken: ct));
            await conn.ExecuteAsync(new CommandDefinition("""
                INSERT INTO SmsStatus (SmsStatusID, AppointmentID, Mobile, SmsBody, SendDate, Status, CreateDate)
                VALUES (@id, @appointmentId, @mobile, @body, @send, NULL, @now)
                """, new { id = Guid.NewGuid(), appointmentId, mobile = member.Mobile, body,
                    send = req.AppointmentDate.Date.AddDays(-1), now }, tx, cancellationToken: ct));

            tx.Commit();

            // 即時簡訊「發送」（dev no-op：不真的發）→ 回寫狀態
            var sent = await sms.SendAsync(member.Mobile, body, ct);
            await conn.ExecuteAsync(new CommandDefinition("""
                UPDATE SmsStatus SET Status = @st, UniqID = @uniq, Message = @msg, UpdateDate = @now
                WHERE SmsStatusID = @id
                """, new { st = sent.Success ? "DEV" : "FAIL", uniq = sent.UniqId, msg = sent.Message, now = TaiwanNow, id = immediateId }, cancellationToken: ct));

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
        // 歸屬檢查：MemberID 條件，非本人查不到（修 IDOR）
        return await conn.QueryFirstOrDefaultAsync<AppointmentDetailDto>(new CommandDefinition("""
            SELECT a.AppointmentID AS AppointmentId, a.AppointmentDate, a.Clinic,
                   b.Title AS BranchTitle, c.Title AS CategoryTitle, d.Name AS DoctorName,
                   p.Title AS PeriodTitle, a.Amount, a.OutpatientNum, a.IsFirstVisit, a.Status, a.QuestionTypeID AS QuestionTypeId
            FROM Appointments a
            LEFT JOIN Branchs b   ON b.BranchID = a.BranchID
            LEFT JOIN Categorys c ON c.CategoryID = a.CategoryID
            LEFT JOIN Doctors d   ON d.DoctorID = a.DoctorID
            LEFT JOIN Periods p   ON p.PeriodID = a.PeriodID
            WHERE a.AppointmentID = @appointmentId AND a.MemberID = @memberId
            """, new { appointmentId, memberId }, cancellationToken: ct));
    }

    public async Task<(bool Ok, string? Message)> CancelAsync(Guid memberId, Guid appointmentId, CancellationToken ct = default)
    {
        using var conn = db.Create();
        conn.Open();

        var appt = await conn.QueryFirstOrDefaultAsync<CancelRow>(new CommandDefinition(
            "SELECT AppointmentDate, Status FROM Appointments WHERE AppointmentID = @appointmentId AND MemberID = @memberId",
            new { appointmentId, memberId }, cancellationToken: ct));
        if (appt is null)
            return (false, "找不到預約");
        if (appt.Status != AppointmentStatus.Active)
            return (false, "此預約無法取消");
        if (appt.AppointmentDate <= TaiwanNow.AddHours(1))
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
    }

    private sealed class MemberRow
    {
        public string Mobile { get; set; } = "";
        public int Cnt { get; set; }
    }

    private sealed class CancelRow
    {
        public DateTime AppointmentDate { get; set; }
        public int Status { get; set; }
    }
}
