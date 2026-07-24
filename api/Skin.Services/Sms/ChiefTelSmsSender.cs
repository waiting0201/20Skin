using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;

namespace Skin.Services.Sms;

/// <summary>
/// 智邦（世紀智邦 PP 一元簡訊）發送實作。對應舊系統 reference/old/20Skin/Commons/SmsHandler.cs。
///
/// 修舊系統安全問題：
///   - 改走 HTTPS（<see cref="SmsOptions.ApiUrl"/> 預設 https），**不停用憑證驗證**
///     （舊系統 ServerCertificateValidationCallback => true 一律信任，不照抄）。
///   - 帳密改由設定/Key Vault 提供，不硬編碼。
///
/// 表單參數沿用智邦格式：api_key / user_name / password / sms_body / sms_list（門號結尾補逗號）。
/// sms_time 省略＝立即發。回應為單引號包住的 key/value 對（見 <see cref="ParseResponse"/>）。
/// </summary>
public sealed partial class ChiefTelSmsSender(HttpClient http, SmsOptions options, ILogger<ChiefTelSmsSender> logger)
    : ISmsSender
{
    public async Task<SmsSendResult> SendAsync(string mobile, string body, CancellationToken ct = default)
    {
        string raw;
        try
        {
            // sms_list：仿舊系統，每個門號後補一個逗號（結尾亦有逗號）。
            var content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["api_key"] = options.ApiKey,
                ["user_name"] = options.Username,
                ["password"] = options.Password,
                ["sms_body"] = body,
                ["sms_list"] = mobile + ",",
            });
            using var resp = await http.PostAsync(options.ApiUrl, content, ct);
            raw = await resp.Content.ReadAsStringAsync(ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "簡訊發送失敗：呼叫智邦 API 發生例外。to={Mobile}", Mask(mobile));
            return new SmsSendResult(false, null, ex.Message, null);
        }

        var parsed = ParseResponse(raw);
        var status = parsed.GetValueOrDefault("status");
        var message = parsed.GetValueOrDefault("message");
        var uniqid = parsed.GetValueOrDefault("uniqid");

        // 智邦未提供明確成功旗標；以「有回傳 uniqid」視為已受理（成功 token 待正式驗證，見 blueprint 風險）。
        var success = !string.IsNullOrEmpty(uniqid);
        if (!success)
            logger.LogWarning("簡訊發送未成功：to={Mobile} status={Status} message={Message} raw={Raw}",
                Mask(mobile), status, message, raw);

        return new SmsSendResult(success, uniqid, message, status);
    }

    /// <summary>
    /// 解析智邦回應：抓所有被單引號包住的字串，成對取出當 key/value。仿舊 SmsHandler.ParseResponse。
    /// </summary>
    private static Dictionary<string, string> ParseResponse(string raw)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var matches = QuotedTokenRegex().Matches(raw);
        for (var i = 0; i + 1 < matches.Count; i += 2)
        {
            var key = matches[i].Groups[1].Value;
            var value = matches[i + 1].Groups[1].Value;
            result[key] = value;
        }
        return result;
    }

    private static string Mask(string mobile) => mobile.Length >= 4 ? $"****{mobile[^3..]}" : "****";

    [GeneratedRegex("'([^']*)'")]
    private static partial Regex QuotedTokenRegex();
}
