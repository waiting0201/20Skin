---
title: API / endpoint 設計
purpose: 描述 20Skin 的 endpoint 命名規律、AJAX JSON 回傳慣例、Web API 與 server-rendered MVC 的角色分工
applicable_when: 要新增 endpoint、要決定該寫 MVC Action 還是 AjaxController、要對接前端 jQuery AJAX、要查 endpoint 對應
related_agents:
  - backend-engineer
  - system-analyst
related_docs:
  - backend-design.md
  - security.md
  - frontend-customer.md
  - frontend-backend.md
keywords: [api, endpoint, mvc, ajax, jsonresult, controller, action]
last_updated: 2026-05-26
---

## 風格現況

20Skin **不是 RESTful API 系統**。實際是：

- **主軸**：server-rendered ASP.NET MVC 5（Controller 回 View / Redirect）
- **輔助**：每個專案各有一個 `AjaxController`，回 JSON 給 jQuery AJAX 使用
- **少量 Web API**：`20Skin` 專案有 Web API 路由設定，主要用於 `UploadsController`（檔案上傳）
- **無**統一 `/api/v1/` 命名空間、**無**版本策略、**無**統一 `{data, error}` 回應格式

## URL 命名規律

```
/{Module}Ms/{Action}              # 前後台 MVC Action 主流形式
/{Module}Ms/{Action}/{id}         # 取單筆 / 詳情頁
/Ajax/{Action}                    # AJAX JSON endpoint
/Uploads/{Action}                 # 檔案上傳 (Web API)
```

### 前台 `20Skin` 代表 endpoint

| URL | Method | 用途 |
|---|---|---|
| `/MainMs/Login` | GET / POST | 客戶登入 |
| `/MainMs/JoinUs` | GET / POST | 新會員註冊 |
| `/MainMs/Index` | GET | 首頁 / 預約入口 |
| `/MainMs/AppointmentForm` | GET / POST | 預約建立 |
| `/MainMs/AppointmentDetail/{id}` | GET | 預約詳情 |
| `/MainMs/Complete/{id}` | GET | 預約完成頁 |
| `/MainMs/Visit` | GET | 就診紀錄 |
| `/MainMs/Questions` | GET / POST | 問卷填寫 |
| `/MainMs/CheckSms` | GET | **被 CheckSms.exe 呼叫**，觸發當日簡訊發送，回 JSON |
| `/Ajax/PostCancel` | POST | 取消預約 |
| `/Ajax/SelectBranch` / `SelectClinic` / `SelectCategory` | POST | 預約步驟暫存 |
| `/Ajax/GetRosters` / `GetRosterDoctors` / `GetDoctorRosters` | GET | 動態取班表 |
| `/Ajax/CheckAppointmentDate` | GET | 檢查該日是否可預約 |
| `/Uploads/{Action}` | POST | 檔案上傳 (Web API) |

### 後台 `20SkinBackend` 代表 endpoint

| URL | 用途 |
|---|---|
| `/Main/Login` | 後台登入 |
| `/Main/Logout` | 登出 |
| `/BasicMs/Branchs` / `AddBranchs` / `EditBranchs` / `DeleteBranchs` | 分支 CRUD |
| `/BasicMs/Doctors` / Periods / OutpatientTimes / Categorys / Questions / QuestionAnswers | 基礎資料 CRUD |
| `/ShiftMs/TaRosters` / `AddTaRosters` / `EditTaRosters` / `DeleteTaRosters` | 班表 CRUD |
| `/ReserveMs/TaAppointments` / `ViewTaAppointments` / `DeleteTaAppointments` / `ExportTaAppointments` | 預約管理 |
| `/MemberMs/Members` / `EditMembers` / `MemberQAs` | 會員管理 |
| `/AuthorityMs/Admins` / `AddAdmins` / `EditAdmins` / `DeleteAdmins` | 管理員 + 權限配置 |
| `/Ajax/CheckUsername` | 驗證管理員帳號唯一 |
| `/Ajax/CheckMobile` | 驗證會員手機唯一 |
| `/Ajax/GetPeriods` | 依門診時段帶出時段範本 |

## JSON 回應慣例（AjaxController）

**無統一格式**，但常見模式：

```json
// 成功（PostCancel）
{ "code": "200", "message": "取消成功" }

// 失敗
{ "code": "202", "message": "取消失敗，預約前 1 小時內無法取消" }

// CheckSms 回應
{ "code": "200", "message": "已送出 5 封簡訊" }
```

部分 endpoint 直接回**裸資料**（無 wrapper）：

```json
// GetRosters
[
  { "RosterID": "...", "PeriodID": "...", "Title": "9:00~9:30", "Patients": 3 },
  ...
]
```

**規範**：寫新 AJAX endpoint 時優先沿用既有同類 endpoint 的格式，避免再增加 shape 種類。

## 認證與授權

- **客戶端**：依賴 Session Cookie（`ASP.NET_SessionId`）；`CheckSessionAttribute` 過濾未登入請求 → redirect `/MainMs/Login`
- **後台**：同上機制 + `IsAuth = true` 開啟功能層級授權，依 `Lims` / `AdminLims` 對應 Controller + Action 做 CRUD 權限檢查
- **跨來源**：無 CORS 設定；前後台與 AJAX 同源
- **CheckSms endpoint**：`/MainMs/CheckSms` 目前未綁定 `CheckSessionAttribute`（給外部 cron 用）

完整授權機制見 [security.md](security.md)。

## 版本策略

無。任何 endpoint 變動屬 breaking 都直接改 caller。

## 分頁

- 後台列表慣用 `PagedList` 套件
- URL 慣例：`?p={pageNumber}`，預設 `pageSize=15`
- 篩選參數命名前綴 `s`：`sClinic` / `sCategoryID` / `sAppointmentDate` / `sMemberNumber` / `sMemberMobile` / `sMemberName`

## 檔案上傳

- 後台基礎資料圖檔：`BasicMsController` 採「本機 `~/Upload/{EntityID}` 暫存 → `Librarys.UploadFileToFrontend()` 上傳前台 → 刪本機」三段式
- 客戶問卷檔案：`Questions` POST 經 `MemberQuestions.Filename` 儲存
- Web API：`UploadsController`（路由 `/api/Uploads/{Action}` 形式）

## 錯誤處理

- 預期內錯誤回 view 或回 `{ code: "20x", message: "..." }`
- 預期外例外：`Web.config customErrors`（dev: Off / prod: 應 RemoteOnly）

詳見 [backend-design.md](backend-design.md) 「錯誤處理現況」段。
