using Skin.Api.Routing;
using Skin.Core;
using Skin.Core.Constants;
using Skin.Core.Dtos;
using Skin.Services.Member;
using Skin.Services.Question;

namespace Skin.Api.Controllers;

/// <summary>
/// 後台會員管理：查詢/編輯/黑名單 + 問卷掃描檔上傳維護（對應舊 MemberMsController）。
/// Resource 固定 "Members"（沿用舊系統特殊映射 MemberQAs→Members，見 old/blueprints/backend-admin.md）。
/// 見 docs/blueprints/admin-member.md。
/// </summary>
[ApiController]
public sealed class MembersAdminController(IMemberAdminService members, IQuestionService questions)
{
    [ApiRoute("GET", "admin/members")]
    [Authorize(Roles.Admin, Resource = "Members", Op = "read")]
    public async Task<object> List(int page = 1, Guid? branchId = null, string? number = null, DateTime? birthday = null)
    {
        var (items, total) = await members.ListAsync(page, 20, branchId, number, birthday);
        return new { items, total, page, pageSize = 20 };
    }

    [ApiRoute("GET", "admin/members/{id}")]
    [Authorize(Roles.Admin, Resource = "Members", Op = "read")]
    public async Task<ApiResponse<MemberDetailDto>> Detail(Guid id)
    {
        var member = await members.GetAsync(id);
        return member is null
            ? ApiResponse<MemberDetailDto>.Fail("找不到會員", "NOT_FOUND")
            : ApiResponse<MemberDetailDto>.Ok(member);
    }

    [ApiRoute("PUT", "admin/members/{id}")]
    [Authorize(Roles.Admin, Resource = "Members", Op = "update")]
    public async Task<ApiResponse<MemberDetailDto>> Update(Guid id, MemberUpdateRequest req)
    {
        await members.UpdateAsync(id, req);
        return await Detail(id);
    }

    /// <summary>刪除會員。有預約或問卷紀錄即擋（Appointments/MemberQuestions 對 Members 皆為 CASCADE，見 Service 註解）。</summary>
    [ApiRoute("DELETE", "admin/members/{id}")]
    [Authorize(Roles.Admin, Resource = "Members", Op = "delete")]
    public async Task<ApiResponse> Delete(Guid id)
    {
        await members.DeleteAsync(id);
        return ApiResponse.Ok("刪除成功");
    }

    [ApiRoute("GET", "admin/members/{id}/questionnaires")]
    [Authorize(Roles.Admin, Resource = "Members", Op = "read")]
    public Task<MemberQuestionnairesDto> Questionnaires(Guid id) => members.GetQuestionnairesAsync(id);

    /// <summary>唯讀檢視此會員某問卷的數位作答打勾清單（重用客戶前台 IQuestionService.GetFormAsync，不新增 Service 邏輯）。</summary>
    [ApiRoute("GET", "admin/members/{id}/questionnaires/{questionTypeId}/view")]
    [Authorize(Roles.Admin, Resource = "Members", Op = "read")]
    public async Task<ApiResponse<QuestionFormDto>> ViewQuestionnaire(Guid id, Guid questionTypeId)
    {
        var form = await questions.GetFormAsync(id, questionTypeId, includeDisabled: true);
        return form is null
            ? ApiResponse<QuestionFormDto>.Fail("問卷不存在或已停用", "NOT_FOUND")
            : ApiResponse<QuestionFormDto>.Ok(form);
    }

    [ApiRoute("POST", "admin/members/{id}/questionnaires")]
    [Authorize(Roles.Admin, Resource = "Members", Op = "add")]
    public async Task<ApiResponse> CreateQuestionUpload(Guid id, MemberQuestionUpsertRequest req)
    {
        await members.CreateQuestionUploadAsync(id, req);
        return ApiResponse.Ok("新增成功");
    }

    [ApiRoute("PUT", "admin/members/questionnaires/{linkId}")]
    [Authorize(Roles.Admin, Resource = "Members", Op = "update")]
    public async Task<ApiResponse> UpdateQuestionUpload(Guid linkId, MemberQuestionUpsertRequest req)
    {
        await members.UpdateQuestionUploadAsync(linkId, req);
        return ApiResponse.Ok("儲存成功");
    }

    [ApiRoute("DELETE", "admin/members/questionnaires/{linkId}")]
    [Authorize(Roles.Admin, Resource = "Members", Op = "delete")]
    public async Task<ApiResponse> DeleteQuestionUpload(Guid linkId)
    {
        await members.DeleteQuestionUploadAsync(linkId);
        return ApiResponse.Ok("刪除成功");
    }
}
