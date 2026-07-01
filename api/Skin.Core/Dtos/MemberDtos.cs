namespace Skin.Core.Dtos;

/// <summary>郵遞區號（城市→區）。前端以 City→Area 連動下拉，送出 ZipcodeId。</summary>
public sealed record ZipcodeDto(int ZipcodeId, string City, string Area, string Zipcode);

/// <summary>
/// 初診會員註冊（JoinUs）。對應舊 MainMs/JoinUs。Allergy/MedicalHistory 前端多選，後端存 CSV（沿用）。
/// 生日以民國/西元年三欄送出（與登入一致）。
/// </summary>
public sealed record RegisterMemberRequest(
    string Number,
    int Yyyy,
    int Mm,
    int Dd,
    string Name,
    string Mobile,
    int? Gender,
    string? BloodType,
    string? Email,
    int? ZipcodeId,
    string? Address,
    string? EmergencyName,
    string? EmergencyPhone,
    IReadOnlyList<string>? Allergy,
    string? AllergyOther,
    IReadOnlyList<string>? MedicalHistory,
    string? MedicalHistoryOther,
    string GoogleCaptchaToken);
