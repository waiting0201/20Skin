using System.Security.Claims;
using System.Text.Json;
using System.Text.RegularExpressions;
using Skin.Api.Auth;
using Skin.Api.Routing;
using Skin.Core;
using Skin.Core.Constants;
using Skin.Core.Dtos;
using Skin.Services;
using Skin.Services.Admin;
using Skin.Services.Recaptcha;

namespace Skin.Api.Controllers;

/// <summary>
/// 認證端點。會員：身分證+生日；管理員：帳號+密碼。
/// 見 docs/blueprints/member-auth.md、admin-auth-authority.md、docs/design/security.md。
/// </summary>
[ApiController]
public sealed class AuthController(
    IMemberService members,
    IAdminService admins,
    IRecaptchaVerifier recaptcha,
    JwtTokenService jwt,
    SuperAdminOptions superAdmin,
    RequestContext ctx)
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public sealed record MemberLoginRequest(string Number, int Yyyy, int Mm, int Dd, string GoogleCaptchaToken);
    public sealed record AdminLoginRequest(string Username, string Password, string GoogleCaptchaToken);

    /// <summary>1=成功 / 2=新客（導註冊）/ 3=黑名單（沿用舊系統語意）。IsFirstVisit：初診/複診（見舊 Reserve.UpdateVisit），供前台麵包屑顯示。</summary>
    public sealed record LoginResult(int Status, string? Token = null, Guid? MemberId = null, string? Message = null, bool? IsFirstVisit = null);

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
        // 既有會員登入一律為複診（沿用舊 Login POST 固定 UpdateVisit("N")）。
        return ApiResponse<LoginResult>.Ok(new LoginResult(Status: 1, Token: token, MemberId: member.MemberID, IsFirstVisit: false));
    }

    /// <summary>
    /// POST /api/auth/member/register — 初診建檔（JoinUs）→ 直接登入態（簽 JWT）。
    /// 已存在（身分證+生日）則不重複建檔、直接登入（沿用舊行為）。見 docs/blueprints/member-auth.md。
    /// </summary>
    [ApiRoute("POST", "auth/member/register")]
    public async Task<ApiResponse<LoginResult>> MemberRegister(RegisterMemberRequest req)
    {
        if (!await recaptcha.VerifyAsync(req.GoogleCaptchaToken, "login"))
            return ApiResponse<LoginResult>.Fail("reCAPTCHA 驗證失敗", "RECAPTCHA_FAILED");

        var number = (req.Number ?? "").Trim().ToUpperInvariant();
        if (!Regex.IsMatch(number, "^[A-Z][0-9]{9}$"))
            return ApiResponse<LoginResult>.Fail("身分證格式錯誤", "INVALID_NUMBER");
        if (string.IsNullOrWhiteSpace(req.Name))
            return ApiResponse<LoginResult>.Fail("請輸入姓名", "INVALID_NAME");
        if (!Regex.IsMatch(req.Mobile ?? "", "^09[0-9]{8}$"))
            return ApiResponse<LoginResult>.Fail("手機格式錯誤", "INVALID_MOBILE");
        if (!TryBuildDate(req.Yyyy, req.Mm, req.Dd, out var birthday))
            return ApiResponse<LoginResult>.Fail("生日格式錯誤", "INVALID_BIRTHDAY");

        var (member, isNew) = await members.RegisterAsync(req, birthday);

        if (member.IsBlackList)
            return ApiResponse<LoginResult>.Ok(new LoginResult(Status: 3, Message: "您的帳號已被限制預約，請洽診所"));

        var token = jwt.CreateToken([
            new Claim(ClaimTypes.NameIdentifier, member.MemberID.ToString()),
            new Claim(ClaimTypes.Name, member.Name ?? ""),
            new Claim(ClaimTypes.Role, Roles.Member),
        ]);
        // isNew：新建會員→初診；身分證+生日已存在→複診（沿用舊 JoinUs POST 邏輯）。
        return ApiResponse<LoginResult>.Ok(new LoginResult(Status: 1, Token: token, MemberId: member.MemberID, IsFirstVisit: isNew));
    }

    /// <summary>
    /// POST /api/auth/admin/login — 帳密(+reCAPTCHA) → JWT（帶 is_super_admin + 攤平 perms）。
    /// 超管為設定驅動（取代舊硬編碼 weypro）；一般管理員明碼比對（schema 不可改，雜湊待核准）。
    /// </summary>
    [ApiRoute("POST", "auth/admin/login")]
    public async Task<ApiResponse<AdminLoginResult>> AdminLogin(AdminLoginRequest req)
    {
        if (!await recaptcha.VerifyAsync(req.GoogleCaptchaToken, "login"))
            return ApiResponse<AdminLoginResult>.Fail("reCAPTCHA 驗證失敗", "RECAPTCHA_FAILED");

        var username = (req.Username ?? "").Trim();

        // 1) 超管（設定驅動）：全放行
        if (superAdmin.Matches(username, req.Password ?? ""))
            return ApiResponse<AdminLoginResult>.Ok(new AdminLoginResult(
                CreateAdminToken(Guid.Empty, username, isSuper: true, perms: [])));

        // 2) 一般管理員：明碼比對
        var admin = await admins.FindByUsernameAsync(username);
        if (admin is null || admin.Password != (req.Password ?? ""))
            return ApiResponse<AdminLoginResult>.Fail("帳號或密碼錯誤", "INVALID_CREDENTIALS");

        var lims = await admins.ListLimsAsync();
        var adminLims = await admins.GetAdminLimsAsync(admin.AdminID);
        var perms = AuthorizationDomain.Flatten(lims, adminLims);

        return ApiResponse<AdminLoginResult>.Ok(new AdminLoginResult(
            CreateAdminToken(admin.AdminID, admin.Name ?? admin.Username, isSuper: false, perms)));
    }

    /// <summary>簽發後台 JWT。perms 以 JSON 字串 claim 承載（前端解析、router 比對）。</summary>
    private string CreateAdminToken(Guid adminId, string name, bool isSuper, List<AdminPermDto> perms)
        => jwt.CreateToken([
            new Claim(ClaimTypes.NameIdentifier, adminId.ToString()),
            new Claim(ClaimTypes.Name, name),
            new Claim(ClaimTypes.Role, Roles.Admin),
            new Claim("is_super_admin", isSuper ? "true" : "false"),
            new Claim("perms", JsonSerializer.Serialize(perms, JsonOpts)),
        ]);

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
