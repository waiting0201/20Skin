namespace Skin.Data.Entities;

/// <summary>問卷題目的選項。對應 reused DB `QuestionAnswers`。</summary>
public class QuestionAnswers
{
    public Guid QuestionAnswerID { get; set; }
    public Guid QuestionID { get; set; }
    public string Title { get; set; } = "";
    public int Sort { get; set; }
}
