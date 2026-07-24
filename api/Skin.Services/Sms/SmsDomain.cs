using System.Globalization;
using Skin.Core.Constants;

namespace Skin.Services.Sms;

/// <summary>
/// 簡訊內容組裝（純邏輯、可測）。
///
/// ⚠️ 文案「一字不差」照抄舊系統 reference/old/20Skin/Controllers/MainMsController.cs:273-304
/// （客戶已定稿，勿改字）。6 種模板：診別（Skin/Cosmetic/Dentist）× 是否配號。
///
/// 判別鍵：
///   - 診別 = <see cref="Clinic"/>（Skin / Cosmetic / 其餘=齒科）。
///   - 配號與否 = <c>outpatientNum is not null</c>。舊系統用 branch.IsAutoRowNumber；新系統改用
///     「是否配到門診號」判別，對所有舊情境等價，且能安全處理「台中現場取號細時段」
///     （IsAutoRowNumber 分院但該時段不配號）——不會誤發含空號碼的配號文案。
/// 見 docs/blueprints/sms-reminder.md。
/// </summary>
public static class SmsDomain
{
    /// <summary>
    /// 依預約組出「即時確認」與「前一天提醒」兩則簡訊內容。
    /// </summary>
    /// <param name="clinic">診別代碼（<see cref="Clinic.Skin"/> / <see cref="Clinic.Cosmetic"/> / 其餘=齒科）。</param>
    /// <param name="branchTitle">分院名稱（Branchs.Title，DB 原值，勿加工）。</param>
    /// <param name="periodTitle">時段名稱（Periods.Title）。</param>
    /// <param name="memberName">會員姓名（Members.Name，僅齒科文案使用）。</param>
    /// <param name="appointmentDate">預約日期。</param>
    /// <param name="outpatientNum">門診號；null 表示現場取號。</param>
    public static (string Immediate, string Reminder) Compose(
        string clinic, string branchTitle, string periodTitle, string memberName,
        DateTime appointmentDate, int? outpatientNum)
    {
        // 西元 yyyy-MM-dd（皮膚科/醫美用）。舊系統：AppointmentDate.ToString("yyyy-MM-dd")。
        var date = appointmentDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var numbered = outpatientNum is not null;

        return clinic switch
        {
            Clinic.Skin when numbered => (
                $"『{branchTitle}皮膚科診所』您的預約號碼為{outpatientNum}號，報到時請主動告知櫃檯人員預約號碼。預約成功注意事項:①進入20skin官網可以看到現場即時看診進度②依照過號順序，每一位過號皆需候診3-5位現場號，建議提前5個號碼報到以免過號③超過三次預約未報到系統將自動封鎖線上預約功能④若需指定醫師請於關診前半小時報到",
                $"『{branchTitle}皮膚科診所』預約提醒！您預約的號碼為{outpatientNum}號，請於【{date} {periodTitle}】提前5個號碼報到，過號請再等3-5位。請到皮膚科櫃檯報到。"),

            Clinic.Skin => (
                $"『{branchTitle}皮膚科診所』預約成功！請於【{date} {periodTitle}】準時前往，需提早10分鐘報到，只保留10分鐘。請到皮膚科櫃檯報到，並告知櫃檯人員有線上預約及預約時段，謝謝您。",
                $"『{branchTitle}皮膚科診所』預約提醒！請於【{date} {periodTitle}】準時前往，需提早10分鐘報到，只保留10分鐘。請到皮膚科櫃檯報到，並告知櫃檯人員有線上預約及預約時段，謝謝您。"),

            Clinic.Cosmetic when numbered => (
                $"『醫學美容．{branchTitle}皮膚科診所』預約成功！您預約的號碼為{outpatientNum}號，請於【{date} {periodTitle}】提前5個號碼報到，過號請再等3-5位。請到美容中心『美美藥局』櫃檯報到。",
                $"『醫學美容．{branchTitle}皮膚科診所』預約提醒！您預約的號碼為{outpatientNum}號，請於【{date} {periodTitle}】提前5個號碼報到，過號請再等3-5位。請到美容中心『美美藥局』櫃檯報到。"),

            Clinic.Cosmetic => (
                $"『醫學美容．{branchTitle}皮膚科診所』預約成功！請於【{date} {periodTitle}】準時前往，需提早10分鐘報到，只保留10分鐘。請到美容中心『美美藥局』櫃檯報到。",
                // ⚠️ 舊系統此則在「】」之後多一個半形空格才接「準時前往」（其他分支沒有），務必保留。
                $"『醫學美容．{branchTitle}皮膚科診所』預約提醒！請於【{date} {periodTitle}】 準時前往，需提早10分鐘報到，只保留10分鐘。請到美容中心『美美藥局』櫃檯報到。"),

            // 齒科（else，不分配號）：用「N月N日」（半形、無前導零、無年份）。
            _ => (
                $"{branchTitle}關心您，{memberName}您好，提醒您於{appointmentDate.Month}月{appointmentDate.Day}日{periodTitle}已預約成功，謝謝。",
                $"{memberName}您好，提醒您於{appointmentDate.Month}月{appointmentDate.Day}日{periodTitle}已有預約，此致{branchTitle}。"),
        };
    }
}
