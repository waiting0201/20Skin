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

    /// <summary>智邦簡訊 API 端點。</summary>
    public string ApiUrl { get; init; } = "https://pp.url.com.tw/api/msg";

    public string ApiKey { get; init; } = "";
    public string Username { get; init; } = "";
    public string Password { get; init; } = "";
}
