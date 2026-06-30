namespace Skin.Data.Entities;

/// <summary>簡訊狀態。對應 reused DB `SmsStatus`（§2.11）。SmsBody 為 ntext（沿用）。</summary>
public class SmsStatus
{
    public Guid SmsStatusID { get; set; }
    public Guid AppointmentID { get; set; }
    public string Mobile { get; set; } = "";
    public string SmsBody { get; set; } = "";
    public DateTime SendDate { get; set; }      // 預定發送時間
    public string? Status { get; set; }         // null=待發 / "CANCEL"=取消 / 其他=發送結果
    public string? Message { get; set; }
    public string? UniqID { get; set; }
    public DateTime CreateDate { get; set; }    // 沿用：大寫 D
    public DateTime? UpdateDate { get; set; }
}
