using Skin.Core.Dtos;

namespace Skin.Services.BasicData;

/// <summary>
/// 後台問卷題目 + 選項維護。題目刪除為軟刪（IsEnabled=false）；選項編輯採整組送出比對 diff，
/// 「現有但送上來沒有」的一律硬刪除（沿用舊系統行為，不查 MemberQuestionAnswers 引用——
/// 該表對 QuestionAnswers 無 FK 保護，已知孤兒資料風險，為維持舊行為相容性由使用者拍板接受）。
/// 見 docs/blueprints/admin-basic-data.md。
/// </summary>
public interface IQuestionAdminService
{
    /// <summary>依問卷類型列出題目（含巢狀選項，含已軟刪，後台管理需看到全部）。</summary>
    Task<IReadOnlyList<QuestionAdminDto>> ListAsync(Guid questionTypeId, CancellationToken ct = default);

    /// <summary>新增題目 + 初始選項（交易內）。</summary>
    Task<Guid> CreateAsync(Guid questionTypeId, QuestionUpsertRequest req, CancellationToken ct = default);

    /// <summary>編輯題目 + 選項 diff（交易內）。</summary>
    Task UpdateAsync(Guid id, QuestionUpsertRequest req, CancellationToken ct = default);

    Task DeleteAsync(Guid id, CancellationToken ct = default);
    Task ReorderAsync(Guid questionTypeId, List<SortItem> items, CancellationToken ct = default);
}
