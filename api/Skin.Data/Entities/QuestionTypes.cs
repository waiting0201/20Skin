namespace Skin.Data.Entities;

/// <summary>問卷類型（一個 Category 可有多份）。對應 reused DB `QuestionTypes`。</summary>
public class QuestionTypes
{
    public Guid QuestionTypeID { get; set; }
    public Guid CategoryID { get; set; }
    public string Title { get; set; } = "";
    public int Sort { get; set; }
    public bool IsEnabled { get; set; }
}
