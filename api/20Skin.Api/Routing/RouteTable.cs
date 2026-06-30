using System.Reflection;

namespace Skin.Api.Routing;

/// <summary>一條路由：HTTP method + 樣板段 + 目標 controller/action + 授權。</summary>
public sealed class RouteEntry
{
    public required string Method { get; init; }
    public required string[] Segments { get; init; }       // 樣板切段，{x} 表參數
    public required Type ControllerType { get; init; }
    public required MethodInfo Action { get; init; }
    public required AuthorizeAttribute? Authorize { get; init; }
}

/// <summary>
/// 啟動時反射掃描所有 [ApiController]，建立路由表（見 docs/design/backend-design.md 自訂 router）。
/// </summary>
public sealed class RouteTable
{
    private readonly List<RouteEntry> _routes = [];

    public RouteTable(Assembly assembly)
    {
        foreach (var type in assembly.GetTypes()
                     .Where(t => t.GetCustomAttribute<ApiControllerAttribute>() is not null))
        {
            var classAuth = type.GetCustomAttribute<AuthorizeAttribute>();
            foreach (var action in type.GetMethods(BindingFlags.Public | BindingFlags.Instance))
            {
                var route = action.GetCustomAttribute<ApiRouteAttribute>();
                if (route is null) continue;
                _routes.Add(new RouteEntry
                {
                    Method = route.Method,
                    Segments = route.Template.Length == 0 ? [] : route.Template.Split('/'),
                    ControllerType = type,
                    Action = action,
                    Authorize = action.GetCustomAttribute<AuthorizeAttribute>() ?? classAuth,
                });
            }
        }
    }

    public int Count => _routes.Count;

    /// <summary>比對 method + path（已去除前綴 api/）；命中時填入 routeValues。</summary>
    public RouteEntry? Match(string method, string path, out Dictionary<string, string> routeValues)
    {
        routeValues = new(StringComparer.OrdinalIgnoreCase);
        var parts = path.Trim('/').Split('/', StringSplitOptions.RemoveEmptyEntries);

        foreach (var r in _routes)
        {
            if (!string.Equals(r.Method, method, StringComparison.OrdinalIgnoreCase)) continue;
            if (r.Segments.Length != parts.Length) continue;

            var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            var ok = true;
            for (var i = 0; i < parts.Length; i++)
            {
                var seg = r.Segments[i];
                if (seg.StartsWith('{') && seg.EndsWith('}'))
                    values[seg[1..^1]] = Uri.UnescapeDataString(parts[i]);
                else if (!string.Equals(seg, parts[i], StringComparison.OrdinalIgnoreCase))
                {
                    ok = false;
                    break;
                }
            }
            if (ok)
            {
                routeValues = values;
                return r;
            }
        }
        return null;
    }
}
