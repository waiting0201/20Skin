using Skin.Core.Dtos;

namespace Skin.Services.BasicData;

/// <summary>後台分院主檔維護。見 docs/blueprints/admin-basic-data.md。</summary>
public interface IBranchAdminService
{
    /// <summary>分頁列表（忠於舊系統 Branchs.cshtml 的 pageSize=20 分頁）。</summary>
    Task<(IReadOnlyList<BranchAdminDto> Items, int Total)> ListAsync(int page, int pageSize, CancellationToken ct = default);

    /// <summary>
    /// 全量已啟用分院（不分頁，依 Sort 排序），供下拉選單使用（如會員列表分院篩選）。
    /// 忠於舊 `MemberMsController.Members`：`branchsService.Get().Where(b => b.IsEnabled).OrderBy(b => b.Sort)`。
    /// </summary>
    Task<IReadOnlyList<BranchAdminDto>> ListEnabledAsync(CancellationToken ct = default);

    Task<BranchAdminDto?> GetAsync(Guid id, CancellationToken ct = default);
    Task<Guid> CreateAsync(BranchUpsertRequest req, CancellationToken ct = default);
    Task UpdateAsync(Guid id, BranchUpsertRequest req, CancellationToken ct = default);

    /// <summary>刪除前檢查：Appointments/Rosters/Periods 有任一引用即擋（Periods 對 Branchs 是 CASCADE，故連帶擋）。</summary>
    Task DeleteAsync(Guid id, CancellationToken ct = default);

    Task ReorderAsync(List<SortItem> items, CancellationToken ct = default);
}
