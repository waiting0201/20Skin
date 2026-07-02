using Skin.Api.Routing;
using Skin.Core;
using Skin.Core.Constants;
using Skin.Core.Dtos;
using Skin.Services.BasicData;
using Skin.Services.Roster;

namespace Skin.Api.Controllers;

/// <summary>
/// 後台基礎資料：排班 CRUD + 重複展開（對應舊 ShiftMsController §Ta/TaCosmetic/Ch/ChCosmetic/ChDentistRosters）。
/// Service 完全參數化（branchId+clinic），Controller 保留 5 組「瘦」proxy action 對應真實 Lims 變體粒度
/// （TaRosters/ChRosters/TaCosmeticRosters/ChCosmeticRosters/ChDentistRosters），與 PeriodsAdminController
/// 同一設計理由；重用既有 PeriodsOptions 做分院別名解析。見 docs/blueprints/admin-roster.md。
/// </summary>
[ApiController]
public sealed class RostersAdminController(IRosterAdminService rosters, PeriodsOptions branchAliases)
{
    // ================= Ta + Skin（TaRosters） =================

    [ApiRoute("GET", "admin/rosters/ta-skin")]
    [Authorize(Roles.Admin, Resource = "TaRosters", Op = "read")]
    public Task<object> TaSkinList(DateTime? date = null, Guid? doctorId = null, int page = 1)
        => List(branchAliases.Resolve("Ta"), Clinic.Skin, date, doctorId, page);

    [ApiRoute("POST", "admin/rosters/ta-skin")]
    [Authorize(Roles.Admin, Resource = "TaRosters", Op = "add")]
    public Task<ApiResponse<RosterCreateResult>> TaSkinCreate(RosterCreateRequest req)
        => Create(branchAliases.Resolve("Ta"), Clinic.Skin, req);

    [ApiRoute("GET", "admin/rosters/ta-skin/{id}")]
    [Authorize(Roles.Admin, Resource = "TaRosters", Op = "read")]
    public Task<ApiResponse<RosterAdminDto>> TaSkinDetail(Guid id) => Detail(id);

    [ApiRoute("PUT", "admin/rosters/ta-skin/{id}")]
    [Authorize(Roles.Admin, Resource = "TaRosters", Op = "update")]
    public Task<ApiResponse> TaSkinUpdate(Guid id, RosterUpdateRequest req) => Update(id, req);

    [ApiRoute("DELETE", "admin/rosters/ta-skin/{id}")]
    [Authorize(Roles.Admin, Resource = "TaRosters", Op = "delete")]
    public Task<ApiResponse> TaSkinDelete(Guid id) => Delete(id);

    // ================= Ta + Cosmetic（TaCosmeticRosters） =================

    [ApiRoute("GET", "admin/rosters/ta-cosmetic")]
    [Authorize(Roles.Admin, Resource = "TaCosmeticRosters", Op = "read")]
    public Task<object> TaCosmeticList(DateTime? date = null, Guid? doctorId = null, int page = 1)
        => List(branchAliases.Resolve("Ta"), Clinic.Cosmetic, date, doctorId, page);

    [ApiRoute("POST", "admin/rosters/ta-cosmetic")]
    [Authorize(Roles.Admin, Resource = "TaCosmeticRosters", Op = "add")]
    public Task<ApiResponse<RosterCreateResult>> TaCosmeticCreate(RosterCreateRequest req)
        => Create(branchAliases.Resolve("Ta"), Clinic.Cosmetic, req);

    [ApiRoute("GET", "admin/rosters/ta-cosmetic/{id}")]
    [Authorize(Roles.Admin, Resource = "TaCosmeticRosters", Op = "read")]
    public Task<ApiResponse<RosterAdminDto>> TaCosmeticDetail(Guid id) => Detail(id);

    [ApiRoute("PUT", "admin/rosters/ta-cosmetic/{id}")]
    [Authorize(Roles.Admin, Resource = "TaCosmeticRosters", Op = "update")]
    public Task<ApiResponse> TaCosmeticUpdate(Guid id, RosterUpdateRequest req) => Update(id, req);

    [ApiRoute("DELETE", "admin/rosters/ta-cosmetic/{id}")]
    [Authorize(Roles.Admin, Resource = "TaCosmeticRosters", Op = "delete")]
    public Task<ApiResponse> TaCosmeticDelete(Guid id) => Delete(id);

    // ================= Ch + Skin（ChRosters） =================

    [ApiRoute("GET", "admin/rosters/ch-skin")]
    [Authorize(Roles.Admin, Resource = "ChRosters", Op = "read")]
    public Task<object> ChSkinList(DateTime? date = null, Guid? doctorId = null, int page = 1)
        => List(branchAliases.Resolve("Ch"), Clinic.Skin, date, doctorId, page);

    [ApiRoute("POST", "admin/rosters/ch-skin")]
    [Authorize(Roles.Admin, Resource = "ChRosters", Op = "add")]
    public Task<ApiResponse<RosterCreateResult>> ChSkinCreate(RosterCreateRequest req)
        => Create(branchAliases.Resolve("Ch"), Clinic.Skin, req);

    [ApiRoute("GET", "admin/rosters/ch-skin/{id}")]
    [Authorize(Roles.Admin, Resource = "ChRosters", Op = "read")]
    public Task<ApiResponse<RosterAdminDto>> ChSkinDetail(Guid id) => Detail(id);

    [ApiRoute("PUT", "admin/rosters/ch-skin/{id}")]
    [Authorize(Roles.Admin, Resource = "ChRosters", Op = "update")]
    public Task<ApiResponse> ChSkinUpdate(Guid id, RosterUpdateRequest req) => Update(id, req);

    [ApiRoute("DELETE", "admin/rosters/ch-skin/{id}")]
    [Authorize(Roles.Admin, Resource = "ChRosters", Op = "delete")]
    public Task<ApiResponse> ChSkinDelete(Guid id) => Delete(id);

    // ================= Ch + Cosmetic（ChCosmeticRosters） =================

    [ApiRoute("GET", "admin/rosters/ch-cosmetic")]
    [Authorize(Roles.Admin, Resource = "ChCosmeticRosters", Op = "read")]
    public Task<object> ChCosmeticList(DateTime? date = null, Guid? doctorId = null, int page = 1)
        => List(branchAliases.Resolve("Ch"), Clinic.Cosmetic, date, doctorId, page);

    [ApiRoute("POST", "admin/rosters/ch-cosmetic")]
    [Authorize(Roles.Admin, Resource = "ChCosmeticRosters", Op = "add")]
    public Task<ApiResponse<RosterCreateResult>> ChCosmeticCreate(RosterCreateRequest req)
        => Create(branchAliases.Resolve("Ch"), Clinic.Cosmetic, req);

    [ApiRoute("GET", "admin/rosters/ch-cosmetic/{id}")]
    [Authorize(Roles.Admin, Resource = "ChCosmeticRosters", Op = "read")]
    public Task<ApiResponse<RosterAdminDto>> ChCosmeticDetail(Guid id) => Detail(id);

    [ApiRoute("PUT", "admin/rosters/ch-cosmetic/{id}")]
    [Authorize(Roles.Admin, Resource = "ChCosmeticRosters", Op = "update")]
    public Task<ApiResponse> ChCosmeticUpdate(Guid id, RosterUpdateRequest req) => Update(id, req);

    [ApiRoute("DELETE", "admin/rosters/ch-cosmetic/{id}")]
    [Authorize(Roles.Admin, Resource = "ChCosmeticRosters", Op = "delete")]
    public Task<ApiResponse> ChCosmeticDelete(Guid id) => Delete(id);

    // ================= ChDentist + Dentist（ChDentistRosters） =================
    // 注意：ChDentist 是「二林．齒科」獨立分院，非「Ch 分院的齒科診別」，見 PeriodsOptions 註解。

    [ApiRoute("GET", "admin/rosters/ch-dentist")]
    [Authorize(Roles.Admin, Resource = "ChDentistRosters", Op = "read")]
    public Task<object> ChDentistList(DateTime? date = null, Guid? doctorId = null, int page = 1)
        => List(branchAliases.Resolve("ChDentist"), Clinic.Dentist, date, doctorId, page);

    [ApiRoute("POST", "admin/rosters/ch-dentist")]
    [Authorize(Roles.Admin, Resource = "ChDentistRosters", Op = "add")]
    public Task<ApiResponse<RosterCreateResult>> ChDentistCreate(RosterCreateRequest req)
        => Create(branchAliases.Resolve("ChDentist"), Clinic.Dentist, req);

    [ApiRoute("GET", "admin/rosters/ch-dentist/{id}")]
    [Authorize(Roles.Admin, Resource = "ChDentistRosters", Op = "read")]
    public Task<ApiResponse<RosterAdminDto>> ChDentistDetail(Guid id) => Detail(id);

    [ApiRoute("PUT", "admin/rosters/ch-dentist/{id}")]
    [Authorize(Roles.Admin, Resource = "ChDentistRosters", Op = "update")]
    public Task<ApiResponse> ChDentistUpdate(Guid id, RosterUpdateRequest req) => Update(id, req);

    [ApiRoute("DELETE", "admin/rosters/ch-dentist/{id}")]
    [Authorize(Roles.Admin, Resource = "ChDentistRosters", Op = "delete")]
    public Task<ApiResponse> ChDentistDelete(Guid id) => Delete(id);

    // ================= 共用（非路由） =================

    private async Task<object> List(Guid branchId, string clinic, DateTime? date, Guid? doctorId, int page)
    {
        var (items, total) = await rosters.ListAsync(branchId, clinic, date, doctorId, page, 20);
        return new { items, total, page, pageSize = 20 };
    }

    private async Task<ApiResponse<RosterCreateResult>> Create(Guid branchId, string clinic, RosterCreateRequest req)
        => ApiResponse<RosterCreateResult>.Ok(await rosters.CreateAsync(branchId, clinic, req));

    private async Task<ApiResponse<RosterAdminDto>> Detail(Guid id)
    {
        var roster = await rosters.GetAsync(id);
        return roster is null
            ? ApiResponse<RosterAdminDto>.Fail("找不到排班", "NOT_FOUND")
            : ApiResponse<RosterAdminDto>.Ok(roster);
    }

    private async Task<ApiResponse> Update(Guid id, RosterUpdateRequest req)
    {
        await rosters.UpdateAsync(id, req);
        return ApiResponse.Ok("儲存成功");
    }

    private async Task<ApiResponse> Delete(Guid id)
    {
        await rosters.DeleteAsync(id);
        return ApiResponse.Ok("刪除成功");
    }
}
