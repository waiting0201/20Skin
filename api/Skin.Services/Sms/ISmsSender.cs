namespace Skin.Services.Sms;

/// <param name="Success">是否視為發送成功（依供應商回應判定）。</param>
/// <param name="UniqId">供應商回傳的唯一序號（智邦 uniqid）。</param>
/// <param name="Message">供應商回傳訊息。</param>
/// <param name="RawStatus">
/// 供應商回傳的原始 status 字串（智邦 response["status"]），寫入 SmsStatus.Status 以貼近舊系統
/// （舊系統原樣存 response["status"]）。no-op/未知時可為 null。
/// </param>
public sealed record SmsSendResult(bool Success, string? UniqId, string? Message, string? RawStatus = null);

/// <summary>
/// 簡訊寄送抽象。見 docs/blueprints/sms-reminder.md。
/// 正式環境用智邦 API 實作；開發/測試用 DevNoOpSmsSender（不真的發送）。
/// </summary>
public interface ISmsSender
{
    Task<SmsSendResult> SendAsync(string mobile, string body, CancellationToken ct = default);
}
