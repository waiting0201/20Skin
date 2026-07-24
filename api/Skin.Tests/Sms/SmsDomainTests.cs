using Skin.Core.Constants;
using Skin.Services.Sms;
using Xunit;

namespace Skin.Tests.Sms;

/// <summary>
/// 逐字守門：SmsDomain 產出必須與舊系統文案「一字不差」
/// （客戶已定稿，來源 reference/old/20Skin/Controllers/MainMsController.cs:273-304）。
/// 樣本值：院名=台中、時段=早診、姓名=王小明、日期=2026-08-15、門診號=8。
/// </summary>
public class SmsDomainTests
{
    private static readonly DateTime Date = new(2026, 8, 15);
    private const string Branch = "台中";
    private const string Period = "早診";
    private const string Name = "王小明";

    [Fact]
    public void Skin_Numbered() // 健保 · 配號
    {
        var (immediate, reminder) = SmsDomain.Compose(Clinic.Skin, Branch, Period, Name, Date, 8);
        Assert.Equal(
            "『台中皮膚科診所』您的預約號碼為8號，報到時請主動告知櫃檯人員預約號碼。預約成功注意事項:①進入20skin官網可以看到現場即時看診進度②依照過號順序，每一位過號皆需候診3-5位現場號，建議提前5個號碼報到以免過號③超過三次預約未報到系統將自動封鎖線上預約功能④若需指定醫師請於關診前半小時報到",
            immediate);
        Assert.Equal(
            "『台中皮膚科診所』預約提醒！您預約的號碼為8號，請於【2026-08-15 早診】提前5個號碼報到，過號請再等3-5位。請到皮膚科櫃檯報到。",
            reminder);
    }

    [Fact]
    public void Skin_OnSite() // 健保 · 現場取號（無門診號）
    {
        var (immediate, reminder) = SmsDomain.Compose(Clinic.Skin, Branch, Period, Name, Date, null);
        Assert.Equal(
            "『台中皮膚科診所』預約成功！請於【2026-08-15 早診】準時前往，需提早10分鐘報到，只保留10分鐘。請到皮膚科櫃檯報到，並告知櫃檯人員有線上預約及預約時段，謝謝您。",
            immediate);
        Assert.Equal(
            "『台中皮膚科診所』預約提醒！請於【2026-08-15 早診】準時前往，需提早10分鐘報到，只保留10分鐘。請到皮膚科櫃檯報到，並告知櫃檯人員有線上預約及預約時段，謝謝您。",
            reminder);
    }

    [Fact]
    public void Cosmetic_Numbered() // 醫美 · 配號
    {
        var (immediate, reminder) = SmsDomain.Compose(Clinic.Cosmetic, Branch, Period, Name, Date, 8);
        Assert.Equal(
            "『醫學美容．台中皮膚科診所』預約成功！您預約的號碼為8號，請於【2026-08-15 早診】提前5個號碼報到，過號請再等3-5位。請到美容中心『美美藥局』櫃檯報到。",
            immediate);
        Assert.Equal(
            "『醫學美容．台中皮膚科診所』預約提醒！您預約的號碼為8號，請於【2026-08-15 早診】提前5個號碼報到，過號請再等3-5位。請到美容中心『美美藥局』櫃檯報到。",
            reminder);
    }

    [Fact]
    public void Cosmetic_OnSite() // 醫美 · 現場取號（提醒那則「】」後有一個半形空格）
    {
        var (immediate, reminder) = SmsDomain.Compose(Clinic.Cosmetic, Branch, Period, Name, Date, null);
        Assert.Equal(
            "『醫學美容．台中皮膚科診所』預約成功！請於【2026-08-15 早診】準時前往，需提早10分鐘報到，只保留10分鐘。請到美容中心『美美藥局』櫃檯報到。",
            immediate);
        Assert.Equal(
            "『醫學美容．台中皮膚科診所』預約提醒！請於【2026-08-15 早診】 準時前往，需提早10分鐘報到，只保留10分鐘。請到美容中心『美美藥局』櫃檯報到。",
            reminder);
    }

    [Fact]
    public void Dentist() // 齒科（else，不分配號；用 N月N日、無年份）
    {
        var (immediate, reminder) = SmsDomain.Compose(Clinic.Dentist, Branch, Period, Name, Date, null);
        Assert.Equal("台中關心您，王小明您好，提醒您於8月15日早診已預約成功，謝謝。", immediate);
        Assert.Equal("王小明您好，提醒您於8月15日早診已有預約，此致台中。", reminder);
    }

    [Fact]
    public void Dentist_IgnoresOutpatientNum() // 齒科即使有門診號也不進配號分支、文案不含號碼
    {
        var (immediate, _) = SmsDomain.Compose(Clinic.Dentist, Branch, Period, Name, Date, 8);
        Assert.DoesNotContain("號", immediate);
        Assert.Equal("台中關心您，王小明您好，提醒您於8月15日早診已預約成功，謝謝。", immediate);
    }
}
