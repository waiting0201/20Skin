namespace Skin.Core.Dtos;

/// <summary>後台排班管理 DTO（見 docs/blueprints/admin-roster.md）。</summary>

/// <summary>排班列表項。</summary>
public sealed record RosterListItemDto(Guid RosterId, DateTime RosterDate, Guid? DoctorId, string? DoctorName, int? OutpatientTimeId, string? OutpatientTimeTitle, bool IsAppointment);

/// <summary>排班的單一時段容量覆蓋（列表用）。</summary>
public sealed record RosterPeriodAdminDto(Guid PeriodId, string PeriodTitle, int? StartNumber, int Patients, int Sort);

/// <summary>排班詳情（含開放科別 + 各時段容量覆蓋）。</summary>
public sealed record RosterAdminDto(Guid RosterId, Guid BranchId, Guid? DoctorId, string? DoctorName, int? OutpatientTimeId, string? OutpatientTimeTitle, DateTime RosterDate, string Clinic, bool IsAppointment, List<Guid> CategoryIds, List<RosterPeriodAdminDto> Periods);

/// <summary>時段容量輸入（以 PeriodId 為自然鍵，後端據此 diff）。</summary>
public sealed record RosterPeriodInput(Guid PeriodId, int? StartNumber, int Patients);

/// <summary>新增排班請求；RepeatMode：0=不重複／1=每日／2=每週（需搭配 ExpireDate）。</summary>
public sealed record RosterCreateRequest(Guid? DoctorId, int? OutpatientTimeId, DateTime RosterDate, bool IsAppointment, List<Guid> CategoryIds, List<RosterPeriodInput> Periods, int RepeatMode, DateTime? ExpireDate);

/// <summary>編輯排班請求（不含 RosterDate/重複設定，僅編輯單一天）。</summary>
public sealed record RosterUpdateRequest(Guid? DoctorId, int? OutpatientTimeId, bool IsAppointment, List<Guid> CategoryIds, List<RosterPeriodInput> Periods);

/// <summary>新增排班結果：實際建立的日期 + 因當日已有重疊科別排班而跳過的日期。</summary>
public sealed record RosterCreateResult(List<DateTime> CreatedDates, List<DateTime> SkippedDates);
