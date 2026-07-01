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
  - ../old/design/api-design.md
  - ../old/blueprints/customer-booking.md
keywords: [api, endpoint, custom-router, azure-functions, mvc, rest, apiresponse, jwt]
last_updated: 2026-07-01
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
| `/api/auth/member/login` | POST | 身分證+生日+reCAPTCHA → JWT（status 1/2/3：成功/新客/黑名單） |
| `/api/auth/member/register` | POST | 新會員建檔 → JWT |
| `/api/auth/admin/login` | POST | 帳號+密碼+reCAPTCHA → JWT（`is_super_admin`+攤平 `perms`）。**Done 2026-07-01** |
| `/api/auth/refresh` | POST | refresh token → 新 access token（狀態存 reused DB 之外） |
| `/api/auth/me` | GET | 取當前使用者 |

### 客戶預約（[blueprints/customer-booking.md](../blueprints/customer-booking.md)）
| 端點 | Method | 說明 |
|---|---|---|
| `/api/branches` | GET | 啟用分院列表 |
| `/api/categories?clinic=` | GET | 某診別項目 |
| `/api/rosters?branch=&clinic=&category=&date=` | GET | 可預約時段（JSON） |
| `/api/rosters/doctors?...` | GET | 可指定醫師 |
| `/api/rosters/check-availability` | POST | 重複預約檢查 |
| `/api/appointments` | POST/GET | 建立 / 查詢自己的預約（分頁） |
| `/api/appointments/{id}` | GET | 詳情（**含歸屬驗證，修 IDOR**） |
| `/api/appointments/{id}/cancel` | POST | 取消（>1 小時限制 + 標記未發 SMS=CANCEL） |

### 問卷（[blueprints/questionnaire.md](../blueprints/questionnaire.md)）
`/api/question-types?clinic=`、`/api/question-types/{id}`（題目+選項+會員已答）、`/api/member-questions`（POST 儲存）。

### 地點 / 上傳
`/api/locations/cities`、`/api/locations/zipcodes?city=`、`/api/uploads`（multipart → Blob，見 [blueprints/file-upload.md](../blueprints/file-upload.md)）。

### 後台（各 admin blueprint）
基礎資料 `/api/branches|doctors|periods|categories|question-types|questions`（皆 `?clinic=` 參數化）；班表 `/api/rosters`；預約管理 `/api/appointments` + `/api/appointments/export/{checkin|questionnaire}`；會員 `/api/members`。

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
