using Skin.Core.Dtos;

namespace Skin.Services.BasicData;

/// <summary>
/// 後台時段主檔維護。Service 完全參數化（branchId+clinic），消除舊 5 變體複製；
/// 授權仍是變體粒度，由 Controller 層瘦 proxy action 分別掛 Resource key（見 docs/blueprints/admin-basic-data.md）。
/// </summary>
public interface IPeriodAdminService
{
    Task<IReadOnlyList<PeriodAdminDto>> ListAsync(Guid branchId, string clinic, CancellationToken ct = default);
    Task<PeriodAdminDto?> GetAsync(Guid id, CancellationToken ct = default);
    Task<Guid> CreateAsync(Guid branchId, string clinic, PeriodUpsertRequest req, CancellationToken ct = default);
    Task UpdateAsync(Guid id, PeriodUpsertRequest req, CancellationToken ct = default);

    /// <summary>刪除前檢查：Appointments/RosterPeriods 有任一引用即擋（RosterPeriods 對 Periods 是 CASCADE，故連帶擋）。</summary>
    Task DeleteAsync(Guid id, CancellationToken ct = default);

    Task ReorderAsync(Guid branchId, string clinic, List<SortItem> items, CancellationToken ct = default);

    /// <summary>門診時段字典（上午/下午/晚上），下拉選單用。</summary>
    Task<IReadOnlyList<OutpatientTimeDto>> ListOutpatientTimesAsync(CancellationToken ct = default);

    /// <summary>該分院是否為自動配號分院（Branchs.IsAutoRowNumber）；前端據此決定時段表單/清單/排班是否呈現「配號」模式。</summary>
    Task<bool> GetBranchIsAutoRowNumberAsync(Guid branchId, CancellationToken ct = default);
}
