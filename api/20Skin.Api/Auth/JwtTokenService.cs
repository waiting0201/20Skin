using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Skin.Api.Auth;

public sealed class JwtOptions
{
    public string SigningKey { get; set; } = "";
    public string Issuer { get; set; } = "20skin";
    public string Audience { get; set; } = "20skin";
    public int AccessTokenMinutes { get; set; } = 60;
}

/// <summary>
/// 簽發 / 驗證 JWT。金鑰來自設定（正式環境經 Key Vault），見 docs/design/security.md。
/// 會員：身分證+生日驗證後簽發；管理員：帳號+密碼驗證後簽發（claims 帶權限）。
/// </summary>
public sealed class JwtTokenService(JwtOptions options)
{
    private readonly JsonWebTokenHandler _handler = new();
    private SymmetricSecurityKey Key => new(Encoding.UTF8.GetBytes(options.SigningKey));

    public string CreateToken(IEnumerable<Claim> claims)
    {
        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Issuer = options.Issuer,
            Audience = options.Audience,
            Expires = DateTime.UtcNow.AddMinutes(options.AccessTokenMinutes),
            SigningCredentials = new SigningCredentials(Key, SecurityAlgorithms.HmacSha256),
        };
        return _handler.CreateToken(descriptor);
    }

    public async Task<ClaimsPrincipal?> ValidateAsync(string token)
    {
        var result = await _handler.ValidateTokenAsync(token, new TokenValidationParameters
        {
            ValidIssuer = options.Issuer,
            ValidAudience = options.Audience,
            IssuerSigningKey = Key,
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
        });
        return result.IsValid ? new ClaimsPrincipal(result.ClaimsIdentity) : null;
    }
}
