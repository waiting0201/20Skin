namespace Skin.Data.Entities;

/// <summary>
/// 權限/選單節點。對應 reused DB 既有資料表 `Lims`（schema 不可改）。
/// 二層樹：ParentID=null 為模組（Icon+Value 顯示、選單標題），其餘為子功能（葉節點）。
/// 舊系統以此渲染左側選單（見 HtmlHelperExtensions.SiteMenuAsUnorderedList）。
/// </summary>
public class Lims
{
    public int LimID { get; set; }
    public string Key { get; set; } = "";      // 資源鍵：模組=controller 名（如 AuthorityMs）、子項=action（如 Admins）
    public string? Value { get; set; }         // 顯示名（中文）
    public string? Icon { get; set; }          // fa-* 圖示（模組層用）
    public int Sort { get; set; }
    public int? ParentID { get; set; }         // null=模組；否則指向所屬模組 LimID
}
