namespace Skin.Core.Constants;

/// <summary>
/// 診別代碼（DB 為字串欄位 Clinic）。值見 docs/old/design/database-design.md §列舉值對照。
/// 沿用舊系統字串值，勿更動。
/// </summary>
public static class Clinic
{
    public const string Skin = "Skin";        // 健保門診
    public const string Cosmetic = "Cosmetic"; // 醫學美容
    public const string Dentist = "Dentist";   // 齒科

    public static string ToTitle(string clinic) => clinic switch
    {
        Skin => "健保門診",
        Cosmetic => "醫學美容",
        Dentist => "齒科",
        _ => clinic,
    };
}

/// <summary>Appointments.Status：1=有效預約 / 0=已取消（沿用）。</summary>
public static class AppointmentStatus
{
    public const int Active = 1;
    public const int Cancelled = 0;
}

/// <summary>
/// SmsStatus.Status：null=待發 / "CANCEL"=取消（沿用舊系統）/ "OFF"=分項開關關閉未發（新增）。
/// 其餘值為智邦回應原始 status（未知時退回 "SENT"/"FAIL"）。
/// </summary>
public static class SmsStatusValue
{
    public const string Cancel = "CANCEL";

    /// <summary>分項開關 <c>Sms:ImmediateEnabled=false</c> 時的即時列狀態（非 null 以免被 Timer 撈走補送）。</summary>
    public const string Off = "OFF";
}

/// <summary>
/// Questions.OptionType。⚠️ 真實 DB 只有 1=單選(radio)/2=複選(checkbox)（見 docs/gotchas.md）。
/// 舊文件曾記為 0/1/2/3=單選/複選/文字/檔案，與實際資料不符，勿採用。
/// </summary>
public enum QuestionOptionType
{
    Single = 1,   // 單選 radio
    Multiple = 2, // 複選 checkbox
}

/// <summary>JWT 角色。</summary>
public static class Roles
{
    public const string Member = "member";
    public const string Admin = "admin";
}
