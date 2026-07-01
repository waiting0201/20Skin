namespace Skin.Api.Auth;

/// <summary>
/// 超級管理員（設定驅動，取代舊硬編碼 weypro）。命中則 is_super_admin=true 全放行。
/// 值來自設定（local.settings.json / 正式經 Key Vault）；未設定則停用超管登入。
/// 見 docs/design/security.md、blueprints/admin-auth-authority.md。
/// </summary>
public sealed class SuperAdminOptions
{
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";

    public bool IsConfigured => !string.IsNullOrEmpty(Username) && !string.IsNullOrEmpty(Password);
    public bool Matches(string username, string password) =>
        IsConfigured && Username == username && Password == password;
}
