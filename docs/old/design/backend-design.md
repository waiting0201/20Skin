---
title: 後端設計
purpose: 描述 20Skin 後端的技術選型、Controller / Service / Models 分層、Result 回傳慣例、Session 操作邊界、無 DI 等實際現況
applicable_when: 要新增 Service / Controller、要決定業務邏輯放在哪一層、要修改錯誤處理、要排查 EF 行為
related_agents:
  - backend-engineer
related_docs:
  - ../architecture.md
  - api-design.md
  - database-design.md
  - security.md
  - backend-coding-style.md
keywords: [backend, 後端, mvc, ef6, service, basecontroller, session, layer]
last_updated: 2026-05-26
---

## 技術選型

| 面向 | 選擇 | 備註 |
|---|---|---|
| Runtime | .NET Framework 4.8 | 非 .NET Core |
| Web 框架 | ASP.NET MVC 5.2.7 + Web API 5.2.7 | server-rendered Razor + 少量 AJAX JSON |
| ORM | Entity Framework 6.4.4 | **Database-First**（EDMX） |
| DB | SQL Server | `data source=(local)` / DB 名 `20Skin` |
| DI 容器 | 無 | Service 在 Controller 內手動 `new` |
| 任務佇列 | 無 | 簡訊提醒走 `CheckSms` Console App 拉式排程 |
| 快取 | 無 | 全部即時查 DB |
| 報表匯出 | NPOI 2.6.2 (Excel) + iTextSharp 5.5.13 (PDF) | 後台預約簽到單匯出 |
| 圖像處理 | SixLabors.ImageSharp 2.1.4 | 圖檔縮放 / 上傳處理 |
| 分頁 | PagedList 1.17.0 | 後台列表慣用 |
| JSON | Newtonsoft.Json 13.0.1 | AjaxController 回傳 |

## 分層

```
Controllers (20Skin / 20SkinBackend)
   │   薄 Controller：Session 操作、ViewModel 組裝、檔案上傳
   ▼
Services (20Skin.Service)
   │   BaseService<T> 提供 CRUD；具體 Service 加業務邏輯
   │   回傳 IResult { Success, Message, Data }
   ▼
Models (20Skin.Models)
   │   EF6 partial class + SkinEntities DbContext
   ▼
SQL Server
```

依賴方向見 [../architecture.md](../architecture.md)，**禁止下層引用上層**。

## Service 慣例（`BaseService<T>`）

`20Skin.Service/BaseService.cs` 提供泛型基類，所有 `*Service` 繼承之：

```csharp
public class BaseService<T> : IBaseService<T> where T : class
{
    protected SkinEntities db = new SkinEntities();

    public virtual IQueryable<T> Get() { ... }
    public virtual IResult Add(T entity) { ... }
    public virtual IResult Update(T entity) { ... }
    public virtual IResult Delete(T entity) { ... }
    // 全部用 try/catch 包，回 IResult { Success, Message, Exception }
}
```

**特殊 Service**：`MembersService.GetMemberByNumberAndBirthday`、`SmsStatusService.GetPendingByDate` 等加業務查詢條件。

### IResult

```csharp
public interface IResult
{
    bool Success { get; set; }
    string Message { get; set; }
    object Data { get; set; }
    Exception Exception { get; set; }
}
```

Controller 端統一檢查 `result.Success` 後決定 redirect 或顯示錯誤。

### DbContext 生命週期

- 每個 Service 自己 `new SkinEntities()`
- **同一個 HTTP request 內多 Service 各自開 DbContext**（非 unit of work 模式）
- 跨表交易需手動用 `using (var tx = db.Database.BeginTransaction())` 包

## Controller 慣例

### 命名

- 前台：`{Module}MsController`（如 `MainMs`、`Ajax`、`Uploads`）
- 後台：`{Module}MsController`（如 `BasicMs`、`ShiftMs`、`ReserveMs`、`MemberMs`、`AuthorityMs`、`Ajax`）

### Action 命名規律（被 `CheckSessionAttribute` 用於權限對應）

| 後綴 | 用途 | 對應權限 |
|---|---|---|
| `Add{Entity}` | 新增 | `AdminLims.IsAdd` |
| `Edit{Entity}` | 編輯 | `AdminLims.IsUpdate` |
| `Delete{Entity}` | 刪除 | `AdminLims.IsDelete` |
| `Export{Entity}` | 匯出 | （列入 Action 清理規則） |
| `Sort{Entity}` | 排序 | 同上 |
| `Import{Entity}` | 匯入 | 同上 |
| `View{Entity}` | 檢視 | 同上 |
| `Upload{Entity}` | 上傳 | 同上 |
| `Modify{Entity}` | 修改 | 同上 |
| `Cogs{Entity}` | 設定 | 同上 |

權限對應演算法詳見 [security.md](security.md)。

### 長 Controller 警示

| Controller | 大小 | 注意 |
|---|---|---|
| `ShiftMsController` | ~92KB | 含班表 CRUD + 重複展開（日/週）+ 跨期匯入；修改前先 grep 找對應 Action 段落，**勿整檔讀** |
| `ReserveMsController` | ~57KB | 預約查詢 / 審核 / 取消 / Excel 匯出 |
| `MemberMsController` | ~14KB | 含 SMS 狀態查詢 |

業務邏輯下沉到 Service 是未列入排程的長期改進（見 [../status.md](../../status.md) Backlog）。

## Session 操作邊界

| Session Key | 寫入點 | 用途 |
|---|---|---|
| `IsLogin` (bool) | Login 成功 | `CheckSessionAttribute` 主要判斷依據 |
| `MemberID` (Guid) | 前台 Login / JoinUs | 預約建立時取得會員 |
| `myReserve` (`Reservation` DTO) | 前台 SelectBranch / Clinic / Category | 預約多步驟暫存 |
| `Username` (string) | 後台 Login | 顯示用 |
| `AdminID` (Guid) | 後台 Login | 權限對應 |
| `AdminLims` (ICollection) | 後台 Login | UI 顯示（實際授權仍即時查 DB） |

**規則**：
- 只有 Controller 可讀寫 Session；Service 層**不應依賴 HttpContext**
- 多步驟流程的暫存物件（如 `myReserve`）放 Session 而非 hidden form fields

## 錯誤處理現況

- **無**全域例外 middleware
- 各 Service 內 try/catch 把 Exception 塞進 `IResult.Exception`
- Controller 視 `IResult.Success` 決定流程，UI 用 `TempData` / ViewBag 顯示訊息
- 預期內錯誤（如預約已滿）→ 回 view 帶錯誤訊息
- 預期外例外 → Web.config `customErrors` 設定主導（dev: Off 顯示 yellow screen / prod: 應為 RemoteOnly）

## 交易邊界

- 預設**單表 SaveChanges**為交易邊界
- 跨表寫入（如預約建立同時寫 `Appointments` + 兩筆 `SmsStatus`）：
  - 當前實作為「先 Add 全部 → 一次 SaveChanges」依賴 EF6 內建交易
  - 並發容量檢查 → SaveChanges 之間**無 lock**，理論上可超賣（見 [../gotchas.md](../gotchas.md)）

## 第三方服務呼叫

| 服務 | 介接位置 | 觸發點 |
|---|---|---|
| 智邦通訊 SMS | `20Skin/Commons/SmsHandler.cs` | `AppointmentForm` 預約成功 + `CheckSms` 排程 |
| Google reCAPTCHA v3 | `MainMsController.Login` | 客戶登入 / 註冊 |
| 前台靜態資源伺服器 | `Librarys.UploadFileToFrontend` | 後台圖片上傳走「本機暫存 → 上傳 CDN → 刪本機」三段式 |

## 觀測

- **無**結構化 log、**無** APM、**無** traceId / correlationId
- 依賴 IIS log（HTTP 層）與 Windows Event Log（例外）
- 重要操作（登入、預約建立、簡訊發送結果）寫入對應 DB 表（如 `SmsStatus`）作為事後追溯依據

## 程式碼風格

詳見 [backend-coding-style.md](backend-coding-style.md)。
