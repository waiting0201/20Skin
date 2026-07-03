using Skin.Api.Routing;
using Skin.Core;
using Skin.Core.Constants;
using Skin.Core.Dtos;
using Skin.Services.BasicData;

namespace Skin.Api.Controllers;

/// <summary>
/// 後台基礎資料：分院 CRUD + 排序（對應舊 BasicMsController §Branchs）。
/// 路徑走 admin/ 前綴，避免與客戶前台 GET /api/branches（Roles.Member）路由衝突。
/// 見 docs/blueprints/admin-basic-data.md。
/// </summary>
[ApiController]
public sealed class BranchesAdminController(IBranchAdminService branches)
{
    /// <summary>
    /// `enabledOnly=true`：回傳全量已啟用分院（不分頁，依 Sort 排序），供下拉選單使用
    /// （如會員列表分院篩選，忠於舊 `MemberMsController.Members` 的 `Where(IsEnabled).OrderBy(Sort)`）。
    /// 沿用同一路由（不新增路徑段），避免與 `GET admin/branches/{id}` 的自訂 router 比對衝突
    /// （router 為 first-match、無 literal 優先於 `{param}` 的機制，見 Routing/RouteTable.cs）。
    /// </summary>
    [ApiRoute("GET", "admin/branches")]
    [Authorize(Roles.Admin, Resource = "Branchs", Op = "read")]
    public async Task<object> List(int page = 1, bool enabledOnly = false)
    {
        if (enabledOnly)
        {
            var enabled = await branches.ListEnabledAsync();
            return new { items = enabled, total = enabled.Count, page = 1, pageSize = enabled.Count };
        }
        var (items, total) = await branches.ListAsync(page, 20);
        return new { items, total, page, pageSize = 20 };
    }

    [ApiRoute("GET", "admin/branches/{id}")]
    [Authorize(Roles.Admin, Resource = "Branchs", Op = "read")]
    public async Task<ApiResponse<BranchAdminDto>> Detail(Guid id)
    {
        var branch = await branches.GetAsync(id);
        return branch is null
            ? ApiResponse<BranchAdminDto>.Fail("找不到分院", "NOT_FOUND")
            : ApiResponse<BranchAdminDto>.Ok(branch);
    }

    [ApiRoute("POST", "admin/branches")]
    [Authorize(Roles.Admin, Resource = "Branchs", Op = "add")]
    public async Task<ApiResponse<BranchAdminDto>> Create(BranchUpsertRequest req)
    {
        var id = await branches.CreateAsync(req);
        return await Detail(id);
    }

    [ApiRoute("PUT", "admin/branches/{id}")]
    [Authorize(Roles.Admin, Resource = "Branchs", Op = "update")]
    public async Task<ApiResponse<BranchAdminDto>> Update(Guid id, BranchUpsertRequest req)
    {
        await branches.UpdateAsync(id, req);
        return await Detail(id);
    }

    /// <summary>DELETE /api/admin/branches/{id} — 有預約/排班/時段引用即擋（見 Service 註解）。</summary>
    [ApiRoute("DELETE", "admin/branches/{id}")]
    [Authorize(Roles.Admin, Resource = "Branchs", Op = "delete")]
    public async Task<ApiResponse> Delete(Guid id)
    {
        await branches.DeleteAsync(id);
        return ApiResponse.Ok("刪除成功");
    }

    /// <summary>POST /api/admin/branches/sort（非 PUT，避免與 PUT admin/branches/{id} 同段數混淆）。</summary>
    [ApiRoute("POST", "admin/branches/sort")]
    [Authorize(Roles.Admin, Resource = "Branchs", Op = "update")]
    public async Task<ApiResponse> Sort(SortRequest req)
    {
        await branches.ReorderAsync(req.Items);
        return ApiResponse.Ok();
    }
}
