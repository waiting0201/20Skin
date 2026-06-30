---
title: 20Skin 新系統專案總覽
purpose: 描述重寫版 20Skin 的業務定位、三個獨立可部署單元、reused 資料庫、技術約束與第三方整合，作為理解新系統的第一站
applicable_when: 第一次接觸新系統、要了解客戶 SPA / 後台 SPA / Functions API 怎麼分工、要回答整體性技術選型問題
related_agents:
  - software-architect-blueprint
  - system-analyst
related_docs:
  - architecture.md
  - design/api-design.md
  - design/database-design.md
  - design/security.md
  - design/infrastructure.md
  - old/README.md
  - old/modernization.md
keywords: [overview, 總覽, 新系統, angular, azure-functions, jwt, rewrite, 20Skin]
last_updated: 2026-06-30
status: draft
---

> **新系統規劃中**。本文描述「重寫版」20Skin 的目標架構。舊系統（.NET Framework）參考見 [old/README.md](old/README.md)，重建必修/必避見 [old/modernization.md](old/modernization.md)。

## 業務定位

20Skin 是**多分院、多診別的診所線上預約系統**（皮膚科 / 醫美 / 牙科），重寫目標是把舊的 .NET Framework MVC5 單體拆成現代化、前後端分離的架構，**業務行為與視覺維持不變**，但程式全部重寫。

三大產品線維持不變：
1. **客戶端預約**：會員以身分證 + 生日登入，選分院 / 診別 / 項目 / 時段 / 醫師完成預約，並可填術前問卷。
2. **診所後台**：管理分院、醫師、班表、預約、會員、權限。
3. **簡訊提醒**：預約成功即時通知 + 預約前一日提醒。

## 三個獨立可部署單元

| 單元 | 技術 | 職責 | 對應舊系統 |
|---|---|---|---|
| **客戶前台 SPA** | Angular（standalone + signals）+ Tailwind，純 SPA 無 SEO | 病患預約、查詢、取消、問卷 | `reference/old/20Skin`（[old/design/frontend-customer.md](old/design/frontend-customer.md)） |
| **後台 SPA** | Angular（standalone + signals）+ Tailwind，純 SPA 無 SEO | 員工管理六模組 | `reference/old/20SkinBackend`（[old/design/frontend-backend.md](old/design/frontend-backend.md)） |
| **API** | Azure Functions **.NET 10**（isolated worker）+ 自訂 router MVC + JWT | 所有業務 API、簡訊排程 | `reference/old/20Skin.Service` + 兩站 Controllers（[old/architecture.md](old/architecture.md)） |

- 客戶前台與後台為**兩個完全獨立的專案**（各自 repo/workspace、各自部署），不共用程式碼。
- API 為單一 Azure Functions，提供兩個前端共用的端點（以 JWT role 區分 member / admin）。
- 三者共用**同一套正在營運的 SQL Server `20Skin`**（reused，schema 不可改）。

## 主要使用者旅程（不變，實作改變）

```
客戶預約：Login(身分證+生日+reCAPTCHA) → 選分院 → 選診別 → 選項目
  → (IsQuestion ? 問卷 : skip) → 選日期/醫師/時段 → 建立預約
  → 即時簡訊 + 前一天提醒(SmsStatus) → Complete
後台日常：Login(帳號+密碼) → JWT claims 授權 → 基礎資料 / 班表 / 預約 / 會員 / 權限
簡訊提醒：Azure Functions Timer trigger（取代 CheckSms.exe）→ 發當日待發 SmsStatus
```

詳見對應 blueprint（[blueprints/README.md](blueprints/README.md)）。

## 技術約束

| 面向 | 選擇 | 約束來源 |
|---|---|---|
| 客戶/後台前端 | Angular standalone + **signals**，Tailwind CSS，純 SPA（**無 SEO/SSR**） | 需求指定 |
| API | Azure Functions **.NET 10** isolated，**自訂 router 的 MVC 架構** | 需求指定 |
| 資料存取 | **Dapper**（micro-ORM + 參數化 SQL，無 migration/DbContext） | reused DB、schema 不可改 |
| 資料庫 | SQL Server `20Skin`（營運中，**schema 完全不可改**） | 需求指定，見 [design/database-design.md](design/database-design.md) |
| 認證 | **JWT**（會員：身分證+生日；管理員：帳號+密碼） | 需求指定，見 [design/security.md](design/security.md) |
| 視覺 | **不改**（客戶端 main.css、後台 SmartAdmin 外觀），改用 Tailwind 重現 | 需求指定，見 [design/visual-design.md](design/visual-design.md) |
| 機密 | Azure Key Vault / App Settings（移除舊硬編碼） | 必修安全項 |
| 檔案 | Azure Blob Storage（取代舊 `~/Upload`） | 見 [design/infrastructure.md](design/infrastructure.md) |
| 排程 | Azure Functions Timer trigger（取代 CheckSms console） | 見 [blueprints/sms-reminder.md](blueprints/sms-reminder.md) |
| 部署 | 兩 SPA → Azure Static Web Apps；API → Azure Functions | 見 [design/infrastructure.md](design/infrastructure.md) |

### schema 不可改的衍生限制（重要）
- 管理員密碼無法加長欄位存 bcrypt → 密碼雜湊列為**待 schema 核准的後續項**，現以傳輸/登入層緩解。
- refresh token 不可在 20Skin DB 加表 → 狀態存於 reused DB 之外。
- 詳見 [design/security.md](design/security.md) 與 [design/database-design.md](design/database-design.md)。

## 第三方整合

| 服務 | 用途 | 對應舊系統 |
|---|---|---|
| 智邦通訊 SMS（`pp.url.com.tw`） | 預約即時 / 提醒簡訊 | `reference/old/20Skin/Commons/SmsHandler.cs` |
| Google reCAPTCHA v3 | 前台登入 / 註冊防機器人；新增後台登入防護 | `MainMsController.Login` |
| Azure Blob Storage | 圖片 / 問卷檔案 | 取代舊 `UploadsController` + `~/Upload` |

**無**金流、**無** Email/SMTP、**無** OAuth/SSO（同舊系統範圍）。

## 程式碼位置（新系統，與 docs/ 同 repo）

| 目錄 | 內容 |
|---|---|
| `api/` | Azure Functions .NET 10 solution（`20Skin.slnx`）：`20Skin.Api`(host+自訂 router) / `Skin.Core` / `Skin.Data`(Dapper + POCO) / `Skin.Services` |
| `web-customer/` | 客戶前台 Angular SPA（standalone + signals + Tailwind） |
| `web-admin/` | 後台 Angular SPA（同上 + 權限選單） |

> 三者為獨立可部署單元（各自 build/deploy）。本機開發：`func start`（api）、`ng serve`（各 SPA）。
> 資料層用 Dapper：實體為手寫 POCO（`Skin.Data/Entities`，已建 `Members`），連線經 `IDbConnectionFactory`；happy path 需設定可連 reused DB 的連線字串。見 [design/database-design.md](design/database-design.md)。

## 文件導覽

- 技術分層 → [architecture.md](architecture.md)
- 資料表（沿用） → [design/database-design.md](design/database-design.md)
- API / 自訂 router → [design/api-design.md](design/api-design.md)
- 認證 / 授權 / JWT → [design/security.md](design/security.md)
- 各功能規格 → [blueprints/](blueprints/)
- 進度 → [status.md](status.md)
