namespace Skin.Services.Storage;

/// <summary>
/// 檔案儲存設定。連線字串統一用 <c>AzureWebJobsStorage</c>（本機 = Azurite）。
/// 容器 <c>upload</c> 下以舊系統資料夾名為子路徑（appointments/branchs/categorys/memberquestions），
/// 方便直接把舊主機 ~/Upload 整包搬進容器（路徑 1:1）。
/// </summary>
public sealed class StorageOptions
{
    public string ConnectionString { get; set; } = "";
    public string Container { get; set; } = "upload";
    public long MaxBytes { get; set; } = 8 * 1024 * 1024; // 8 MB

    /// <summary>允許的上傳子目錄（沿用舊系統 Definition.*Dir）。</summary>
    public HashSet<string> AllowedFolders { get; } =
        new(StringComparer.OrdinalIgnoreCase) { "appointments", "branchs", "categorys", "memberquestions" };

    public HashSet<string> AllowedContentTypes { get; } =
        new(StringComparer.OrdinalIgnoreCase) { "image/jpeg", "image/png", "image/webp", "image/gif" };
}
