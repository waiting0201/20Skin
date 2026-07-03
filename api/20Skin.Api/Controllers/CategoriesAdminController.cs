using Skin.Api.Routing;
using Skin.Core;
using Skin.Core.Constants;
using Skin.Core.Dtos;
using Skin.Services.BasicData;

namespace Skin.Api.Controllers;

/// <summary>
/// 後台基礎資料：科別項目 CRUD + 排序（對應舊 BasicMsController §Skins/Cosmetics）。
/// Service 完全參數化（clinic），Controller 保留 2 組「瘦」proxy action 對應真實 Lims 變體粒度
/// （Skins/Cosmetics），與 PeriodsAdminController 同一設計理由，見 docs/blueprints/admin-basic-data.md。
/// </summary>
[ApiController]
public sealed class CategoriesAdminController(ICategoryAdminService categories)
{
    // ================= Skin（Skins） =================

    [ApiRoute("GET", "admin/categories/skin")]
    [Authorize(Roles.Admin, Resource = "Skins", Op = "read")]
    public Task<object> SkinList(int page = 1) => List(Clinic.Skin, page);

    /// <summary>GET /api/admin/categories/skin/all — 全量（不分頁），供其他表單下拉/多選使用。</summary>
    [ApiRoute("GET", "admin/categories/skin/all")]
    [Authorize(Roles.Admin, Resource = "Skins", Op = "read")]
    public Task<IReadOnlyList<CategoryAdminDto>> SkinListAll() => categories.ListAllAsync(Clinic.Skin);

    [ApiRoute("POST", "admin/categories/skin")]
    [Authorize(Roles.Admin, Resource = "Skins", Op = "add")]
    public async Task<ApiResponse<CategoryAdminDto>> SkinCreate(CategoryUpsertRequest req)
        => await Detail(await categories.CreateAsync(Clinic.Skin, req));

    [ApiRoute("PUT", "admin/categories/skin/{id}")]
    [Authorize(Roles.Admin, Resource = "Skins", Op = "update")]
    public async Task<ApiResponse<CategoryAdminDto>> SkinUpdate(Guid id, CategoryUpsertRequest req) => await Update(id, req);

    [ApiRoute("DELETE", "admin/categories/skin/{id}")]
    [Authorize(Roles.Admin, Resource = "Skins", Op = "delete")]
    public Task<ApiResponse> SkinDelete(Guid id) => Delete(id);

    [ApiRoute("POST", "admin/categories/skin/sort")]
    [Authorize(Roles.Admin, Resource = "Skins", Op = "update")]
    public Task<ApiResponse> SkinSort(SortRequest req) => Sort(Clinic.Skin, req);

    // ================= Cosmetic（Cosmetics） =================

    [ApiRoute("GET", "admin/categories/cosmetic")]
    [Authorize(Roles.Admin, Resource = "Cosmetics", Op = "read")]
    public Task<object> CosmeticList(int page = 1) => List(Clinic.Cosmetic, page);

    /// <summary>GET /api/admin/categories/cosmetic/all — 全量（不分頁），供其他表單下拉/多選使用。</summary>
    [ApiRoute("GET", "admin/categories/cosmetic/all")]
    [Authorize(Roles.Admin, Resource = "Cosmetics", Op = "read")]
    public Task<IReadOnlyList<CategoryAdminDto>> CosmeticListAll() => categories.ListAllAsync(Clinic.Cosmetic);

    [ApiRoute("POST", "admin/categories/cosmetic")]
    [Authorize(Roles.Admin, Resource = "Cosmetics", Op = "add")]
    public async Task<ApiResponse<CategoryAdminDto>> CosmeticCreate(CategoryUpsertRequest req)
        => await Detail(await categories.CreateAsync(Clinic.Cosmetic, req));

    [ApiRoute("PUT", "admin/categories/cosmetic/{id}")]
    [Authorize(Roles.Admin, Resource = "Cosmetics", Op = "update")]
    public async Task<ApiResponse<CategoryAdminDto>> CosmeticUpdate(Guid id, CategoryUpsertRequest req) => await Update(id, req);

    [ApiRoute("DELETE", "admin/categories/cosmetic/{id}")]
    [Authorize(Roles.Admin, Resource = "Cosmetics", Op = "delete")]
    public Task<ApiResponse> CosmeticDelete(Guid id) => Delete(id);

    [ApiRoute("POST", "admin/categories/cosmetic/sort")]
    [Authorize(Roles.Admin, Resource = "Cosmetics", Op = "update")]
    public Task<ApiResponse> CosmeticSort(SortRequest req) => Sort(Clinic.Cosmetic, req);

    // ================= 共用（非路由） =================

    private async Task<object> List(string clinic, int page)
    {
        var (items, total) = await categories.ListAsync(clinic, page, 20);
        return new { items, total, page, pageSize = 20 };
    }

    private async Task<ApiResponse<CategoryAdminDto>> Detail(Guid id)
    {
        var category = await categories.GetAsync(id);
        return category is null
            ? ApiResponse<CategoryAdminDto>.Fail("找不到項目", "NOT_FOUND")
            : ApiResponse<CategoryAdminDto>.Ok(category);
    }

    private async Task<ApiResponse<CategoryAdminDto>> Update(Guid id, CategoryUpsertRequest req)
    {
        await categories.UpdateAsync(id, req);
        return await Detail(id);
    }

    private async Task<ApiResponse> Delete(Guid id)
    {
        await categories.DeleteAsync(id);
        return ApiResponse.Ok("刪除成功");
    }

    private async Task<ApiResponse> Sort(string clinic, SortRequest req)
    {
        await categories.ReorderAsync(clinic, req.Items);
        return ApiResponse.Ok();
    }
}
