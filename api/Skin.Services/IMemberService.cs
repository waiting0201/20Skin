using Skin.Core.Dtos;
using Skin.Data.Entities;

namespace Skin.Services;

public interface IMemberService
{
    /// <summary>依身分證+生日查會員（登入用）。對應舊 MembersService.GetMemberByNumberAndBirthday。</summary>
    Task<Members?> FindByNumberAndBirthdayAsync(string number, DateTime birthday, CancellationToken ct = default);

    /// <summary>
    /// 初診註冊（JoinUs）。已存在（身分證+生日）→ 回既有會員（不重複建檔，沿用舊行為）；
    /// 否則建檔並回新會員。Allergy/MedicalHistory 存 CSV；身分證轉大寫。
    /// </summary>
    Task<(Members Member, bool IsNew)> RegisterAsync(RegisterMemberRequest req, DateTime birthday, CancellationToken ct = default);

    /// <summary>可顯示的郵遞區號（城市→區→ZipcodeID），供註冊城市/區連動。</summary>
    Task<IReadOnlyList<ZipcodeDto>> GetZipcodesAsync(CancellationToken ct = default);
}
