using Dapper;
using Skin.Core;
using Skin.Core.Dtos;
using Skin.Data;
using Skin.Services.Storage;

namespace Skin.Services.Member;

/// <summary>後台會員維護（Dapper，reused DB，schema 不可改）。</summary>
public sealed class MemberAdminService(IDbConnectionFactory db, IFileStorage storage) : IMemberAdminService
{
    private const string UploadFolder = "memberquestions";

    // 真實欄位長度見 docs/old/design/database-design.md §2 Members（nvarchar 邏輯字數）。
    private const int MobileMaxLength = 15;
    private const int NameMaxLength = 20;
    private const int BloodTypeMaxLength = 5;
    private const int EmailMaxLength = 150;
    private const int AddressMaxLength = 250;
    private const int EmergencyNameMaxLength = 20;
    private const int EmergencyPhoneMaxLength = 15;
    private const int AllergyMaxLength = 150;
    private const int AllergyOtherMaxLength = 50;
    private const int MedicalHistoryMaxLength = 150;
    private const int MedicalHistoryOtherMaxLength = 50;

    public async Task<(IReadOnlyList<MemberListItemDto> Items, int Total)> ListAsync(
        int page, int pageSize, Guid? branchId, string? number, DateTime? birthday, CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var offset = (page - 1) * pageSize;

        var normalizedNumber = string.IsNullOrWhiteSpace(number) ? null : number.Trim().ToUpperInvariant();
        var dayStart = birthday?.Date;
        var dayEnd = dayStart?.AddDays(1);

        const string where = """
            WHERE (@branchId IS NULL OR EXISTS (SELECT 1 FROM Appointments a WHERE a.MemberID = m.MemberID AND a.BranchID = @branchId))
              AND (@number IS NULL OR m.Number = @number)
              AND (@dayStart IS NULL OR (m.Birthday >= @dayStart AND m.Birthday < @dayEnd))
            """;

        using var conn = db.Create();
        var total = await conn.ExecuteScalarAsync<int>(new CommandDefinition(
            $"SELECT COUNT(*) FROM Members m {where}",
            new { branchId, number = normalizedNumber, dayStart, dayEnd }, cancellationToken: ct));

        var rows = (await conn.QueryAsync<MemberRow>(new CommandDefinition($"""
            SELECT m.MemberID AS MemberId, m.Number, m.Mobile, m.Birthday, m.Name, m.IsBlackList,
                   (SELECT COUNT(*) FROM Appointments a WHERE a.MemberID = m.MemberID AND a.Status = 1) AS FirstVisitCount
            FROM Members m
            {where}
            ORDER BY m.Createdate DESC
            OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
            """, new { branchId, number = normalizedNumber, dayStart, dayEnd, offset, pageSize }, cancellationToken: ct))).AsList();

        var ids = rows.Select(r => r.MemberId).ToList();
        var branchTitles = new Dictionary<Guid, List<string>>();
        if (ids.Count > 0)
        {
            var branchRows = await conn.QueryAsync<BranchTitleRow>(new CommandDefinition("""
                SELECT DISTINCT a.MemberID AS MemberId, b.Title
                FROM Appointments a JOIN Branchs b ON b.BranchID = a.BranchID
                WHERE a.MemberID IN @ids
                """, new { ids }, cancellationToken: ct));
            foreach (var r in branchRows)
            {
                if (!branchTitles.TryGetValue(r.MemberId, out var list))
                    branchTitles[r.MemberId] = list = [];
                list.Add(r.Title);
            }
        }

        var items = rows.Select(r => new MemberListItemDto(
            r.MemberId, r.Number, r.Mobile, r.Birthday, r.Name, r.IsBlackList,
            r.FirstVisitCount <= 1,
            branchTitles.TryGetValue(r.MemberId, out var titles) ? titles : [])).ToList();
        return (items, total);
    }

    public async Task<MemberDetailDto?> GetAsync(Guid id, CancellationToken ct = default)
    {
        using var conn = db.Create();
        var row = await conn.QueryFirstOrDefaultAsync<MemberDetailRow>(new CommandDefinition("""
            SELECT m.MemberID AS MemberId, m.Number, m.Mobile, m.Birthday, m.Name, m.Gender, m.BloodType, m.Email,
                   m.ZipcodeID AS ZipcodeId, z.City, m.Address, m.EmergencyName, m.EmergencyPhone,
                   m.Allergy, m.AllergyOther, m.MedicalHistory, m.MedicalHistoryOther, m.IsBlackList
            FROM Members m LEFT JOIN Zipcodes z ON z.ZipcodeID = m.ZipcodeID
            WHERE m.MemberID = @id
            """, new { id }, cancellationToken: ct));
        if (row is null) return null;

        return new MemberDetailDto(
            row.MemberId, row.Number, row.Mobile, row.Birthday, row.Name,
            row.Gender, row.BloodType, row.Email, row.ZipcodeId, row.City, row.Address,
            row.EmergencyName, row.EmergencyPhone,
            FromCsv(row.Allergy), row.AllergyOther,
            FromCsv(row.MedicalHistory), row.MedicalHistoryOther,
            row.IsBlackList);
    }

    public async Task UpdateAsync(Guid id, MemberUpdateRequest req, CancellationToken ct = default)
    {
        Validate(req);

        using var conn = db.Create();
        var affected = await conn.ExecuteAsync(new CommandDefinition("""
            UPDATE Members
            SET Mobile = @Mobile, Birthday = @Birthday, Name = @Name, Gender = @Gender, BloodType = @BloodType,
                Email = @Email, ZipcodeID = @ZipcodeId, Address = @Address,
                EmergencyName = @EmergencyName, EmergencyPhone = @EmergencyPhone,
                Allergy = @Allergy, AllergyOther = @AllergyOther,
                MedicalHistory = @MedicalHistory, MedicalHistoryOther = @MedicalHistoryOther,
                IsBlackList = @IsBlackList
            WHERE MemberID = @id
            """, new
        {
            id, req.Mobile, req.Birthday, req.Name, req.Gender, req.BloodType, req.Email, req.ZipcodeId, req.Address,
            req.EmergencyName, req.EmergencyPhone,
            Allergy = ToCsv(req.Allergy), req.AllergyOther,
            MedicalHistory = ToCsv(req.MedicalHistory), req.MedicalHistoryOther,
            req.IsBlackList,
        }, cancellationToken: ct));
        if (affected == 0)
            throw new BusinessException("找不到會員", "NOT_FOUND");
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        using var conn = db.Create();
        var refs = await conn.ExecuteScalarAsync<int>(new CommandDefinition("""
            SELECT
                (SELECT COUNT(*) FROM Appointments WHERE MemberID = @id) +
                (SELECT COUNT(*) FROM MemberQuestions WHERE MemberID = @id)
            """, new { id }, cancellationToken: ct));
        if (refs > 0)
            throw new BusinessException("會員已有預約或問卷紀錄，無法刪除", "MEMBER_IN_USE");

        var affected = await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM Members WHERE MemberID = @id", new { id }, cancellationToken: ct));
        if (affected == 0)
            throw new BusinessException("找不到會員", "NOT_FOUND");
    }

    public async Task<MemberQuestionnairesDto> GetQuestionnairesAsync(Guid memberId, CancellationToken ct = default)
    {
        using var conn = db.Create();
        var uploaded = (await conn.QueryAsync<MemberQuestionnaireLinkDto>(new CommandDefinition("""
            SELECT mq.MemberQuestionID AS LinkId, c.Title AS CategoryTitle, qt.Title AS QuestionTypeTitle,
                   qt.QuestionTypeID AS QuestionTypeId, mq.Filename
            FROM MemberQuestions mq
            JOIN QuestionTypes qt ON qt.QuestionTypeID = mq.QuestionTypeID
            JOIN Categorys c ON c.CategoryID = qt.CategoryID
            WHERE mq.MemberID = @memberId AND mq.Filename IS NOT NULL
            ORDER BY c.Title, qt.Sort
            """, new { memberId }, cancellationToken: ct))).AsList();

        var digitalAnswered = (await conn.QueryAsync<MemberQuestionnaireLinkDto>(new CommandDefinition("""
            SELECT qt.QuestionTypeID AS LinkId, c.Title AS CategoryTitle, qt.Title AS QuestionTypeTitle,
                   qt.QuestionTypeID AS QuestionTypeId, CAST(NULL AS nvarchar(50)) AS Filename
            FROM QuestionTypes qt
            JOIN Categorys c ON c.CategoryID = qt.CategoryID
            WHERE EXISTS (
                SELECT 1 FROM MemberQuestions mq
                WHERE mq.QuestionTypeID = qt.QuestionTypeID AND mq.MemberID = @memberId AND mq.Filename IS NULL
            )
            ORDER BY qt.Sort
            """, new { memberId }, cancellationToken: ct))).AsList();

        return new MemberQuestionnairesDto(uploaded, digitalAnswered);
    }

    public async Task<Guid> CreateQuestionUploadAsync(Guid memberId, MemberQuestionUpsertRequest req, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(req.Filename))
            throw new BusinessException("請上傳掃描檔案", "NO_FILE");

        using var conn = db.Create();
        await EnsureNotDuplicateAsync(conn, memberId, req.QuestionTypeId, excludeId: null, ct);

        var id = Guid.NewGuid();
        await conn.ExecuteAsync(new CommandDefinition("""
            INSERT INTO MemberQuestions (MemberQuestionID, MemberID, QuestionTypeID, QuestionID, Other, Filename)
            VALUES (@id, @memberId, @questionTypeId, NULL, NULL, @filename)
            """, new { id, memberId, questionTypeId = req.QuestionTypeId, filename = req.Filename }, cancellationToken: ct));
        return id;
    }

    public async Task UpdateQuestionUploadAsync(Guid memberQuestionId, MemberQuestionUpsertRequest req, CancellationToken ct = default)
    {
        using var conn = db.Create();
        var current = await conn.QueryFirstOrDefaultAsync<QuestionUploadRow>(new CommandDefinition("""
            SELECT MemberQuestionID AS Id, MemberID AS MemberId, QuestionTypeID AS QuestionTypeId, Filename
            FROM MemberQuestions WHERE MemberQuestionID = @memberQuestionId AND Filename IS NOT NULL
            """, new { memberQuestionId }, cancellationToken: ct));
        if (current is null)
            throw new BusinessException("找不到問卷上傳紀錄", "NOT_FOUND");

        await EnsureNotDuplicateAsync(conn, current.MemberId, req.QuestionTypeId, excludeId: memberQuestionId, ct);

        var newFilename = string.IsNullOrWhiteSpace(req.Filename) ? current.Filename : req.Filename;
        if (!string.IsNullOrWhiteSpace(req.Filename) && req.Filename != current.Filename && !string.IsNullOrWhiteSpace(current.Filename))
            await storage.DeleteAsync(UploadFolder, current.Filename, ct);

        await conn.ExecuteAsync(new CommandDefinition("""
            UPDATE MemberQuestions SET QuestionTypeID = @questionTypeId, Filename = @newFilename
            WHERE MemberQuestionID = @memberQuestionId
            """, new { memberQuestionId, questionTypeId = req.QuestionTypeId, newFilename }, cancellationToken: ct));
    }

    public async Task DeleteQuestionUploadAsync(Guid memberQuestionId, CancellationToken ct = default)
    {
        using var conn = db.Create();
        var filename = await conn.QueryFirstOrDefaultAsync<string?>(new CommandDefinition("""
            SELECT Filename FROM MemberQuestions WHERE MemberQuestionID = @memberQuestionId AND Filename IS NOT NULL
            """, new { memberQuestionId }, cancellationToken: ct));
        if (filename is null)
            throw new BusinessException("找不到問卷上傳紀錄", "NOT_FOUND");

        await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM MemberQuestions WHERE MemberQuestionID = @memberQuestionId",
            new { memberQuestionId }, cancellationToken: ct));

        if (!string.IsNullOrWhiteSpace(filename))
            await storage.DeleteAsync(UploadFolder, filename, ct);
    }

    /// <summary>同會員同問卷類型是否已有任何 MemberQuestions 紀錄（不論掃描檔或數位作答），沿用舊「此問卷已填寫過」查重。</summary>
    private static async Task EnsureNotDuplicateAsync(
        System.Data.IDbConnection conn, Guid memberId, Guid questionTypeId, Guid? excludeId, CancellationToken ct)
    {
        var exists = await conn.ExecuteScalarAsync<int>(new CommandDefinition("""
            SELECT COUNT(*) FROM MemberQuestions
            WHERE MemberID = @memberId AND QuestionTypeID = @questionTypeId
              AND (@excludeId IS NULL OR MemberQuestionID <> @excludeId)
            """, new { memberId, questionTypeId, excludeId }, cancellationToken: ct));
        if (exists > 0)
            throw new BusinessException("此問卷已填寫過，請重新確認", "DUPLICATE_QUESTIONNAIRE");
    }

    private static void Validate(MemberUpdateRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Mobile))
            throw new BusinessException("手機號碼不可空白", "INVALID_MOBILE");
        if (req.Mobile.Trim().Length > MobileMaxLength)
            throw new BusinessException($"手機號碼不可超過 {MobileMaxLength} 碼", "MOBILE_TOO_LONG");
        if ((req.Name?.Length ?? 0) > NameMaxLength)
            throw new BusinessException($"姓名不可超過 {NameMaxLength} 字", "NAME_TOO_LONG");
        if ((req.BloodType?.Length ?? 0) > BloodTypeMaxLength)
            throw new BusinessException($"血型格式錯誤", "INVALID_BLOOD_TYPE");
        if ((req.Email?.Length ?? 0) > EmailMaxLength)
            throw new BusinessException($"Email 不可超過 {EmailMaxLength} 字", "EMAIL_TOO_LONG");
        if ((req.Address?.Length ?? 0) > AddressMaxLength)
            throw new BusinessException($"地址不可超過 {AddressMaxLength} 字", "ADDRESS_TOO_LONG");
        if ((req.EmergencyName?.Length ?? 0) > EmergencyNameMaxLength)
            throw new BusinessException($"緊急聯絡人不可超過 {EmergencyNameMaxLength} 字", "EMERGENCY_NAME_TOO_LONG");
        if ((req.EmergencyPhone?.Length ?? 0) > EmergencyPhoneMaxLength)
            throw new BusinessException($"緊急聯絡電話不可超過 {EmergencyPhoneMaxLength} 碼", "EMERGENCY_PHONE_TOO_LONG");
        if ((req.AllergyOther?.Length ?? 0) > AllergyOtherMaxLength)
            throw new BusinessException($"過敏史其他說明不可超過 {AllergyOtherMaxLength} 字", "ALLERGY_OTHER_TOO_LONG");
        if ((req.MedicalHistoryOther?.Length ?? 0) > MedicalHistoryOtherMaxLength)
            throw new BusinessException($"病史其他說明不可超過 {MedicalHistoryOtherMaxLength} 字", "MEDICAL_HISTORY_OTHER_TOO_LONG");
        if ((ToCsv(req.Allergy)?.Length ?? 0) > AllergyMaxLength)
            throw new BusinessException($"過敏史選項過多（合計不可超過 {AllergyMaxLength} 字）", "ALLERGY_TOO_LONG");
        if ((ToCsv(req.MedicalHistory)?.Length ?? 0) > MedicalHistoryMaxLength)
            throw new BusinessException($"病史選項過多（合計不可超過 {MedicalHistoryMaxLength} 字）", "MEDICAL_HISTORY_TOO_LONG");
    }

    /// <summary>多選 → CSV（沿用舊 string.Join(",")）；空則 null。</summary>
    private static string? ToCsv(IReadOnlyList<string>? items)
    {
        if (items is null) return null;
        var vals = items.Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => s.Trim());
        var csv = string.Join(",", vals);
        return csv.Length == 0 ? null : csv;
    }

    private static IReadOnlyList<string> FromCsv(string? csv) =>
        string.IsNullOrWhiteSpace(csv) ? [] : csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    private sealed record MemberRow(Guid MemberId, string Number, string Mobile, DateTime Birthday, string? Name, bool IsBlackList, int FirstVisitCount);
    private sealed record BranchTitleRow(Guid MemberId, string Title);
    private sealed record MemberDetailRow(
        Guid MemberId, string Number, string Mobile, DateTime Birthday, string? Name, int? Gender, string? BloodType,
        string? Email, int? ZipcodeId, string? City, string? Address, string? EmergencyName, string? EmergencyPhone,
        string? Allergy, string? AllergyOther, string? MedicalHistory, string? MedicalHistoryOther, bool IsBlackList);
    private sealed record QuestionUploadRow(Guid Id, Guid MemberId, Guid QuestionTypeId, string? Filename);
}
