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

public sealed record AppointmentDetailDto(
    Guid AppointmentId,
    DateTime AppointmentDate,
    string Clinic,
    string? BranchTitle,
    string? CategoryTitle,
    string? DoctorName,
    string? PeriodTitle,
    int Amount,
    int? OutpatientNum,
    bool IsFirstVisit,
    int Status,
    Guid? QuestionTypeId,
    string? Photo);
