using Skin.Api.Routing;
using Skin.Core;
using Skin.Core.Constants;
using Skin.Core.Dtos;
using Skin.Services.BasicData;

namespace Skin.Api.Controllers;

/// <summary>
/// 後台基礎資料：問卷類型 CRUD + 排序（對應舊 BasicMsController §QuestionTypes）。
/// 真實 Lims 無獨立 Questions key，題目/選項（QuestionsAdminController）也掛本 Resource。
/// 刪除為軟刪（IsEnabled=false），見 docs/blueprints/admin-basic-data.md。
/// </summary>
[ApiController]
public sealed class QuestionTypesAdminController(IQuestionTypeAdminService questionTypes)
{
    /// <summary>GET /api/admin/question-types?categoryId= — 依科別列出（不帶 categoryId 則全部）。</summary>
    [ApiRoute("GET", "admin/question-types")]
    [Authorize(Roles.Admin, Resource = "QuestionTypes", Op = "read")]
    public Task<IReadOnlyList<QuestionTypeAdminDto>> List(Guid? categoryId) => questionTypes.ListAsync(categoryId);

    [ApiRoute("POST", "admin/question-types")]
    [Authorize(Roles.Admin, Resource = "QuestionTypes", Op = "add")]
    public async Task<ApiResponse<QuestionTypeAdminDto>> Create(QuestionTypeUpsertRequest req)
        => await Detail(await questionTypes.CreateAsync(req));

    [ApiRoute("PUT", "admin/question-types/{id}")]
    [Authorize(Roles.Admin, Resource = "QuestionTypes", Op = "update")]
    public async Task<ApiResponse<QuestionTypeAdminDto>> Update(Guid id, QuestionTypeUpsertRequest req)
    {
        await questionTypes.UpdateAsync(id, req);
        return await Detail(id);
    }

    /// <summary>DELETE /api/admin/question-types/{id} — 軟刪（IsEnabled=false），沿用舊系統。</summary>
    [ApiRoute("DELETE", "admin/question-types/{id}")]
    [Authorize(Roles.Admin, Resource = "QuestionTypes", Op = "delete")]
    public async Task<ApiResponse> Delete(Guid id)
    {
        await questionTypes.DeleteAsync(id);
        return ApiResponse.Ok("刪除成功");
    }

    [ApiRoute("POST", "admin/question-types/sort")]
    [Authorize(Roles.Admin, Resource = "QuestionTypes", Op = "update")]
    public async Task<ApiResponse> Sort(SortRequest req)
    {
        await questionTypes.ReorderAsync(req.Items);
        return ApiResponse.Ok();
    }

    private async Task<ApiResponse<QuestionTypeAdminDto>> Detail(Guid id)
    {
        var qt = await questionTypes.GetAsync(id);
        return qt is null
            ? ApiResponse<QuestionTypeAdminDto>.Fail("找不到問卷", "NOT_FOUND")
            : ApiResponse<QuestionTypeAdminDto>.Ok(qt);
    }
}
