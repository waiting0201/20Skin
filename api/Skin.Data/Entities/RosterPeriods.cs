namespace Skin.Data.Entities;

/// <summary>排班號碼段（當日實例，覆蓋 Periods 範本）。對應 reused DB `RosterPeriods`（§2.7）。</summary>
public class RosterPeriods
{
    public Guid RosterPeriodID { get; set; }
    public Guid RosterID { get; set; }
    public Guid PeriodID { get; set; }
    public int? StartNumber { get; set; }
    public int Patients { get; set; }   // 當日容量（覆蓋 Periods.Patients）
    public int Sort { get; set; }
}
