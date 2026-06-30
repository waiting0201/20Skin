namespace Skin.Data.Entities;

/// <summary>分院。對應 reused DB `Branchs`（見 docs/old/design/database-design.md §2.1）。</summary>
public class Branchs
{
    public Guid BranchID { get; set; }
    public string Title { get; set; } = "";
    public int BranchType { get; set; }       // 2=齒科（前台直接跳預約表單）
    public string Photo { get; set; } = "";
    public bool IsAutoRowNumber { get; set; } // 是否自動配號（台中健保 +2 偶數）
    public int Sort { get; set; }
    public bool IsEnabled { get; set; }
}
