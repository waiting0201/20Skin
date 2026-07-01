namespace Skin.Services.Storage;

/// <summary>已存檔資訊。<see cref="Filename"/> 存入 DB（如 Appointments.Photo，相容舊系統只存檔名）。</summary>
public sealed record SavedFile(string Filename, string Folder, string Url);

/// <summary>檔案儲存（Azure Blob）。取代舊系統 ~/Upload 本機磁碟（Functions 檔案系統為臨時）。</summary>
public interface IFileStorage
{
    /// <summary>驗證（目錄白名單/型別/大小）後存到 <c>{container}/{folder}/{guid}{ext}</c>；回檔名+公開 URL。</summary>
    Task<SavedFile> SaveAsync(
        string folder, Stream content, string contentType, string originalFileName, long length, CancellationToken ct = default);
}
