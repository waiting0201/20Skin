namespace Skin.Core.Dtos;

/// <summary>
/// 後台儀表板 DTO（見 docs/blueprints/admin-dashboard.md）。舊系統 Main/Index 為空殼 widget，
/// 儀表板為新系統新增功能：依管理員可讀權限（TaAppointments/ChAppointments/ChDentistAppointments/Members）
/// 回傳對應區塊，無權限的區塊不出現在回應中。
/// </summary>
public sealed record DashboardDto(
    DateTime Date,
    IReadOnlyList<DashboardBranchDto> Branches,
    IReadOnlyList<DashboardTrendDayDto> Trend,
    DashboardMemberStatsDto? Members);

/// <summary>
/// 單一分院（Lims 變體粒度：ta/ch/chDentist，同預約管理）當日統計。
/// TodayFirstVisit 依會員 Status=1 預約總數是否 &lt;=1 動態判斷（同預約列表頁邏輯，不讀 IsFirstVisit 欄位）。
/// </summary>
public sealed record DashboardBranchDto(
    string BranchKey,
    string BranchTitle,
    int TodayCount,
    int TodayFirstVisit,
    int TodayCancelled,
    IReadOnlyList<DashboardClinicStatDto> Clinics);

/// <summary>分院內各診別（Skin/Cosmetic/Dentist）當日有效預約數。</summary>
public sealed record DashboardClinicStatDto(string Clinic, string ClinicTitle, int TodayCount);

/// <summary>未來 7 天（含今日）預約量（僅 Status=1）；PerBranch 鍵為 BranchKey。</summary>
public sealed record DashboardTrendDayDto(DateTime Date, int Total, IReadOnlyDictionary<string, int> PerBranch);

/// <summary>會員統計（需 Members 讀取權限）。TodayNew/MonthNew 依 Members.Createdate 計算。</summary>
public sealed record DashboardMemberStatsDto(int TotalMembers, int TodayNew, int MonthNew, int BlacklistCount);
