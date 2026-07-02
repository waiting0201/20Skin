using Microsoft.AspNetCore.Http;
using Skin.Api.Routing;
using Skin.Core;
using Skin.Services.Storage;

namespace Skin.Api.Controllers;

/// <summary>
/// 檔案上傳（Azure Blob）。取代舊系統 ~/Upload 本機磁碟。需已登入（會員或後台管理員皆可）；
/// 資料夾層級白名單（StorageOptions.AllowedFolders）把關，寫入 DB 的端點仍各自鎖對應角色。
/// 容器 upload 下以舊資料夾名分類（預設 appointments）。見 docs/blueprints/file-upload.md、admin-basic-data.md。
/// </summary>
[ApiController]
[Authorize]
public sealed class UploadsController(IFileStorage storage)
{
    /// <summary>POST /api/uploads（multipart：file[+folder]）→ 回 { filename, folder, url }。</summary>
    [ApiRoute("POST", "uploads")]
    public async Task<object> Upload(HttpRequest req)
    {
        if (!req.HasFormContentType)
            return ApiResponse.Fail("需以 multipart/form-data 上傳", "INVALID_REQUEST");

        var form = await req.ReadFormAsync();
        var file = form.Files.GetFile("file") ?? form.Files.FirstOrDefault();
        if (file is null || file.Length == 0)
            return ApiResponse.Fail("未選擇檔案", "NO_FILE");

        var folder = form["folder"].ToString();
        if (string.IsNullOrWhiteSpace(folder)) folder = "appointments";

        await using var stream = file.OpenReadStream();
        var saved = await storage.SaveAsync(folder, stream, file.ContentType, file.FileName, file.Length);
        return ApiResponse<SavedFile>.Ok(saved);
    }
}
