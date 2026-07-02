using Skin.Core.Dtos;

namespace Skin.Services.BasicData;

/// <summary>後台問卷類型主檔維護。刪除為軟刪（IsEnabled=false），沿用舊系統；不做硬刪。</summary>
public interface IQuestionTypeAdminService
{
    /// <summary>依科別列出（含已軟刪，後台管理需看到全部）；categoryId 為 null 表全部。</summary>
    Task<IReadOnlyList<QuestionTypeAdminDto>> ListAsync(Guid? categoryId, CancellationToken ct = default);

    Task<QuestionTypeAdminDto?> GetAsync(Guid id, CancellationToken ct = default);
    Task<Guid> CreateAsync(QuestionTypeUpsertRequest req, CancellationToken ct = default);
    Task UpdateAsync(Guid id, QuestionTypeUpsertRequest req, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
    Task ReorderAsync(List<SortItem> items, CancellationToken ct = default);
}
