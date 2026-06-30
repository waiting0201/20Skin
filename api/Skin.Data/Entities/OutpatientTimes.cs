namespace Skin.Data.Entities;

/// <summary>門診時段名稱（上午/下午/晚診）。對應 reused DB `OutpatientTimes`（§2.4）。int identity PK。</summary>
public class OutpatientTimes
{
    public int OutpatientTimeID { get; set; }
    public string Title { get; set; } = "";
}
