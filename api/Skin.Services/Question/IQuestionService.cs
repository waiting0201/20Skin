using Skin.Core.Dtos;

namespace Skin.Services.Question;

/// <summary>
/// 問卷（術前電子病歷）：清單 → 填答（含既有作答 pre-fill）→ 提交。
/// 見 docs/blueprints/questionnaire.md。忠實還原舊 MainMsController(QuestionTypes/Questions)。
/// 只顯示 IsEnabled 的問卷/題目；作答綁定 JWT 會員。
/// </summary>
public interface IQuestionService
{
    /// <summary>有啟用問卷的 Category 清單（可依 clinic 或單一 categoryId 過濾），含會員已作答旗標。</summary>
    Task<IReadOnlyList<QuestionnaireCategoryDto>> GetCategoriesAsync(
        Guid memberId, string? clinic, Guid? categoryId, CancellationToken ct = default);

    /// <summary>取單份問卷表單（題目 + 選項 + 會員既有作答 pre-fill）。查無或未啟用回 null。</summary>
    Task<QuestionFormDto?> GetFormAsync(Guid memberId, Guid questionTypeId, CancellationToken ct = default);

    /// <summary>提交作答：交易內先刪該會員此問卷舊作答再寫入（可重填、冪等）。</summary>
    Task SubmitAsync(Guid memberId, SaveMemberQuestionsRequest req, CancellationToken ct = default);
}
