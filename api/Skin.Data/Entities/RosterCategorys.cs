namespace Skin.Data.Entities;

/// <summary>排班科別（排班↔科別多對多）。對應 reused DB `RosterCategorys`（§2.8）。</summary>
public class RosterCategorys
{
    public Guid RosterCategoryID { get; set; }
    public Guid RosterID { get; set; }
    public Guid CategoryID { get; set; }
}
