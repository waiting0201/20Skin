namespace Skin.Services.Sms;

/// <summary>簡訊排程發送（供 Timer 觸發）。見 docs/blueprints/sms-reminder.md。</summary>
public interface ISmsService
{
    /// <summary>
    /// 撈當日待發（SendDate=台灣今日 且 Status IS NULL）的簡訊逐筆發送並回寫狀態。
    /// 回傳實際處理筆數（總開關關閉時回 0 且不動任何列）。
    /// </summary>
    Task<int> SendPendingForTodayAsync(CancellationToken ct = default);
}
