using Skin.Core.Dtos;

namespace Skin.Services.Booking;

/// <summary>
/// 客戶預約讀取面（選分院→診別→時段→醫師→重複檢查）。
/// 見 docs/blueprints/customer-booking.md。寫入面（建立/取消）另見 AppointmentService（待實作）。
/// </summary>
public interface IBookingService
{
    Task<IReadOnlyList<BranchDto>> GetEnabledBranchesAsync(CancellationToken ct = default);

    Task<IReadOnlyList<CategoryDto>> GetCategoriesByClinicAsync(string clinic, CancellationToken ct = default);

    /// <summary>
    /// 可預約時段（含容量）。容量＝RosterPeriods.Patients，已用＝當日該段 Status=1 預約數。
    /// doctorId 為 null → 不指定醫師（IsAppointment=0）；有值 → 該指定醫師（IsAppointment=1 且 DoctorID=doctorId）。
    /// </summary>
    Task<IReadOnlyList<TimeSlotDto>> GetTimeSlotsAsync(
        Guid branchId, string clinic, Guid categoryId, DateTime date, Guid? doctorId = null, CancellationToken ct = default);

    /// <summary>該日可指定的醫師（IsAppointment=1 的排班）。</summary>
    Task<IReadOnlyList<DoctorDto>> GetDoctorsAsync(
        Guid branchId, string clinic, Guid categoryId, DateTime date, CancellationToken ct = default);

    /// <summary>重複預約檢查：依分院的「不可重複天數視窗」（設定驅動，取代舊硬編碼 GUID）。</summary>
    Task<CheckAvailabilityResult> CheckDuplicateAsync(
        Guid memberId, Guid branchId, string clinic, DateTime date, CancellationToken ct = default);
}
