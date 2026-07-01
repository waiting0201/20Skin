namespace Skin.Core.Dtos;

/// <summary>問卷清單頁：一個 Category 及其（啟用的）問卷，含會員是否已作答旗標。</summary>
public sealed record QuestionnaireCategoryDto(
    Guid CategoryId,
    string Clinic,
    string Title,
    string? Intro,
    string Photo,
    IReadOnlyList<QuestionnaireEntryDto> QuestionTypes);

public sealed record QuestionnaireEntryDto(Guid QuestionTypeId, string Title, int Sort, bool Answered);

/// <summary>問卷表單（題目 + 選項 + 會員既有作答，用於 pre-fill）。對應舊 Questions.cshtml。</summary>
public sealed record QuestionFormDto(
    Guid QuestionTypeId,
    Guid CategoryId,
    string Title,
    bool Answered,
    IReadOnlyList<QuestionFormItemDto> Questions);

public sealed record QuestionFormItemDto(
    Guid QuestionId,
    string Title,
    int OptionType,          // 1=單選 / 2=複選
    bool IsOther,
    string? OtherTitle,
    IReadOnlyList<QuestionAnswerDto> Answers,
    IReadOnlyList<Guid> SelectedAnswerIds,   // pre-fill：已勾選的選項
    string? OtherText);                      // pre-fill：其他自填

public sealed record QuestionAnswerDto(Guid QuestionAnswerId, string Title, int Sort);

/// <summary>作答提交（memberId 取自 JWT，不信任前端）。</summary>
public sealed record SaveMemberQuestionsRequest(Guid QuestionTypeId, IReadOnlyList<MemberQuestionInput> Answers);

public sealed record MemberQuestionInput(Guid QuestionId, IReadOnlyList<Guid> AnswerIds, string? Other);
