namespace Skin.Core.Dtos;

/// <summary>
/// 後台預約管理 DTO（見 docs/blueprints/admin-reserve.md）。對應舊 ReserveMsController 三組變體
/// （TaAppointments/ChAppointments/ChDentistAppointments）。
/// </summary>

/// <summary>
/// 預約列表項。PeriodTitle 為「時間」欄（Rosters.OutpatientTimes.Title 優先，否則 fallback
/// Periods.OutpatientTimes.Title，忠於舊 ViewXxxAppointments.cshtml 第176行；注意簽到單 Excel 匯出
/// 的「時間」欄無此 fallback，兩者刻意不同，見 AppointmentAdminService 註解）；
/// SlotTitle 為「時段」欄（Periods.Title）。IsFirstVisit 依會員 Status=1 預約總數是否 &lt;=1 動態判斷
/// （不讀 Appointments.IsFirstVisit 既有欄位，忠於舊系統列表/匯出邏輯）。
/// </summary>
public sealed record AppointmentAdminListItemDto(
    Guid AppointmentId,
    DateTime AppointmentDate,
    string Clinic,
    string? DoctorName,
    string? PeriodTitle,
    string SlotTitle,
    string CategoryTitle,
    string? MemberName,
    DateTime MemberBirthday,
    string MemberMobile,
    int? OutpatientNum,
    int Status,
    bool IsFirstVisit);

/// <summary>
/// 列表結果。BranchIsAutoRowNumber 對應 Branchs.IsAutoRowNumber，前端據此決定是否顯示「編號」欄
/// （沿用舊系統依此旗標切換看診號碼欄位/簡訊文案的邏輯）。PeriodAmounts 僅當篩選條件足以定位單一天
/// 的時段容量表時才非空（見 IAppointmentAdminService.ListAsync）。
/// </summary>
public sealed record AppointmentAdminListResultDto(
    IReadOnlyList<AppointmentAdminListItemDto> Items,
    int Total,
    int Page,
    int PageSize,
    bool BranchIsAutoRowNumber,
    IReadOnlyList<PeriodAmountDto> PeriodAmounts);

/// <summary>
/// 時段容量統計（僅當 ta/ch 的 clinic+categoryId+appointmentDate 三者皆有值，或 ch-dentist 的
/// appointmentDate 有值時才回傳，見 AppointmentAdminService.GetPeriodAmountsAsync）。
/// TotalAmount 有對應 Roster 時取 RosterPeriods.Patients，否則退回 Periods.Patients；
/// RosterPeriodId 為 null 表示該時段目前無對應排班容量覆蓋（容量批次更新時不連動 RosterPeriods）。
/// </summary>
public sealed record PeriodAmountDto(
    Guid PeriodId,
    string PeriodTitle,
    int Sort,
    int TotalAmount,
    int AppointmentAmount,
    Guid? RosterPeriodId);

/// <summary>
/// 預約詳情：會員完整資料 + 預約本身（Clinic/CategoryTitle/Photo，Photo 為 Appointments.Photo 上傳圖檔名，
/// 非 Categorys 的圖片）+ 問卷（QuestionFormDto 重用 IQuestionService.GetFormAsync，見 Skin.Core.Dtos.QuestionDtos）。
/// MemberAllergy/MemberMedicalHistory 為 CSV 轉陣列（沿用 MemberAdminService 慣例，查無選項回空陣列而非 null）。
/// </summary>
public sealed record AppointmentAdminDetailDto(
    Guid AppointmentId,
    string Clinic,
    string CategoryTitle,
    string? Photo,
    string MemberNumber,
    string MemberMobile,
    DateTime MemberBirthday,
    string? MemberName,
    int? MemberGender,
    string? MemberBloodType,
    string? MemberCity,
    string? MemberArea,
    string? MemberAddress,
    IReadOnlyList<string> MemberAllergy,
    string? MemberAllergyOther,
    IReadOnlyList<string> MemberMedicalHistory,
    string? MemberMedicalHistoryOther,
    QuestionFormDto? Questionnaire);

/// <summary>容量批次更新請求（對應舊 SortXxxAppointments）。</summary>
public sealed record CapacityUpdateRequest(IReadOnlyList<CapacityItemInput> Items);

/// <summary>單筆容量輸入；RosterPeriodId 有值時同時更新 RosterPeriods.Patients（否則只更新 Periods.Patients）。</summary>
public sealed record CapacityItemInput(Guid PeriodId, Guid? RosterPeriodId, int Patients);

/// <summary>問卷匯出結果（取代舊 iTextSharp PDF 匯出，前端另做可列印頁面）。</summary>
public sealed record QuestionnaireExportDto(IReadOnlyList<QuestionnaireExportItemDto> Items);

/// <summary>
/// 單筆問卷匯出項。注意：來源查詢刻意不篩選 Status（連已取消的預約只要有填問卷也會匯出），
/// 忠於舊 ExportQuestionXxxAppointments 的既有行為，見 AppointmentAdminService.ExportQuestionnaireAsync。
/// </summary>
public sealed record QuestionnaireExportItemDto(
    Guid AppointmentId,
    string PeriodTitle,
    string? MemberName,
    string CategoryTitle,
    string QuestionTypeTitle,
    QuestionFormDto Questionnaire);
