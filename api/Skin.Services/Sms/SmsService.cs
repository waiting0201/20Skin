using System.Data;
using Dapper;
using Microsoft.Extensions.Logging;
using Skin.Data;

namespace Skin.Services.Sms;

/// <summary>
/// 簡訊排程發送。取代舊系統對外公開的 MainMsController.CheckSms HTTP 端點（改由 Timer 內部觸發）。
/// 撈當日待發的「前一天提醒」列（雙寫時 Status=null），發送當時已組好存在 SmsBody 的文字（不重組，同舊系統）。
/// </summary>
public sealed class SmsService(IDbConnectionFactory db, ISmsSender sms, SmsOptions options, ILogger<SmsService> logger)
    : ISmsService
{
    private sealed record PendingRow(Guid SmsStatusID, string Mobile, string SmsBody);

    public async Task<int> SendPendingForTodayAsync(CancellationToken ct = default)
    {
        // 總開關：關閉時不動任何列（待發列保持 null，日後開啟只撈當日、無 backlog 洪水）。
        if (!options.Enabled)
        {
            logger.LogInformation("簡訊排程略過：總開關 Sms:Enabled=false（正式環境驗證智邦帳號前為停用狀態）。");
            return 0;
        }

        var today = DateTime.UtcNow.AddHours(8).Date; // 台灣今日
        using var conn = db.Create();
        conn.Open();

        var pending = (await conn.QueryAsync<PendingRow>(new CommandDefinition("""
            SELECT SmsStatusID, Mobile, SmsBody
            FROM SmsStatus
            WHERE CAST(SendDate AS DATE) = @today AND Status IS NULL
            """, new { today }, cancellationToken: ct))).ToList();

        if (pending.Count == 0)
        {
            logger.LogInformation("簡訊排程：今日（{Today:yyyy-MM-dd}）無待發簡訊。", today);
            return 0;
        }

        var sentCount = 0;
        foreach (var row in pending)
        {
            var result = await sms.SendAsync(row.Mobile, row.SmsBody, ct);
            var status = result.RawStatus ?? (result.Success ? "SENT" : "FAIL");
            await conn.ExecuteAsync(new CommandDefinition("""
                UPDATE SmsStatus SET Status = @status, Message = @message, UniqID = @uniqId, UpdateDate = @now
                WHERE SmsStatusID = @id
                """, new { status, message = result.Message, uniqId = result.UniqId, now = DateTime.UtcNow.AddHours(8), id = row.SmsStatusID }, cancellationToken: ct));
            if (result.Success) sentCount++;
        }

        logger.LogInformation("簡訊排程完成：今日待發 {Total} 筆，成功 {Sent} 筆。", pending.Count, sentCount);
        return pending.Count;
    }
}
