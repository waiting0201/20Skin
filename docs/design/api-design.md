---
title: API / 自訂 router 設計
purpose: 規範 Azure Functions(.NET 10) 上的自訂 router MVC 架構、REST 端點慣例、統一回應/錯誤格式、以及把舊 Ta/Ch/ChDentist 變體參數化的端點目錄
applicable_when: 要新增/修改 API 端點、決定路由與 model binding、設計回應格式、或對接前端時
related_agents:
  - backend-engineer
  - system-analyst
related_docs:
  - backend-design.md
  - security.md
  - ../blueprints/admin-member.md
  - ../old/design/api-design.md
  - ../old/blueprints/customer-booking.md
keywords: [api, endpoint, custom-router, azure-functions, mvc, rest, apiresponse, jwt]
last_updated: 2026-07-03
status: draft
---

> 舊系統 endpoint 對照見 [old/design/api-design.md](../old/design/api-design.md)。新系統全部改 JSON、JWT、`/api/` 前綴。

## 自訂 router MVC on Azure Functions

```
單一 HttpTrigger（catch-all）: route = "{*path}"  (AuthorizationLevel.Anonymous，授權自行做)
  → Router：解析 path + method → 反射建立的路由表 → 命中 Controller.Action
  → Middleware pipeline：
      1. CORS
      2. JWT 驗證（解析 Bearer，填入 ClaimsPrincipal）
      3. Authorization（依 [Authorize]/policy/權限 claim）
      4. Model binding（route/query/body → DTO）
      5. Action 執行
      6. 回應序列化（ApiResponse<T>）+ 例外 → ProblemDetails
```

| 維度 | 做法 |
|---|---|
| 路由表 | 啟動時反射掃描所有 `Controller` + `[Route]/[HttpGet/Post/...]` attribute 建表（快取） |
| Controller | POCO class，建構子注入 Service（DI）；method 回 `IActionResult`-like 或 `ApiResponse<T>` |
| Model binding | 自訂 binder：route param、query string、JSON body、`multipart/form-data`（上傳） |
| DI | `Program.cs`（isolated worker）`builder.Services.AddScoped<...>()` 註冊 Service / `IDbConnectionFactory` |
| 為何自訂 router | 需求指定；讓 ~90 個端點以 MVC 風格集中管理，而非每個 Function 一支 |

實作細節見 [backend-design.md](backend-design.md)。

## URL 慣例

```
/api/{resource}                GET 列表 / POST 建立
/api/{resource}/{id}           GET 詳情 / PUT 更新 / DELETE 刪除
/api/{resource}/{id}/{action}  動作（如 /appointments/{id}/cancel）
/api/auth/{action}             認證
```

- mutation 用 POST/PUT/PATCH/DELETE；查詢用 GET。
- **參數化取代舊變體**：舊 `TaAppointments`/`ChAppointments`/`ChDentistAppointments` → `GET /api/appointments?clinic=&branch=`；舊 `TaRosters`/… → `/api/rosters?clinic=&branch=`；時段同理。移除硬編碼分院 GUID。
- 舊回 HTML 片段者（`GetRosters`/`GetRosterDoctors`/`GetZipcodeByCity`/`GetPeriods`）一律改回 **JSON**，由前端渲染。

## 統一回應與錯誤

```jsonc
// 成功
{ "success": true, "data": { ... } }
// 失敗（預期內）
{ "success": false, "message": "取消失敗，預約前 1 小時內無法取消", "code": "APPOINTMENT_CANCEL_TOO_LATE" }
```

- 預期外例外 → HTTP 4xx/5xx + RFC7807 `ProblemDetails`；prod 不洩漏堆疊。
- 401 未帶/失效 token；403 權限不足；422 驗證失敗（FluentValidation）。

## 端點目錄（代表，完整見各 blueprint）

### 認證（[blueprints/member-auth.md](../blueprints/member-auth.md) / [admin-auth-authority.md](../blueprints/admin-auth-authority.md)）
| 端點 | Method | 說明 |
|---|---|---|
| `/api/auth/member/login` | POST | 身分證+生日+reCAPTCHA → JWT（status 1/2/3：成功/新客/黑名單）；成功固定回 `isFirstVisit:false`（複診）。**Done 2026-07-02** |
| `/api/auth/member/register` | POST | 初診建檔（JoinUs）→ JWT 直接登入態；身分證+生日已存在則回既有不重複建檔；Allergy/MedicalHistory 存 CSV；回傳 `isFirstVisit`（是否新建會員，供前端初診/複診麵包屑）。**Done 2026-07-02** |
| `/api/zipcodes` | GET | 郵遞區號（城市→區→ZipcodeID，公開，供註冊連動）。**Done 2026-07-01** |
| `/api/auth/admin/login` | POST | 帳號+密碼+reCAPTCHA → JWT（`is_super_admin`+攤平 `perms`）。**Done 2026-07-01** |
| `/api/auth/refresh` | POST | refresh token → 新 access token（狀態存 reused DB 之外） |
| `/api/auth/me` | GET | 取當前使用者 |

### 客戶預約（[blueprints/customer-booking.md](../blueprints/customer-booking.md)）
| 端點 | Method | 說明 |
|---|---|---|
| `/api/branches` | GET | 啟用分院列表 |
| `/api/categories?branchId=&clinic=` | GET | 某診別項目（含 `isAmountLocked`：依 `branchId` 解析分院別名對照舊 `IsOnly/ChIsOnly/ChDentistIsOnly`，2026-07-02） |
| `/api/rosters?branch=&clinic=&category=&date=&doctorId=` | GET | 可預約時段（JSON）。**帶 `doctorId` → 該指定醫師時段（IsAppointment=1）；不帶 → 不指定（IsAppointment=0）**。2026-07-01 |
| `/api/rosters/doctors?...` | GET | 該日可指定醫師 |
| `/api/rosters/check-availability` | POST | 重複預約檢查 |
| `/api/appointments` | POST/GET | 建立 / 查詢自己的預約（分頁） |
| `/api/appointments/{id}` | GET | 詳情（**含歸屬驗證，修 IDOR**） |
| `/api/appointments/{id}/cancel` | POST | 取消（>1 小時限制 + 標記未發 SMS=CANCEL） |

### 問卷（[blueprints/questionnaire.md](../blueprints/questionnaire.md)）✅ 已實作
| 端點 | 方法 | 說明 |
|---|---|---|
| `/api/question-types?clinic=&categoryId=` | GET | 有啟用問卷的項目清單（含會員**已作答旗標** answered） |
| `/api/question-types/{id}` | GET | 單份問卷：題目＋選項＋會員既有作答（pre-fill）；不存在/停用回 NOT_FOUND |
| `/api/member-questions` | POST | 作答；交易內「重填」語義（先刪該會員此問卷舊作答再寫）。偽造 answerID 於應用層濾除 |

> `OptionType`：**1=單選(radio)／2=複選(checkbox)**（真實 DB 僅此二值，無文字/檔案；見 [gotchas.md](gotchas.md)）。

### 地點 / 上傳
- `/api/zipcodes`（GET，公開，城市→區→ZipcodeID）。**Done 2026-07-01**
- `/api/uploads`（POST，需會員登入，multipart：`file`[+`folder`，預設 appointments]）→ Blob `upload/{folder}/{guid}{ext}`，回 `{ filename, folder, url }`。目錄白名單/型別/大小驗證；`Appointments.Photo` 存檔名。見 [blueprints/file-upload.md](../blueprints/file-upload.md)。**Done 2026-07-01**

### 後台（各 admin blueprint）
**基礎資料（已實作 Done 2026-07-02，[blueprints/admin-basic-data.md](../blueprints/admin-basic-data.md)）**：客戶前台已用 `Roles.Member` 鎖住 `/api/branches`、`/api/categories?clinic=`、`/api/question-types`，同 method+同段數路由不可重複註冊，故後台一律走 **`admin/` 前綴**（比照既有 `AdminController` 慣例）：
- `admin/branches`(GET/POST)、`admin/branches/{id}`(GET/PUT/DELETE)、`admin/branches/sort`(POST) — `Resource="Branchs"`
- `admin/doctors`(GET/POST)、`admin/doctors/{id}`(GET/PUT/DELETE) — `Resource="Doctors"`（無 Sort：`Doctors` 表無 `Sort`/`IsEnabled` 欄位）
- `admin/outpatient-times`(GET) — 門診時段字典（上午/下午/晚上），供時段表單下拉選單
- `admin/periods/{ta-skin|ch-skin|ta-cosmetic|ch-cosmetic|ch-dentist}`(+`/{id}`+`/sort`) — Service 層完全參數化（`branchId`+`clinic`），但 Controller 保留 5 組「瘦」proxy action，因為真實 `Lims` 權限仍是變體粒度（`TaPeriods`/`ChPeriods`/…，見 [admin-auth-authority.md](../blueprints/admin-auth-authority.md)），而 router 的 `[Authorize(Resource,Op)]` 是啟動時綁死在單一 method 上的靜態屬性，無法依 query 參數動態換 Resource key
- `admin/categories/{skin|cosmetic}`(+`/{id}`+`/sort`) — 同理 2 組 proxy，`Resource="Skins"|"Cosmetics"`
- `admin/question-types`(?categoryId=)、`admin/question-types/{id}`、`admin/question-types/sort`、`admin/question-types/{questionTypeId}/questions`、`admin/questions`(POST)、`admin/questions/{id}`(PUT/DELETE)、`admin/questions/sort` — 真實 `Lims` 無獨立 `Questions` key，全掛 `Resource="QuestionTypes"`

**班表（已實作 Done 2026-07-02，[blueprints/admin-roster.md](../blueprints/admin-roster.md)）**：`admin/rosters/{ta-skin|ta-cosmetic|ch-skin|ch-cosmetic|ch-dentist}`(GET 列表`?date=&doctorId=&page=`/POST 建立含展開)、`admin/rosters/{變體}/{id}`(GET/PUT/DELETE) — 同 Periods 設計理由，5 組瘦 proxy 對應 `TaRosters`/`ChRosters`/`TaCosmeticRosters`/`ChCosmeticRosters`/`ChDentistRosters`，分院別名解析重用 `PeriodsOptions`。建立回應含 `skippedDates`（重複展開時因當日既有排班科別重疊而跳過的日期，明確回報取代舊系統靜默跳過）。

**會員管理（已實作 Done 2026-07-03，[blueprints/admin-member.md](../blueprints/admin-member.md)）**：無分院/診別變體，故無需 proxy，`Resource` 固定 `"Members"`：
- `admin/members`(GET`?page=&branchId=&number=&birthday=`)、`admin/members/{id}`(GET/PUT/DELETE) — 列表篩選 + 分頁 20 筆 / 詳情 / 編輯 / 刪除（不含新增會員；刪除有預約或問卷紀錄即擋 `MEMBER_IN_USE`，見 [blueprints/admin-member.md](../blueprints/admin-member.md) 設計決策）
- `admin/members/{id}/questionnaires`(GET) — 已上傳掃描檔 + 已數位作答問卷兩份清單
- `admin/members/{id}/questionnaires/{questionTypeId}/view`(GET) — 唯讀檢視數位作答打勾清單，重用 `IQuestionService.GetFormAsync(includeDisabled: true)`（已停用問卷類型的歷史作答仍可查看，與客戶前台預設行為不同）
- `admin/members/{id}/questionnaires`(POST)、`admin/members/questionnaires/{linkId}`(PUT/DELETE) — 問卷掃描檔上傳/編輯/刪除（`Filename` 存入既有 `memberquestions` Blob 資料夾，重用 `POST /api/uploads`；換檔/刪除連動呼叫 `IFileStorage.DeleteAsync` 清 Blob）

預約管理 `/api/appointments` + `/api/appointments/export/{checkin|questionnaire}`（尚未實作）。

**後台認證與權限（已實作 Done 2026-07-01，`AdminController`）**：

| 端點 | Method | 授權 | 說明 |
|---|---|---|---|
| `/api/admin/menu` | GET | admin | 資料驅動左側選單（讀 Lims+AdminLims 過濾，忠於舊做法） |
| `/api/admins` | GET/POST | Admins read/add | 管理員列表 / 新增（含權限樹） |
| `/api/admins/{id}` | GET/PUT/DELETE | Admins read/update/delete | 詳情（含權限樹勾選）/ 編輯 / 刪除 |
| `/api/lims` | GET | Admins read | 完整權限樹（供新增表單，全未勾） |
| `/api/admin/check-username?username=&excludeId=` | GET | Admins read | 帳號唯一性（對應舊 `/Ajax/CheckUsername`；用 `admin/*` 避與 `admins/{id}` 樣板衝突） |

> 逐操作授權：`[Authorize(Roles.Admin, Resource="Admins", Op="...")]`，router 比對 JWT `perms`，超管放行。見 [security.md](security.md)、[../blueprints/admin-auth-authority.md](../blueprints/admin-auth-authority.md)。

## 分頁與篩選
- 分頁：`?page=&pageSize=`（預設 15）。
- 篩選沿用舊前綴語意改 query param：`clinic` / `branch` / `doctor` / `date` / `memberNumber` / `memberMobile` / `memberName` / `status`。

## 授權
端點授權由 middleware 依 JWT claims 判定（member vs admin、後台功能權限），取代舊 `CheckSessionAttribute` 字串比對。完整見 [security.md](security.md)。
