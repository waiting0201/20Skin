using Skin.Api.Auth;
using Skin.Api.Routing;
using Skin.Core;
using Skin.Core.Constants;
using Skin.Core.Dtos;
using Skin.Services.Booking;

namespace Skin.Api.Controllers;

/// <summary>
/// 客戶預約（建立/查詢/詳情/取消）。需會員登入；memberId 取自 JWT。
/// 見 docs/blueprints/customer-booking.md。
/// </summary>
[ApiController]
[Authorize(Roles.Member)]
public sealed class AppointmentsController(IAppointmentService appointments, RequestContext ctx)
{
    private Guid MemberId => ctx.UserId ?? throw new BusinessException("未登入", "UNAUTHORIZED");

    /// <summary>POST /api/appointments — 建立預約。</summary>
    [ApiRoute("POST", "appointments")]
    public async Task<ApiResponse<CreateAppointmentResult>> Create(CreateAppointmentRequest req)
        => ApiResponse<CreateAppointmentResult>.Ok(await appointments.CreateAsync(MemberId, req));

    /// <summary>GET /api/appointments?page=&amp;pageSize= — 我的預約（分頁）。</summary>
    [ApiRoute("GET", "appointments")]
    public async Task<object> Mine(int page = 1, int pageSize = 15)
    {
        var (items, total) = await appointments.GetMineAsync(MemberId, page, pageSize);
        return new { items, total, page, pageSize };
    }

    /// <summary>GET /api/appointments/{id} — 詳情（含歸屬檢查）。</summary>
    [ApiRoute("GET", "appointments/{id}")]
    public async Task<object> Detail(Guid id)
    {
        var dto = await appointments.GetByIdAsync(MemberId, id);
        return dto is null
            ? ApiResponse.Fail("找不到預約", "NOT_FOUND")
            : ApiResponse<AppointmentDetailDto>.Ok(dto);
    }

    /// <summary>POST /api/appointments/{id}/cancel — 取消（&gt;1 小時）。</summary>
    [ApiRoute("POST", "appointments/{id}/cancel")]
    public async Task<ApiResponse> Cancel(Guid id)
    {
        var (ok, message) = await appointments.CancelAsync(MemberId, id);
        return ok ? ApiResponse.Ok(message) : ApiResponse.Fail(message ?? "取消失敗", "CANCEL_FAILED");
    }
}
