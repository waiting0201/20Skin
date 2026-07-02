using Skin.Api.Auth;
using Skin.Api.Routing;
using Skin.Core;
using Skin.Core.Constants;
using Skin.Core.Dtos;
using Skin.Services.Booking;

namespace Skin.Api.Controllers;

/// <summary>
/// 客戶預約讀取面（選分院→診別→時段→醫師→重複檢查）。需會員登入。
/// 見 docs/blueprints/customer-booking.md、design/api-design.md。
/// </summary>
[ApiController]
[Authorize(Roles.Member)]
public sealed class BookingController(IBookingService booking, RequestContext ctx)
{
    /// <summary>GET /api/branches — 啟用分院列表。</summary>
    [ApiRoute("GET", "branches")]
    public Task<IReadOnlyList<BranchDto>> Branches() => booking.GetEnabledBranchesAsync();

    /// <summary>GET /api/categories?branchId=&amp;clinic=Skin — 某診別項目（IsAmountLocked 依 branchId 解析）。</summary>
    [ApiRoute("GET", "categories")]
    public Task<IReadOnlyList<CategoryDto>> Categories(Guid branchId, string clinic) => booking.GetCategoriesByClinicAsync(branchId, clinic);

    /// <summary>
    /// GET /api/rosters?branchId=&amp;clinic=&amp;categoryId=&amp;date=&amp;doctorId= — 可預約時段。
    /// 帶 doctorId → 該指定醫師（IsAppointment=1）；不帶 → 不指定醫師（IsAppointment=0）。
    /// </summary>
    [ApiRoute("GET", "rosters")]
    public Task<IReadOnlyList<TimeSlotDto>> TimeSlots(Guid branchId, string clinic, Guid categoryId, DateTime date, Guid? doctorId = null)
        => booking.GetTimeSlotsAsync(branchId, clinic, categoryId, date, doctorId);

    /// <summary>GET /api/rosters/doctors?... — 該日可指定醫師。</summary>
    [ApiRoute("GET", "rosters/doctors")]
    public Task<IReadOnlyList<DoctorDto>> Doctors(Guid branchId, string clinic, Guid categoryId, DateTime date)
        => booking.GetDoctorsAsync(branchId, clinic, categoryId, date);

    public sealed record CheckAvailabilityRequest(Guid BranchId, string Clinic, DateTime Date);

    /// <summary>POST /api/rosters/check-availability — 重複預約檢查（memberId 取自 JWT）。</summary>
    [ApiRoute("POST", "rosters/check-availability")]
    public async Task<ApiResponse<CheckAvailabilityResult>> CheckAvailability(CheckAvailabilityRequest req)
    {
        var memberId = ctx.UserId;
        if (memberId is null) return ApiResponse<CheckAvailabilityResult>.Fail("未登入", "UNAUTHORIZED");
        var result = await booking.CheckDuplicateAsync(memberId.Value, req.BranchId, req.Clinic, req.Date);
        return ApiResponse<CheckAvailabilityResult>.Ok(result);
    }
}
