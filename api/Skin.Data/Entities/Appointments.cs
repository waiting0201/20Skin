namespace Skin.Data.Entities;

/// <summary>預約掛號。對應 reused DB `Appointments`（見 docs/old/design/database-design.md §2.10）。</summary>
public class Appointments
{
    public Guid AppointmentID { get; set; }
    public Guid MemberID { get; set; }
    public Guid PeriodID { get; set; }
    public Guid CategoryID { get; set; }
    public Guid? RosterID { get; set; }
    public Guid? BranchID { get; set; }
    public Guid? DoctorID { get; set; }
    public Guid? QuestionTypeID { get; set; }
    public int Amount { get; set; }              // 預約人數
    public DateTime AppointmentDate { get; set; }
    public string? Photo { get; set; }
    public bool IsFirstVisit { get; set; }
    public string Clinic { get; set; } = "";
    public int? OutpatientNum { get; set; }      // 自動門診號（IsAutoRowNumber）
    public int Status { get; set; }              // 1=有效 / 0=取消
    public DateTime? Createdate { get; set; }    // 沿用：小寫 d
}
