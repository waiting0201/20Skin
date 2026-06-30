namespace Skin.Data.Entities;

/// <summary>醫師。對應 reused DB `Doctors`（見 docs/old/design/database-design.md §2.3）。</summary>
public class Doctors
{
    public Guid DoctorID { get; set; }
    public string Name { get; set; } = "";
}
