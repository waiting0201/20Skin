namespace Skin.Data.Entities;

/// <summary>
/// 會員/病患。對應 reused DB 既有資料表 `Members`（schema 不可改）。
/// 純 POCO，Dapper 依「屬性名 = 資料表欄位名」自動對應；欄位須與
/// docs/old/design/database-design.md §2.9 完全一致（含沿用的 Createdate 小寫命名）。
/// </summary>
public class Members
{
    public Guid MemberID { get; set; }
    public string Number { get; set; } = "";   // 身分證字號
    public string Mobile { get; set; } = "";
    public DateTime Birthday { get; set; }
    public string? Name { get; set; }
    public int? Gender { get; set; }            // 0=未知/1=男/2=女
    public string? BloodType { get; set; }
    public string? Email { get; set; }
    public int? ZipcodeID { get; set; }
    public string? Address { get; set; }
    public string? EmergencyName { get; set; }
    public string? EmergencyPhone { get; set; }
    public string? Allergy { get; set; }        // CSV 多選（沿用）
    public string? AllergyOther { get; set; }
    public string? MedicalHistory { get; set; } // CSV 多選（沿用）
    public string? MedicalHistoryOther { get; set; }
    public bool IsBlackList { get; set; }
    public DateTime Createdate { get; set; }    // 沿用：小寫 d
}
