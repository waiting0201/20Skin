namespace Skin.Data.Entities;

/// <summary>
/// 管理員對子功能（Lim）的授權。對應 reused DB 既有資料表 `AdminLims`（schema 不可改）。
/// 每筆代表某 AdminID 對某 LimID 的三權旗標（讀取權隱含存在即可見）。
/// </summary>
public class AdminLims
{
    public Guid AdminLimID { get; set; }
    public Guid AdminID { get; set; }
    public int LimID { get; set; }
    public bool IsAdd { get; set; }
    public bool IsUpdate { get; set; }
    public bool IsDelete { get; set; }
}
