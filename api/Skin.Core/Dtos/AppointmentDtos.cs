namespace Skin.Core.Dtos;

/// <summary>建立預約請求（見 docs/blueprints/customer-booking.md）。memberId 取自 JWT，不在此。</summary>
public sealed record CreateAppointmentRequest(
    Guid BranchId,
    string Clinic,
    Guid CategoryId,
    Guid PeriodId,
    Guid? DoctorId,
    bool IsAppointment,
    DateTime AppointmentDate,
    int Amount,
    Guid? QuestionTypeId,
    string? Photo);

public sealed record CreateAppointmentResult(Guid AppointmentId, int? OutpatientNum);

public sealed record AppointmentListItemDto(
    Guid AppointmentId,
    DateTime AppointmentDate,
    string Clinic,
    string? BranchTitle,
    string? CategoryTitle,
    int? OutpatientNum,
    int Status);

/// <summary>
/// IsQuestion：該預約項目（Categorys）是否需填問卷。QuestionAnswered：是否已填答
/// （比照舊系統 Complete.cshtml／AppointmentDetail.cshtml：IsQuestion 為 false 時「不需填寫問卷」；
/// 為 true 時依 Appointments.QuestionTypeID 是否已寫入判斷「已填寫／未填寫」）。
/// BranchId：供前端做分院條件渲染（如二林分院專屬提示），文案由前端依此欄位判斷，後端不寫死。
/// </summary>
public sealed record AppointmentDetailDto(
    Guid AppointmentId,
    DateTime AppointmentDate,
    string Clinic,
    Guid? BranchId,
    string? BranchTitle,
    string? CategoryTitle,
    string? DoctorName,
    string? PeriodTitle,
    int Amount,
    int? OutpatientNum,
    bool IsFirstVisit,
    int Status,
    Guid? QuestionTypeId,
    string? Photo,
    bool IsQuestion,
    bool QuestionAnswered);
