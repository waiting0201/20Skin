using System.Security.Claims;
using System.Text.Json;
using Skin.Core.Constants;

namespace Skin.Api.Auth;

/// <summary>每請求一份（scoped）。承載已驗證的使用者，供 controller 注入使用。</summary>
public sealed class RequestContext
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public ClaimsPrincipal? User { get; set; }

    public bool IsAuthenticated => User?.Identity?.IsAuthenticated == true;
    public Guid? UserId => Guid.TryParse(User?.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : null;
    public string? Role => User?.FindFirst(ClaimTypes.Role)?.Value;
    public bool IsAdmin => Role == Roles.Admin;
    public bool IsMember => Role == Roles.Member;
    public bool IsSuperAdmin => string.Equals(User?.FindFirst("is_super_admin")?.Value, "true", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// 是否可讀取某後台資源（對應 Lims.Key；超管一律可）。read 語意與 ApiRouterFunction.HasPermission
    /// 一致：perms claim 有列該資源即可。供「單一端點內依權限決定回應區塊」的場景（如儀表板）使用；
    /// 逐端點授權仍走 [Authorize(Resource=..)]。
    /// </summary>
    public bool CanRead(string resource)
    {
        if (!IsAdmin) return false;
        if (IsSuperAdmin) return true;

        var permsJson = User?.FindFirst("perms")?.Value;
        if (string.IsNullOrEmpty(permsJson)) return false;

        try
        {
            var perms = JsonSerializer.Deserialize<PermClaim[]>(permsJson, JsonOpts);
            return perms?.Any(p => string.Equals(p.Key, resource, StringComparison.OrdinalIgnoreCase)) == true;
        }
        catch
        {
            return false;
        }
    }

    private sealed record PermClaim(string Key);
}
