using Skin.Core.Dtos;
using Skin.Data.Entities;

namespace Skin.Services.Admin;

/// <summary>後台管理員 + 權限（Lims/AdminLims）資料存取。見 docs/blueprints/admin-auth-authority.md。</summary>
public interface IAdminService
{
    /// <summary>依帳號查管理員（登入用）。</summary>
    Task<Admins?> FindByUsernameAsync(string username, CancellationToken ct = default);

    /// <summary>管理員分頁列表（忠於舊系統 Admins.cshtml 的 pageSize=20 分頁）。</summary>
    Task<(IReadOnlyList<AdminListItemDto> Items, int Total)> ListAsync(int page, int pageSize, CancellationToken ct = default);

    /// <summary>取單一管理員。</summary>
    Task<Admins?> GetByIdAsync(Guid adminId, CancellationToken ct = default);

    /// <summary>全部 Lims（權限/選單樹來源）。</summary>
    Task<IReadOnlyList<Lims>> ListLimsAsync(CancellationToken ct = default);

    /// <summary>某管理員的 AdminLims（授權旗標）。</summary>
    Task<IReadOnlyList<AdminLims>> GetAdminLimsAsync(Guid adminId, CancellationToken ct = default);

    /// <summary>帳號是否已存在（可排除自身，供編輯）。</summary>
    Task<bool> UsernameExistsAsync(string username, Guid? excludeAdminId = null, CancellationToken ct = default);

    /// <summary>新增管理員 + 權限（交易內）；回新 AdminID。</summary>
    Task<Guid> CreateAsync(AdminUpsertRequest req, CancellationToken ct = default);

    /// <summary>編輯管理員 + 權限（清空重建 AdminLims，交易內）；Password 空則不改。</summary>
    Task UpdateAsync(Guid adminId, AdminUpsertRequest req, CancellationToken ct = default);

    /// <summary>刪除管理員（連同其 AdminLims）。</summary>
    Task DeleteAsync(Guid adminId, CancellationToken ct = default);
}
