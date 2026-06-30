using System.Net.Http.Json;

namespace Skin.Services.Recaptcha;

/// <summary>
/// 呼叫 Google siteverify 驗證 reCAPTCHA v3。
/// 開發環境若未設 SecretKey 則直接通過（方便本機測試）；正式環境 secret 由 Key Vault 提供。
/// </summary>
public sealed class RecaptchaVerifier(HttpClient http, RecaptchaOptions options) : IRecaptchaVerifier
{
    private sealed class SiteVerifyResponse
    {
        public bool Success { get; set; }
        public double Score { get; set; }
        public string? Action { get; set; }
    }

    public async Task<bool> VerifyAsync(string token, string expectedAction, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(options.SecretKey))
            return true; // dev bypass

        if (string.IsNullOrWhiteSpace(token)) return false;

        var resp = await http.PostAsync(
            "https://www.google.com/recaptcha/api/siteverify",
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["secret"] = options.SecretKey,
                ["response"] = token,
            }), ct);

        var result = await resp.Content.ReadFromJsonAsync<SiteVerifyResponse>(ct);
        return result is { Success: true }
            && result.Score >= options.MinScore
            && string.Equals(result.Action, expectedAction, StringComparison.OrdinalIgnoreCase);
    }
}
