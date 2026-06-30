namespace Skin.Data.Entities;

/// <summary>科別/診療項目。對應 reused DB `Categorys`（見 docs/old/design/database-design.md §2.2）。</summary>
public class Categorys
{
    public Guid CategoryID { get; set; }
    public string Clinic { get; set; } = "";   // Skin/Cosmetic/Dentist
    public string Title { get; set; } = "";
    public string? Intro { get; set; }
    public string Photo { get; set; } = "";
    public bool IsQuestion { get; set; }        // 預約前是否需填問卷
    public bool IsOnly { get; set; }            // 台中院開放控制
    public bool ChIsOnly { get; set; }          // 二林院開放控制
    public bool ChDentistIsOnly { get; set; }   // 二林齒科開放控制
    public int Sort { get; set; }
}
