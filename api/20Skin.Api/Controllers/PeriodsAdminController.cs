using Skin.Api.Routing;
using Skin.Core;
using Skin.Core.Constants;
using Skin.Core.Dtos;
using Skin.Services.BasicData;

namespace Skin.Api.Controllers;

/// <summary>
/// 後台基礎資料：時段 CRUD + 排序（對應舊 BasicMsController §Ta/TaCosmetic/Ch/ChCosmetic/ChDentistPeriods）。
/// Service 完全參數化（branchId+clinic），但真實 Lims 權限仍是變體粒度，故 Controller 保留 5 組「瘦」
/// proxy action，各自解析對應分院別名（Ta/Ch/ChDentist）+ 診別後轉呼叫共用 Service。
/// 見 docs/blueprints/admin-basic-data.md「設計決策」。
/// </summary>
[ApiController]
public sealed class PeriodsAdminController(IPeriodAdminService periods, PeriodsOptions branchAliases)
{
    /// <summary>GET /api/admin/outpatient-times — 門診時段字典（上午/下午/晚上），5 組表單共用下拉選單。</summary>
    [ApiRoute("GET", "admin/outpatient-times")]
    [Authorize(Roles.Admin, Resource = "Branchs", Op = "read")]
    public async Task<IReadOnlyList<OutpatientTimeDto>> OutpatientTimes() => await periods.ListOutpatientTimesAsync();

    /// <summary>
    /// GET /api/admin/periods/branch-meta?branch={ta|ch|chDentist} — 該分院是否自動配號。
    /// 時段表單/清單/排班用來判斷是否呈現「配號」模式；授權沿用 Branchs.read（開時段表單本就需要）。
    /// </summary>
    [ApiRoute("GET", "admin/periods/branch-meta")]
    [Authorize(Roles.Admin, Resource = "Branchs", Op = "read")]
    public async Task<PeriodBranchMetaDto> BranchMeta(string branch)
        => new(await periods.GetBranchIsAutoRowNumberAsync(branchAliases.Resolve(branch)));

    // ================= Ta + Skin（TaPeriods） =================

    [ApiRoute("GET", "admin/periods/ta-skin")]
    [Authorize(Roles.Admin, Resource = "TaPeriods", Op = "read")]
    public Task<IReadOnlyList<PeriodAdminDto>> TaSkinList() => periods.ListAsync(branchAliases.Resolve("Ta"), Clinic.Skin);

    [ApiRoute("POST", "admin/periods/ta-skin")]
    [Authorize(Roles.Admin, Resource = "TaPeriods", Op = "add")]
    public async Task<ApiResponse<PeriodAdminDto>> TaSkinCreate(PeriodUpsertRequest req)
        => await Detail(await periods.CreateAsync(branchAliases.Resolve("Ta"), Clinic.Skin, req));

    [ApiRoute("PUT", "admin/periods/ta-skin/{id}")]
    [Authorize(Roles.Admin, Resource = "TaPeriods", Op = "update")]
    public async Task<ApiResponse<PeriodAdminDto>> TaSkinUpdate(Guid id, PeriodUpsertRequest req)
        => await Update(id, req);

    [ApiRoute("DELETE", "admin/periods/ta-skin/{id}")]
    [Authorize(Roles.Admin, Resource = "TaPeriods", Op = "delete")]
    public Task<ApiResponse> TaSkinDelete(Guid id) => Delete(id);

    [ApiRoute("POST", "admin/periods/ta-skin/sort")]
    [Authorize(Roles.Admin, Resource = "TaPeriods", Op = "update")]
    public Task<ApiResponse> TaSkinSort(SortRequest req) => Sort(branchAliases.Resolve("Ta"), Clinic.Skin, req);

    // ================= Ta + Cosmetic（TaCosmeticPeriods） =================

    [ApiRoute("GET", "admin/periods/ta-cosmetic")]
    [Authorize(Roles.Admin, Resource = "TaCosmeticPeriods", Op = "read")]
    public Task<IReadOnlyList<PeriodAdminDto>> TaCosmeticList() => periods.ListAsync(branchAliases.Resolve("Ta"), Clinic.Cosmetic);

    [ApiRoute("POST", "admin/periods/ta-cosmetic")]
    [Authorize(Roles.Admin, Resource = "TaCosmeticPeriods", Op = "add")]
    public async Task<ApiResponse<PeriodAdminDto>> TaCosmeticCreate(PeriodUpsertRequest req)
        => await Detail(await periods.CreateAsync(branchAliases.Resolve("Ta"), Clinic.Cosmetic, req));

    [ApiRoute("PUT", "admin/periods/ta-cosmetic/{id}")]
    [Authorize(Roles.Admin, Resource = "TaCosmeticPeriods", Op = "update")]
    public async Task<ApiResponse<PeriodAdminDto>> TaCosmeticUpdate(Guid id, PeriodUpsertRequest req)
        => await Update(id, req);

    [ApiRoute("DELETE", "admin/periods/ta-cosmetic/{id}")]
    [Authorize(Roles.Admin, Resource = "TaCosmeticPeriods", Op = "delete")]
    public Task<ApiResponse> TaCosmeticDelete(Guid id) => Delete(id);

    [ApiRoute("POST", "admin/periods/ta-cosmetic/sort")]
    [Authorize(Roles.Admin, Resource = "TaCosmeticPeriods", Op = "update")]
    public Task<ApiResponse> TaCosmeticSort(SortRequest req) => Sort(branchAliases.Resolve("Ta"), Clinic.Cosmetic, req);

    // ================= Ch + Skin（ChPeriods） =================

    [ApiRoute("GET", "admin/periods/ch-skin")]
    [Authorize(Roles.Admin, Resource = "ChPeriods", Op = "read")]
    public Task<IReadOnlyList<PeriodAdminDto>> ChSkinList() => periods.ListAsync(branchAliases.Resolve("Ch"), Clinic.Skin);

    [ApiRoute("POST", "admin/periods/ch-skin")]
    [Authorize(Roles.Admin, Resource = "ChPeriods", Op = "add")]
    public async Task<ApiResponse<PeriodAdminDto>> ChSkinCreate(PeriodUpsertRequest req)
        => await Detail(await periods.CreateAsync(branchAliases.Resolve("Ch"), Clinic.Skin, req));

    [ApiRoute("PUT", "admin/periods/ch-skin/{id}")]
    [Authorize(Roles.Admin, Resource = "ChPeriods", Op = "update")]
    public async Task<ApiResponse<PeriodAdminDto>> ChSkinUpdate(Guid id, PeriodUpsertRequest req)
        => await Update(id, req);

    [ApiRoute("DELETE", "admin/periods/ch-skin/{id}")]
    [Authorize(Roles.Admin, Resource = "ChPeriods", Op = "delete")]
    public Task<ApiResponse> ChSkinDelete(Guid id) => Delete(id);

    [ApiRoute("POST", "admin/periods/ch-skin/sort")]
    [Authorize(Roles.Admin, Resource = "ChPeriods", Op = "update")]
    public Task<ApiResponse> ChSkinSort(SortRequest req) => Sort(branchAliases.Resolve("Ch"), Clinic.Skin, req);

    // ================= Ch + Cosmetic（ChCosmeticPeriods） =================

    [ApiRoute("GET", "admin/periods/ch-cosmetic")]
    [Authorize(Roles.Admin, Resource = "ChCosmeticPeriods", Op = "read")]
    public Task<IReadOnlyList<PeriodAdminDto>> ChCosmeticList() => periods.ListAsync(branchAliases.Resolve("Ch"), Clinic.Cosmetic);

    [ApiRoute("POST", "admin/periods/ch-cosmetic")]
    [Authorize(Roles.Admin, Resource = "ChCosmeticPeriods", Op = "add")]
    public async Task<ApiResponse<PeriodAdminDto>> ChCosmeticCreate(PeriodUpsertRequest req)
        => await Detail(await periods.CreateAsync(branchAliases.Resolve("Ch"), Clinic.Cosmetic, req));

    [ApiRoute("PUT", "admin/periods/ch-cosmetic/{id}")]
    [Authorize(Roles.Admin, Resource = "ChCosmeticPeriods", Op = "update")]
    public async Task<ApiResponse<PeriodAdminDto>> ChCosmeticUpdate(Guid id, PeriodUpsertRequest req)
        => await Update(id, req);

    [ApiRoute("DELETE", "admin/periods/ch-cosmetic/{id}")]
    [Authorize(Roles.Admin, Resource = "ChCosmeticPeriods", Op = "delete")]
    public Task<ApiResponse> ChCosmeticDelete(Guid id) => Delete(id);

    [ApiRoute("POST", "admin/periods/ch-cosmetic/sort")]
    [Authorize(Roles.Admin, Resource = "ChCosmeticPeriods", Op = "update")]
    public Task<ApiResponse> ChCosmeticSort(SortRequest req) => Sort(branchAliases.Resolve("Ch"), Clinic.Cosmetic, req);

    // ================= ChDentist + Dentist（ChDentistPeriods） =================
    // 注意：ChDentist 是「二林．齒科」獨立分院（BAAAF928…），非「Ch 分院的齒科診別」，見 PeriodsOptions 註解。

    [ApiRoute("GET", "admin/periods/ch-dentist")]
    [Authorize(Roles.Admin, Resource = "ChDentistPeriods", Op = "read")]
    public Task<IReadOnlyList<PeriodAdminDto>> ChDentistList() => periods.ListAsync(branchAliases.Resolve("ChDentist"), Clinic.Dentist);

    [ApiRoute("POST", "admin/periods/ch-dentist")]
    [Authorize(Roles.Admin, Resource = "ChDentistPeriods", Op = "add")]
    public async Task<ApiResponse<PeriodAdminDto>> ChDentistCreate(PeriodUpsertRequest req)
        => await Detail(await periods.CreateAsync(branchAliases.Resolve("ChDentist"), Clinic.Dentist, req));

    [ApiRoute("PUT", "admin/periods/ch-dentist/{id}")]
    [Authorize(Roles.Admin, Resource = "ChDentistPeriods", Op = "update")]
    public async Task<ApiResponse<PeriodAdminDto>> ChDentistUpdate(Guid id, PeriodUpsertRequest req)
        => await Update(id, req);

    [ApiRoute("DELETE", "admin/periods/ch-dentist/{id}")]
    [Authorize(Roles.Admin, Resource = "ChDentistPeriods", Op = "delete")]
    public Task<ApiResponse> ChDentistDelete(Guid id) => Delete(id);

    [ApiRoute("POST", "admin/periods/ch-dentist/sort")]
    [Authorize(Roles.Admin, Resource = "ChDentistPeriods", Op = "update")]
    public Task<ApiResponse> ChDentistSort(SortRequest req) => Sort(branchAliases.Resolve("ChDentist"), Clinic.Dentist, req);

    // ================= 共用（非路由，供上方 proxy action 呼叫） =================

    private async Task<ApiResponse<PeriodAdminDto>> Detail(Guid id)
    {
        var period = await periods.GetAsync(id);
        return period is null
            ? ApiResponse<PeriodAdminDto>.Fail("找不到時段", "NOT_FOUND")
            : ApiResponse<PeriodAdminDto>.Ok(period);
    }

    private async Task<ApiResponse<PeriodAdminDto>> Update(Guid id, PeriodUpsertRequest req)
    {
        await periods.UpdateAsync(id, req);
        return await Detail(id);
    }

    private async Task<ApiResponse> Delete(Guid id)
    {
        await periods.DeleteAsync(id);
        return ApiResponse.Ok("刪除成功");
    }

    private async Task<ApiResponse> Sort(Guid branchId, string clinic, SortRequest req)
    {
        await periods.ReorderAsync(branchId, clinic, req.Items);
        return ApiResponse.Ok();
    }
}
