using Skin.Api.Auth;
using Skin.Api.Routing;
using Skin.Core;
using Skin.Core.Constants;
using Skin.Core.Dtos;
using Skin.Services.Question;

namespace Skin.Api.Controllers;

/// <summary>
/// 問卷（術前電子病歷）：清單 → 填答（pre-fill）→ 提交。需會員登入。
/// 見 docs/blueprints/questionnaire.md、design/api-design.md。對應舊 MainMs(QuestionTypes/Questions)。
/// </summary>
[ApiController]
[Authorize(Roles.Member)]
public sealed class QuestionsController(IQuestionService questions, RequestContext ctx)
{
    private Guid MemberId => ctx.UserId ?? throw new BusinessException("未登入", "UNAUTHORIZED");

    /// <summary>GET /api/question-types?clinic=&amp;categoryId= — 有啟用問卷的項目清單（含已作答旗標）。</summary>
    [ApiRoute("GET", "question-types")]
    public Task<IReadOnlyList<QuestionnaireCategoryDto>> List(string? clinic = null, Guid? categoryId = null)
        => questions.GetCategoriesAsync(MemberId, clinic, categoryId);

    /// <summary>GET /api/question-types/{id} — 單份問卷表單（題目+選項+既有作答 pre-fill）。</summary>
    [ApiRoute("GET", "question-types/{id}")]
    public async Task<object> Form(Guid id)
    {
        var dto = await questions.GetFormAsync(MemberId, id);
        return dto is null
            ? ApiResponse.Fail("問卷不存在或已停用", "NOT_FOUND")
            : ApiResponse<QuestionFormDto>.Ok(dto);
    }

    /// <summary>POST /api/member-questions — 提交作答（交易內重填語義）。</summary>
    [ApiRoute("POST", "member-questions")]
    public async Task<ApiResponse> Submit(SaveMemberQuestionsRequest req)
    {
        await questions.SubmitAsync(MemberId, req);
        return ApiResponse.Ok("已儲存");
    }
}
