using Skin.Api.Auth;
using Skin.Api.Routing;
using Skin.Core;
using Skin.Core.Constants;
using Skin.Core.Dtos;
using Skin.Services.Admin;

namespace Skin.Api.Controllers;

/// <summary>
/// 後台管理員與權限管理（對應舊 AuthorityMsController）+ 資料驅動選單。
/// 逐操作授權以 [Authorize(Resource, Op)]（超管放行）；見 docs/blueprints/admin-auth-authority.md。
/// </summary>
[ApiController]
public sealed class AdminController(IAdminService admins, RequestContext ctx)
{
    /// <summary>GET /api/admin/menu — 資料驅動左側選單（讀 Lims + 當前管理員 AdminLims 過濾，忠於舊做法）。</summary>
    [ApiRoute("GET", "admin/menu")]
    [Authorize(Roles.Admin)]
    public async Task<List<MenuNodeDto>> Menu()
    {
        var lims = await admins.ListLimsAsync();
        var adminLims = ctx.IsSuperAdmin
            ? []
            : await admins.GetAdminLimsAsync(ctx.UserId ?? Guid.Empty);
        return AuthorizationDomain.BuildMenu(lims, adminLims, ctx.IsSuperAdmin);
    }

    /// <summary>GET /api/admins — 管理員分頁列表。</summary>
    [ApiRoute("GET", "admins")]
    [Authorize(Roles.Admin, Resource = "Admins", Op = "read")]
    public async Task<object> List(int page = 1)
    {
        var (items, total) = await admins.ListAsync(page, 20);
        return new { items, total, page, pageSize = 20 };
    }

    /// <summary>GET /api/lims — 完整權限樹（供新增表單，全未勾）。</summary>
    [ApiRoute("GET", "lims")]
    [Authorize(Roles.Admin, Resource = "Admins", Op = "read")]
    public async Task<List<LimNodeDto>> LimsTree()
    {
        var lims = await admins.ListLimsAsync();
        return AuthorizationDomain.BuildPermissionTree(lims, []);
    }

    /// <summary>GET /api/admin/check-username?username=&amp;excludeId= — 帳號唯一性（對應舊 /Ajax/CheckUsername）。
    /// 路徑用 admin/*（非 admins/*）以免與 admins/{id} 路由樣板衝突（router 非 literal 優先）。</summary>
    [ApiRoute("GET", "admin/check-username")]
    [Authorize(Roles.Admin, Resource = "Admins", Op = "read")]
    public async Task<object> CheckUsername(string username, Guid? excludeId = null)
        => new { exists = await admins.UsernameExistsAsync((username ?? "").Trim(), excludeId) };

    /// <summary>GET /api/admins/{id} — 管理員詳情（含權限樹勾選狀態）。</summary>
    [ApiRoute("GET", "admins/{id}")]
    [Authorize(Roles.Admin, Resource = "Admins", Op = "read")]
    public async Task<ApiResponse<AdminDetailDto>> Detail(Guid id)
    {
        var admin = await admins.GetByIdAsync(id);
        if (admin is null)
            return ApiResponse<AdminDetailDto>.Fail("找不到管理員", "NOT_FOUND");

        var lims = await admins.ListLimsAsync();
        var adminLims = await admins.GetAdminLimsAsync(id);
        var tree = AuthorizationDomain.BuildPermissionTree(lims, adminLims);
        return ApiResponse<AdminDetailDto>.Ok(new AdminDetailDto(admin.AdminID, admin.Username, admin.Name, tree));
    }

    /// <summary>POST /api/admins — 新增管理員 + 權限。</summary>
    [ApiRoute("POST", "admins")]
    [Authorize(Roles.Admin, Resource = "Admins", Op = "add")]
    public async Task<ApiResponse<AdminDetailDto>> Create(AdminUpsertRequest req)
    {
        var id = await admins.CreateAsync(req);
        return await Detail(id);
    }

    /// <summary>PUT /api/admins/{id} — 編輯管理員 + 權限。</summary>
    [ApiRoute("PUT", "admins/{id}")]
    [Authorize(Roles.Admin, Resource = "Admins", Op = "update")]
    public async Task<ApiResponse<AdminDetailDto>> Update(Guid id, AdminUpsertRequest req)
    {
        await admins.UpdateAsync(id, req);
        return await Detail(id);
    }

    /// <summary>DELETE /api/admins/{id} — 刪除管理員。</summary>
    [ApiRoute("DELETE", "admins/{id}")]
    [Authorize(Roles.Admin, Resource = "Admins", Op = "delete")]
    public async Task<ApiResponse> Delete(Guid id)
    {
        await admins.DeleteAsync(id);
        return ApiResponse.Ok("刪除成功");
    }
}
