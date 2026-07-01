using Skin.Core.Dtos;
using Skin.Data.Entities;

namespace Skin.Services.Admin;

/// <summary>
/// 權限攤平與選單/權限樹組裝（取代舊 CheckSession 字串比對 + SiteMenuAsUnorderedList）。
/// 二層樹：ParentID=null 為模組，其餘為子功能（葉節點）。
/// </summary>
public static class AuthorizationDomain
{
    /// <summary>
    /// 攤平成 perms[]（寫入 JWT）：每個「有授權的子功能」一項，帶所屬模組 key 與三旗標。
    /// </summary>
    public static List<AdminPermDto> Flatten(IReadOnlyList<Lims> lims, IReadOnlyList<AdminLims> adminLims)
    {
        var byId = lims.ToDictionary(l => l.LimID);
        var result = new List<AdminPermDto>();
        foreach (var al in adminLims)
        {
            if (!byId.TryGetValue(al.LimID, out var lim)) continue;   // 孤兒授權：略過
            if (lim.ParentID is null) continue;                       // 只攤平子功能
            var module = byId.TryGetValue(lim.ParentID.Value, out var m) ? m.Key : "";
            result.Add(new AdminPermDto(lim.Key, module, al.IsAdd, al.IsUpdate, al.IsDelete));
        }
        return result;
    }

    /// <summary>
    /// 資料驅動選單樹（忠於舊做法）：模組層只要對其任一子項有授權即顯示；子項需該 LimID 有授權。
    /// 超管（isSuper=true）看全部。
    /// </summary>
    public static List<MenuNodeDto> BuildMenu(
        IReadOnlyList<Lims> lims, IReadOnlyList<AdminLims> adminLims, bool isSuper)
    {
        var authedLimIds = adminLims.Select(a => a.LimID).ToHashSet();
        var modules = lims.Where(l => l.ParentID is null).OrderBy(l => l.Sort);

        var menu = new List<MenuNodeDto>();
        foreach (var mod in modules)
        {
            var children = lims
                .Where(l => l.ParentID == mod.LimID && (isSuper || authedLimIds.Contains(l.LimID)))
                .OrderBy(l => l.Sort)
                .Select(l => new MenuNodeDto(l.Key, l.Value, l.Icon, l.Sort, []))
                .ToList();

            if (children.Count == 0) continue;   // 模組無可見子項 → 不顯示
            menu.Add(new MenuNodeDto(mod.Key, mod.Value, mod.Icon, mod.Sort, children));
        }
        return menu;
    }

    /// <summary>
    /// 完整權限樹（供權限管理勾選 UI）：全部模組+子功能，勾選狀態取自該管理員 AdminLims（新增時全 false）。
    /// </summary>
    public static List<LimNodeDto> BuildPermissionTree(
        IReadOnlyList<Lims> lims, IReadOnlyList<AdminLims> adminLims)
    {
        var flagsByLim = adminLims.ToDictionary(a => a.LimID);
        var modules = lims.Where(l => l.ParentID is null).OrderBy(l => l.Sort);

        var tree = new List<LimNodeDto>();
        foreach (var mod in modules)
        {
            var children = lims
                .Where(l => l.ParentID == mod.LimID)
                .OrderBy(l => l.Sort)
                .Select(l =>
                {
                    var f = flagsByLim.GetValueOrDefault(l.LimID);
                    return new LimChildDto(l.LimID, l.Key, l.Value, l.Sort,
                        f?.IsAdd ?? false, f?.IsUpdate ?? false, f?.IsDelete ?? false);
                })
                .ToList();

            if (children.Count == 0) continue;
            tree.Add(new LimNodeDto(mod.LimID, mod.Key, mod.Value, mod.Icon, mod.Sort, children));
        }
        return tree;
    }
}
