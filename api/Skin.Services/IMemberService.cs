using Skin.Data.Entities;

namespace Skin.Services;

public interface IMemberService
{
    /// <summary>依身分證+生日查會員（登入用）。對應舊 MembersService.GetMemberByNumberAndBirthday。</summary>
    Task<Members?> FindByNumberAndBirthdayAsync(string number, DateTime birthday, CancellationToken ct = default);
}
