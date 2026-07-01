using Skin.Api.Routing;
using Skin.Core.Dtos;
using Skin.Services;

namespace Skin.Api.Controllers;

/// <summary>公開查詢（免登入）：郵遞區號等註冊/表單所需的參照資料。</summary>
[ApiController]
public sealed class LookupController(IMemberService members)
{
    /// <summary>GET /api/zipcodes — 可顯示的郵遞區號（城市→區→ZipcodeID），供註冊城市/區連動。</summary>
    [ApiRoute("GET", "zipcodes")]
    public Task<IReadOnlyList<ZipcodeDto>> Zipcodes() => members.GetZipcodesAsync();
}
