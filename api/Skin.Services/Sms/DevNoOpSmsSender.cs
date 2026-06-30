using Microsoft.Extensions.Logging;

namespace Skin.Services.Sms;

/// <summary>
/// 開發/測試用：**不真的發送簡訊**（客人手機，避免誤發造成困擾），只記 log。
/// 正式環境改注入智邦 API 實作。
/// </summary>
public sealed class DevNoOpSmsSender(ILogger<DevNoOpSmsSender> logger) : ISmsSender
{
    public Task<SmsSendResult> SendAsync(string mobile, string body, CancellationToken ct = default)
    {
        var masked = mobile.Length >= 4 ? $"****{mobile[^3..]}" : "****";
        logger.LogInformation("[DEV no-op SMS] 不實際發送。to={Mobile} bodyLen={Len}", masked, body.Length);
        return Task.FromResult(new SmsSendResult(true, "dev-noop", "DEV: not actually sent"));
    }
}
