namespace Skin.Services.Sms;

public sealed record SmsSendResult(bool Success, string? UniqId, string? Message);

/// <summary>
/// 簡訊寄送抽象。見 docs/blueprints/sms-reminder.md。
/// 正式環境用智邦 API 實作；開發/測試用 DevNoOpSmsSender（不真的發送）。
/// </summary>
public interface ISmsSender
{
    Task<SmsSendResult> SendAsync(string mobile, string body, CancellationToken ct = default);
}
