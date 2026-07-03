using Skin.Core.Dtos;

namespace Skin.Services.Member;

/// <summary>
/// 後台會員維護：查詢/編輯/黑名單 + 問卷掃描檔上傳維護。見 docs/blueprints/admin-member.md。
/// 與 <see cref="Skin.Services.IMemberService"/>（會員登入/註冊）職責分離，不共用。
/// </summary>
public interface IMemberAdminService
{
    /// <summary>分頁列表（忠於舊系統 Members.cshtml 的 pageSize=20 分頁）；篩選：分院/身分證號/生日。</summary>
    Task<(IReadOnlyList<MemberListItemDto> Items, int Total)> ListAsync(
        int page, int pageSize, Guid? branchId, string? number, DateTime? birthday, CancellationToken ct = default);

    Task<MemberDetailDto?> GetAsync(Guid id, CancellationToken ct = default);

    /// <summary>編輯會員資料（不含身分證號，唯讀）。</summary>
    Task UpdateAsync(Guid id, MemberUpdateRequest req, CancellationToken ct = default);

    /// <summary>
    /// 刪除會員。舊系統 `DeleteMembers` 無任何前置檢查即硬刪；但 Appointments/MemberQuestions 對 Members
    /// 皆為 CASCADE（已查證 docs/old/design/database-design.md），無檢查會連帶靜默刪光該會員全部預約/問卷史。
    /// 比照本系統其餘 CASCADE 風險實體（Branch/Category/Period/Doctor）的既有慣例，加前置檢查擋下。
    /// </summary>
    Task DeleteAsync(Guid id, CancellationToken ct = default);

    /// <summary>問卷維護頁：已上傳掃描檔（可編輯/刪除）＋已數位作答問卷（唯讀連結）。</summary>
    Task<MemberQuestionnairesDto> GetQuestionnairesAsync(Guid memberId, CancellationToken ct = default);

    /// <summary>新增問卷掃描檔（同會員同問卷類型已有紀錄則擋 DUPLICATE_QUESTIONNAIRE）。</summary>
    Task<Guid> CreateQuestionUploadAsync(Guid memberId, MemberQuestionUpsertRequest req, CancellationToken ct = default);

    /// <summary>編輯問卷掃描檔；Filename 有值且與舊檔不同時，換檔並刪除舊 Blob。</summary>
    Task UpdateQuestionUploadAsync(Guid memberQuestionId, MemberQuestionUpsertRequest req, CancellationToken ct = default);

    /// <summary>刪除問卷掃描檔（連同刪除 Blob）。</summary>
    Task DeleteQuestionUploadAsync(Guid memberQuestionId, CancellationToken ct = default);
}
