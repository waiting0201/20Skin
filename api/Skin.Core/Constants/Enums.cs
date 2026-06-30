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

/// <summary>SmsStatus.Status：null=待發 / "CANCEL"=取消（沿用）。</summary>
public static class SmsStatusValue
{
    public const string Cancel = "CANCEL";
}

/// <summary>Questions.OptionType：0=單選/1=複選/2=文字/3=檔案（沿用）。</summary>
public enum QuestionOptionType
{
    Single = 0,
    Multiple = 1,
    Text = 2,
    File = 3,
}

/// <summary>JWT 角色。</summary>
public static class Roles
{
    public const string Member = "member";
    public const string Admin = "admin";
}
