---
title: 專案狀態
purpose: 追蹤 20Skin 目前進度、待辦清單、已完成項目、阻塞項；每次任務開始/完成/卡住都要更新
applicable_when: 開始任何任務前要先讀本檔、收到新需求要新增、完成任務要移到 Done、卡住要移到 Blocked
related_agents: []
related_docs:
  - project-overview.md
  - blueprints/README.md
  - old/modernization.md
keywords: [status, 狀態, 進度, todo, backlog, in-progress, blocked, done, roadmap]
last_updated: 2026-06-30T22:00+08:00
---

> 本檔由 Claude **自動維護**。任務開始/完成/卡住都必須更新。詳細規則見 [../CLAUDE.md](../CLAUDE.md) 「狀態追蹤規則」。
> **目前階段：核心功能實作中**。已完成 = 舊系統分析歸檔 → 新系統設計文件 → 三專案骨架 → **會員認證** → **客戶預約（讀+寫，真實 DB 驗證）** → **客戶 SPA 前端串接 API（登入→預約→查詢/取消）**。
> 連線：本機 `(local)` `20Skin` 已可用，連線字串在 `api/20Skin.Api/local.settings.json`（gitignore 排除）。測試會員：`B121583140` / `1978-02-01`。**簡訊一律 no-op（`DevNoOpSmsSender`），測試不真發**。
> 本機啟動：API `cd api/20Skin.Api && func start`（:7071，需 Azurite）；前端 `cd web-customer && npx ng serve`（:4200）。CORS 已允許 :4200（`local.settings.json` Host.CORS）；`environment.apiBase` = `http://localhost:7071/api`。

## 🔄 In Progress

> 一次最多 3–5 項

（目前無 — 骨架完成，等待開始核心功能實作）

## 📋 Backlog

> 新系統開發階段（依 [project-overview.md](project-overview.md) 架構）。優先級為候選排序，由使用者決定執行順序。

### P0 — 基礎
- [x] ~~設定 reused DB 連線字串 + 端對端驗證~~（已完成，連線可用）
- [ ] **逐步補手寫 POCO 實體**（已建：Members + 預約 9 表；其餘 Questions/Admins/Lims… 依功能補）
- [ ] **observability + 機密**：Serilog + App Insights、Key Vault（取代 local 設定）
  - Related: [design/infrastructure.md](design/infrastructure.md)

### P1 — 核心功能（客戶端）
- [x] **會員認證**（完成，真實 DB + 真實會員驗證）[blueprints/member-auth.md](blueprints/member-auth.md)
  - Members POCO、MemberService（Dapper）、reCAPTCHA verifier、`POST /api/auth/member/login`（驗證→黑名單→簽 JWT）、`/api/auth/me`、客戶 SPA login 已串接
  - 實測：真實會員 `B121583140`/`1978-02-01` → status 1 + JWT；`/api/auth/me` 帶 token 解出正確 claims
  - 未做（需求保留無密碼）：OTP/refresh token 持久化（見「待 schema 核准」）
- [x] **客戶線上預約（讀+寫）完成，真實 DB 端對端驗證** [blueprints/customer-booking.md](blueprints/customer-booking.md)
  - 讀取面：10 POCO + `BookingService`（Dapper）+ `GET /api/branches`、`/api/categories?clinic=`、`/api/rosters`(時段+容量)、`/api/rosters/doctors`、`POST /api/rosters/check-availability`（重複視窗設定驅動，台中 ±2 天）
  - 寫入面：`AppointmentService` + `POST /api/appointments`（容量檢查交易內防超賣 + 自動門診號 +2 偶數 + 重複限制 + 問卷強制 + **簡訊雙寫**）、`GET /api/appointments`(分頁)、`GET /api/appointments/{id}`(歸屬檢查修 IDOR)、`POST /api/appointments/{id}/cancel`(>1 小時 + 標記未發 SMS=CANCEL)
  - **真實 DB 實測（建立→列表→詳情→取消→硬刪清除，零殘留）**：建立成功、初診判斷正確、取消後 status=0、SmsStatus 雙寫（即時 DEV + 前一天 CANCEL）正確
  - **簡訊不真發**：`ISmsSender` + `DevNoOpSmsSender`（dev no-op，只記 log，不打智邦；正式環境再接智邦實作）
  - 細節 TODO：取消「>1 小時」目前以 AppointmentDate 日期判斷，未含時段時刻；簡訊內容為精簡版（完整診別差異待補）
- [x] **客戶前台 SPA 串接 API** [design/frontend-customer.md](design/frontend-customer.md)
  - 頁面（standalone + signals + Tailwind）：login、index(分院)、clinic、category、appointment-form(日期→即時時段→送出)、complete、appointment-list、appointment-detail(含取消)
  - 服務：`BookingService` / `AppointmentService`（呼叫 9 端點）、`authInterceptor`(Bearer)、`authGuard`、`ReservationStore`(signals + sessionStorage 防 F5)
  - 驗證：`ng build` 通過；CORS 已驗（preflight + ACAO :4200）；request/response 欄位與 API 一致（camelCase↔PascalCase）
  - 未串：需問卷的科別（`IsQuestion`）前端先擋（問卷功能未做）；指定醫師流程（資料稀少，先走不指定）
- [ ] **問卷** [blueprints/questionnaire.md](blueprints/questionnaire.md)
- [ ] **簡訊雙寫 + Timer 排程** [blueprints/sms-reminder.md](blueprints/sms-reminder.md)
- [ ] **檔案上傳（Blob）** [blueprints/file-upload.md](blueprints/file-upload.md)

### P1 — 核心功能（後台）
- [ ] **後台認證與權限** [blueprints/admin-auth-authority.md](blueprints/admin-auth-authority.md)
- [ ] **後台基礎資料** [blueprints/admin-basic-data.md](blueprints/admin-basic-data.md)
- [ ] **後台排班** [blueprints/admin-roster.md](blueprints/admin-roster.md)
- [ ] **後台預約管理 + 匯出** [blueprints/admin-reserve.md](blueprints/admin-reserve.md)
- [ ] **後台會員管理** [blueprints/admin-member.md](blueprints/admin-member.md)

### P2 — 部署與品質
- [ ] **CI/CD**：兩 SPA → Static Web Apps、API → Functions（[design/infrastructure.md](design/infrastructure.md)）
- [ ] **環境分離** dev/staging/prod
- [ ] **測試**：Domain service 單元測試（容量/編號/重複/簡訊）+ 端點整合測試
- [ ] **與舊系統並行驗證**（同一 reused DB 雙寫一致性）

### 待 schema 核准（暫不做，需動 DB）
- [ ] 管理員密碼雜湊（需加長/新增欄位）
- [ ] refresh token 持久化表（目前用 DB 外儲存）
- [ ] 補 FK（`MemberQuestionAnswers→QuestionAnswers`）、audit 欄位
  - Related: [design/security.md](design/security.md)、[design/database-design.md](design/database-design.md)

## 🚧 Blocked

（目前無）

## ✅ Recently Done

- [x] **客戶前台視覺改為直接套用舊 `main.css`（移除 Tailwind，template 還原舊標記）** — Done 2026-06-30
  - 理由：Tailwind 重建版仍有細微視覺差異；改用原檔求像素一致。
  - `public/content/main.css` = 舊原始 CSS 原封不動；`index.html` 加 `<link>`；`styles.css` 移除 Tailwind。
  - 8 頁 template 全部還原舊 `.cshtml` markup 與 class（`#wrapper`/`#header`/`#sideBar`/`.block-online`/`.online-item`/`.form-block`/`.time-btn`/`.js-active`/`.online-list-tb` 等），零殘留 Tailwind utility。
  - sidebar signal `sidebarOpen()` → `[style.display]`（舊版 jQuery `.show()`，無對應 CSS class）。時段 `.js-active` 改 `[class.js-active]`。
  - `ng build` 通過（1 個無害 warning：Angular 掃描 `<link>` 找不到 `src/content/main.css`，實際資產在 `public/` 正確複製到 dist）。
  - 文件同步：[design/visual-design.md](design/visual-design.md)、[design/frontend-customer.md](design/frontend-customer.md)。
- [x] **客戶前台視覺重現舊系統（Tailwind 重建，已被上項取代）** — Done 2026-06-30
  - 8 頁沿用舊 markup 結構（Tailwind token 版）。被直接套用 main.css 原檔的策略取代。
- [x] **客戶前台 SPA 串接 API 完成** — Done 2026-06-30
  - 8 個頁面 + 2 個 API service + interceptor/guard/signal-store；登入→選分院→診別→項目→日期/時段→送出→完成→查詢/取消全流程接上後端 9 端點。`ng build` 通過、CORS 驗證通過。
- [x] **客戶預約寫入面（建立/取消）完成 + 真實 DB 驗證 + 零殘留清除** — Done 2026-06-30
  - 容量檢查（交易內防超賣）、自動門診號、重複限制、問卷強制、簡訊雙寫；`ISmsSender` no-op 確保測試不真發簡訊。建立→取消全程實測通過，測試資料硬刪清乾淨。
- [x] **客戶預約讀取面 + 自訂 router 綁定修正** — Done 2026-06-30
  - 8 POCO + BookingService（Dapper）+ 5 端點，對真實 `20Skin` DB 實測通過（含真實容量計算）。
  - **修正自訂 router model binding bug**：Guid/DateTime/enum 參數原被誤判為複雜型別而從 body 綁定（應從 route/query）；加入 `IsSimple()` 判斷，影響所有帶此類參數的端點。
- [x] **會員認證 happy path 實測通過（真實 DB + 真實會員）** — Done 2026-06-30
- [x] **決策：資料層改用 Dapper（取代 EF Core）** — Done 2026-06-30
  - 理由：reused DB、schema 不可改、無 migration → Dapper 參數化 SQL 最輕量可控。已移除 EF Core 套件、以 `IDbConnectionFactory`(`Microsoft.Data.SqlClient`) 取代 DbContext、Members 改純 POCO、MemberService 改 Dapper；同步更新 database-design / backend-design / coding-style / architecture / infrastructure / project-overview。build 0 warning（EF Design 漏洞警告一併消除）。
- [x] **新系統三專案骨架完成（可編譯/可跑）** — Done 2026-06-30
  - `api/`：Azure Functions .NET 10 isolated + **自訂 router MVC**（反射路由表）+ JWT 簽發/驗證 middleware + 授權 + model binding + 統一 `ApiResponse` + DI + Dapper 資料層（POCO + `IDbConnectionFactory`）。實測：`/api/health`→200、`/api/auth/me` 無 token→401 / 帶 JWT→200、未知路由→404、JWT 簽發/驗證 round-trip 通過。
  - `web-customer/`：Angular 21 standalone + signals + Tailwind v4 + authInterceptor + authGuard + reservation signal store + login/home；`ng build` 通過。
  - `web-admin/`：Angular 21 + Tailwind + 權限 JWT 解析 + permGuard + 權限過濾側欄 layout + login/dashboard；`ng build` 通過。
- [x] **新系統設計文件完成** — Done 2026-06-30
  - Outcome: 建立 [project-overview.md](project-overview.md)、[architecture.md](architecture.md)、10 份 [design/](design/)、10 份 [blueprints/](blueprints/)；定案兩獨立 Angular SPA + Azure Functions .NET 10 自訂 router + JWT + reused DB（schema 不可改）；每份含「對應舊系統」連結
- [x] **舊系統逆向分析歸檔 docs/old/** — Done 2026-06-30
  - Outcome: 客戶前台/後台/資料庫/架構完整分析 + [old/modernization.md](old/modernization.md) 重建必修清單；docs/ 重構為「舊系統參考 vs 新系統規劃」

## 🗄 Archive

- harness 初始建立（2026-05-07）：docs/ 結構 + CLAUDE.md + agents-catalog + workflows
- 舊系統文件對齊（2026-05-26）→ 已移入 [old/](old/)
