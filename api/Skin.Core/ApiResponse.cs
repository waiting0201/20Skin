namespace Skin.Core;

/// <summary>API 回應信封標記（router 用以判斷是否已包裝）。</summary>
public interface IApiResponse;

/// <summary>
/// 統一 API 回應信封。見 docs/design/api-design.md「統一回應與錯誤」。
/// </summary>
public sealed class ApiResponse<T> : IApiResponse
{
    public bool Success { get; init; }
    public T? Data { get; init; }
    public string? Message { get; init; }
    public string? Code { get; init; }

    public static ApiResponse<T> Ok(T data) => new() { Success = true, Data = data };
    public static ApiResponse<T> Fail(string message, string? code = null)
        => new() { Success = false, Message = message, Code = code };
}

/// <summary>無資料的成功回應。</summary>
public sealed class ApiResponse : IApiResponse
{
    public bool Success { get; init; }
    public string? Message { get; init; }
    public string? Code { get; init; }

    public static ApiResponse Ok(string? message = null) => new() { Success = true, Message = message };
    public static ApiResponse Fail(string message, string? code = null)
        => new() { Success = false, Message = message, Code = code };
}

/// <summary>
/// 業務層可預期的失敗，由 router 轉成 ApiResponse.Fail（非 500）。
/// </summary>
public sealed class BusinessException(string message, string? code = null) : Exception(message)
{
    public string? Code { get; } = code;
}
