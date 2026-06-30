namespace Skin.Api.Routing;

/// <summary>標記類別為 API controller（供 router 反射掃描）。建構子可注入 DI 服務。</summary>
[AttributeUsage(AttributeTargets.Class)]
public sealed class ApiControllerAttribute : Attribute;

/// <summary>
/// 標記 action 的 HTTP method 與路由樣板（相對 /api/）。
/// 樣板段可含 {param} 對應 method 參數，例：[ApiRoute("GET", "appointments/{id}")]。
/// </summary>
[AttributeUsage(AttributeTargets.Method)]
public sealed class ApiRouteAttribute(string method, string template) : Attribute
{
    public string Method { get; } = method.ToUpperInvariant();
    public string Template { get; } = template.Trim('/');
}

/// <summary>要求已認證；可指定角色（member/admin）。授權真相在此，前端 guard 僅體驗。</summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public sealed class AuthorizeAttribute(string? role = null) : Attribute
{
    public string? Role { get; } = role;
}
