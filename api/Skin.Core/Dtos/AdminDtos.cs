namespace Skin.Core.Dtos;

/// <summary>後台認證與權限管理 DTO（見 docs/blueprints/admin-auth-authority.md）。</summary>

/// <summary>管理員登入結果：僅回 token（perms/is_super_admin 攤平在 JWT claims）。</summary>
public sealed record AdminLoginResult(string Token);

/// <summary>攤平後的單一權限項（對應舊 Lims+AdminLims）；寫入 JWT，前端 can(key,op) 使用。</summary>
public sealed record AdminPermDto(string Key, string Module, bool Add, bool Update, bool Delete);

/// <summary>選單節點（資料驅動，忠於舊 Lims 二層樹）；已依 AdminLims 過濾。</summary>
public sealed record MenuNodeDto(string Key, string? Label, string? Icon, int Sort, List<MenuNodeDto> Children);

/// <summary>權限樹節點（供權限管理勾選 UI；模組→子功能）。checked 狀態隨管理員帶入。</summary>
public sealed record LimNodeDto(int LimId, string Key, string? Label, string? Icon, int Sort, List<LimChildDto> Children);
public sealed record LimChildDto(int LimId, string Key, string? Label, int Sort, bool IsAdd, bool IsUpdate, bool IsDelete);

/// <summary>管理員列表項。</summary>
public sealed record AdminListItemDto(Guid AdminId, string Username, string? Name);

/// <summary>管理員詳情（含權限樹勾選狀態）。</summary>
public sealed record AdminDetailDto(Guid AdminId, string Username, string? Name, List<LimNodeDto> Permissions);

/// <summary>新增/編輯管理員請求；Password 空字串代表編輯時不改密碼。</summary>
public sealed record AdminUpsertRequest(string Username, string? Password, string? Name, List<AdminLimInputDto> Lims);

/// <summary>權限勾選輸入項（只送有任一旗標為真者）。</summary>
public sealed record AdminLimInputDto(int LimId, bool IsAdd, bool IsUpdate, bool IsDelete);
