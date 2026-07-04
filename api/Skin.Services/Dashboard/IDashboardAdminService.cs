using Skin.Core.Dtos;

namespace Skin.Services.Dashboard;

/// <summary>儀表板統計輸入：分院鍵（ta/ch/chDentist）+ 實際 BranchID（呼叫端以權限過濾後傳入）。</summary>
public sealed record DashboardBranchInput(string Key, Guid BranchId);

public interface IDashboardAdminService
{
    /// <summary>
    /// 取得儀表板統計。branches 為呼叫端依管理員可讀權限過濾後的分院清單（可為空）；
    /// includeMembers 為 false 時 Members 區塊回 null。
    /// </summary>
    Task<DashboardDto> GetAsync(IReadOnlyList<DashboardBranchInput> branches, bool includeMembers, CancellationToken ct = default);
}
