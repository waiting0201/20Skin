using Skin.Core;

namespace Skin.Services.BasicData;

/// <summary>
/// 分院別名（Ta/Ch/ChDentist）→ 實際 BranchID 對照（設定驅動，取代舊硬編碼；仿 BookingOptions 模式）。
/// 別名對應舊系統三個實體分院：Ta=台中．四季、Ch=二林．四季、ChDentist=二林．齒科（三個不同 BranchID，
/// 非「Ch 分院的齒科診別」——已對真實 DB 查證，見 docs/blueprints/admin-basic-data.md）。GUID 不進原始碼。
/// </summary>
public sealed class PeriodsOptions
{
    public Dictionary<string, Guid> BranchIdByAlias { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    public Guid Resolve(string alias)
        => BranchIdByAlias.TryGetValue(alias, out var id)
            ? id
            : throw new BusinessException($"分院別名 {alias} 未設定", "BRANCH_ALIAS_NOT_CONFIGURED");

    /// <summary>反查 branchId 屬於哪個別名（查無對應則回 null，例如尚未設定別名的分院）。</summary>
    public string? AliasFor(Guid branchId)
        => BranchIdByAlias.FirstOrDefault(kv => kv.Value == branchId) is { Key: not null } kv ? kv.Key : null;
}
