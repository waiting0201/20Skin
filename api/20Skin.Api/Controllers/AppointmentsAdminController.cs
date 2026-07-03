// 只別名匯入 IActionResult/FileContentResult：整包 using Microsoft.AspNetCore.Mvc 會與
// Skin.Api.Routing.ApiControllerAttribute 的 [ApiController] 標記撞名（兩者同名不同命名空間）。
using IActionResult = Microsoft.AspNetCore.Mvc.IActionResult;
using FileContentResult = Microsoft.AspNetCore.Mvc.FileContentResult;
using Skin.Api.Routing;
using Skin.Core;
using Skin.Core.Constants;
using Skin.Core.Dtos;
using Skin.Services.BasicData;
using Skin.Services.Reserve;

namespace Skin.Api.Controllers;

/// <summary>
/// 後台預約管理：預約查詢/詳情/取消/容量批次更新/匯出（對應舊 ReserveMsController §Ta/Ch/ChDentistAppointments）。
/// Service 完全參數化（branchId+clinic），Controller 保留 3 組「瘦」proxy action 對應真實 Lims 變體粒度
/// （TaAppointments/ChAppointments/ChDentistAppointments），與 RostersAdminController 同一設計理由；
/// 重用既有 PeriodsOptions 做分院別名解析。見 docs/blueprints/admin-reserve.md。
/// </summary>
[ApiController]
public sealed class AppointmentsAdminController(IAppointmentAdminService appointments, PeriodsOptions branchAliases)
{
    // ================= 台中（TaAppointments，clinic/categoryId 可切換 Skin/Cosmetic） =================

    [ApiRoute("GET", "admin/appointments/ta")]
    [Authorize(Roles.Admin, Resource = "TaAppointments", Op = "read")]
    public Task<AppointmentAdminListResultDto> TaList(
        string? clinic = null, Guid? categoryId = null, DateTime? appointmentDate = null,
        string? memberNumber = null, string? memberMobile = null, string? memberName = null,
        DateTime? birthday = null, int page = 1)
        => List(branchAliases.Resolve("Ta"), clinic, categoryId, appointmentDate, memberNumber, memberMobile, memberName, birthday, page);

    [ApiRoute("GET", "admin/appointments/ta/{id}")]
    [Authorize(Roles.Admin, Resource = "TaAppointments", Op = "read")]
    public Task<ApiResponse<AppointmentAdminDetailDto>> TaDetail(Guid id) => Detail(id);

    [ApiRoute("POST", "admin/appointments/ta/{id}/cancel")]
    [Authorize(Roles.Admin, Resource = "TaAppointments", Op = "delete")]
    public Task<ApiResponse> TaCancel(Guid id) => Cancel(id);

    [ApiRoute("PUT", "admin/appointments/ta/capacity")]
    [Authorize(Roles.Admin, Resource = "TaAppointments", Op = "update")]
    public Task<ApiResponse> TaCapacity(CapacityUpdateRequest req) => Capacity(req);

    [ApiRoute("GET", "admin/appointments/ta/export/checkin")]
    [Authorize(Roles.Admin, Resource = "TaAppointments", Op = "read")]
    public Task<IActionResult> TaExportCheckin(string clinic, DateTime appointmentDate)
        => ExportCheckin(branchAliases.Resolve("Ta"), clinic, appointmentDate);

    [ApiRoute("GET", "admin/appointments/ta/export/questionnaire")]
    [Authorize(Roles.Admin, Resource = "TaAppointments", Op = "read")]
    public Task<ApiResponse<QuestionnaireExportDto>> TaExportQuestionnaire(string clinic, DateTime appointmentDate)
        => ExportQuestionnaire(branchAliases.Resolve("Ta"), clinic, appointmentDate);

    // ================= 二林（ChAppointments，clinic/categoryId 可切換 Skin/Cosmetic） =================

    [ApiRoute("GET", "admin/appointments/ch")]
    [Authorize(Roles.Admin, Resource = "ChAppointments", Op = "read")]
    public Task<AppointmentAdminListResultDto> ChList(
        string? clinic = null, Guid? categoryId = null, DateTime? appointmentDate = null,
        string? memberNumber = null, string? memberMobile = null, string? memberName = null,
        DateTime? birthday = null, int page = 1)
        => List(branchAliases.Resolve("Ch"), clinic, categoryId, appointmentDate, memberNumber, memberMobile, memberName, birthday, page);

    [ApiRoute("GET", "admin/appointments/ch/{id}")]
    [Authorize(Roles.Admin, Resource = "ChAppointments", Op = "read")]
    public Task<ApiResponse<AppointmentAdminDetailDto>> ChDetail(Guid id) => Detail(id);

    [ApiRoute("POST", "admin/appointments/ch/{id}/cancel")]
    [Authorize(Roles.Admin, Resource = "ChAppointments", Op = "delete")]
    public Task<ApiResponse> ChCancel(Guid id) => Cancel(id);

    [ApiRoute("PUT", "admin/appointments/ch/capacity")]
    [Authorize(Roles.Admin, Resource = "ChAppointments", Op = "update")]
    public Task<ApiResponse> ChCapacity(CapacityUpdateRequest req) => Capacity(req);

    [ApiRoute("GET", "admin/appointments/ch/export/checkin")]
    [Authorize(Roles.Admin, Resource = "ChAppointments", Op = "read")]
    public Task<IActionResult> ChExportCheckin(string clinic, DateTime appointmentDate)
        => ExportCheckin(branchAliases.Resolve("Ch"), clinic, appointmentDate);

    [ApiRoute("GET", "admin/appointments/ch/export/questionnaire")]
    [Authorize(Roles.Admin, Resource = "ChAppointments", Op = "read")]
    public Task<ApiResponse<QuestionnaireExportDto>> ChExportQuestionnaire(string clinic, DateTime appointmentDate)
        => ExportQuestionnaire(branchAliases.Resolve("Ch"), clinic, appointmentDate);

    // ================= 二林．齒科（ChDentistAppointments，無 clinic/category 篩選，clinic 固定 Dentist） =================

    [ApiRoute("GET", "admin/appointments/ch-dentist")]
    [Authorize(Roles.Admin, Resource = "ChDentistAppointments", Op = "read")]
    public Task<AppointmentAdminListResultDto> ChDentistList(
        DateTime? appointmentDate = null, string? memberNumber = null, string? memberMobile = null,
        string? memberName = null, DateTime? birthday = null, int page = 1)
        => List(branchAliases.Resolve("ChDentist"), Clinic.Dentist, null, appointmentDate, memberNumber, memberMobile, memberName, birthday, page);

    [ApiRoute("GET", "admin/appointments/ch-dentist/{id}")]
    [Authorize(Roles.Admin, Resource = "ChDentistAppointments", Op = "read")]
    public Task<ApiResponse<AppointmentAdminDetailDto>> ChDentistDetail(Guid id) => Detail(id);

    [ApiRoute("POST", "admin/appointments/ch-dentist/{id}/cancel")]
    [Authorize(Roles.Admin, Resource = "ChDentistAppointments", Op = "delete")]
    public Task<ApiResponse> ChDentistCancel(Guid id) => Cancel(id);

    [ApiRoute("PUT", "admin/appointments/ch-dentist/capacity")]
    [Authorize(Roles.Admin, Resource = "ChDentistAppointments", Op = "update")]
    public Task<ApiResponse> ChDentistCapacity(CapacityUpdateRequest req) => Capacity(req);

    [ApiRoute("GET", "admin/appointments/ch-dentist/export/checkin")]
    [Authorize(Roles.Admin, Resource = "ChDentistAppointments", Op = "read")]
    public Task<IActionResult> ChDentistExportCheckin(DateTime appointmentDate)
        => ExportCheckin(branchAliases.Resolve("ChDentist"), Clinic.Dentist, appointmentDate);

    [ApiRoute("GET", "admin/appointments/ch-dentist/export/questionnaire")]
    [Authorize(Roles.Admin, Resource = "ChDentistAppointments", Op = "read")]
    public Task<ApiResponse<QuestionnaireExportDto>> ChDentistExportQuestionnaire(DateTime appointmentDate)
        => ExportQuestionnaire(branchAliases.Resolve("ChDentist"), Clinic.Dentist, appointmentDate);

    // ================= 共用（非路由） =================

    private Task<AppointmentAdminListResultDto> List(
        Guid branchId, string? clinic, Guid? categoryId, DateTime? appointmentDate,
        string? memberNumber, string? memberMobile, string? memberName, DateTime? birthday, int page)
        => appointments.ListAsync(branchId, clinic, categoryId, appointmentDate, memberNumber, memberMobile, memberName, birthday, page);

    private async Task<ApiResponse<AppointmentAdminDetailDto>> Detail(Guid id)
    {
        var detail = await appointments.GetAsync(id);
        return detail is null
            ? ApiResponse<AppointmentAdminDetailDto>.Fail("找不到預約", "NOT_FOUND")
            : ApiResponse<AppointmentAdminDetailDto>.Ok(detail);
    }

    private async Task<ApiResponse> Cancel(Guid id)
    {
        await appointments.CancelAsync(id);
        return ApiResponse.Ok("取消成功");
    }

    private async Task<ApiResponse> Capacity(CapacityUpdateRequest req)
    {
        await appointments.UpdateCapacityAsync(req);
        return ApiResponse.Ok("儲存成功");
    }

    private async Task<IActionResult> ExportCheckin(Guid branchId, string clinic, DateTime appointmentDate)
    {
        var bytes = await appointments.ExportCheckinAsync(branchId, clinic, appointmentDate);
        return new FileContentResult(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        {
            FileDownloadName = $"{appointmentDate:yyyyMMdd}預約.xlsx",
        };
    }

    private async Task<ApiResponse<QuestionnaireExportDto>> ExportQuestionnaire(Guid branchId, string clinic, DateTime appointmentDate)
        => ApiResponse<QuestionnaireExportDto>.Ok(await appointments.ExportQuestionnaireAsync(branchId, clinic, appointmentDate));
}
