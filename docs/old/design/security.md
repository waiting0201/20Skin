---
title: 安全機制
purpose: 描述 20Skin 既有的認證、授權、Session 機制與權限資料模型；本檔僅描述機制現況，不列漏洞清單
applicable_when: 要新增 Action 並判斷該不該加 CheckSession、要修改 Lims / AdminLims、要排查未授權問題、要理解前後台 Session 邊界
related_agents:
  - backend-engineer
  - code-review-optimizer
related_docs:
  - api-design.md
  - database-design.md
  - backend-design.md
  - ../blueprints/backend-admin.md
keywords: [security, auth, session, authorization, authentication, lims, adminlims, checksession]
last_updated: 2026-05-26
---

## 認證機制總覽

| 端 | 識別方式 | Session 鍵 | 過濾器 |
|---|---|---|---|
| 客戶前台 | 身分證字號 + 出生日期 + Google reCAPTCHA v3 | `IsLogin`、`MemberID`、`myReserve` | `20Skin/Filters/CheckSessionAttribute.cs` |
| 診所後台 | Username + Password | `IsLogin`、`Username`、`AdminID`、`AdminLims` | `20SkinBackend/Filters/CheckSessionAttribute.cs` |

**無** JWT / OAuth / SSO / API Key（除少量 Web API 內部使用）。

## CheckSessionAttribute

兩端各自一份 filter，繼承 `ActionFilterAttribute`，在 `OnActionExecuting` 攔截。

### 前台版（`20Skin/Filters/CheckSessionAttribute.cs`）

```csharp
public override void OnActionExecuting(ActionExecutingContext filterContext)
{
    var isLogin = filterContext.HttpContext.Session["IsLogin"] as bool?;
    if (isLogin != true)
    {
        filterContext.HttpContext.Session["IsLogin"] = false;
        filterContext.Result = RedirectToAction("Login", "MainMs");
    }
}
```

- 無功能層級授權
- 無 Action 白名單（白名單行為由 Controller 內 `[AllowAnonymous]` 或不掛此 attribute 達成）

### 後台版（`20SkinBackend/Filters/CheckSessionAttribute.cs`）

- 基本檢查同前台（重導向 `MainController.Login`）
- 多一個 `IsAuth` 屬性參數：`[CheckSession(IsAuth = true)]` 時啟用功能層級授權

## 後台功能層級授權對應演算法

`IsAuth = true` 時，filter 執行以下流程：

```
1. 從 RouteData 取 controller + action 字串
   (例: controller="AuthorityMs", action="EditAdmins")

2. Action 字串清理（移除後綴）：
   Add / Edit / Delete / Sort / Import / Export / Cogs / View / Upload / Modify
   結果: "EditAdmins" → "Admins"

3. 特殊映射：
   Questions → QuestionTypes
   MemberQAs → Members
   QuestionTaAppointments / QuestionChAppointments / QuestionChDentistAppointments → 對應 Appointments

4. 查模組 LimID：
   Lims WHERE Key.Contains(controller) AND ParentID IS NULL
   (例: Key contains "Authority")

5. 查子功能 LimID：
   Lims WHERE Key.Contains(cleanedAction) AND ParentID = 模組 LimID

6. 查授權：
   AdminLims WHERE AdminID = Session["AdminID"] AND LimID = 子功能 LimID

7. 判斷：
   - 無紀錄 → redirect /Error/Validation
   - Action 含 "Add" 但 IsAdd=false → 403
   - Action 含 "Edit" 但 IsUpdate=false → 403
   - Action 含 "Delete" 但 IsDelete=false → 403
```

## 權限資料模型

```
Admins (1) ──── (N) AdminLims (N) ──── (1) Lims
                       ├── IsAdd                 │
                       ├── IsUpdate              │ ParentID (self-ref)
                       └── IsDelete              ▼
                                              Lims (子功能)
```

### Lims 表結構（二層樹）

- `ParentID IS NULL` → 一級模組（例：Key="Authority" / "Basic" / "Shift" / "Reserve" / "Member"）
- `ParentID = 模組 LimID` → 二級功能（例：Key="Admins" / "Branchs" / "Rosters" / "Members"）

### AdminLims 表結構（M:N + CRUD 旗標）

每筆紀錄代表「某管理員」對「某子功能」的權限三元組：
- `IsAdd` — 是否允許新增
- `IsUpdate` — 是否允許編輯
- `IsDelete` — 是否允許刪除

**無**預設角色 / 群組 / 模板。每個管理員的權限獨立配置。

## 登入流程

### 前台 `MainMsController.Login` → `JoinUs`

```
輸入：Number (身分證) + Birthday + reCAPTCHA token
  ↓
reCAPTCHA 驗證（score > 0.5）
  ↓
MembersService.GetMemberByNumberAndBirthday(Number, Birthday)
  ↓
三分支：
  ├── 會員不存在 → 回 2 → redirect JoinUs (帶 Number, Birthday)
  ├── IsBlackList = true → 回 3 → 顯示「未報到超過 3 次封鎖」
  └── 成功 → 回 1
              ├── Session["IsLogin"] = true
              ├── Session["MemberID"] = MemberID
              ├── Session["myReserve"] = Reservation DTO
              └── redirect (Index / AppointmentForm)
```

### 後台 `MainController.Login`

```
輸入：Username + Password
  ↓
查 Admins WHERE Username = input.Username
  ↓
密碼比對（依現行欄位儲存方式）
  ↓
成功：
  ├── Session["IsLogin"] = true
  ├── Session["Username"] = username
  ├── Session["AdminID"] = admin.AdminID
  └── Session["AdminLims"] = admin.AdminLims (ICollection)
  ↓
redirect MainController.Index
```

### 後台登出 `MainController.Logout`

清除 `Session["IsLogin"]` / `Session["Username"]` → redirect 登入頁。

## Session 設定

| 項目 | 前台 | 後台 |
|---|---|---|
| Mode | InProc | InProc |
| Timeout | 預設 20 分鐘 | **480 分鐘**（Web.config 明設） |
| Cookie 名 | `ASP.NET_SessionId` | `ASP.NET_SessionId` |
| Sliding Expiration | 否 | 否 |
| 跨站共享 | **獨立**（不同 IIS Application） | 同左 |

## 傳輸層

- Production：`booking.20skin.tw` 為 HTTPS
- HSTS / 強制 HTTPS redirect 設定（依 IIS / web.config 而定，未在 repo 內統一描述）

## 密碼儲存

- `Admins.Password`：`nvarchar(20)` 欄位
- 客戶端**無**密碼（用身分證字號 + 生日代替）

## reCAPTCHA

- 用於前台 `Login` / `JoinUs`
- v3 模式：score 門檻 > 0.5
- Secret 存於 Web.config

## 第三方服務的認證

- 智邦通訊 SMS：API key + username + password 存於 Web.config，由 `SmsHandler` 讀取
- 前台靜態資源伺服器：由 `Librarys.UploadFileToFrontend` 內部處理

## 安全相關陷阱

詳見 [../gotchas.md](../gotchas.md)：

- 後台 Session timeout 480 分鐘長於常見預設
- 前後台 Session 各自獨立，不能用「在前台登入過所以後台應該也登入」這種假設
- `/MainMs/CheckSms` endpoint 設計給 cron 用，目前無 IP 白名單或 token 保護
