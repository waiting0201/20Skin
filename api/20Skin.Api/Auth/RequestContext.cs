using System.Security.Claims;
using Skin.Core.Constants;

namespace Skin.Api.Auth;

/// <summary>每請求一份（scoped）。承載已驗證的使用者，供 controller 注入使用。</summary>
public sealed class RequestContext
{
    public ClaimsPrincipal? User { get; set; }

    public bool IsAuthenticated => User?.Identity?.IsAuthenticated == true;
    public Guid? UserId => Guid.TryParse(User?.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : null;
    public string? Role => User?.FindFirst(ClaimTypes.Role)?.Value;
    public bool IsAdmin => Role == Roles.Admin;
    public bool IsMember => Role == Roles.Member;
    public bool IsSuperAdmin => string.Equals(User?.FindFirst("is_super_admin")?.Value, "true", StringComparison.OrdinalIgnoreCase);
}
