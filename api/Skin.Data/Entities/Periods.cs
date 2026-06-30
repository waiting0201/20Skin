namespace Skin.Data.Entities;

/// <summary>號碼段/時段設定（模板）。對應 reused DB `Periods`（§2.5）。</summary>
public class Periods
{
    public Guid PeriodID { get; set; }
    public Guid BranchID { get; set; }
    public int OutpatientTimeID { get; set; }
    public string Clinic { get; set; } = "";
    public string Title { get; set; } = "";   // 如「上午診 1-30 號」
    public int? StartNumber { get; set; }
    public int Patients { get; set; }          // 預設容量上限
    public int Sort { get; set; }
}
