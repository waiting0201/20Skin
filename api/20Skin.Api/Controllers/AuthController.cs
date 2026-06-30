using System.Security.Claims;
using Skin.Api.Auth;
using Skin.Api.Routing;
using Skin.Core;
using Skin.Core.Constants;
using Skin.Services;
using Skin.Services.Recaptcha;

namespace Skin.Api.Controllers;

/// <summary>
/// 認證端點。會員：身分證+生日；管理員：帳號+密碼。
/// 見 docs/blueprints/member-auth.md、admin-auth-authority.md、docs/design/security.md。
/// </summary>
[ApiController]
public sealed class AuthController(
    IMemberService members,
    IRecaptchaVerifier recaptcha,
    JwtTokenService jwt,
    RequestContext ctx)
{
    public sealed record MemberLoginRequest(string Number, int Yyyy, int Mm, int Dd, string GoogleCaptchaToken);
    public sealed record AdminLoginRequest(string Username, string Password, string GoogleCaptchaToken);

    /// <summary>1=成功 / 2=新客（導註冊）/ 3=黑名單（沿用舊系統語意）。</summary>
    public sealed record LoginResult(int Status, string? Token = null, Guid? MemberId = null, string? Message = null);

    /// <summary>POST /api/auth/member/login — 身分證+生日 → JWT。</summary>
    [ApiRoute("POST", "auth/member/login")]
    public async Task<ApiResponse<LoginResult>> MemberLogin(MemberLoginRequest req)
    {
        if (!await recaptcha.VerifyAsync(req.GoogleCaptchaToken, "login"))
            return ApiResponse<LoginResult>.Fail("reCAPTCHA 驗證失敗", "RECAPTCHA_FAILED");

        if (!TryBuildDate(req.Yyyy, req.Mm, req.Dd, out var birthday))
            return ApiResponse<LoginResult>.Fail("生日格式錯誤", "INVALID_BIRTHDAY");

        var member = await members.FindByNumberAndBirthdayAsync(req.Number, birthday);
        if (member is null)
            return ApiResponse<LoginResult>.Ok(new LoginResult(Status: 2, Message: "查無資料，請填寫初診表單"));

        if (member.IsBlackList)
            return ApiResponse<LoginResult>.Ok(new LoginResult(Status: 3, Message: "您的帳號已被限制預約，請洽診所"));

        var token = jwt.CreateToken([
            new Claim(ClaimTypes.NameIdentifier, member.MemberID.ToString()),
            new Claim(ClaimTypes.Name, member.Name ?? ""),
            new Claim(ClaimTypes.Role, Roles.Member),
        ]);
        return ApiResponse<LoginResult>.Ok(new LoginResult(Status: 1, Token: token, MemberId: member.MemberID));
    }

    /// <summary>POST /api/auth/admin/login — TODO: 驗證 Admins、攤平 Lims/AdminLims 進 claims。</summary>
    [ApiRoute("POST", "auth/admin/login")]
    public ApiResponse AdminLogin(AdminLoginRequest req)
        => ApiResponse.Fail("尚未實作：見 blueprints/admin-auth-authority.md", "NOT_IMPLEMENTED");

    /// <summary>GET /api/auth/me — 當前 token 身分。</summary>
    [ApiRoute("GET", "auth/me")]
    [Authorize]
    public object Me() => new
    {
        userId = ctx.UserId,
        role = ctx.Role,
        name = ctx.User?.FindFirst(ClaimTypes.Name)?.Value,
    };

    private static bool TryBuildDate(int y, int m, int d, out DateTime date)
    {
        try { date = new DateTime(y, m, d); return true; }
        catch { date = default; return false; }
    }
}
