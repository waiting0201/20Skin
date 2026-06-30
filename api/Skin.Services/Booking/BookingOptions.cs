namespace Skin.Services.Booking;

/// <summary>
/// 預約規則設定（設定驅動，取代舊硬編碼分院 GUID）。
/// DuplicateWindowDaysByBranch：某分院「同診別不可重複預約」的前後天數視窗；
/// 預設 0（同日不可重複）；台中院設 2（前後 2 天內不可重複），由 appsettings 提供。
/// </summary>
public sealed class BookingOptions
{
    public Dictionary<string, int> DuplicateWindowDaysByBranch { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    public int WindowDaysFor(Guid branchId)
        => DuplicateWindowDaysByBranch.TryGetValue(branchId.ToString(), out var d) ? d : 0;
}
