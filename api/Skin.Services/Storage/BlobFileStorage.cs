using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Skin.Core;

namespace Skin.Services.Storage;

public sealed class BlobFileStorage(StorageOptions options) : IFileStorage
{
    // 釘住 service 版本：SDK 預設版本較新，本機 Azurite 3.35 不支援會回 InvalidHeaderValue。
    // 正式 Azure 支援所有較舊版本，故此釘版對正式環境安全。
    private readonly BlobContainerClient _container = new(
        options.ConnectionString, options.Container,
        new BlobClientOptions(BlobClientOptions.ServiceVersion.V2025_11_05));
    private Task? _ensured;

    public async Task<SavedFile> SaveAsync(
        string folder, Stream content, string contentType, string originalFileName, long length, CancellationToken ct = default)
    {
        folder = (folder ?? "").Trim().ToLowerInvariant();
        if (!options.AllowedFolders.Contains(folder))
            throw new BusinessException("不支援的上傳目錄", "INVALID_FOLDER");
        if (string.IsNullOrEmpty(contentType) || !options.AllowedContentTypes.Contains(contentType))
            throw new BusinessException("僅支援 JPG／PNG／WEBP／GIF 圖片", "INVALID_TYPE");
        if (length <= 0 || length > options.MaxBytes)
            throw new BusinessException($"檔案大小需在 {options.MaxBytes / 1024 / 1024} MB 以內", "FILE_TOO_LARGE");

        // 容器建立一次（public-blob：讓 <img src> 直接讀，沿用舊站公開靜態檔行為）。
        _ensured ??= _container.CreateIfNotExistsAsync(PublicAccessType.Blob, cancellationToken: ct);
        await _ensured;

        var filename = Guid.NewGuid().ToString("N") + ExtFor(contentType, originalFileName);
        var blob = _container.GetBlobClient($"{folder}/{filename}");
        await blob.UploadAsync(content,
            new BlobUploadOptions { HttpHeaders = new BlobHttpHeaders { ContentType = contentType } }, ct);

        return new SavedFile(filename, folder, blob.Uri.ToString());
    }

    private static string ExtFor(string contentType, string originalName) => contentType.ToLowerInvariant() switch
    {
        "image/jpeg" => ".jpg",
        "image/png" => ".png",
        "image/webp" => ".webp",
        "image/gif" => ".gif",
        _ => Path.GetExtension(originalName) is { Length: > 0 } e ? e.ToLowerInvariant() : ".bin",
    };
}
