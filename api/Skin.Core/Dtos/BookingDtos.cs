namespace Skin.Core.Dtos;

public sealed record BranchDto(Guid BranchId, string Title, int BranchType, string Photo, bool IsAutoRowNumber);

public sealed record CategoryDto(Guid CategoryId, string Clinic, string Title, string? Intro, string Photo, bool IsQuestion);

/// <summary>可預約時段（含容量）。對應舊 GetRosters，但回 JSON 由前端渲染。</summary>
public sealed record TimeSlotDto(
    Guid PeriodId,
    string Title,
    int? OutpatientTimeId,
    string? OutpatientTimeTitle,
    int Capacity,
    int Used)
{
    public int Available => Math.Max(0, Capacity - Used);
    public bool IsAvailable => Available > 0;
}

public sealed record DoctorDto(Guid DoctorId, string Name);

public sealed record CheckAvailabilityResult(bool Available, string? Reason = null);
