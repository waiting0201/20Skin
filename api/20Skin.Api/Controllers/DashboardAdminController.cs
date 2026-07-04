using Skin.Api.Auth;
using Skin.Api.Routing;
using Skin.Core;
using Skin.Core.Constants;
using Skin.Core.Dtos;
using Skin.Services.BasicData;
using Skin.Services.Dashboard;

namespace Skin.Api.Controllers;

/// <summary>
/// 後台儀表板（舊 Main/Index 為空殼 widget，本功能為新系統新增）。單一端點、任何管理員可呼叫；
/// 回應區塊依該管理員可讀權限過濾（分院統計對應 3 組預約 Lims key、會員統計對應 Members），
/// 無任何可讀區塊時回傳空殼（前端顯示引導文字）。見 docs/blueprints/admin-dashboard.md。
/// </summary>
[ApiController]
public sealed class DashboardAdminController(
    IDashboardAdminService dashboard, PeriodsOptions branchAliases, RequestContext ctx)
{
    /// <summary>分院變體（同預約管理 3 組粒度）：前端鍵 / PeriodsOptions 別名 / Lims Resource key。</summary>
    private static readonly (string Key, string Alias, string Resource)[] BranchVariants =
    [
        ("ta", "Ta", "TaAppointments"),
        ("ch", "Ch", "ChAppointments"),
        ("chDentist", "ChDentist", "ChDentistAppointments"),
    ];

    [ApiRoute("GET", "admin/dashboard")]
    [Authorize(Roles.Admin)]
    public async Task<ApiResponse<DashboardDto>> Get()
    {
        // 別名未設定時略過該分院（防禦性，不像逐分院端點用 Resolve 直接擋下——儀表板缺一塊仍應能看其餘區塊）。
        var branches = BranchVariants
            .Where(v => ctx.CanRead(v.Resource) && branchAliases.BranchIdByAlias.ContainsKey(v.Alias))
            .Select(v => new DashboardBranchInput(v.Key, branchAliases.BranchIdByAlias[v.Alias]))
            .ToList();

        var result = await dashboard.GetAsync(branches, includeMembers: ctx.CanRead("Members"));
        return ApiResponse<DashboardDto>.Ok(result);
    }
}
