using Skin.Core.Dtos;

namespace Skin.Services.BasicData;

/// <summary>後台分院主檔維護。見 docs/blueprints/admin-basic-data.md。</summary>
public interface IBranchAdminService
{
    Task<IReadOnlyList<BranchAdminDto>> ListAsync(CancellationToken ct = default);
    Task<BranchAdminDto?> GetAsync(Guid id, CancellationToken ct = default);
    Task<Guid> CreateAsync(BranchUpsertRequest req, CancellationToken ct = default);
    Task UpdateAsync(Guid id, BranchUpsertRequest req, CancellationToken ct = default);

    /// <summary>刪除前檢查：Appointments/Rosters/Periods 有任一引用即擋（Periods 對 Branchs 是 CASCADE，故連帶擋）。</summary>
    Task DeleteAsync(Guid id, CancellationToken ct = default);

    Task ReorderAsync(List<SortItem> items, CancellationToken ct = default);
}
