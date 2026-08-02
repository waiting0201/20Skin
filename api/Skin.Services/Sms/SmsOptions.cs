namespace Skin.Services.Sms;

/// <summary>
/// 簡訊發送設定（智邦 API 帳密 + 總開關）。見 docs/blueprints/sms-reminder.md。
/// 機密（ApiKey/Username/Password）正式環境由 Key Vault 提供，勿硬編碼。
/// </summary>
public sealed class SmsOptions
{
    /// <summary>
    /// 真發總開關。false = 一律不真發（注入 DevNoOpSmsSender、Timer 早退不動列）。
    /// 正式環境部署後預設停用，智邦帳號驗證通過後再手動開啟。
    /// </summary>
    public bool Enabled { get; init; }

    /// <summary>
    /// 分項開關①：建立預約當下的「即時確認」簡訊。false = 仍寫入 SmsStatus（保留稽核），
    /// 但不呼叫供應商、直接回寫 <see cref="Skin.Core.Constants.SmsStatusValue.Off"/>
    /// （必須寫成非 null，否則該列會被當日 Timer 撈走補送，違反關閉意圖）。預設 true。
    /// </summary>
    public bool ImmediateEnabled { get; init; } = true;

    /// <summary>
    /// 分項開關②：Timer 排程的「前一天提醒」簡訊。false = Timer 早退、不動任何列
    /// （待發列保持 null，日後開啟只撈當日、無 backlog 洪水，與總開關同語義；切換即時可逆）。預設 true。
    /// </summary>
    public bool ReminderEnabled { get; init; } = true;

    /// <summary>
    /// 分項開關③：取消預約時把未發送的 SmsStatus 標記 CANCEL。false = 不標記。
    /// ⚠️ 關閉代表已取消的預約其「前一天提醒」仍會照常發出（僅供除錯/比對舊行為用，正常營運勿關）。預設 true。
    /// </summary>
    public bool CancelEnabled { get; init; } = true;

    /// <summary>智邦簡訊 API 端點。</summary>
    public string ApiUrl { get; init; } = "https://pp.url.com.tw/api/msg";

    public string ApiKey { get; init; } = "";
    public string Username { get; init; } = "";
    public string Password { get; init; } = "";
}
