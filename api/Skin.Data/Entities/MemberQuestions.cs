namespace Skin.Data.Entities;

/// <summary>
/// 會員某題的作答（一題一筆；QuestionID 一律有值，無 container 空列）。
/// 對應 reused DB `MemberQuestions`。單選 → 1 筆 MemberQuestionAnswers；複選 → 多筆。
/// 「其他」自填文字存 <see cref="Other"/>；檔案（歷史欄位，現無題型使用）存 <see cref="Filename"/>。
/// </summary>
public class MemberQuestions
{
    public Guid MemberQuestionID { get; set; }
    public Guid MemberID { get; set; }
    public Guid QuestionTypeID { get; set; }
    public Guid? QuestionID { get; set; }
    public string? Other { get; set; }
    public string? Filename { get; set; }
}
