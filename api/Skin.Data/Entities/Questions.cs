namespace Skin.Data.Entities;

/// <summary>
/// 問卷題目。對應 reused DB `Questions`。
/// OptionType 實際資料只有 1=單選(radio)/2=複選(checkbox)（見 docs/gotchas.md）；無文字/檔案題型。
/// </summary>
public class Questions
{
    public Guid QuestionID { get; set; }
    public Guid QuestionTypeID { get; set; }
    public string Title { get; set; } = "";
    public string? OtherTitle { get; set; }
    public int OptionType { get; set; }   // 1=單選 / 2=複選
    public bool IsOther { get; set; }      // 是否有「其他」自填欄
    public int Sort { get; set; }
    public bool IsEnabled { get; set; }
}
