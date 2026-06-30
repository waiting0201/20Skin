namespace Skin.Data.Entities;

/// <summary>醫師排班。對應 reused DB `Rosters`（§2.6）。</summary>
public class Rosters
{
    public Guid RosterID { get; set; }
    public Guid BranchID { get; set; }
    public Guid? DoctorID { get; set; }
    public int? OutpatientTimeID { get; set; }
    public DateTime RosterDate { get; set; }
    public bool IsAppointment { get; set; }   // 是否開放線上預約（指定醫師）
    public string Clinic { get; set; } = "";
}
