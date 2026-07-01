namespace Skin.Data.Entities;

/// <summary>
/// 後台管理員。對應 reused DB 既有資料表 `Admins`（schema 不可改）。
/// Password 為明碼欄位（沿用；雜湊待 schema 核准，見 docs/design/security.md）。
/// </summary>
public class Admins
{
    public Guid AdminID { get; set; }
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";  // 明碼（沿用舊系統）
    public string? Name { get; set; }
}
