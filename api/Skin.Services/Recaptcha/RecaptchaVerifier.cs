using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;

namespace Skin.Services.Recaptcha;

/// <summary>
/// 呼叫 Google siteverify 驗證 reCAPTCHA v3。
/// 開發環境若未設 SecretKey 則直接通過（方便本機測試）；正式環境 secret 由 Key Vault 提供。
/// </summary>
public sealed class RecaptchaVerifier(HttpClient http, RecaptchaOptions options, ILogger<RecaptchaVerifier> logger) : IRecaptchaVerifier
{
    private sealed class SiteVerifyResponse
    {
        public bool Success { get; set; }
        public double Score { get; set; }
        public string? Action { get; set; }

        [JsonPropertyName("error-codes")]
        public string[]? ErrorCodes { get; set; }
    }

    public async Task<bool> VerifyAsync(string token, string expectedAction, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(options.SecretKey))
            return true; // dev bypass

        if (string.IsNullOrWhiteSpace(token))
        {
            logger.LogWarning("reCAPTCHA 驗證失敗：前端未附上 token（可能是 grecaptcha 腳本被擋或載入失敗）。action={Action}", expectedAction);
            return false;
        }

        SiteVerifyResponse? result;
        try
        {
            var resp = await http.PostAsync(
                "https://www.google.com/recaptcha/api/siteverify",
                new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["secret"] = options.SecretKey,
                    ["response"] = token,
                }), ct);
            result = await resp.Content.ReadFromJsonAsync<SiteVerifyResponse>(ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "reCAPTCHA 驗證失敗：呼叫 Google siteverify 發生例外（可能是伺服器對外網路無法連到 google.com）");
            return false;
        }

        var ok = result is { Success: true }
            && result.Score >= options.MinScore
            && string.Equals(result.Action, expectedAction, StringComparison.OrdinalIgnoreCase);

        if (!ok)
        {
            logger.LogWarning(
                "reCAPTCHA 驗證失敗：success={Success} score={Score} action={Action} expectedAction={ExpectedAction} errorCodes={ErrorCodes}",
                result?.Success, result?.Score, result?.Action, expectedAction,
                result?.ErrorCodes is null ? "" : string.Join(',', result.ErrorCodes));
        }

        return ok;
    }
}
