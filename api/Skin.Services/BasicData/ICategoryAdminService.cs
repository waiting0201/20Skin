using Skin.Core.Dtos;

namespace Skin.Services.BasicData;

/// <summary>
/// 後台科別項目主檔維護。Service 完全參數化（clinic），消除舊 Skins/Cosmetics 2 變體複製；
/// 授權仍是變體粒度，由 Controller 層瘦 proxy action 分別掛 Resource key（見 docs/blueprints/admin-basic-data.md）。
/// </summary>
public interface ICategoryAdminService
{
    Task<IReadOnlyList<CategoryAdminDto>> ListAsync(string clinic, CancellationToken ct = default);
    Task<CategoryAdminDto?> GetAsync(Guid id, CancellationToken ct = default);
    Task<Guid> CreateAsync(string clinic, CategoryUpsertRequest req, CancellationToken ct = default);
    Task UpdateAsync(Guid id, CategoryUpsertRequest req, CancellationToken ct = default);

    /// <summary>
    /// 刪除前檢查：Appointments/RosterCategorys/QuestionTypes 有任一引用即擋。
    /// QuestionTypes 一律查全表 COUNT（含已軟刪 IsEnabled=false 的列，因 QuestionTypes 從不硬刪）——
    /// QuestionTypes.CategoryID 對 Categorys 是 CASCADE，任何殘留列都代表刪除會波及 Questions/
    /// QuestionAnswers/MemberQuestions（會員歷史問卷記錄），已對真實 DB 查證，見 blueprint。
    /// </summary>
    Task DeleteAsync(Guid id, CancellationToken ct = default);

    Task ReorderAsync(string clinic, List<SortItem> items, CancellationToken ct = default);
}
