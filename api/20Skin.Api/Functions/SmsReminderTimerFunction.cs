using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using Skin.Services.Sms;

namespace Skin.Api.Functions;

/// <summary>
/// 每日簡訊提醒排程。取代舊系統對外公開的 CheckSms HTTP 端點（改內部 Timer 觸發，修安全問題）。
/// 觸發時刻：每日 08:00（開診前提醒）。cron 依 App Setting WEBSITE_TIME_ZONE=Asia/Taipei 以台灣時間解讀
/// （已於 infra/modules/function-app.bicep 設定）；未設時區時退回 UTC，部署後須以首次 Next 時間確認。
/// 與自訂 router 的 catch-all HttpTrigger 互不衝突。實作委派給 Skin.Services.Sms.SmsService（薄 function、厚 service）。
/// </summary>
public sealed class SmsReminderTimerFunction(ISmsService smsService, ILogger<SmsReminderTimerFunction> logger)
{
    [Function("SmsReminder")]
    public async Task Run([TimerTrigger("0 0 8 * * *")] TimerInfo timer, CancellationToken ct)
    {
        logger.LogInformation("SmsReminder 觸發（下次排程 {Next}）。", timer.ScheduleStatus?.Next);
        var processed = await smsService.SendPendingForTodayAsync(ct);
        logger.LogInformation("SmsReminder 完成，處理 {Processed} 筆。", processed);
    }
}
