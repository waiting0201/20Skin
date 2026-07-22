using System.Globalization;
using ClosedXML.Excel;
using Dapper;
using Skin.Core;
using Skin.Core.Constants;
using Skin.Core.Dtos;
using Skin.Data;
using Skin.Services.Question;

namespace Skin.Services.Reserve;

/// <summary>後台預約管理（Dapper，reused DB，schema 不可改）。見 docs/blueprints/admin-reserve.md。</summary>
public sealed class AppointmentAdminService(IDbConnectionFactory db, IQuestionService questions) : IAppointmentAdminService
{
    // 舊系統 ToPagedList(pageSize: 50) 寫死 50，非其他模組常見的 20，這裡刻意維持沿用。
    private const int PageSize = 50;

    private static readonly CultureInfo RocCulture = new("zh-TW") { DateTimeFormat = { Calendar = new TaiwanCalendar() } };

    public async Task<AppointmentAdminListResultDto> ListAsync(
        Guid branchId, string? clinic, Guid? categoryId, DateTime? appointmentDate,
        string? memberNumber, string? memberMobile, string? memberName, DateTime? birthday,
        int page, CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        var offset = (page - 1) * PageSize;

        var normalizedNumber = string.IsNullOrWhiteSpace(memberNumber) ? null : memberNumber.Trim();
        var normalizedMobile = string.IsNullOrWhiteSpace(memberMobile) ? null : memberMobile.Trim();
        var normalizedName = string.IsNullOrWhiteSpace(memberName) ? null : memberName.Trim();
        var dateOnly = appointmentDate?.Date;
        var birthdayOnly = birthday?.Date;

        using var conn = db.Create();

        const string where = """
            WHERE a.BranchID = @branchId
              AND (@clinic IS NULL OR a.Clinic = @clinic)
              AND (@categoryId IS NULL OR a.CategoryID = @categoryId)
              AND (@dateOnly IS NULL OR a.AppointmentDate = @dateOnly)
              AND (@memberNumber IS NULL OR m.Number = @memberNumber)
              AND (@memberMobile IS NULL OR m.Mobile = @memberMobile)
              AND (@memberName IS NULL OR m.Name = @memberName)
              AND (@birthdayOnly IS NULL OR m.Birthday = @birthdayOnly)
            """;
        var filterParams = new
        {
            branchId, clinic, categoryId, dateOnly,
            memberNumber = normalizedNumber, memberMobile = normalizedMobile, memberName = normalizedName, birthdayOnly,
        };

        // OPTION (RECOMPILE)：where 內含 `(@dateOnly IS NULL OR a.AppointmentDate=@dateOnly)` 等萬用
        // predicate，若共用快取計畫，優化器會退回全表掃描（無法為「日期給/不給」各挑最佳計畫）。
        // RECOMPILE 讓每次以實際參數編譯，配合 IX_Appointments_BranchID_AppointmentDate 才會 seek
        // （實測 COUNT 3161→3 reads）。後台列表屬低頻，逐次重編譯成本遠低於全表掃描節省。
        var total = await conn.ExecuteScalarAsync<int>(new CommandDefinition($"""
            SELECT COUNT(*) FROM Appointments a JOIN Members m ON m.MemberID = a.MemberID {where}
            OPTION (RECOMPILE)
            """, filterParams, cancellationToken: ct));

        // PeriodTitle（時間欄）：Rosters.OutpatientTimes.Title 優先，否則 fallback Periods.OutpatientTimes.Title
        // （忠於舊 ViewXxxAppointments.cshtml；注意簽到單 Excel 匯出無此 fallback，見 ExportCheckinAsync）。
        // IsFirstVisit 改在分頁後用「單次 IN 清單 group-by」批次計算（見下方 firstVisitCounts），
        // 不再於此大查詢內用相關子查詢——後者在無索引的 reused DB 上，會為每頁列各觸發一次全表掃描，
        // 使列表 CPU 近乎翻倍（實測 189ms→53ms）。IN 版本是單一查詢、非 N+1（比照 ExportCheckinAsync）。
        var rows = (await conn.QueryAsync<ListRow>(new CommandDefinition($"""
            SELECT a.AppointmentID AS AppointmentId, a.AppointmentDate, a.Clinic, d.Name AS DoctorName,
                   COALESCE(rot.Title, pot.Title) AS PeriodTitle, p.Title AS SlotTitle, c.Title AS CategoryTitle,
                   m.Name AS MemberName, m.Birthday AS MemberBirthday, m.Mobile AS MemberMobile,
                   a.OutpatientNum, a.Status, a.MemberID AS MemberId
            FROM Appointments a
            JOIN Members m ON m.MemberID = a.MemberID
            LEFT JOIN Doctors d ON d.DoctorID = a.DoctorID
            JOIN Periods p ON p.PeriodID = a.PeriodID
            LEFT JOIN OutpatientTimes pot ON pot.OutpatientTimeID = p.OutpatientTimeID
            LEFT JOIN Rosters r ON r.RosterID = a.RosterID
            LEFT JOIN OutpatientTimes rot ON rot.OutpatientTimeID = r.OutpatientTimeID
            JOIN Categorys c ON c.CategoryID = a.CategoryID
            {where}
            ORDER BY a.AppointmentDate DESC, p.Sort, a.OutpatientNum
            OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
            OPTION (RECOMPILE)
            """, new
        {
            branchId, clinic, categoryId, dateOnly,
            memberNumber = normalizedNumber, memberMobile = normalizedMobile, memberName = normalizedName, birthdayOnly,
            offset, pageSize = PageSize,
        }, cancellationToken: ct))).AsList();

        // 初診判斷：僅針對本頁 ≤PageSize 個會員，一次 group-by 算其 Status=1 預約總數（≤1 即初診）。
        var memberIds = rows.Select(r => r.MemberId).Distinct().ToList();
        var firstVisitCounts = memberIds.Count == 0
            ? new Dictionary<Guid, int>()
            : (await conn.QueryAsync<(Guid MemberId, int Cnt)>(new CommandDefinition("""
                SELECT MemberID AS MemberId, COUNT(*) AS Cnt FROM Appointments
                WHERE MemberID IN @memberIds AND Status = 1
                GROUP BY MemberID
                """, new { memberIds }, cancellationToken: ct)))
                .ToDictionary(x => x.MemberId, x => x.Cnt);

        var items = rows.Select(r => new AppointmentAdminListItemDto(
            r.AppointmentId, r.AppointmentDate, r.Clinic, r.DoctorName, r.PeriodTitle, r.SlotTitle, r.CategoryTitle,
            r.MemberName, r.MemberBirthday, r.MemberMobile, r.OutpatientNum, r.Status,
            firstVisitCounts.GetValueOrDefault(r.MemberId) <= 1)).ToList();

        var isAutoRowNumber = await conn.ExecuteScalarAsync<bool>(new CommandDefinition(
            "SELECT IsAutoRowNumber FROM Branchs WHERE BranchID = @branchId", new { branchId }, cancellationToken: ct));

        // 容量表僅當足以定位「單一天」時才回傳：ta/ch 需 clinic+categoryId+appointmentDate 三者皆有值；
        // ch-dentist（clinic 恆為 Dentist、categoryId 恆為 null）僅需 appointmentDate。
        IReadOnlyList<PeriodAmountDto> periodAmounts = [];
        if (dateOnly is not null && clinic is not null && (clinic == Clinic.Dentist || categoryId is not null))
            periodAmounts = await GetPeriodAmountsAsync(conn, branchId, clinic, categoryId, dateOnly.Value, ct);

        return new AppointmentAdminListResultDto(items, total, page, PageSize, isAutoRowNumber, periodAmounts);
    }

    /// <summary>
    /// 時段容量表：對該分院+診別每個 Periods 模板，找當天是否有對應 Roster（ta/ch 需比對
    /// RosterCategorys 含指定 categoryId；ch-dentist 不比對科別，categoryId 為 null 時略過該條件）。
    /// TotalAmount 有對應 Roster 用 RosterPeriods.Patients，否則退回 Periods.Patients；
    /// AppointmentAmount 依 PeriodID+RosterID 分組（無對應 Roster 則單純依 PeriodID 加總）。
    /// 已預約名額以「人數」計＝Status=1 預約的 Amount 合計（非筆數），與前台餘額／CreateAsync 容量閘門一致；
    /// 此處刻意偏離舊系統「COUNT 筆數」照抄，因新系統 Amount 語意為預約人數、單筆可多人（見 docs/gotchas.md）。
    /// </summary>
    private static async Task<List<PeriodAmountDto>> GetPeriodAmountsAsync(
        System.Data.IDbConnection conn, Guid branchId, string clinic, Guid? categoryId, DateTime appointmentDate, CancellationToken ct)
    {
        var matchCategory = categoryId is not null;

        var periodRows = (await conn.QueryAsync<PeriodRow>(new CommandDefinition("""
            SELECT p.PeriodID AS PeriodId, p.Title AS PeriodTitle, p.Patients, p.Sort,
                   rp.RosterPeriodID AS RosterPeriodId, rp.RosterID AS RosterId, rp.Patients AS RosterPatients
            FROM Periods p
            OUTER APPLY (
                SELECT TOP 1 rp2.RosterPeriodID, rp2.RosterID, rp2.Patients
                FROM RosterPeriods rp2
                JOIN Rosters ros ON ros.RosterID = rp2.RosterID AND rp2.PeriodID = p.PeriodID
                WHERE ros.BranchID = @branchId AND ros.RosterDate = @appointmentDate AND ros.Clinic = @clinic
                  AND (@matchCategory = 0 OR EXISTS (
                      SELECT 1 FROM RosterCategorys rc WHERE rc.RosterID = ros.RosterID AND rc.CategoryID = @categoryId))
            ) rp
            WHERE p.BranchID = @branchId AND p.Clinic = @clinic
            ORDER BY p.Sort
            """, new { branchId, clinic, appointmentDate, categoryId, matchCategory }, cancellationToken: ct))).AsList();

        var apptCounts = (await conn.QueryAsync<ApptCountRow>(new CommandDefinition("""
            SELECT PeriodID AS PeriodId, RosterID AS RosterId, COALESCE(SUM(Amount), 0) AS Cnt
            FROM Appointments
            WHERE BranchID = @branchId AND Clinic = @clinic AND AppointmentDate = @appointmentDate AND Status = 1
            GROUP BY PeriodID, RosterID
            """, new { branchId, clinic, appointmentDate }, cancellationToken: ct))).AsList();

        var result = new List<PeriodAmountDto>();
        foreach (var pr in periodRows)
        {
            var count = pr.RosterId is { } rid
                ? apptCounts.Where(x => x.PeriodId == pr.PeriodId && x.RosterId == rid).Sum(x => x.Cnt)
                : apptCounts.Where(x => x.PeriodId == pr.PeriodId).Sum(x => x.Cnt);

            var total = pr.RosterId is not null ? pr.RosterPatients!.Value : pr.Patients;
            result.Add(new PeriodAmountDto(pr.PeriodId, pr.PeriodTitle, pr.Sort, total, count, pr.RosterPeriodId));
        }
        return result;
    }

    public async Task<AppointmentAdminDetailDto?> GetAsync(Guid appointmentId, CancellationToken ct = default)
    {
        using var conn = db.Create();
        var row = await conn.QueryFirstOrDefaultAsync<DetailRow>(new CommandDefinition("""
            SELECT a.AppointmentID AS AppointmentId, a.Clinic, c.Title AS CategoryTitle, a.Photo,
                   m.MemberID AS MemberId, m.Number AS MemberNumber, m.Mobile AS MemberMobile,
                   m.Birthday AS MemberBirthday, m.Name AS MemberName, m.Gender AS MemberGender,
                   m.BloodType AS MemberBloodType, z.City AS MemberCity, z.Area AS MemberArea, m.Address AS MemberAddress,
                   m.Allergy, m.AllergyOther AS MemberAllergyOther,
                   m.MedicalHistory, m.MedicalHistoryOther AS MemberMedicalHistoryOther,
                   a.QuestionTypeID AS QuestionTypeId
            FROM Appointments a
            JOIN Members m ON m.MemberID = a.MemberID
            LEFT JOIN Zipcodes z ON z.ZipcodeID = m.ZipcodeID
            JOIN Categorys c ON c.CategoryID = a.CategoryID
            WHERE a.AppointmentID = @appointmentId
            """, new { appointmentId }, cancellationToken: ct));
        if (row is null) return null;

        // 問卷：includeDisabled=true 讓「問卷類型後續被停用」不影響查看該預約當初的填答（同 MemberAdminService 慣例）。
        QuestionFormDto? questionnaire = row.QuestionTypeId is { } qtId
            ? await questions.GetFormAsync(row.MemberId, qtId, includeDisabled: true, ct)
            : null;

        return new AppointmentAdminDetailDto(
            row.AppointmentId, row.Clinic, row.CategoryTitle, row.Photo,
            row.MemberNumber, row.MemberMobile, row.MemberBirthday, row.MemberName,
            row.MemberGender, row.MemberBloodType, row.MemberCity, row.MemberArea, row.MemberAddress,
            FromCsv(row.Allergy), row.MemberAllergyOther,
            FromCsv(row.MedicalHistory), row.MemberMedicalHistoryOther,
            questionnaire);
    }

    /// <summary>
    /// 取消預約（軟刪除）：Status=0 + 標記該預約所有未發送（Status IS NULL）的 SmsStatus 為 CANCEL。
    /// 比舊系統多一條防禦性檢查：已取消狀態重複取消擋下 ALREADY_CANCELLED（見 blueprint 設計決策）。
    /// </summary>
    public async Task CancelAsync(Guid appointmentId, CancellationToken ct = default)
    {
        using var conn = db.Create();
        conn.Open();
        using var tx = conn.BeginTransaction();
        try
        {
            var status = await conn.ExecuteScalarAsync<int?>(new CommandDefinition(
                "SELECT Status FROM Appointments WHERE AppointmentID = @appointmentId",
                new { appointmentId }, tx, cancellationToken: ct));
            if (status is null)
                throw new BusinessException("找不到預約", "NOT_FOUND");
            if (status == AppointmentStatus.Cancelled)
                throw new BusinessException("此預約已取消", "ALREADY_CANCELLED");

            await conn.ExecuteAsync(new CommandDefinition(
                "UPDATE Appointments SET Status = @cancelled WHERE AppointmentID = @appointmentId",
                new { cancelled = AppointmentStatus.Cancelled, appointmentId }, tx, cancellationToken: ct));

            await conn.ExecuteAsync(new CommandDefinition("""
                UPDATE SmsStatus SET Status = @cancel, Message = N'取消預約', UpdateDate = @now
                WHERE AppointmentID = @appointmentId AND Status IS NULL
                """, new { cancel = SmsStatusValue.Cancel, now = DateTime.UtcNow.AddHours(8), appointmentId }, tx, cancellationToken: ct));

            tx.Commit();
        }
        catch
        {
            try { tx.Rollback(); } catch { /* ignore */ }
            throw;
        }
    }

    public async Task UpdateCapacityAsync(CapacityUpdateRequest req, CancellationToken ct = default)
    {
        if (req.Items is null || req.Items.Count == 0) return;
        foreach (var item in req.Items)
            if (item.Patients < 0)
                throw new BusinessException("容量不可為負數", "INVALID_PATIENTS");

        using var conn = db.Create();
        conn.Open();
        using var tx = conn.BeginTransaction();
        try
        {
            foreach (var item in req.Items)
            {
                var affected = await conn.ExecuteAsync(new CommandDefinition(
                    "UPDATE Periods SET Patients = @Patients WHERE PeriodID = @PeriodId",
                    new { item.PeriodId, item.Patients }, tx, cancellationToken: ct));
                if (affected == 0)
                    throw new BusinessException("找不到時段", "NOT_FOUND");

                if (item.RosterPeriodId is { } rpId)
                {
                    await conn.ExecuteAsync(new CommandDefinition(
                        "UPDATE RosterPeriods SET Patients = @Patients WHERE RosterPeriodID = @rpId",
                        new { rpId, item.Patients }, tx, cancellationToken: ct));
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

    /// <summary>
    /// 簽到單 Excel 匯出（ClosedXML .xlsx，取代舊 NPOI .xls）。只匯出 Status=1 的預約，查無資料回 NO_DATA
    /// （取代舊系統查無資料時的 redirect 行為，因為現在是純 API）。「時間」欄故意不 fallback 到
    /// Periods.OutpatientTimes.Title——忠於舊 ExportXxxAppointments 第 273/662/1034 行的既有行為
    /// （與列表頁/詳情頁的 fallback 邏輯不同，勿「修正」）。
    /// </summary>
    public async Task<byte[]> ExportCheckinAsync(Guid branchId, string clinic, DateTime appointmentDate, CancellationToken ct = default)
    {
        var dateOnly = appointmentDate.Date;
        using var conn = db.Create();

        var rows = (await conn.QueryAsync<CheckinRow>(new CommandDefinition("""
            SELECT b.Title AS BranchTitle, d.Name AS DoctorName, a.AppointmentDate,
                   rot.Title AS TimeTitle, p.Title AS SlotTitle, a.Clinic, c.Title AS CategoryTitle,
                   m.Name AS MemberName, m.Mobile AS MemberMobile, a.OutpatientNum, m.Birthday AS MemberBirthday,
                   a.MemberID AS MemberId
            FROM Appointments a
            JOIN Branchs b ON b.BranchID = a.BranchID
            LEFT JOIN Doctors d ON d.DoctorID = a.DoctorID
            JOIN Periods p ON p.PeriodID = a.PeriodID
            JOIN Categorys c ON c.CategoryID = a.CategoryID
            JOIN Members m ON m.MemberID = a.MemberID
            LEFT JOIN Rosters r ON r.RosterID = a.RosterID
            LEFT JOIN OutpatientTimes rot ON rot.OutpatientTimeID = r.OutpatientTimeID
            WHERE a.BranchID = @branchId AND a.Clinic = @clinic AND a.AppointmentDate = @dateOnly AND a.Status = 1
            ORDER BY p.Sort, a.OutpatientNum
            """, new { branchId, clinic, dateOnly }, cancellationToken: ct))).AsList();

        if (rows.Count == 0)
            throw new BusinessException("查無可匯出的預約資料", "NO_DATA");

        var memberIds = rows.Select(r => r.MemberId).Distinct().ToList();
        var firstVisitCounts = (await conn.QueryAsync<(Guid MemberId, int Cnt)>(new CommandDefinition("""
            SELECT MemberID AS MemberId, COUNT(*) AS Cnt FROM Appointments
            WHERE MemberID IN @memberIds AND Status = 1
            GROUP BY MemberID
            """, new { memberIds }, cancellationToken: ct)))
            .ToDictionary(x => x.MemberId, x => x.Cnt);

        using var workbook = new XLWorkbook();
        var worksheet = workbook.Worksheets.Add($"{dateOnly:yyyy-MM-dd}預約");

        string[] headers = ["分院", "醫師", "預約日期", "時間", "時段", "類型", "項目", "姓名", "手機號碼", "編號", "生日", "初診"];
        for (var col = 0; col < headers.Length; col++)
            worksheet.Cell(1, col + 1).Value = headers[col];

        var rowIndex = 2;
        foreach (var e in rows)
        {
            var firstVisitCount = firstVisitCounts.GetValueOrDefault(e.MemberId);
            worksheet.Cell(rowIndex, 1).Value = e.BranchTitle;
            worksheet.Cell(rowIndex, 2).Value = e.DoctorName ?? "";
            worksheet.Cell(rowIndex, 3).Value = e.AppointmentDate.ToString("yyyy-MM-dd");
            worksheet.Cell(rowIndex, 4).Value = e.TimeTitle ?? "";
            worksheet.Cell(rowIndex, 5).Value = e.SlotTitle;
            worksheet.Cell(rowIndex, 6).Value = Clinic.ToTitle(e.Clinic);
            worksheet.Cell(rowIndex, 7).Value = e.CategoryTitle;
            worksheet.Cell(rowIndex, 8).Value = e.MemberName ?? "";
            worksheet.Cell(rowIndex, 9).Value = e.MemberMobile;
            worksheet.Cell(rowIndex, 10).Value = e.OutpatientNum?.ToString() ?? "";
            worksheet.Cell(rowIndex, 11).Value = e.MemberBirthday.ToString("yyyy-MM-dd", RocCulture);
            worksheet.Cell(rowIndex, 12).Value = firstVisitCount > 1 ? "否" : "是";
            rowIndex++;
        }
        worksheet.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        workbook.SaveAs(ms);
        return ms.ToArray();
    }

    /// <summary>
    /// 問卷匯出（結構化 JSON，取代舊 iTextSharp PDF）。刻意不篩選 Status（含已取消預約只要有填問卷
    /// 也匯出），忠於舊 ExportQuestionXxxAppointments 既有行為，勿「修正」。查無資料回空清單
    /// （不同於簽到單 Excel 匯出的 NO_DATA 例外——此處是 JSON 查詢而非檔案下載，空清單是合法回應）。
    /// N 次呼叫 IQuestionService.GetFormAsync 屬低頻匯出操作，非列表熱路徑，可接受。
    /// </summary>
    public async Task<QuestionnaireExportDto> ExportQuestionnaireAsync(Guid branchId, string clinic, DateTime appointmentDate, CancellationToken ct = default)
    {
        var dateOnly = appointmentDate.Date;
        using var conn = db.Create();

        var rows = (await conn.QueryAsync<QuestionnaireRow>(new CommandDefinition("""
            SELECT a.AppointmentID AS AppointmentId, p.Title AS PeriodTitle, m.Name AS MemberName,
                   c.Title AS CategoryTitle, qt.Title AS QuestionTypeTitle, a.MemberID AS MemberId,
                   a.QuestionTypeID AS QuestionTypeId
            FROM Appointments a
            JOIN Periods p ON p.PeriodID = a.PeriodID
            JOIN Members m ON m.MemberID = a.MemberID
            JOIN Categorys c ON c.CategoryID = a.CategoryID
            JOIN QuestionTypes qt ON qt.QuestionTypeID = a.QuestionTypeID
            WHERE a.BranchID = @branchId AND a.Clinic = @clinic AND a.AppointmentDate = @dateOnly
              AND a.QuestionTypeID IS NOT NULL
            ORDER BY p.Sort
            """, new { branchId, clinic, dateOnly }, cancellationToken: ct))).AsList();

        var items = new List<QuestionnaireExportItemDto>();
        foreach (var r in rows)
        {
            var form = await questions.GetFormAsync(r.MemberId, r.QuestionTypeId!.Value, includeDisabled: true, ct);
            if (form is null) continue; // 防禦性：問卷類型理論上不會被刪除，僅停用；查無則跳過而非整批失敗
            items.Add(new QuestionnaireExportItemDto(r.AppointmentId, r.PeriodTitle, r.MemberName, r.CategoryTitle, r.QuestionTypeTitle, form));
        }
        return new QuestionnaireExportDto(items);
    }

    /// <summary>多選 CSV → 陣列（沿用 MemberAdminService.FromCsv 慣例）。</summary>
    private static IReadOnlyList<string> FromCsv(string? csv) =>
        string.IsNullOrWhiteSpace(csv) ? [] : csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    private sealed record ListRow(
        Guid AppointmentId, DateTime AppointmentDate, string Clinic, string? DoctorName,
        string? PeriodTitle, string SlotTitle, string CategoryTitle,
        string? MemberName, DateTime MemberBirthday, string MemberMobile,
        int? OutpatientNum, int Status, Guid MemberId);

    private sealed record PeriodRow(Guid PeriodId, string PeriodTitle, int Patients, int Sort, Guid? RosterPeriodId, Guid? RosterId, int? RosterPatients);
    private sealed record ApptCountRow(Guid PeriodId, Guid? RosterId, int Cnt);

    private sealed record DetailRow(
        Guid AppointmentId, string Clinic, string CategoryTitle, string? Photo,
        Guid MemberId, string MemberNumber, string MemberMobile, DateTime MemberBirthday, string? MemberName,
        int? MemberGender, string? MemberBloodType, string? MemberCity, string? MemberArea, string? MemberAddress,
        string? Allergy, string? MemberAllergyOther, string? MedicalHistory, string? MemberMedicalHistoryOther,
        Guid? QuestionTypeId);

    private sealed record CheckinRow(
        string BranchTitle, string? DoctorName, DateTime AppointmentDate, string? TimeTitle, string SlotTitle,
        string Clinic, string CategoryTitle, string? MemberName, string MemberMobile, int? OutpatientNum,
        DateTime MemberBirthday, Guid MemberId);

    private sealed record QuestionnaireRow(
        Guid AppointmentId, string PeriodTitle, string? MemberName, string CategoryTitle, string QuestionTypeTitle,
        Guid MemberId, Guid? QuestionTypeId);
}
