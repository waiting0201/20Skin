using Dapper;
using Skin.Core.Dtos;
using Skin.Data;
using Skin.Data.Entities;

namespace Skin.Services;

public sealed class MemberService(IDbConnectionFactory db) : IMemberService
{
    /// <summary>台灣時間（reused DB 以本地時間存 Createdate/Birthday）。</summary>
    private static DateTime TaiwanNow =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("Asia/Taipei"));

    public async Task<(Members Member, bool IsNew)> RegisterAsync(
        RegisterMemberRequest req, DateTime birthday, CancellationToken ct = default)
    {
        // 已存在（身分證+生日）→ 直接回，不重複建檔（沿用舊 JoinUs：member != null 則登入既有）。
        var existing = await FindByNumberAndBirthdayAsync(req.Number, birthday, ct);
        if (existing is not null) return (existing, false);

        var member = new Members
        {
            MemberID = Guid.NewGuid(),
            Number = req.Number.Trim().ToUpperInvariant(),
            Mobile = req.Mobile.Trim(),
            Birthday = birthday,
            Name = req.Name.Trim(),
            Gender = req.Gender,
            BloodType = req.BloodType,
            Email = string.IsNullOrWhiteSpace(req.Email) ? null : req.Email.Trim(),
            ZipcodeID = req.ZipcodeId,
            Address = req.Address?.Trim(),
            EmergencyName = req.EmergencyName?.Trim(),
            EmergencyPhone = req.EmergencyPhone?.Trim(),
            Allergy = ToCsv(req.Allergy),
            AllergyOther = string.IsNullOrWhiteSpace(req.AllergyOther) ? null : req.AllergyOther.Trim(),
            MedicalHistory = ToCsv(req.MedicalHistory),
            MedicalHistoryOther = string.IsNullOrWhiteSpace(req.MedicalHistoryOther) ? null : req.MedicalHistoryOther.Trim(),
            IsBlackList = false,
            Createdate = TaiwanNow,
        };

        const string sql = """
            INSERT INTO Members
                (MemberID, Number, Mobile, Birthday, Name, Gender, BloodType, Email, ZipcodeID, Address,
                 EmergencyName, EmergencyPhone, Allergy, AllergyOther, MedicalHistory, MedicalHistoryOther, IsBlackList, Createdate)
            VALUES
                (@MemberID, @Number, @Mobile, @Birthday, @Name, @Gender, @BloodType, @Email, @ZipcodeID, @Address,
                 @EmergencyName, @EmergencyPhone, @Allergy, @AllergyOther, @MedicalHistory, @MedicalHistoryOther, @IsBlackList, @Createdate)
            """;
        using var conn = db.Create();
        await conn.ExecuteAsync(new CommandDefinition(sql, member, cancellationToken: ct));
        return (member, true);
    }

    public async Task<IReadOnlyList<ZipcodeDto>> GetZipcodesAsync(CancellationToken ct = default)
    {
        const string sql = """
            SELECT ZipcodeID AS ZipcodeId, City, Area, Zipcode
            FROM Zipcodes WHERE IsDisplay = 1 ORDER BY ZipcodeID
            """;
        using var conn = db.Create();
        var rows = await conn.QueryAsync<ZipcodeDto>(new CommandDefinition(sql, cancellationToken: ct));
        return rows.AsList();
    }

    /// <summary>多選 → CSV（沿用舊 string.Join(",")）；空則 null。</summary>
    private static string? ToCsv(IReadOnlyList<string>? items)
    {
        if (items is null) return null;
        var vals = items.Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => s.Trim());
        var csv = string.Join(",", vals);
        return csv.Length == 0 ? null : csv;
    }

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
