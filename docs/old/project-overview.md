---
title: 20Skin 專案總覽
purpose: 描述 20Skin 醫美預約系統的業務定位、子專案職責、技術約束與整體資料流，作為理解專案的第一站
applicable_when: 第一次接觸 20Skin、要了解 6 個 .NET 專案怎麼分工、要回答「為什麼用 Framework 4.8」「為什麼 Database-First」這類整體性問題
related_agents:
  - software-architect-blueprint
  - system-analyst
related_docs:
  - architecture.md
  - design/backend-design.md
  - design/database-design.md
  - design/infrastructure.md
  - blueprints/customer-booking.md
  - blueprints/backend-admin.md
  - blueprints/sms-reminder.md
keywords: [overview, 總覽, 20Skin, 醫美, 預約, booking, 業務, 專案分工]
last_updated: 2026-05-26
---

## 業務定位

20Skin 是一套**醫美診所線上預約系統**，正式環境部署於 `booking.20skin.tw`。涵蓋三大產品線：

1. **客戶端預約**：會員透過身分證 + 生日登入，選擇分支 / 診別 / 項目 / 時段 / 醫師完成預約，並可填寫術前問卷
2. **診所後台**：管理員管理分支、醫師、班表、預約審核、會員資料、權限
3. **簡訊提醒**：預約成功即時通知 + 預約前一日提醒（透過外部排程器觸發）

## 子專案職責

| 專案 | 類型 | 職責 |
|---|---|---|
| `20Skin/` | ASP.NET MVC 5 + Web API | **客戶前台**。Controllers: `MainMsController`、`AjaxController`、`UploadsController` |
| `20SkinBackend/` | ASP.NET MVC 5 | **診所後台**。Controllers: `BasicMs`（基礎資料）、`ShiftMs`（班表）、`ReserveMs`（預約）、`MemberMs`（會員）、`AuthorityMs`（權限）、`AjaxController` |
| `20Skin.Models/` | Class Library (EF6) | **資料模型層**。`Model1.edmx`（Database-First）+ T4 範本產生 20 個實體與 `SkinEntities` DbContext |
| `20Skin.Service/` | Class Library | **業務邏輯層**。21 個 `*Service` 類別，繼承 `BaseService<T>`，回傳 `IResult` |
| `20Skin.Libs/` | Class Library | **共用工具**。`Definition.cs` 含跨層常數與列舉 |
| `CheckSms/` | Console App | **獨立排程**。定時 HTTP GET `MainMsController.CheckSms` 觸發當日待發簡訊發送 |

依賴方向：`20Skin / 20SkinBackend → 20Skin.Service → 20Skin.Models → 20Skin.Libs`；`CheckSms` 不直接連 DB，純粹當作 cron-style HTTP 觸發器。

## 主要使用者旅程

### 客戶端預約
```
Login (身分證+生日+reCAPTCHA)
  → 黑名單 / 不存在 / 既有會員 三分支
  → SelectBranch → SelectClinic → SelectCategory
  → (Category.IsQuestion ? Questions : skip)
  → GetRosters → 選時段 → 選醫師 (可選)
  → AppointmentForm POST
    ├ 寫 Appointments (Status=1)
    ├ 寫 SmsStatus 即時簡訊 + SmsHandler.SendNow
    └ 寫 SmsStatus 提醒簡訊 (排程到 AppointmentDate-1d)
  → Complete(AppointmentID)
```

### 後台日常
```
Login (Username + Password)
  → CheckSessionAttribute 攔截 + Lims / AdminLims 功能授權檢查
  → BasicMs (Branch/Doctor/Period/Category 維護)
  → ShiftMs (班表 Rosters + RosterPeriods + RosterCategorys)
  → ReserveMs (預約查詢 / 取消 / Excel 匯出 NPOI)
  → MemberMs (會員資料、黑名單)
  → AuthorityMs (管理員 + 權限配置)
```

### 簡訊提醒
```
Windows Task Scheduler
  → CheckSms.exe (HTTP GET booking.20skin.tw/MainMs/CheckSms)
  → 查 SmsStatus WHERE SendDate=today AND Status IS NULL
  → 逐筆 SmsHandler.SendNow → 寫回 Status/Message/UniqID
```

詳細流程見對應 blueprint：[customer-booking](blueprints/customer-booking.md) / [backend-admin](blueprints/backend-admin.md) / [sms-reminder](blueprints/sms-reminder.md)。

## 技術約束

| 面向 | 選擇 | 約束來源 |
|---|---|---|
| Runtime | .NET Framework 4.8 | 既有部署在 Windows Server + IIS，未做 .NET Core 遷移 |
| Web | ASP.NET MVC 5.2.7 + Web API 5.2.7 | server-rendered Razor + 少量 AJAX JSON |
| ORM | Entity Framework 6.4.4 (Database-First) | schema 真相在 SQL Server，code 從 `Model1.edmx` 反向產生 |
| DB | SQL Server (`data source=(local)`, DB 名 `20Skin`) | 本機 / production 同 schema，無 dev/staging 分離 |
| 認證 | Session-based (`Session["IsLogin"]` / `Session["MemberID"]` / `Session["AdminID"]`) | 無 JWT、無 OAuth、前後台 Session 各自獨立 |
| 部署 | IIS 手動部署 | 無容器、無 CI/CD |
| 排程 | Windows Task Scheduler + `CheckSms.exe` | 不在 IIS 內 |
| 前端 | Razor + jQuery（無打包工具） | C 端自訂 CSS、B 端 SmartAdmin + Bootstrap 3 |
| 語系 | 繁體中文（zh-Hant-TW） | UI / 資源檔皆繁中 |

## 第三方整合

| 服務 | 用途 | 介接點 |
|---|---|---|
| 智邦通訊 SMS（`pp.url.com.tw`） | 預約成功 / 提醒簡訊 | `20Skin/Commons/SmsHandler.cs` |
| Google reCAPTCHA v3 | 前台登入 / 註冊防機器人 | `MainMsController.Login` |

**無**金流整合、**無** Email / SMTP、**無**雲端儲存、**無** OAuth / SSO。

## 文件導覽

- 想了解**業務功能怎麼跑** → 看 [blueprints/](blueprints/)
- 想了解**技術分層** → [architecture.md](architecture.md) + [design/backend-design.md](design/backend-design.md)
- 想了解**資料表與關聯** → [design/database-design.md](design/database-design.md)
- 想了解**認證 / 權限機制** → [design/security.md](design/security.md)
- 想知道**已知陷阱** → [gotchas.md](gotchas.md)
- 想看**目前進度** → [status.md](../status.md)
