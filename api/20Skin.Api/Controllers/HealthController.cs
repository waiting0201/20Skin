using Skin.Api.Routing;

namespace Skin.Api.Controllers;

[ApiController]
public sealed class HealthController
{
    /// <summary>GET /api/health — 健康檢查（公開）。</summary>
    [ApiRoute("GET", "health")]
    public object Get() => new { status = "ok", service = "20Skin.Api", utc = DateTime.UtcNow };
}
