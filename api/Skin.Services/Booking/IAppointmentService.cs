using Skin.Core.Dtos;

namespace Skin.Services.Booking;

/// <summary>客戶預約寫入面（建立/查詢/取消）。見 docs/blueprints/customer-booking.md。</summary>
public interface IAppointmentService
{
    /// <summary>建立預約：容量檢查（交易內）→ 自動門診號 → 重複限制 → 問卷強制 → 寫 Appointments + 簡訊雙寫。</summary>
    Task<CreateAppointmentResult> CreateAsync(Guid memberId, CreateAppointmentRequest req, CancellationToken ct = default);

    Task<(IReadOnlyList<AppointmentListItemDto> Items, int Total)> GetMineAsync(
        Guid memberId, int page, int pageSize, CancellationToken ct = default);

    /// <summary>詳情（含歸屬檢查；非本人回 null，修 IDOR）。</summary>
    Task<AppointmentDetailDto?> GetByIdAsync(Guid memberId, Guid appointmentId, CancellationToken ct = default);

    /// <summary>取消：>1 小時才可；Status=0 並標記未發簡訊為 CANCEL。回傳是否成功 + 訊息。</summary>
    Task<(bool Ok, string? Message)> CancelAsync(Guid memberId, Guid appointmentId, CancellationToken ct = default);
}
