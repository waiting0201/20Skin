namespace Skin.Services.Recaptcha;

public sealed class RecaptchaOptions
{
    public string SecretKey { get; set; } = "";
    public double MinScore { get; set; } = 0.5;
}

public interface IRecaptchaVerifier
{
    /// <summary>驗證 reCAPTCHA v3 token（score 門檻 + action）。見 docs/design/security.md。</summary>
    Task<bool> VerifyAsync(string token, string expectedAction, CancellationToken ct = default);
}
