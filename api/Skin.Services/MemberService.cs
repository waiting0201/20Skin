using Dapper;
using Skin.Data;
using Skin.Data.Entities;

namespace Skin.Services;

public sealed class MemberService(IDbConnectionFactory db) : IMemberService
{
    public async Task<Members?> FindByNumberAndBirthdayAsync(string number, DateTime birthday, CancellationToken ct = default)
    {
        var key = number.Trim().ToUpperInvariant();
        var dayStart = birthday.Date;
        var dayEnd = dayStart.AddDays(1);

        // 參數化查詢（防 SQL injection）；比對生日當日範圍避免時間成分影響。
        const string sql = """
            SELECT TOP 1 *
            FROM Members
            WHERE Number = @Number
              AND Birthday >= @DayStart AND Birthday < @DayEnd
            """;

        using var conn = db.Create();
        var cmd = new CommandDefinition(sql,
            new { Number = key, DayStart = dayStart, DayEnd = dayEnd },
            cancellationToken: ct);
        return await conn.QueryFirstOrDefaultAsync<Members>(cmd);
    }
}
