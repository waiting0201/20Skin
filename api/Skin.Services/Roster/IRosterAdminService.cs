using Skin.Core.Dtos;

namespace Skin.Services.Roster;

/// <summary>
/// 後台排班主檔維護（Rosters + RosterCategorys + RosterPeriods）。Service 完全參數化
/// （branchId+clinic），消除舊 5 變體複製；授權仍是變體粒度，由 Controller 層瘦 proxy action
/// 分別掛 Resource key。見 docs/blueprints/admin-roster.md。
/// </summary>
public interface IRosterAdminService
{
    Task<(IReadOnlyList<RosterListItemDto> Items, int Total)> ListAsync(
        Guid branchId, string clinic, DateTime? date, Guid? doctorId, int page, int pageSize, CancellationToken ct = default);

    Task<RosterAdminDto?> GetAsync(Guid id, CancellationToken ct = default);

    /// <summary>
    /// 新增排班（可含重複展開）。每天即時查重：同分院+醫師+診別+日期已存在的排班若含任一送出的
    /// 科別，該天整批跳過（all-or-nothing，回報於 SkippedDates，不像舊系統靜默跳過）。
    /// </summary>
    Task<RosterCreateResult> CreateAsync(Guid branchId, string clinic, RosterCreateRequest req, CancellationToken ct = default);

    /// <summary>編輯排班（不含重複展開，僅單一天）。RosterCategorys/RosterPeriods 皆為 diff。</summary>
    Task UpdateAsync(Guid id, RosterUpdateRequest req, CancellationToken ct = default);

    /// <summary>刪除前檢查：有任何 Appointments 引用（不論狀態）即擋。</summary>
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}
