namespace Skin.Core.Dtos;

/// <summary>後台會員管理 DTO（見 docs/blueprints/admin-member.md）。</summary>

/// <summary>會員列表項。BranchTitles：曾就診分院去重清單（無預約則為空陣列，前端顯示「尚未預約」）。</summary>
public sealed record MemberListItemDto(
    Guid MemberId, string Number, string Mobile, DateTime Birthday, string? Name,
    bool IsBlackList, bool IsFirstVisit, IReadOnlyList<string> BranchTitles);

/// <summary>會員詳情（編輯表單用）。Number 唯讀不可改。</summary>
public sealed record MemberDetailDto(
    Guid MemberId, string Number, string Mobile, DateTime Birthday, string? Name,
    int? Gender, string? BloodType, string? Email, int? ZipcodeId, string? City, string? Address,
    string? EmergencyName, string? EmergencyPhone,
    IReadOnlyList<string> Allergy, string? AllergyOther,
    IReadOnlyList<string> MedicalHistory, string? MedicalHistoryOther,
    bool IsBlackList);

/// <summary>編輯會員請求（不含 Number，唯讀）。</summary>
public sealed record MemberUpdateRequest(
    string Mobile, DateTime Birthday, string? Name,
    int? Gender, string? BloodType, string? Email, int? ZipcodeId, string? Address,
    string? EmergencyName, string? EmergencyPhone,
    IReadOnlyList<string>? Allergy, string? AllergyOther,
    IReadOnlyList<string>? MedicalHistory, string? MedicalHistoryOther,
    bool IsBlackList);

/// <summary>
/// 會員問卷清單項。LinkId：掃描檔上傳＝MemberQuestionID；數位作答（唯讀）＝QuestionTypeID
/// （對應舊 MemberQuestionRowViewModel.LinkID 的雙重用途，見 MemberMsController.MemberQAs）。
/// QuestionTypeId/Filename 供前端編輯表單預填（掃描檔項）；數位作答項 Filename 恆為 null。
/// </summary>
public sealed record MemberQuestionnaireLinkDto(
    Guid LinkId, string CategoryTitle, string QuestionTypeTitle, Guid QuestionTypeId, string? Filename);

/// <summary>會員問卷維護頁：已上傳掃描檔（可編輯/刪除）＋已數位作答問卷（唯讀連結）。</summary>
public sealed record MemberQuestionnairesDto(
    IReadOnlyList<MemberQuestionnaireLinkDto> Uploaded,
    IReadOnlyList<MemberQuestionnaireLinkDto> DigitalAnswered);

/// <summary>新增/編輯問卷掃描檔請求。Filename 為 null 表編輯時不換檔（沿用既有檔案）。</summary>
public sealed record MemberQuestionUpsertRequest(Guid QuestionTypeId, string? Filename);
