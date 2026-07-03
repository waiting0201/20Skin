using Skin.Core.Dtos;

namespace Skin.Services.Reserve;

/// <summary>
/// 後台預約管理（對應舊 ReserveMsController 三組變體，見 docs/blueprints/admin-reserve.md）。
/// Service 完全參數化（branchId+clinic），Controller 保留 3 組「瘦」proxy action 對應真實
/// Lims 變體粒度（TaAppointments/ChAppointments/ChDentistAppointments）。
/// </summary>
public interface IAppointmentAdminService
{
    /// <summary>
    /// 預約列表（分頁固定 50 筆，不對外開放調整，沿用舊系統 ToPagedList(pageSize: 50)）。
    /// clinic/categoryId 對 ch-dentist 呼叫方而言恆為 "Dentist"/null（該分院無 clinic/category 篩選）。
    /// </summary>
    Task<AppointmentAdminListResultDto> ListAsync(
        Guid branchId, string? clinic, Guid? categoryId, DateTime? appointmentDate,
        string? memberNumber, string? memberMobile, string? memberName, DateTime? birthday,
        int page, CancellationToken ct = default);

    /// <summary>預約詳情（含會員完整資料 + 問卷，問卷唯讀含已停用問卷類型，見 Service 實作）。</summary>
    Task<AppointmentAdminDetailDto?> GetAsync(Guid appointmentId, CancellationToken ct = default);

    /// <summary>
    /// 取消預約（軟刪除，Status=0 + 標記未發簡訊 CANCEL）。比舊系統多一條防禦性檢查：
    /// 已取消的預約重複取消會擋下 ALREADY_CANCELLED（見 Service 實作，非破壞相容性的改動）。
    /// </summary>
    Task CancelAsync(Guid appointmentId, CancellationToken ct = default);

    /// <summary>時段容量批次更新（對應舊 SortXxxAppointments，逐筆更新 Periods/RosterPeriods.Patients）。</summary>
    Task UpdateCapacityAsync(CapacityUpdateRequest req, CancellationToken ct = default);

    /// <summary>簽到單 Excel 匯出（.xlsx，僅匯出 Status=1 的預約；查無資料回 NO_DATA）。</summary>
    Task<byte[]> ExportCheckinAsync(Guid branchId, string clinic, DateTime appointmentDate, CancellationToken ct = default);

    /// <summary>
    /// 問卷匯出（結構化 JSON 取代舊 iTextSharp PDF，前端另做可列印頁面）。
    /// 刻意不篩選 Status（含已取消預約），忠於舊系統既有行為。
    /// </summary>
    Task<QuestionnaireExportDto> ExportQuestionnaireAsync(Guid branchId, string clinic, DateTime appointmentDate, CancellationToken ct = default);
}
