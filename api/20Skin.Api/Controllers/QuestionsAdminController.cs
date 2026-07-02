using Skin.Api.Routing;
using Skin.Core;
using Skin.Core.Constants;
using Skin.Core.Dtos;
using Skin.Services.BasicData;

namespace Skin.Api.Controllers;

/// <summary>
/// 後台基礎資料：問卷題目 + 選項 CRUD + 排序（對應舊 BasicMsController §Questions）。
/// 真實 Lims 無獨立 Questions key，掛 Resource="QuestionTypes"（同 QuestionTypesAdminController）。
/// 選項編輯為整組送出比對 diff，見 IQuestionAdminService 註解、docs/blueprints/admin-basic-data.md。
/// </summary>
[ApiController]
public sealed class QuestionsAdminController(IQuestionAdminService questions)
{
    /// <summary>GET /api/admin/question-types/{questionTypeId}/questions — 該問卷的題目（含巢狀選項）。</summary>
    [ApiRoute("GET", "admin/question-types/{questionTypeId}/questions")]
    [Authorize(Roles.Admin, Resource = "QuestionTypes", Op = "read")]
    public Task<IReadOnlyList<QuestionAdminDto>> List(Guid questionTypeId) => questions.ListAsync(questionTypeId);

    /// <summary>POST /api/admin/questions?questionTypeId= — 新增題目 + 初始選項。</summary>
    [ApiRoute("POST", "admin/questions")]
    [Authorize(Roles.Admin, Resource = "QuestionTypes", Op = "add")]
    public async Task<ApiResponse> Create(Guid questionTypeId, QuestionUpsertRequest req)
    {
        await questions.CreateAsync(questionTypeId, req);
        return ApiResponse.Ok("新增成功");
    }

    [ApiRoute("PUT", "admin/questions/{id}")]
    [Authorize(Roles.Admin, Resource = "QuestionTypes", Op = "update")]
    public async Task<ApiResponse> Update(Guid id, QuestionUpsertRequest req)
    {
        await questions.UpdateAsync(id, req);
        return ApiResponse.Ok("儲存成功");
    }

    /// <summary>DELETE /api/admin/questions/{id} — 軟刪（IsEnabled=false），沿用舊系統。</summary>
    [ApiRoute("DELETE", "admin/questions/{id}")]
    [Authorize(Roles.Admin, Resource = "QuestionTypes", Op = "delete")]
    public async Task<ApiResponse> Delete(Guid id)
    {
        await questions.DeleteAsync(id);
        return ApiResponse.Ok("刪除成功");
    }

    /// <summary>POST /api/admin/questions/sort?questionTypeId= — 批次排序（限本問卷內的題目）。</summary>
    [ApiRoute("POST", "admin/questions/sort")]
    [Authorize(Roles.Admin, Resource = "QuestionTypes", Op = "update")]
    public async Task<ApiResponse> Sort(Guid questionTypeId, SortRequest req)
    {
        await questions.ReorderAsync(questionTypeId, req.Items);
        return ApiResponse.Ok();
    }
}
