using Skin.Api.Routing;
using Skin.Core;
using Skin.Core.Constants;
using Skin.Core.Dtos;
using Skin.Services.BasicData;

namespace Skin.Api.Controllers;

/// <summary>
/// 後台基礎資料：醫師 CRUD（無排序、無軟刪，Doctors 表只有 DoctorID/Name）。
/// 見 docs/blueprints/admin-basic-data.md。
/// </summary>
[ApiController]
public sealed class DoctorsAdminController(IDoctorAdminService doctors)
{
    [ApiRoute("GET", "admin/doctors")]
    [Authorize(Roles.Admin, Resource = "Doctors", Op = "read")]
    public async Task<IReadOnlyList<DoctorAdminDto>> List() => await doctors.ListAsync();

    [ApiRoute("GET", "admin/doctors/{id}")]
    [Authorize(Roles.Admin, Resource = "Doctors", Op = "read")]
    public async Task<ApiResponse<DoctorAdminDto>> Detail(Guid id)
    {
        var doctor = await doctors.GetAsync(id);
        return doctor is null
            ? ApiResponse<DoctorAdminDto>.Fail("找不到醫師", "NOT_FOUND")
            : ApiResponse<DoctorAdminDto>.Ok(doctor);
    }

    [ApiRoute("POST", "admin/doctors")]
    [Authorize(Roles.Admin, Resource = "Doctors", Op = "add")]
    public async Task<ApiResponse<DoctorAdminDto>> Create(DoctorUpsertRequest req)
    {
        var id = await doctors.CreateAsync(req);
        return await Detail(id);
    }

    [ApiRoute("PUT", "admin/doctors/{id}")]
    [Authorize(Roles.Admin, Resource = "Doctors", Op = "update")]
    public async Task<ApiResponse<DoctorAdminDto>> Update(Guid id, DoctorUpsertRequest req)
    {
        await doctors.UpdateAsync(id, req);
        return await Detail(id);
    }

    [ApiRoute("DELETE", "admin/doctors/{id}")]
    [Authorize(Roles.Admin, Resource = "Doctors", Op = "delete")]
    public async Task<ApiResponse> Delete(Guid id)
    {
        await doctors.DeleteAsync(id);
        return ApiResponse.Ok("刪除成功");
    }
}
