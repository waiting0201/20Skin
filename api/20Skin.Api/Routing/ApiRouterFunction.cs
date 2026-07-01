using System.Reflection;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Skin.Api.Auth;
using Skin.Core;

namespace Skin.Api.Routing;

/// <summary>
/// 單一 catch-all HttpTrigger，自訂 router 分派到 controller/action。
/// pipeline：路由比對 → JWT 驗證 → 授權 → model binding → invoke → 統一回應/錯誤。
/// 見 docs/design/api-design.md、backend-design.md。
/// </summary>
public sealed class ApiRouterFunction(
    RouteTable table,
    IServiceScopeFactory scopeFactory,
    JwtTokenService jwt,
    ILogger<ApiRouterFunction> logger)
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    [Function("ApiRouter")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", "post", "put", "patch", "delete", Route = "{*path}")]
        HttpRequest req,
        string? path)
    {
        var entry = table.Match(req.Method, path ?? "", out var routeValues);
        if (entry is null)
            return new NotFoundObjectResult(ApiResponse.Fail("找不到資源", "NOT_FOUND"));

        // --- JWT 驗證 ---
        ClaimsPrincipal? user = null;
        var authHeader = req.Headers.Authorization.ToString();
        if (authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            user = await jwt.ValidateAsync(authHeader["Bearer ".Length..].Trim());

        // --- 授權 ---
        if (entry.Authorize is not null)
        {
            if (user?.Identity?.IsAuthenticated != true)
                return new UnauthorizedObjectResult(ApiResponse.Fail("未登入", "UNAUTHORIZED"));
            if (entry.Authorize.Role is { } role &&
                user.FindFirst(ClaimTypes.Role)?.Value != role)
                return new ObjectResult(ApiResponse.Fail("權限不足", "FORBIDDEN")) { StatusCode = 403 };

            // 逐操作授權（後台）：超管放行，否則比對 JWT perms 的 add/update/delete
            if (entry.Authorize.Resource is { } resource &&
                !HasPermission(user, resource, entry.Authorize.Op ?? "read"))
                return new ObjectResult(ApiResponse.Fail("權限不足", "FORBIDDEN")) { StatusCode = 403 };
        }

        using var scope = scopeFactory.CreateScope();
        scope.ServiceProvider.GetRequiredService<RequestContext>().User = user;

        try
        {
            var controller = ActivatorUtilities.CreateInstance(scope.ServiceProvider, entry.ControllerType);
            var args = await BindArgumentsAsync(entry.Action, routeValues, req);
            var resultObj = entry.Action.Invoke(controller, args);
            if (resultObj is Task task)
            {
                await task;
                resultObj = task.GetType().IsGenericType
                    ? task.GetType().GetProperty("Result")!.GetValue(task)
                    : null;
            }
            // 已是信封/IActionResult → 直接回；null → 空成功；其他 → 包成功信封
            return resultObj switch
            {
                IActionResult ar => ar,
                IApiResponse env => new OkObjectResult(env),
                null => new OkObjectResult(ApiResponse.Ok()),
                _ => new OkObjectResult(ApiResponseFactory.Ok(resultObj)),
            };
        }
        catch (TargetInvocationException tie) when (tie.InnerException is BusinessException be)
        {
            return new OkObjectResult(ApiResponse.Fail(be.Message, be.Code));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "API 未預期例外 {Method} {Path}", req.Method, path);
            return new ObjectResult(new ProblemDetails { Title = "伺服器錯誤", Status = 500 }) { StatusCode = 500 };
        }
    }

    /// <summary>比對 JWT perms claim：超管放行；否則該 resource 的對應操作旗標為真（read 只需存在）。</summary>
    private static bool HasPermission(ClaimsPrincipal user, string resource, string op)
    {
        if (string.Equals(user.FindFirst("is_super_admin")?.Value, "true", StringComparison.OrdinalIgnoreCase))
            return true;

        var permsJson = user.FindFirst("perms")?.Value;
        if (string.IsNullOrEmpty(permsJson)) return false;

        PermClaim[]? perms;
        try { perms = JsonSerializer.Deserialize<PermClaim[]>(permsJson, JsonOpts); }
        catch { return false; }

        var p = perms?.FirstOrDefault(x => string.Equals(x.Key, resource, StringComparison.OrdinalIgnoreCase));
        if (p is null) return false;

        return op.ToLowerInvariant() switch
        {
            "add" => p.Add,
            "update" => p.Update,
            "delete" => p.Delete,
            _ => true,   // read：有列即可
        };
    }

    private sealed record PermClaim(string Key, string Module, bool Add, bool Update, bool Delete);

    private static async Task<object?[]> BindArgumentsAsync(
        MethodInfo action, IReadOnlyDictionary<string, string> routeValues, HttpRequest req)
    {
        var pars = action.GetParameters();
        var args = new object?[pars.Length];
        object? body = null;
        var bodyRead = false;

        for (var i = 0; i < pars.Length; i++)
        {
            var p = pars[i];
            if (p.Name is not null && routeValues.TryGetValue(p.Name, out var rv))
            {
                args[i] = Convert(rv, p.ParameterType);
            }
            else if (p.ParameterType == typeof(ClaimsPrincipal))
            {
                args[i] = null; // 由 RequestContext 取用；保留以利擴充
            }
            else if (IsSimple(p.ParameterType))
            {
                // 簡單型別（含 Guid/DateTime/enum）：從 query string 綁定
                if (req.Query.TryGetValue(p.Name!, out var qv) && !string.IsNullOrEmpty(qv))
                    args[i] = Convert(qv.ToString(), p.ParameterType);
                else
                    args[i] = p.HasDefaultValue ? p.DefaultValue
                        : p.ParameterType.IsValueType ? Activator.CreateInstance(p.ParameterType) : null;
            }
            else
            {
                // 複雜型別（class/record）：從 JSON body 綁定
                if (!bodyRead)
                {
                    using var reader = new StreamReader(req.Body);
                    var json = await reader.ReadToEndAsync();
                    body = string.IsNullOrWhiteSpace(json) ? null
                        : JsonSerializer.Deserialize(json, p.ParameterType, JsonOpts);
                    bodyRead = true;
                }
                args[i] = body;
            }
        }
        return args;
    }

    /// <summary>可由 route/query 字串綁定的簡單型別（含 Guid/DateTime/enum/decimal 及其 Nullable）。</summary>
    private static bool IsSimple(Type t)
    {
        var u = Nullable.GetUnderlyingType(t) ?? t;
        return u.IsPrimitive || u.IsEnum
            || u == typeof(string) || u == typeof(Guid)
            || u == typeof(DateTime) || u == typeof(DateTimeOffset)
            || u == typeof(decimal) || u == typeof(TimeSpan);
    }

    private static object? Convert(string value, Type t)
    {
        var target = Nullable.GetUnderlyingType(t) ?? t;
        if (target == typeof(string)) return value;
        if (target.IsEnum) return Enum.Parse(target, value, ignoreCase: true);
        if (target == typeof(Guid)) return Guid.Parse(value);
        if (target == typeof(int)) return int.Parse(value);
        if (target == typeof(DateTime)) return DateTime.Parse(value);
        if (target == typeof(bool)) return bool.Parse(value);
        return System.Convert.ChangeType(value, target);
    }
}

/// <summary>泛型 ApiResponse.Ok 包裝（執行期型別）。</summary>
internal static class ApiResponseFactory
{
    public static object Ok(object data)
    {
        var type = typeof(ApiResponse<>).MakeGenericType(data.GetType());
        var method = type.GetMethod(nameof(ApiResponse<object>.Ok))!;
        return method.Invoke(null, [data])!;
    }
}
