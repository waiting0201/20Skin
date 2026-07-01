namespace Skin.Data.Entities;

/// <summary>會員作答的具體選項（QuestionAnswerID 為 NOT NULL）。對應 reused DB `MemberQuestionAnswers`。</summary>
public class MemberQuestionAnswers
{
    public Guid MemberQuestionAnswerID { get; set; }
    public Guid MemberQuestionID { get; set; }
    public Guid QuestionAnswerID { get; set; }
}
