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
last_updated: 2026-07-04T20:00+08:00
---

> 本檔由 Claude **自動維護**。任務開始/完成/卡住都必須更新。詳細規則見 [../CLAUDE.md](../CLAUDE.md) 「狀態追蹤規則」。
> **目前階段：核心功能實作中**。已完成 = 舊系統分析歸檔 → 新系統設計文件 → 三專案骨架 → **會員認證** → **客戶預約（讀+寫，真實 DB 驗證）** → **客戶 SPA 前端串接 API（登入→預約→查詢/取消）** → **後台地基 + 權限管理（資料驅動選單 + Admins CRUD，真實 DB 驗證）** → **客戶前台問卷（術前病歷，動態題型 + 重填語義，真實 DB 驗證）** → **初診註冊 JoinUs（城市區連動 + 過敏/病史 CSV + 註冊即登入）** → **指定醫師流程（+ 修 router 500 bug）** → **預約照片上傳（Azure Blob）** → **reCAPTCHA v3 前端（動態載入 + 登入/註冊送 token，mock 驗證）** → **Serilog 結構化 log** → **後台基礎資料全數完成（分院/醫師/時段/科別項目/問卷主檔，4 Phase）** → **後台排班管理（重複展開 + diff 編輯，真實 DB 驗證）** → **後台會員管理（列表/編輯/黑名單 + 問卷掃描檔上傳維護，真實 DB 驗證）** → **後台預約管理（3 組變體 + 容量表 + Excel/問卷列印 + 後端真實 DB 驗證 + 前端頁面完整實作，後台六模組全數完成）** → **正式環境首次上線（`rg-20skin-prod`，三個可部署單元皆已透過 CI/CD 成功部署並驗證存活：客戶前台/後台 SWA 200、API 401=符合設計）**。
> 連線：本機 `(local)` `20Skin` 已可用，連線字串在 `api/20Skin.Api/local.settings.json`（gitignore 排除）。測試會員：`B121583140` / `1978-02-01`。**簡訊一律 no-op（`DevNoOpSmsSender`），測試不真發**。
> 本機啟動：API `cd api/20Skin.Api && func start`（:7071，需 Azurite）；前端 `cd web-customer && npx ng serve`（:4200）。CORS 已允許 :4200（`local.settings.json` Host.CORS）；`environment.apiBase` = `http://localhost:7071/api`。

## 🔄 In Progress

> 一次最多 3–5 項

（目前無 — 後台預約管理前端已完成，見下方 Recently Done；後台六模組（權限/基礎資料/排班/會員/預約/RWD）全數完成）

## 📋 Backlog

> 新系統開發階段（依 [project-overview.md](project-overview.md) 架構）。優先級為候選排序，由使用者決定執行順序。

### P0 — 基礎
- [x] ~~設定 reused DB 連線字串 + 端對端驗證~~（已完成，連線可用）
- [ ] **逐步補手寫 POCO 實體**（已建：Members + 預約 9 表；其餘 Questions/Admins/Lims… 依功能補）
- [x] **Serilog 結構化 log** ✅ Done 2026-07-02（見 Recently Done）
- [ ] **App Insights 串接 + Key Vault**（取代 local 設定；待實際 Azure 資源/CI-CD 階段一起做，見 P2）
  - Related: [design/infrastructure.md](design/infrastructure.md)

### P1 — 核心功能（客戶端）
- [x] **會員認證**（登入 + 初診註冊 JoinUs 均完成，真實 DB 驗證）[blueprints/member-auth.md](blueprints/member-auth.md)
  - Members POCO、MemberService（Dapper）、reCAPTCHA verifier、`POST /api/auth/member/login`（驗證→黑名單→簽 JWT）、`/api/auth/me`、客戶 SPA login 已串接
  - **初診註冊（2026-07-01）**：`POST /api/auth/member/register`（格式驗證→ 查無則建檔→ 簽 JWT 直接登入）、`GET /api/zipcodes`（城市→區）、`JoinUsComponent`（全欄位 + 城市區連動 + 過敏/病史多選 CSV + 民國年）；身分證+生日已存在則不重複建檔；見 Recently Done
  - 實測：真實會員 `B121583140`/`1978-02-01` → status 1 + JWT；註冊測試身分證端對端 + 硬刪零殘留
  - **reCAPTCHA v3 前端（2026-07-01）**：`RecaptchaService` 動態載入 + 登入/註冊送 token；dev（site key 空）→ 空 token 後端放行；正式填 site key + secret 即啟用。mock 驗證 token 流入請求。
  - 未做（需求保留無密碼）：OTP/refresh token 持久化（見「待 schema 核准」）；登入 rate-limit
- [x] **客戶線上預約（讀+寫）完成，真實 DB 端對端驗證** [blueprints/customer-booking.md](blueprints/customer-booking.md)
  - 讀取面：10 POCO + `BookingService`（Dapper）+ `GET /api/branches`、`/api/categories?clinic=`、`/api/rosters`(時段+容量)、`/api/rosters/doctors`、`POST /api/rosters/check-availability`（重複視窗設定驅動，台中 ±2 天）
  - 寫入面：`AppointmentService` + `POST /api/appointments`（容量檢查交易內防超賣 + 自動門診號 +2 偶數 + 重複限制 + 問卷強制 + **簡訊雙寫**）、`GET /api/appointments`(分頁)、`GET /api/appointments/{id}`(歸屬檢查修 IDOR)、`POST /api/appointments/{id}/cancel`(>1 小時 + 標記未發 SMS=CANCEL)
  - **真實 DB 實測（建立→列表→詳情→取消→硬刪清除，零殘留）**：建立成功、初診判斷正確、取消後 status=0、SmsStatus 雙寫（即時 DEV + 前一天 CANCEL）正確
  - **簡訊不真發**：`ISmsSender` + `DevNoOpSmsSender`（dev no-op，只記 log，不打智邦；正式環境再接智邦實作）
  - 細節 TODO：簡訊內容為精簡版（完整依診別/分院/自動配號差異化文案待補，見 2026-07-02 第三輪 audit）。取消「>1 小時」已於 2026-07-02 改為精確依看診時刻計算（見 Recently Done）
- [x] **客戶前台 SPA 串接 API** [design/frontend-customer.md](design/frontend-customer.md)
  - 頁面（standalone + signals + Tailwind）：login、index(分院)、clinic、category、appointment-form(日期→即時時段→送出)、complete、appointment-list、appointment-detail(含取消)
  - 服務：`BookingService` / `AppointmentService`（呼叫 9 端點）、`authInterceptor`(Bearer)、`authGuard`、`ReservationStore`(signals + sessionStorage 防 F5)
  - 驗證：`ng build` 通過；CORS 已驗（preflight + ACAO :4200）；request/response 欄位與 API 一致（camelCase↔PascalCase）
  - 指定醫師流程已完成（2026-07-01，見 Recently Done）；問卷（`IsQuestion`）已完成。客戶前台三缺口全數補齊。
- [x] **問卷** ✅ Done 2026-07-01（真實 DB 端對端驗證，見 Recently Done）[blueprints/questionnaire.md](blueprints/questionnaire.md)
- [ ] **簡訊雙寫 + Timer 排程** [blueprints/sms-reminder.md](blueprints/sms-reminder.md)
- [x] **檔案上傳（Blob）** ✅ Done 2026-07-01（客戶預約照片，真實 Blob/DB 驗證，見 Recently Done）[blueprints/file-upload.md](blueprints/file-upload.md)

### P1 — 客戶前台（2026-07-02 第三輪 audit 發現，使用者裁示「先修 8 項缺陷/矛盾、其餘記錄 backlog」）
- [ ] **登入頁黑名單訊息文案精簡，遺失「臨櫃註銷即可重新開通」引導** — 舊 `MainMsController.cs` 有完整說明，新 `AuthController.cs` 僅回「請洽診所」，使用者不知如何解除限制。Why：影響被限制會員的自助解決率。
- [ ] **JoinUs 已存在會員新增黑名單阻擋，未記錄決策理由** — 舊系統查到既有會員一律直接登入（不論黑名單），新系統加了擋。屬合理改良但 `blueprints/member-auth.md`「設計決策」段落未記錄，需補寫或確認是否為刻意行為。
- [ ] **登入/註冊身分證格式驗證前端不一致** — `login.ts` 僅接受大寫（`^[A-Z]\d{9}$`，未 toUpperCase），`join-us.ts` 大小寫皆可並自動轉大寫。同一身分證小寫輸入在兩頁行為不同，建議統一。
- [ ] **JoinUs 手機格式規則收緊，未記錄理由** — 舊系統 `^0[0-9]{9}$`（任何 0 開頭10碼皆可）→ 新系統 `^09\d{8}$`（限定手機格式）。屬合理收緊但未記錄於 blueprint。
- [ ] **登入/註冊生日下拉未依年/月即時篩選閏年，UX 倒退** — 舊系統動態產生「日」選項排除不存在日期（如2月30日）；新系統固定1-31，允許選出無效日期後才在送出時被後端擋下。後端有 try/catch 兜底不會產生髒資料，純 UX 體驗劣化。
- [ ] **預約照片上傳新增 8MB+型別白名單限制，舊系統無此限制** — 屬合理強化（防禦性），但改變了「與舊系統行為一致」的比對基準，建議記錄到 [blueprints/file-upload.md](blueprints/file-upload.md) 設計決策。
  - Related: [blueprints/member-auth.md](blueprints/member-auth.md)、[blueprints/customer-booking.md](blueprints/customer-booking.md)

### P1 — 核心功能（後台）
- [x] **後台認證與權限** ✅ Done 2026-07-01（地基 + 權限管理，真實 DB 驗證，見 Recently Done） [blueprints/admin-auth-authority.md](blueprints/admin-auth-authority.md)
- [x] **後台基礎資料** ✅ Done 2026-07-02（分院/醫師/時段/科別項目/問卷主檔，真實 DB 驗證，見 Recently Done） [blueprints/admin-basic-data.md](blueprints/admin-basic-data.md)
- [x] **後台排班** ✅ Done 2026-07-02（排班 CRUD + 重複展開 + RosterCategorys/RosterPeriods diff，真實 DB 驗證，見 Recently Done） [blueprints/admin-roster.md](blueprints/admin-roster.md)
- [x] **後台預約管理 + 匯出**（後端 + 前端）✅ Done 2026-07-03（3 組變體 + 容量表 + Excel/問卷列印 + 前端頁面完整實作，後端真實 DB 驗證，見 Recently Done） [blueprints/admin-reserve.md](blueprints/admin-reserve.md)
- [x] **後台會員管理** ✅ Done 2026-07-03（列表/編輯/黑名單 + 問卷掃描檔上傳維護，真實 DB 驗證，見 Recently Done） [blueprints/admin-member.md](blueprints/admin-member.md)
- [x] **後台 RWD（響應式）** ✅ Done 2026-07-03（見 Recently Done） [design/frontend-backend.md](design/frontend-backend.md) §RWD

### P2 — 部署與品質
- [ ] **正式環境 smoke-test 腳本待實跑**（需有 prod DB/Storage 權限的機器）：`scripts/smoke/check_migrated_files.py`（驗收①搬遷檔可顯示）+ `check_new_upload.py`（驗收②新上傳可用+自動清理）已產出（2026-07-04），本次產出環境無 prod 憑證未能實跑。Why：`docs/blueprints/file-upload.md` 記錄的「尚待實跑」缺口，需要瀏覽器/prod 憑證才能完成。
  - Related: [blueprints/file-upload.md](blueprints/file-upload.md) §Smoke-test 腳本、[../scripts/smoke/README.md](../scripts/smoke/README.md)
- [x] **正式環境首次部署全數完成並驗證存活**（prod-only）✅ Done 2026-07-04（見 Recently Done）[design/infrastructure.md](design/infrastructure.md)
  - `rg-20skin-prod` 17 項資源全數建立成功；SQL AAD 系統管理員 + Function App contained user 已設定；Key Vault 5 項機密已寫入；GitHub Environment `production` + secrets 已由使用者設定完成；reCAPTCHA 後台網域已註冊
  - 三個 CI/CD workflow（web-customer/web-admin/api）皆已 push 觸發並成功部署：客戶前台、後台 SWA 回應 200；API 回應 401（`/api/branches` 需會員 JWT，符合設計）
  - 部署過程發現並修正 **5 個平台限制**（Key Vault purge protection 強制開啟、appsetting 名稱不可含冒號/連字號、`FUNCTIONS_WORKER_RUNTIME` 重複設定、`Azure/static-web-apps-deploy@v1` 的 `skip_app_build: true` 不使用 `output_location`），兩項需要程式碼配合（`Program.cs` 分院 GUID 改讀 JSON app setting；两個 SPA workflow 的 `app_location` 改指向 build 產物目錄），詳見 infrastructure.md §部署實測記錄
  - 客戶前台 SWA 因訂閱 Free tier 名額已滿（其他既有專案佔用），使用者決定改用 Standard tier（約 $9/月），後台維持 Free
  - **未做（非阻塞）**：refresh token 持久化寫入邏輯、智邦 SMS 串接、自訂網域/CDN，見 infrastructure.md §已知限制/後續事項
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

- [x] **正式環境 Azure 資源實際套用（真實訂閱，非僅產出方案）** — Done 2026-07-04 [design/infrastructure.md](design/infrastructure.md) §部署實測記錄
  - `rg-20skin-prod`（西美 `westus2`）17 項資源全數建立：2x SWA（客戶前台 Standard、後台 Free）/ Function App(Flex Consumption) + Plan / Storage(`st20skinprod`) / Key Vault(`kv-20skin-prod-lnjm`) / App Insights + Log Analytics / 既有 `weyprous` SQL Server 防火牆規則；GitHub OIDC 身分 `id-20skin-ci-prod` + federated credential（`repo:waiting0201/20Skin:environment:production`）+ RG 層級 Contributor 已建立
  - 既有 SQL AAD 系統管理員設為 `Weypro`；Function App 的 Managed Identity 已在 `20Skin` DB 建立 contained user（`db_datareader`/`db_datawriter`，透過 `pyodbc` + `az` access token 執行 T-SQL）
  - Key Vault 5 項機密已寫入（`Storage-ConnectionString`/`Jwt-SigningKey`(新產生)/`Recaptcha-SecretKey`(沿用既有)/`SuperAdmin-Username`/`SuperAdmin-Password`(新產生)）；兩個 SWA 部署權杖已取得（暫存本機，未落地 commit）
  - **部署過程中發現並修正 4 個 Flex Consumption 平台限制**（Bicep + 一處程式碼改動）：Key Vault 需強制 `enablePurgeProtection: true`（不可逆）；appsetting 名稱不可含冒號（`Jwt:SigningKey` 等一律改雙底線）；appsetting 名稱不可含連字號（GUID 逐分院攤平的寫法整個作廢，改成單一 JSON 字串 app setting，`api/20Skin.Api/Program.cs` 新增 `ReadBranchAliasMap`/`ReadBookingWindowMap` fallback 解析，`dotnet build` 0 error）；`FUNCTIONS_WORKER_RUNTIME` 在 Flex Consumption 是不允許的重複設定
  - 客戶前台改用 Standard tier（使用者決定）：訂閱既有 9 個其他專案吃滿 Free tier 10 個上限，後台搶到最後一個 Free 名額
  - **未做**：GitHub Environment `production` + secrets/variable 尚未設定（本機 `gh` 未登入）；reCAPTCHA 後台網域註冊；兩個 SPA + API 尚未真正跑過 CI/CD workflow（目前僅 Azure 資源本身就緒，程式碼尚未部署上去）
- [x] **正式環境（prod-only）部署方案 + IaC(Bicep) + GitHub Actions workflow 產出** — Done 2026-07-04 [design/infrastructure.md](design/infrastructure.md)
  - **範圍**：`infra/main.bicep` + 7 個 `infra/modules/*.bicep`（Static Web Apps ×2 / Function App(Flex Consumption) / Storage / Key Vault(RBAC) / App Insights+Log Analytics / 既有 SQL 防火牆規則）+ `.github/workflows/`（`deploy-web-customer`/`deploy-web-admin`/`deploy-api`/`deploy-infra`，四單元各自 path filter 獨立觸發）+ 兩份 `public/staticwebapp.config.json`（SPA fallback + 安全 headers）。
  - **關鍵決策**：① 兩 SWA **不使用** SWA 的 Bring-your-own-API linking（查證官方文件確認 Free tier 本就不支援此功能，且此功能本身是 1:1 綁定不適合兩站共用一支 API）——API 完全獨立部署，靠 CORS 直接呼叫；② Function App 採 **Flex Consumption**（非傳統 Consumption，因 .NET 10 isolated 在 Linux 上傳統 Consumption 不支援且即將淘汰）；③ DB 連線改 **Managed Identity**（`Authentication=Active Directory Managed Identity`，零程式碼改動，取代 `sa`），並提供 SQL 帳密 fallback；④ Storage 帳戶**查證現有程式碼後改為單一帳戶**（原規劃兩顆分離帳戶，但 `Program.cs:111-117` 顯示 Blob 上傳現況直接重用 `AzureWebJobsStorage`，拆分需先改程式碼，故列為 backend-engineer 後續待辦而非本次阻塞項）。
  - **同步修正既有程式碼**：`web-customer`/`web-admin` 的 `environment.prod.ts` 原本 `apiBase: '/api'`（隱含假設走 SWA linked backend，與上述「不 link API」決策衝突，正式部署會 404）——已改為 Function App 絕對網址；`uploadBase` 同步填入 Storage 帳戶的公開容器網址。
  - **更新（2026-07-04）**：已實際套用到真實訂閱，見上方新條目「正式環境 Azure 資源實際套用」。
- [x] **後台預約管理前端：列表（含時段容量表）/詳情/取消/Excel 匯出/問卷列印頁完整實作，後台最後一個 P1 模組前端補齊** — Done 2026-07-03 [blueprints/admin-reserve.md](blueprints/admin-reserve.md) §前端實作紀錄
  - **範圍**：`web-admin/src/app/pages/reserve/`（`reserve-list`/`appointment-detail`/`questionnaire-print`）+ `reserve-api.service.ts` + `core/models.ts` 新增 8 個型別；路由 `reserve`/`reserve/:id`/`reserve/print/questionnaire`（無靜態 `data.perm`，資源 key 依 `branch` query param 動態決定，比照 `roster`/`basic/periods` 既有慣例）；`menu-route-map.ts` `BUILT_KEYS` 補上 3 個 Lims key。
  - **版面比照舊系統**：`reserve-list` 左窄欄時段容量表（可編輯設定人數 + 唯讀預約/剩餘人數）+ 右寬欄預約列表（grid 欄位/寬度/對齊已補入 [design/frontend-backend.md](design/frontend-backend.md) 三個對照表，共 10 頁）；`pageSize` 固定 50（沿用舊系統，與其餘模組的 20 刻意不同，已同步寫入分頁規範表）。
  - **逐欄核對舊 `.cshtml` 修正一處任務規格與實際原始碼的落差**：「項目」欄任務規格原稿標示靠左，但實測舊 `TaAppointments.cshtml` 該欄 `<th>`/`<td>` 皆有 `text-center`，依本專案已定案的「以實際舊 View class 為準」規則改為置中，已同步修正 `design/frontend-backend.md` 對照表。
  - **匯出策略定案：問卷改用瀏覽器原生列印，捨棄 `pdfmake`/`html2pdf`**（取代 blueprint 原先記錄的待實作風險項）：`questionnaire-print.ts` 渲染唯讀勾選表格（重用 `member-questionnaire-view.ts` 樣式）+「列印」按鈕呼叫 `window.print()`（不自動彈窗），刻意避免新增 npm 依賴與 CJK 字型嵌入問題。`styles.css` 新增全域 `@media print` 規則隱藏 `AdminLayoutComponent` 側欄/頂欄/Ribbon（新增 `.app-ribbon` class）/頁尾，只印內容本體。
  - **詳情頁不設頁籤**：「預約資料」+「問卷」上下堆疊，比照本專案既有定案（非本次新規則）；`questionnaire===null` 統一顯示「不需填寫問卷」，涵蓋 ChDentist 變體本無問卷 tab 與「尚未作答」兩種情境（已知簡化，前後端資料格式無法區分兩者）。
  - **驗證**：`ng build` 0 error；額外跑 `tsc --noEmit` 確認 0 型別錯誤；逐一比對編譯後 `styles-*.css` 確認新用到的 Tailwind class（`lg:w-80`/`lg:flex-row`/`disabled:opacity-30`/`disabled:cursor-not-allowed`/`print:hidden`/`break-inside-avoid`/自訂 `@media print` 選擇器）皆正確產生對應規則。**未做**：瀏覽器互動實測（本次會話無 Playwright/chrome-devtools 工具可用，僅型別檢查+編譯+編譯後 CSS 比對，誠實記錄），建議下次有瀏覽器工具時針對篩選/容量編輯送出/詳情頁瀏覽/取消/Excel 下載/問卷列印頁渲染逐一驗證。
- [x] **後台預約管理：查詢/詳情/取消/容量批次更新/簽到單 Excel/問卷 JSON 匯出完整實作（真實 DB 端對端驗證）** — Done 2026-07-03 [blueprints/admin-reserve.md](blueprints/admin-reserve.md)
  - **舊系統研究**：完整讀完 `ReserveMsController.cs`（1225 行）確認只有 3 組變體（`TaAppointments`/`ChAppointments`/`ChDentistAppointments`，非其他模組常見的 5 組）；Ta/Ch 各自用 `sClinic` 查詢參數在 Skin/Cosmetic 間切換（同頁面非獨立頁面）；對真實 DB 查證 `Lims`（`ParentID=18`）三個 Key 精確拼字、`Branchs.IsAutoRowNumber`（前端據此決定是否顯示看診號碼欄）、`Appointments.Photo`/`.IsFirstVisit`（後者存在但列表/匯出皆不讀取，改用動態計算沿用舊行為）。
  - **後端**：`AppointmentAdminDtos.cs`（8 個 DTO）+ `Skin.Services.Reserve.AppointmentAdminService`（Dapper：列表 pageSize 固定 50、時段容量表 `OUTER APPLY` 比對邏輯照抄舊系統、取消含防重複取消防禦性檢查、容量批次更新、簽到單 Excel 用 `ClosedXML` 取代舊 NPOI .xls、問卷匯出改結構化 JSON 取代舊 iTextSharp PDF）+ `AppointmentsAdminController`（3 組瘦 proxy，仿 `RostersAdminController` 設計）；`Skin.Services.Skin.Services.csproj` 新增 `ClosedXML` 套件。
  - **關鍵細節照抄舊系統（勿修正為一致）**：列表/詳情頁「時間」欄有 `Rosters.OutpatientTimes.Title ?? Periods.OutpatientTimes.Title` fallback，但簽到單 Excel 匯出的「時間」欄**無**此 fallback——兩處刻意不同，已用真實資料驗證兩者行為確實有別；問卷匯出刻意不篩選 `Status`（連已取消預約有填問卷也匯出）。
  - **刻意的安全強化（非破壞相容性）**：取消加一條舊系統沒有的檢查——已取消狀態重複取消擋下 `ALREADY_CANCELLED`。
  - **真實 DB 端對端實測**（測試日期 2099-01-01/02，測試會員沿用既有 `B121583140`）：建立 2 個測試管理員（全權限/僅 `TaAppointments` 唯讀）驗證授權邊界（403/401 正確）；Ta/Ch/ChDentist 三分支各建測試 Roster+Appointments(含取消)+SmsStatus+問卷作答，逐一驗證列表篩選/分頁/初診動態判斷（由 true 轉 false）、容量表（ta/ch 正確比對科別、ch-dentist 正確略過）、容量批次更新寫入、詳情問卷 pre-fill、取消（含重複取消/查無預約）、Excel 匯出（`openpyxl` 逐欄核對含「時間」欄確認留空、民國年生日正確）、問卷 JSON 匯出含已取消預約。**發現二林．齒科（ChDentist）在本機開發 DB 完全無 Dentist 診別基礎資料**（`Categorys`/`Periods` 皆 0 筆），暫建最小測試資料驗證後刪除，已記錄為風險（正式環境資料完整性未經本次驗證）。測試資料事後全數清除，SQL 逐表核對零殘留。`dotnet build` 0 warning 0 error。
  - **未做**：前端頁面（本次任務範圍僅後端 API，`web-admin` 對應頁面待排入）；問卷匯出 PDF 前端方案（`pdfmake`/`html2pdf`）未實作。
- [x] **排班頁面（rosters-list/roster-form）移除頁籤，並修正 5 處表單/列表落差（含追加一輪核對）** — Done 2026-07-03 [design/frontend-backend.md](design/frontend-backend.md) §rosters-list 不設頁籤
  - 使用者裁示：①「門診管理裡都有同樣的問題，拿掉tab，要跟舊系統對齊表單」②追加「門診表單要參照舊系統」，觸發第二輪逐行核對，又抓出「班別」欄位是舊系統死碼被誤實作、「重複」用詞順序不符 2 項。
  - **追加修正（第二輪）**：「班別」（`OutpatientTimeID`）下拉在舊 `AddTaRosters`/`EditTaRosters.cshtml` 整段被 Razor 註解隱藏、從未渲染，屬死碼——客戶預約真正讀取的時間欄位是 `Periods.OutpatientTimeID`（`BookingService` join 路徑），與 `Rosters.OutpatientTimeID` 無關；初版誤將此死碼做成可互動下拉，已移除（表單欄位保留但不渲染：新增固定送 `null`，編輯原樣回傳既有值不覆寫，不清空歷史資料）。「重複」單選鈕文字/順序改回舊系統原詞「每天/每周/永不」（原「不重複/每日/每週」），「截止日」改回舊 placeholder「重複結束日期」。
  - **移除頁籤**：`rosters-list.ts` 拿掉 5 頁籤切換列（舊系統 5 變體是各自獨立頁面）；篩選欄「日期」改回舊詞「門診日期」。
  - **列表欄位修正**：查證舊 `TaRosters.cshtml` 顯示「項目」（開放科別項目標題逗號串接）而非「班別」，初版誤用後者；已補 `RosterListItemDto.CategoryTitles`（後端 `STRING_AGG` 查詢）取代原本顯示的 `OutpatientTimeTitle`。
  - **表單 3 處邏輯修正**（逐行比對 `AddTaRosters`/`EditTaRosters.cshtml` 發現）：①「需預約」只在有選醫師時顯示、清空醫師自動取消勾選（查證舊系統 `$("#DoctorID").change` 行為）；②「門診日期」新增與編輯皆可修改（查證舊 `EditTaRosters` 的 `TryUpdateModel` 白名單含 `RosterDate`，初版誤判為編輯不可改），已在 `RosterUpdateRequest` 補上此欄位並實作後端更新；③「起始號碼」改為唯讀顯示（查證舊系統該值一律是 hidden input、從未提供編輯介面，只有「人數」可編輯）。
  - `dotnet build`（0 warning）與 `ng build`（0 error）皆通過。**未做**：瀏覽器互動實測（本次會話無 Playwright/chrome-devtools 工具可用），建議下次驗證「清空醫師需預約自動取消」「編輯排班改門診日期成功寫回」。
- [x] **科別項目頁面（categories-list/category-form）移除頁籤、表單忠於舊系統，並補上「需填問卷」相關業務規則** — Done 2026-07-03 [design/frontend-backend.md](design/frontend-backend.md) §categories-list 不設頁籤
  - 使用者裁示：「皮膚主治跟美容醫學不要有tab，表單也要完全參照舊系統」。同一批問題比照 periods-list 的修法處理。
  - **移除頁籤**：`categories-list.ts` 拿掉「皮膚（健保）」/「醫學美容」2 頁籤切換列（舊 `Skins.cshtml`/`Cosmetics.cshtml` 是各自獨立頁面）；`clinic` 仍走 query params，切換交由選單。
  - **表單忠於舊系統**：逐一比對 `Add·EditSkins`/`Add·EditCosmetics.cshtml`（4 個 View 結構完全相同）後修正 `category-form.ts`：欄名「名稱」→「標題」；「簡介」改單行必填輸入（原多行選填 textarea）；三個「每次一人」checkbox 標籤改回「台中每次一人」/「二林每次一人」/「齒科每次一人」（原自創「台中院限定」等詞）；「代表圖」新增時必填、編輯時選填，補上舊系統提示文字「建議尺寸 : 411 x 298」。
  - **新發現業務規則並補齊後端**：查證舊 `AddSkins`/`AddCosmetics` 的 `TryUpdateModel` 白名單不含 `IsQuestion`——新增科別項目時完全沒有「需填問卷」欄位，一律預設 `false`；`EditSkins`/`EditCosmetics`（第 951–961 行）規定 `IsQuestion` 從 `false`→`true` 時該項目必須已有至少一筆 `QuestionTypes`，否則擋下「尚未編輯問卷」。原新系統 `CategoryAdminService` 兩條規則都沒實作（新增時照單全收前端傳來的 `IsQuestion`、更新時無此守門）。已修正：`CreateAsync` 忽略前端值強制寫 `false`；`UpdateAsync` 補上 `QuestionTypes` 存在性檢查（`QUESTION_NOT_EDITED`）；`Intro` 也補上非空驗證（舊系統為必填）。前端 `category-form.ts` 的「需填問卷」checkbox 改為只在編輯頁顯示。
  - `dotnet build`（0 warning）與 `ng build`（0 error）皆通過。**未做**：瀏覽器互動實測（本次會話無 Playwright/chrome-devtools 工具可用），建議下次驗證「新增不填代表圖擋下」「編輯開啟需填問卷但無 QuestionTypes 擋下尚未編輯問卷」兩個新業務規則。
- [x] **時段頁面（periods-list/period-form）移除頁籤、表單忠於舊系統、台中健保時段隱藏新增按鈕** — Done 2026-07-03 [design/frontend-backend.md](design/frontend-backend.md) §periods-list 不設頁籤
  - 使用者裁示：①「台中健保、二林健保、台中美容、二林美容、二林齒科頁面不需要有tab，表單要完全參照舊程式」②「台中健保時段的新增時段隱藏」。
  - **移除頁籤**：`periods-list.ts` 拿掉原本自創的 5 頁籤切換列（舊系統 5 變體本是各自獨立頁面，互相間沒有切換 UI）；元件仍維持 branch/clinic 參數化（未拆成 5 個獨立元件，理由見 blueprint），切換交由選單。
  - **表單忠於舊系統**：逐一比對 `BasicMs/Add·EditTa·Ch·ChDentist·CosmeticPeriods.cshtml`（5 變體結構完全相同，僅標題/URL 不同）後修正：「時段」欄原是自由文字輸入（誤植），改回舊系統的 HH(08–21)/MM(00,05,…,55) 兩個下拉組成 `"HH:MM"`；欄位標籤「門診時段/名稱/起始號碼/容量」改回舊系統原詞「時間/時段/起始編號/人數」；起始編號提示文字改為「若沒填寫，起始編號預設為 2」（查證 `AppointmentService.NextOutpatientNumber` 的 `ctx.StartNumber ?? 2` 已實作此預設值，原提示「留空則不自動配號」與實際行為不符）。列表頁欄名同步修正。
  - **台中健保時段隱藏新增按鈕**：查證舊 `TaPeriods.cshtml:30` 的「新增台中健保時段」連結整段被 Razor 註解隱藏，其餘 4 變體正常顯示；`periods-list.ts` 加 `isTaSkin()` 判斷比照隱藏，後端 `TaSkinCreate` 端點不受影響（比照舊系統該 action 仍存在、只是沒有 UI 連結）。
  - `ng build` 0 error。**未做**：瀏覽器互動實測（本次會話無 Playwright/chrome-devtools 工具可用）。
- [x] **修復後台選單「點擊沒反應」bug：`LIMS_ROUTE_MAP` path/query 混成單一字串餵給 `[routerLink]` 導致永遠匹配不到路由** — Done 2026-07-03 [gotchas.md](gotchas.md) §選單資料表把 path?query 烤成單一字串
  - **緣起**：使用者要求「參照舊程式製作台中健保時段」，經核對發現該功能（`TaPeriods`）其實已在 2026-07-02 Phase 2 完整實作（後端 5 變體 proxy + 前端頁籤 + `BUILT_KEYS`），程式碼、設定、commit 都已存在。追問使用者實際現象後確認是「點左側選單沒反應」——不是功能沒做，是選單連結本身壞了。
  - **根因**：`menu-route-map.ts` 的 `LIMS_ROUTE_MAP` 原把路徑與 query 烤成一個字串（如 `'/basic/periods?branch=ta&clinic=Skin'`）直接餵給 `[routerLink]`；Angular `RouterLink` 收到純字串只會按 `/` 切路徑片段、不解析 `?`，導致永遠匹配不到路由，靜默落到 `{path:'**', redirectTo:''}`。此 bug 影響所有帶 query 參數的選單項目：時段 5 變體（Ta/Ch/TaCosmetic/ChCosmetic/ChDentistPeriods）、排班 5 變體（*Rosters）、科別項目 2 變體（Skins/Cosmetics），不只台中健保時段一項。
  - **修法**：`LIMS_ROUTE_MAP` 改為 `{ path, queryParams? }` 結構化型別；`admin-layout.ts` 模板改用 `[routerLink]="route(key).path"` + `[queryParams]="route(key).queryParams"` 雙綁定（比照 `periods-list.ts` 頁籤既有正確寫法）；breadcrumb／自動展開所屬模組的比對邏輯一併改為路徑前綴＋query 子集比對，取代原本脆弱的整串 `startsWith`。
  - **驗證**：`ng build` 0 error。**未做**：真實瀏覽器點擊選單驗證（本次會話無 Playwright/chrome-devtools 工具可用），建議下次有瀏覽器工具時針對「台中健保時段」等原本壞掉的選單項目逐一點擊確認可正確導頁。
- [x] **後台 RWD（響應式）：側欄 off-canvas 化 + 13 個 table 頁面加橫向捲動容器 + 一處非響應式 grid 修正** — Done 2026-07-03 [design/frontend-backend.md](design/frontend-backend.md) §RWD
  - **AdminLayoutComponent**（`web-admin/src/app/layout/admin-layout.ts`）：側欄（`w-64`）在 `lg` 以下改為 off-canvas 抽屜（`fixed` + `-translate-x-full`/`translate-x-0` 切換 + 200ms transition），加半透明遮罩（點擊收合）+ 頂欄漢堡選單按鈕（`lg:hidden`）；`lg` 以上維持原本固定顯示（`lg:static lg:translate-x-0`）。路由切換（`NavigationEnd`）時自動收合手機選單，避免導頁後選單仍蓋在內容上。頂欄/Ribbon/主內容/頁尾的水平內距改 `px-4 sm:px-6`、`p-4 sm:p-6`，窄螢幕減少留白；使用者名稱與「登出」文字在 `sm` 以下收成純 icon（`hidden sm:inline`）。
  - **13 個含 `<table>` 的頁面**（8 個列表頁 `branches/doctors/categories/periods/question-types/questions/admins/members-list` + `roster-form`、`admin-form`（權限樹）、`member-questionnaire-view`、`member-questionnaires`（2 個 table））：每個 `<table>` 外加 `<div class="overflow-x-auto">` 包裹，窄螢幕橫向捲動限制在表格自身容器內，不會撐開整頁版面或把側欄推出畫面。列表頁「標題＋新增按鈕」列與分頁頁腳列補上 `flex-wrap gap-2`，避免窄螢幕擠壓變形；5 頁籤切換列（`periods-list`/`categories-list`/`rosters-list`）加 `overflow-x-auto` 允許橫向捲動（頁籤本身用底線樣式不適合換行）。
  - **`category-form.ts`**：3 個「每次一人」核取方塊原用 `grid-cols-3`（無響應式前綴），改 `grid-cols-1 sm:grid-cols-3`，比照其餘表單頁既有慣例。
  - **範圍判斷**：其餘表單頁（`branch-form`/`doctor-form`/`period-form`/`admin-form`/`member-form`/`question-form`/`question-type-form`/`member-questionnaire-form`）原本已採用 `grid-cols-1 sm:grid-cols-3` 或 `grid-cols-1 md:grid-cols-3` 慣例，逐一比對後確認無需改動；`question-form.ts` 選項標題列（短文字+短按鈕）評估後判定窄螢幕不致溢出，未動。
  - **驗證**：`ng build` 0 error；比對編譯後 `styles-*.css` 確認所有新用到的 Tailwind class（`overflow-x-auto`、`flex-wrap`、`-translate-x-full`、`translate-x-0`、`lg:translate-x-0`、`lg:static`、`lg:hidden`）皆已正確產生對應規則。**未做**：瀏覽器實機/DevTools 響應式斷點視覺驗證（本次會話無 Playwright/chrome-devtools 工具可用，僅型別檢查 + 編譯後 CSS 比對；建議下次有瀏覽器工具時針對登入頁、後台列表頁、表單頁在手機寬度各截圖驗證一次）。
- [x] **後台會員管理：列表/編輯/刪除/黑名單 + 問卷掃描檔上傳維護完整實作（真實 DB 端對端驗證）** — Done 2026-07-03 [blueprints/admin-member.md](blueprints/admin-member.md)
  - **範圍決策（使用者拍板）**：問卷維護完整比照舊系統，含掃描檔上傳/編輯/刪除（非僅唯讀檢視）。研究確認 `MemberQuestions.Filename` 欄位與 Blob `memberquestions` 資料夾白名單雖已就緒，但新系統原本完全沒有寫入路徑（`QuestionService.SubmitAsync` 寫死 `Filename=NULL`），本次補上此缺口。
  - **後端**：`MemberAdminDtos.cs`（6 個 DTO）+ `Skin.Services.Member.MemberAdminService`（Dapper，會員列表含初診判斷 + 曾就診分院批次查詢避免 N+1、編輯、刪除、問卷掃描檔 CRUD 含查重）+ `MembersAdminController`（`admin/members` 系列 9 端點，Resource 固定 `"Members"`，沿用舊系統 `MemberQAs→Members` 特殊映射）。`IFileStorage` 新增 `DeleteAsync`（換檔/刪除連動刪 Blob）。`IQuestionService.GetFormAsync` 新增 `includeDisabled` 參數供後台唯讀檢視已停用問卷類型的歷史作答（客戶前台預設行為不變）。
  - **前端**：`pages/member/`（members-list、member-form、member-questionnaires、member-questionnaire-form、member-questionnaire-view）+ `member-api.service.ts` + `lookup.service.ts`（城市/區連動，仿 web-customer 同名服務各自獨立一份）；`members-list` 依 Grid 規範補入 [design/frontend-backend.md](design/frontend-backend.md) 欄位順序/寬度/對齊/分頁對照表（第 9 頁）；路由 + `BUILT_KEYS` 加 `Members`。
  - **真實 DB 端對端實測（測試會員 `B121583140`，事後零殘留）**：列表篩選（分院/身分證號/生日，53,610 筆會員驗證）+ 分頁；編輯（黑名單/過敏史病史 CSV/地址）更新後還原；問卷掃描檔上傳（真實 Blob 讀寫）→ 編輯換檔（驗證舊 Blob 確實刪除、新 Blob 可讀）→ 刪除（DB+Blob 皆清除）→ 查重擋下重複新增；唯讀檢視已停用問卷類型的歷史數位作答（含發現並修正 `includeDisabled` 缺陷後）；授權邊界（測試管理員僅 `Members` `read+add`：GET/POST 200、PUT/DELETE 403）。`dotnet build`/`ng build` 皆 0 warning。
  - **追加修正（同日，使用者回饋「會員沒有做到刪除」）**：初版誤沿用一份**已存在但錯誤**的 blueprint 草稿敘述「不新增/刪除會員」，未核對已讀過的舊 `MemberMsController.DeleteMembers` action（該 action 確實存在，且無任何前置檢查即硬刪）。已查證 `Appointments`/`MemberQuestions` 對 `Members` 皆為 **CASCADE**，故補上 `DeleteAsync`（`MembersAdminController` DELETE `admin/members/{id}`）時**刻意加前置檢查**（有預約或問卷紀錄即擋 `MEMBER_IN_USE`），比照本系統其餘 CASCADE 風險實體的既有慣例，而非照搬舊系統的無檢查硬刪。真實 DB 驗證：① 對有歷史紀錄的會員（`B121583140`）刪除正確擋下；② 新建零紀錄的拋棄式測試會員可正常刪除且零殘留；③ 授權邊界（僅 `read+update` 權限呼叫 DELETE 正確 403）。`admin-member.md`/`frontend-backend.md`/`api-design.md` 同步更正。
  - **踩雷修復**：後台問卷清單 SQL 原用 `SELECT DISTINCT` + `ORDER BY qt.Sort`（Sort 不在 SELECT 清單）觸發 SQL Server 語法錯誤（500）；因來源即為 `QuestionTypes` 主表本無重複列，移除多餘 `DISTINCT` 修正。
  - **追加修正（同日，使用者回饋「1. 分院的下拉要參照舊程式 2. 排序要參照舊程式」）**：① `members-list` 分院篩選下拉原用既有分頁端點（含停用分院），舊 `MemberMsController.Members` 只列 `IsEnabled` 分院——真實 DB 驗證「二林．齒科」確實 `IsEnabled=false`，修正為新增 `IBranchAdminService.ListEnabledAsync`（`BranchesAdminController.List` 加 `enabledOnly` 參數，沿用同路由避免與自訂 router 的 `{id}` 路由衝突，見 `admin-member.md` 風險段落記錄的 router 限制：`RouteTable.Match` 無 literal 優先於 `{param}` 的機制）；② `member-questionnaire-form` 問卷下拉原用全域 `ORDER BY qt.Sort`，舊 `AddMemberQAs`/`EditMemberQAs` 是 `.OrderBy(CategoryID).ThenBy(Sort)`（依科別分組），已在前端補排序，未動共用後端 `QuestionTypeAdminService`（避免影響既有 `basic/question-types-list` 頁面既定行為）。`dotnet build`/`ng build` 皆通過。
  - **追加修正（同日，使用者回饋「點篩選的體驗不是很好 沒反應」）**：`members-list` 篩選按鈕原本沒有任何載入態回饋（不 disable、文字不變、表格資料在請求期間不變暗），快速的 API 回應（本機實測 ~150ms）配合零視覺提示，讓使用者誤以為點擊沒反應。修正：按鈕載入中顯示「篩選中…」+ disable + `fa-spinner fa-spin` 圖示、表格於載入中套 `opacity-50`、上一頁/下一頁按鈕同步 disable 避免競態。**本次首次動用 Playwright 實際跑瀏覽器端對端**（此前所有模組皆僅型別檢查+編譯驗證，未做真實瀏覽器互動）：啟動 `ng serve --port 4300` + `func start`（reCAPTCHA 暫時 bypass）→ 登入 → 進會員列表 → 輸入身分證號 → 點篩選 → 確認 50ms 內按鈕即顯示「篩選中…」且 disabled、~150ms 後結果正確過濾為 1 筆、全程無 console 錯誤 → 截圖存證。測畢已還原 reCAPTCHA 設定、關閉測試用 dev server。
  - **追加修正（同日，使用者回饋「維護頁的地址沒有帶入預設 這個問題要紀錄到規範」）**：`member-form` 編輯既有會員時城市/區下拉顯示空白。用 Playwright 逐時間點輪詢排除是 race condition（放 3 秒仍不會恢復；且下游 `areas()` computed 用 30 筆選項證明訊號值其實正確）後，查明真因是 **Angular 樣板指令依宣告順序執行**：同一元素「先套用自身屬性繫結（`[value]`）、才建立子節點（`@for` 的 `<option>`）」，而本頁把整段表單包在 `@if(loaded())`，`loaded.set(true)` 與 `selectedCity`/`zipcodeId` 賦非空值又在同一輪 callback 內同步發生，等同「`<select>` 第一次掛載到 DOM 那一刻，對應的 `<option>` 都還沒建出來」，賦值被瀏覽器靜默忽略且之後不會自我修正；區的巢狀連動（`areas()` 依賴 `selectedCity`）會在下一層再犯一次。修法：`setTimeout`（區再巢狀一層）把「表單掛載」與「回填既有城市/區值」拆到不同輪 render。**已記錄為通用踩雷**（非本模組特例）：[gotchas.md](gotchas.md) §動態選項 `<select>` 首次渲染即帶入既有值、[design/frontend-coding-style.md](design/frontend-coding-style.md) 核心慣例補充一條，強調任何「原生 `[value]` + async 選項 + 需預帶入既有值」的下拉都要假設有此問題，且不會被 `ng build` 或看訊號值發現，改用 Reactive Forms 也無法倖免。Playwright 端對端驗證：城市/區皆正確預選、送出後資料完整保留（`zipcodeId=112`/`city=台中市` 不變）、全程無 console 錯誤。
  - **追加修正（同日，使用者回饋「表單的設計不要太浪費空間，不然會一直往下延伸」）**：`member-form` 原本 12 個欄位逐一獨占一整列（`space-y-4` 單欄堆疊），表單過長需捲動。改為短欄位每列塞 3 欄（`grid grid-cols-1 sm:grid-cols-3 gap-4`：身分證號/手機號碼/生日、姓名/性別/血型、Email/緊急聯絡人/緊急聯絡電話）、過敏史/病史改 2 欄並排，地址（含城市/區下拉）維持獨占一列。Playwright 截圖驗證：表單高度從需捲動縮短為 535px，1280×900 視窗可完整顯示。**已記錄為通用規範**（非本頁特例）：[design/frontend-coding-style.md](design/frontend-coding-style.md) §Tailwind 新增一條，未來任何多欄位表單都應比照此 grid 密度，不逐欄堆疊；既有欄位少的表單（branch/category/period/admin/roster-form）本來就短，非本次範圍不回溯。
  - **未做**：完整瀏覽器互動實測（僅會員列表篩選流程有 Playwright 端對端覆蓋，見上方；編輯/刪除/問卷維護等其餘頁面仍只有型別檢查+編譯驗證+真實 API 端對端，未跑瀏覽器點擊操作）。
- [x] **後台列表頁欄位對齊（置中/靠左）逐頁修正 + 對齊規範定案** — Done 2026-07-03 [design/frontend-backend.md](design/frontend-backend.md) §欄位對齊規範
  - 使用者裁示：「grid 標題跟內容是否需要置中，也要紀錄到規範」。逐一重新比對 8 個舊 `.cshtml` 的 `class="text-center"` 標記（非憑印象），發現先前實作只有操作欄置中，其餘欄位全部預設靠左，與舊系統不符。
  - **判斷標準**：不是「短內容/數字置中、長文字靠左」這種啟發式，而是逐欄核對舊系統該欄是否真的有 `text-center` class；例如排班「日期」欄雖短但舊系統靠左（維持靠左）、時段「門診時段」欄是短分類文字但舊系統置中（改為置中）。
  - **修正**：`branches-list`（排序/類型/自動編號/啟用改置中，名稱維持靠左）、`categories-list`（排序/需填問卷/三個每次一人旗標改置中）、`periods-list`（排序/門診時段/起始號碼/容量改置中）、`question-types-list`（排序/狀態改置中，科別項目/問卷名稱維持靠左）、`questions-list`（排序/題型/狀態改置中）、`roster/rosters-list`（開放指定預約改置中）；`doctors-list`/`admins-list` 本來就與舊系統一致未變動。排序欄的數字輸入框連同 `td` 一起置中（非只置中文字）。
  - [design/frontend-backend.md](design/frontend-backend.md) 新增「欄位對齊規範」章節（逐頁 L/C 對照表 + 判斷標準說明，強調不可用長度/型別等啟發式規則取代逐欄核對）。
  - `ng build` 通過。**未做**：瀏覽器互動實測（僅型別檢查+編譯驗證，未實際截圖比對視覺效果）。
- [x] **後台列表頁補回分頁（分院/科別項目/管理員）+ 分頁規範定案** — Done 2026-07-03 [design/frontend-backend.md](design/frontend-backend.md) §分頁規範
  - 使用者裁示：「要有分頁，加入規範」。逐一比對舊系統發現：`Branchs.cshtml`/`Skins.cshtml`/`Cosmetics.cshtml`/`Admins.cshtml` 皆為 `ToPagedList(pageSize: 20)`，先前重寫這 3 個列表頁（分院/科別項目/管理員）時漏掉分頁（僅 `roster/rosters-list` 先前已有）；`Doctors.cshtml`/`TaPeriods.cshtml`/`QuestionTypes.cshtml`/`Questions.cshtml` 舊系統本來就沒有分頁，故對應新頁面維持不分頁。
  - **後端**：`IBranchAdminService`/`ICategoryAdminService`/`IAdminService` 的 `ListAsync` 改為分頁簽章（`page,pageSize` → `(Items, Total)` tuple，COUNT + `OFFSET/FETCH`，比照既有 `RosterAdminService` 範本）；對應 3 個 Controller 的 GET 端點回傳 `{ items, total, page, pageSize }`（pageSize 固定 20，不開放前端調整）。
  - **踩雷修復**：`CategoryAdminService.ListAsync` 分頁後，發現 `category-form.ts`（編輯回填）、`question-type-form.ts`（科別下拉）、`roster-form.ts`（科別多選）三處表單也在呼叫同一支 API 取得「全部科別」，分頁後只會拿到第一頁 20 筆導致資料缺漏。已加獨立不分頁端點 `GET admin/categories/{clinic}/all`（`ICategoryAdminService.ListAllAsync`，前端 `listAllCategories()`），三個表單改呼叫新端點，`listCategories()`（分頁版）僅供列表頁 grid 使用。
  - **前端**：`models.ts` 新增共用 `PagedResult<T>` 型別（`roster-api.service.ts` 原本自己宣告的 `RosterListResponse` 一併改用共用型別，消除重複）；`branches-list.ts`/`categories-list.ts`/`admins-list.ts` 加 `page()`/`total()` signal + 分頁頁腳 UI（`共 N 筆` + 上一頁/第 N 頁/下一頁），樣式與既有 `rosters-list.ts` 完全一致；「儲存排序」維持只送出當頁資料（與舊系統 `SortBranchs`/`SortSkins` 表單同樣只含當頁列一致，非新缺陷）。
  - [design/frontend-backend.md](design/frontend-backend.md) 新增「分頁規範」章節（逐頁是否分頁對照表 + pageSize 固定 20 + API 信封格式 + 全量端點例外規則）；同步更新 [blueprints/admin-basic-data.md](blueprints/admin-basic-data.md)、[blueprints/admin-auth-authority.md](blueprints/admin-auth-authority.md) 設計決策段落記錄此追加變更。
  - `dotnet build`（0 warning）與 `ng build` 皆通過。**未做**：瀏覽器互動實測（僅型別檢查+編譯驗證，未跑 `func start`/`ng serve` 端對端驗證分頁翻頁行為）。
- [x] **後台列表頁 Grid 欄位規範定案 + 全 8 頁操作欄改為純 icon 置中，欄位順序改回忠於舊系統** — Done 2026-07-03 [design/frontend-backend.md](design/frontend-backend.md) §列表頁 Grid 欄位規範
  - 使用者裁示：① 分院等各主檔列表頁欄位順序需一致、操作欄只需 icon 並置中，且要有規範文件供其他頁面參照；② 欄位順序需參照舊系統（第一版自訂順序不算數）。
  - **修正**：實際逐一比對 `reference/old/20SkinBackend/Views/{BasicMs,AuthorityMs,ShiftMs}/*.cshtml`，發現舊系統「排序」欄一律在**最前面**（非緊鄰操作欄），且各頁業務欄位順序需依舊 View 實際序（如 Periods 舊系統「門診時段」在「名稱」之前、Rosters「醫師」在「日期」之前）。已改寫 [design/frontend-backend.md](design/frontend-backend.md) 為逐頁對照表，取代原先自訂的通用排序規則。
  - 套用到全部 8 個既有列表頁：`authority/admins-list`、`basic/{branches,doctors,categories,periods,question-types,questions}-list`、`roster/rosters-list`（doctors/admins 因無排序欄且舊順序本已相符，未變動；其餘 6 頁重排）。操作欄仍為純 icon + 置中（`text-center`、`title` tooltip，取代原 icon+文字/靠右）。
  - **追加修正（同日）**：使用者再裁示「顯示的欄位跟內容也要參照舊系統」——補回先前遺漏的舊欄位：分院「自動編號」、科別「台中/二林/齒科每次一人」三旗標；並修正內容文字對齊舊系統（分院類型改顯示「皮膚/齒科」文字而非原始數字、啟用改「是/不啟用」、需填問卷改「需要/不需要」、問卷類型與題目「狀態」改「開啟/關閉」，取代原統一套用的「啟用/停用」樣板）。唯一刻意保留的例外：題目「題型」欄沿用系統既有術語「複選」，不改回舊系統原文字「多選」，因為 `question-form.ts` 與客戶前台問卷已一致採用「複選」（見 [gotchas.md](gotchas.md) `OptionType` 定案），改回會造成同一系統內用詞不一致。
  - [design/frontend-backend.md](design/frontend-backend.md) 表格已擴充為「欄位順序＋布林/列舉欄位顯示文字」逐頁對照，含各文字對照的具體理由。
  - **再追加修正（同日）**：使用者裁示①「舊系統沒顯示的欄位新系統也不要有」②「每個欄位設計一個合理的寬度」。移除先前新增但舊系統沒有的 2 個欄位：分院/科別項目列表的「圖片」縮圖欄（含移除 `BasicUploadService` 依賴）、問卷題目列表新增的「選項」（答案文字清單）欄。全部 8 頁每個 `<th>` 補上明確寬度 class（`w-20`/`w-24`/`w-28`/`w-32`/`w-40` 依內容長度分級，唯一主要辨識文字欄用 `w-auto` 明示為彈性欄），取代原本部分欄位無寬度、交由瀏覽器自行分配的寫法。
  - [design/frontend-backend.md](design/frontend-backend.md) 新增「欄位寬度規範」章節（寬度分級 + 逐頁對照表），並將「不新增舊系統沒有的欄位」列為明文規則。
  - `ng build` 0 error。**未做**：瀏覽器互動實測（僅型別檢查+編譯驗證）。
- [x] **修復後台登入 reCAPTCHA bug：補上真實 `RecaptchaService`（原寫死空字串 token）** — Done 2026-07-03 [design/security.md](design/security.md)
  - **成因**：`api/20Skin.Api/local.settings.json` 的 `Recaptcha:SecretKey` 已設定非空值，dev bypass 因此失效；但 `web-admin/login.ts` 仍寫死送空字串 `googleCaptchaToken`，導致 `RecaptchaVerifier` 對空 token 一律回 `false` → 後台登入必定回 `RECAPTCHA_FAILED`（使用者實測重現）。
  - **修復**：新增 `web-admin/src/app/core/services/recaptcha.service.ts`（比照客戶前台同名服務，各自獨立一份，不共用程式碼）；`login.ts` 送出前呼叫 `recaptcha.execute('login')` 取真實 token；`environment.ts` 補上 site key（沿用客戶前台同一把，dev 用 `localhost` 不受網域白名單限制）。
  - **正式環境待辦**（記錄於 [design/security.md](design/security.md)）：後台部署為獨立網域，`environment.prod.ts` 的 site key 留空，須先把後台正式網域加入該 key 在 Google reCAPTCHA 後台的允許網域清單，再填入部署，否則會被判定 domain mismatch。
  - 驗證：`ng build` 0 error。
  - **追加診斷 + 真正根因確認（2026-07-03 同日）**：使用者重測後仍回報 `RECAPTCHA_FAILED`，`RecaptchaVerifier.VerifyAsync` 補上 `ILogger` 失敗診斷後，log 顯示 `success=true score=0.3 action=login errorCodes=""`——token 完全正常，純粹是 **score 0.3 低於門檻 0.5**。查明是 Firefox 隱私/防指紋保護打亂裝置指紋訊號導致 reCAPTCHA v3 評分偏低（非程式 bug）。**決策**：正式環境門檻維持 0.5（沿用舊系統）；本機 `local.settings.json` 的 `Recaptcha:MinScore` 調降為 `0.3` 方便隱私保護瀏覽器測試。詳見 [gotchas.md](gotchas.md) §認證/reCAPTCHA、[design/security.md](design/security.md) `MinScore` 門檻段落。
- [x] **後台視覺改採企業識別品牌 token（取代初版 SmartAdmin 通用配色），全 19 個頁面套用** — Done 2026-07-03 [design/visual-design.md](design/visual-design.md) §後台視覺策略 / [design/frontend-backend.md](design/frontend-backend.md)
  - `web-admin/src/styles.css` 新增 `@theme` token（`brand`/`brand-deep`/`brand-deeper`/`brand-tint`/`ink`/`muted`/`line`/`hairline`/`surface`），取代 `teal-*`/`blue-600`/`gray-{300..900}` 通用色。
  - 已套用：`dashboard.ts`/`forbidden.ts`/`coming-soon.ts`、`authority/*`（admins-list、admin-form）、`basic/*`（branches/categories/doctors/periods/question-types/questions 各 list+form，共 12 檔）、`roster/*`（rosters-list、roster-form）；`admin-layout.ts`/`login.html` 為前一版已完成的參考範例。
  - 次要深色按鈕（「儲存排序」）改 `bg-ink hover:bg-black`；所有 input/select/textarea 統一補 `focus:ring-2 focus:ring-brand/30 focus:border-brand`；功能語意色（紅/綠/琥珀）維持不變。
  - 驗證：`ng build` 0 error，編譯後 CSS 已含全部 token class。

- [x] **客戶前台全頁面重新對齊舊系統（第三輪 audit）：5 組並行比對 11 頁 + 修復 8 項缺口 + 3 項業務決策** — Done 2026-07-02 [blueprints/customer-booking.md](blueprints/customer-booking.md) / [blueprints/questionnaire.md](blueprints/questionnaire.md) / [design/frontend-customer.md](design/frontend-customer.md)
  - **審查**：5 組 frontend-architect agent 並行重新逐行比對全部 11 個新頁面對應的 14 個舊 View（含 MainMsController/AjaxController 邏輯），非僅比對文件。
  - **業務決策（使用者拍板）**：① 醫學美容線上掛號入口比照舊系統全院隱藏（舊 `Clinic.cshtml` 該選項本已被 Razor 註解停用，新系統原本對非台中分院重新開放，已改回隱藏）；② 取消預約改為精確依看診時刻計算（`Periods.Title` 解析 + fallback，取代原「當天禁止取消」簡化版）；③ 額滿時段改回隱藏（取代原灰階顯示「餘0」）。
  - **修復（無需決策，純缺陷）**：台中分院不可預約當日規則補回、完成頁/詳情頁補「問卷填寫狀態」欄位（`AppointmentDetailDto` 新增 `isQuestion`/`questionAnswered`）、完成頁補二林分院兩則提示（新增 `branchId` 欄位）、完成頁台中皮膚科早晚診標題（`GetByIdAsync` 補 `LEFT JOIN OutpatientTimes`）、預約清單頁補分頁 UI（`total` 原本回傳但前端未用）。
  - **文件矛盾修正**：`frontend-customer.md` 對「AppointmentCancelComponent」的自相矛盾敘述（實際取消功能合併在 AppointmentDetailComponent，無獨立路由）；`questionnaire.md` 多處殘留舊版 4 值 OptionType + 檔案上傳敘述已清理為真實的 1=單選/2=複選。
  - `dotnet build`/`ng build` 皆 0 warning。**未做**：瀏覽器互動實測（僅型別檢查+編譯驗證）。
- [x] **預約表單老系統對齊 audit（兩輪）：重複預約檢查 + 時段週日/過期過濾 + 人數鎖定 + 早晚診標題** — Done 2026-07-02 [blueprints/customer-booking.md](blueprints/customer-booking.md) / [design/frontend-customer.md](design/frontend-customer.md)
  - **第一輪**：後端 `POST /api/rosters/check-availability` 與建立時的伺服器端檢查早已存在（依分院視窗天數驅動），但 `AppointmentFormComponent` 未呼叫，選日期後會直接進下一步。已補 `onDateChange()` 呼叫 `checkAvailability`，未通過則顯示錯誤（fallback 文案沿用舊系統「三日內不可重複預約」）並擋住指定醫師/選時段/送出。
  - **第二輪（重新逐行比對 `AjaxController`/`MainMsController`/`AppointmentForm.cshtml`）**：補 3 個缺口——① `GetTimeSlotsAsync` 原本只查容量，未過濾週日、已過去時段、指定醫師+自動配號分院需提前 2 天（該規則舊系統從未上線，指定醫師整體被 `1==2` 停用，新系統啟用指定醫師後一併沿用，如與業務不符可調整）；② `Categorys.IsOnly/ChIsOnly/ChDentistIsOnly`（分院限定人數=1）完全沒有暴露給客戶端，已在 `CategoryDto` 加 `IsAmountLocked`（依 `branchId` 用既有 `PeriodsOptions` 分院別名解析，非硬編碼）、`GET /api/categories` 加 `branchId` 必填參數；③ 時段標題「選擇早晚診」/「選擇時段」未依分院切換，改用資料驅動（是否有 `outpatientTimeTitle`）判斷。
  - `dotnet build`（0 warning）與 `ng build`/`tsc --noEmit` 皆通過。
  - **未做**：瀏覽器互動實測（僅型別檢查+編譯驗證，未跑 `func start`/`ng serve` 端對端）；「指定醫師 2 天前」規則正確性待業務確認（見 blueprint 附註）。
- [x] **客戶前台：登出移出 header + 補回「初診/複診」麵包屑（含後端 `isFirstVisit`）** — Done 2026-07-02 [design/frontend-customer.md](design/frontend-customer.md) / [blueprints/member-auth.md](blueprints/member-auth.md)
  - 登出改放 `IndexComponent`（`/`）的 `.title-block` 右側，不再混在 `#header .head_nav` 行銷導覽列；手機側欄登出維持原樣。
  - 補回舊系統 `Clinic.cshtml`/`Category.cshtml`/`AppointmentForm.cshtml` 的 `@ViewBag.VisitTitle`（初診/複診）麵包屑，發現後端 `LoginResult` 原本沒有此欄位（純前端 TS 型別空掛）：`AuthController` 加 `IsFirstVisit`（登入固定 false=複診；註冊依 `MemberService.RegisterAsync` 的 `IsNew`）；前端 `AuthService` 存 `localStorage`（隨 `logout()` 清除）+ `visitTitle()` computed；三個預約流程頁補回前綴。`dotnet build`/`ng build`(`tsc --noEmit`) 皆過。
  - **未做**：瀏覽器互動實測（僅型別檢查+編譯驗證，未跑 `func start`/`ng serve` 端對端）。
- [x] **後台排班管理：排班 CRUD + 重複展開 + RosterCategorys/RosterPeriods diff（真實 DB 端對端驗證）** — Done 2026-07-02 [blueprints/admin-roster.md](blueprints/admin-roster.md)
  - **舊系統研究**：直接讀 `ShiftMsController.cs`（~2089 行，號稱舊系統最複雜模組）diff 比對 5 變體確認純複製貼上；讀程式碼推翻本文件原先「編輯清空重建」的錯誤敘述，證實是真正的 diff；確認容量覆蓋語意（`RosterPeriods.Patients` 完全取代 `Periods.Patients`）與 `RosterPeriods` 涵蓋範圍不受 `Rosters.OutpatientTimeID` 篩選。
  - **後端**：`RosterAdminService`（新增含重複展開演算法：逐日/逐週查重+建立，回報 `skippedDates`；編輯以 `CategoryID`/`PeriodID` 為自然鍵 diff）+ `RostersAdminController`（`admin/rosters/{ta-skin|ta-cosmetic|ch-skin|ch-cosmetic|ch-dentist}`，5 組瘦 proxy，重用 Phase 2 的 `PeriodsOptions` 做分院別名解析）。**修正舊系統 2 個欄位遺漏 bug**：展開/編輯時正確複製 `RosterPeriods.StartNumber`（舊系統原本遺漏）。**刪除守門改更嚴格**：有任何 `Appointments.RosterID` 引用（不論狀態）即擋，取代舊系統「無有效預約就先硬刪已取消的預約再刪排班」（使用者已拍板，保留歷史取消記錄完整性）。
  - **前端**：`roster-api.service.ts`（5 變體 slug/resource-key 對照，仿 Periods）+ `pages/roster/{rosters-list,roster-form}`（列表含日期/醫師篩選+分頁；表單含動態時段容量表 + 科別多選 + 重複模式，新增時若有日期被跳過會停留顯示提示而非自動導頁）；路由 + `BUILT_KEYS` 加 5 個 Rosters key。
  - **真實 DB 實測**（測試日期 2099-01-01~04）：單一建立三表正確寫入；每日重複展開 4 天，刻意製造 1 天衝突正確跳過並回報；展開出的非首日排班 `StartNumber` 正確複製（驗證 bug 已修正）；編輯 diff（替換科別、更新+移除時段）正確；刪除守門對「僅有已取消預約引用」的排班正確擋下（驗證更嚴格政策）；**授權邊界測試**（僅 `ChRosters` 權限呼叫 `ta-skin`）正確 403；測試資料事後清除零殘留。`dotnet build`/`ng build` 皆 0 warning。
  - **未解決**：無 `RowVersion` 欄位（schema 不可改），並發編輯排班仍是後寫覆蓋，diff 寫入已縮小風險範圍但未消除。
- [x] **後台基礎資料 Phase 3：科別項目 2 變體參數化（真實 DB 端對端驗證，含 CASCADE 風險刪除守門）** — Done 2026-07-02 [blueprints/admin-basic-data.md](blueprints/admin-basic-data.md)
  - **後端**：`CategoryAdminService`（Dapper，clinic 參數化）+ `CategoriesAdminController`（`admin/categories/{skin|cosmetic}`，2 組瘦 proxy，`Resource="Skins"|"Cosmetics"`）。刪除前置檢查 `COUNT(Appointments)+COUNT(RosterCategorys)+COUNT(QuestionTypes)`——**QuestionTypes 查全表（含已軟刪 IsEnabled=false 的列）**，因為 `QuestionTypes.CategoryID→Categorys` 是 CASCADE 且 QuestionTypes 從不硬刪，任何殘留列都代表刪除會波及 Questions/QuestionAnswers/MemberQuestions（會員歷史問卷記錄）；長度驗證 Title 50 字、Intro 250 字、Photo 50 字（真實 DB 查證）。
  - **前端**：`pages/basic/{categories-list,category-form}`（2 頁籤 + 排序 + 圖片上傳 + 4 個布林旗標）；路由 + `BUILT_KEYS` 加 `Skins`/`Cosmetics`。
  - **真實 DB 實測**：CRUD+排序+長度驗證全通過；刪除守門對「青春痘特別門診」（有 3 筆 QuestionTypes，均已軟刪停用）正確擋下 `CATEGORY_IN_USE`——驗證即使子項目全部停用，CASCADE 風險仍被擋下；`categorys` 資料夾圖片上傳可讀回 200。`dotnet build`/`ng build` 皆 0 warning。
- [x] **後台基礎資料 Phase 4（最後一階段）：問卷類型 + 題目/選項 CRUD（真實 DB 端對端驗證）** — Done 2026-07-02 [blueprints/admin-basic-data.md](blueprints/admin-basic-data.md)
  - **後端**：`QuestionTypeAdminService`（軟刪 IsEnabled=false，JOIN Categorys 帶出 CategoryTitle 供前端顯示）+ `QuestionAdminService`（`ListAsync` 巢狀 Answers、`UpdateAsync` 選項 diff：送上來有既有 ID 且屬本題目→更新、現有但送上來沒有→**硬刪除**（依使用者拍板純沿用舊系統，不查 `MemberQuestionAnswers` 引用）、ID 偽造或不屬本題目→視為新增（沿用問卷讀取面「偽造 answerID 濾除」慣例））；`QuestionTypesAdminController`/`QuestionsAdminController` 皆掛 `Resource="QuestionTypes"`（真實 Lims 無獨立 Questions key）；長度驗證 QuestionTypes.Title 50 字、Questions.Title 250 字/OtherTitle 50 字、QuestionAnswers.Title 50 字（真實 DB 查證）；`OptionType` 限定 1/2（沿用問卷讀取面已確認的真實值域）。
  - **前端**：`pages/basic/{question-types-list,question-type-form,questions-list,question-form}`；`question-type-form` 的科別下拉合併 Skin+Cosmetic 兩份清單（`forkJoin`）；`question-form` 用 `FormArray` 動態增刪選項，送出時整組打包交後端 diff；路由巢狀 `basic/question-types/:questionTypeId/questions(/...)`；`BUILT_KEYS` 加 `QuestionTypes`。
  - **真實 DB 實測**（真實 DB 14 個 QuestionTypes 全 `IsEnabled=false`，未動用；改建專屬測試資料掛在真實科別「一般皮膚病」下）：QuestionType/Question CRUD 全通過；選項 diff 三情境（改名保留 ID、移除未送出的選項即硬刪、新增無 ID 選項）逐一驗證正確；偽造 `QuestionAnswerId` 正確被當新增處理（分配新 GUID，非誤更新/報錯）；`OptionType=3` 與空選項陣列皆正確擋下驗證錯誤；軟刪除驗證（Delete 後 `IsEnabled=false` 但列表仍可見，符合後台管理需求）；測試資料事後**硬刪除**歸零（`QuestionTypes` 回到 14 筆，真實科別未受影響）。`dotnet build`/`ng build` 皆 0 warning。
- [x] **後台基礎資料 Phase 2：時段 5 變體參數化 + 授權 proxy（真實 DB 端對端驗證，含授權邊界測試）** — Done 2026-07-02 [blueprints/admin-basic-data.md](blueprints/admin-basic-data.md)
  - **關鍵架構決策**：Service 完全參數化（`branchId`+`clinic`），消除舊 5 變體業務邏輯複製；但真實 `Lims` 權限仍是變體粒度、router `[Authorize(Resource,Op)]` 是啟動時綁死在單一 method 的靜態屬性，故 Controller 保留 5 組「瘦」proxy action（`PeriodsAdminController`：`admin/periods/{ta-skin|ta-cosmetic|ch-skin|ch-cosmetic|ch-dentist}`），各自解析分院別名後轉呼叫共用 `IPeriodAdminService`。
  - **後端**：`PeriodsOptions`（`Ta`/`Ch`/`ChDentist` 別名→實際 BranchID，設定驅動，仿 `BookingOptions`，GUID 不進原始碼）+ `PeriodAdminService`（Dapper，含 `ListOutpatientTimesAsync` 字典查詢）；刪除前置檢查 `COUNT(Appointments)+COUNT(RosterPeriods)`；`Periods.Title` 長度驗證（50 字，nvarchar(100) bytes）。
  - **修正既有 bug**：`menu-route-map.ts` 原本把 `ChDentistPeriods`/`ChDentistRosters`/`ChDentistAppointments` 誤植為 `branch=ch`——真實 DB 查證「二林．齒科」（`BAAAF928…`）與「二林．四季」（`C59D0277…`）是**不同分院**，非「ch 分院的齒科診別」；已改用獨立別名 `chDentist` 並同步修正三處路由（Rosters/Appointments 尚未建頁，先修正供未來 Phase 對齊）。
  - **前端**：`BasicDataApiService` 擴充 `periodSlug`/`periodResourceKey` 對照表；`PeriodsListComponent`（5 頁籤切換 + 排序）+ `PeriodFormComponent`（`?branch=&clinic=` 決定呼叫哪組 API）；路由不掛靜態 `data.perm`（資源 key 動態決定，前端僅登入檢查，授權真相在 API）；`BUILT_KEYS` 加 5 個 Periods key。
  - **真實 DB 實測**：CRUD+排序+長度驗證全通過；刪除守門（真實有 23,989 筆預約的時段）正確擋下 `PERIOD_IN_USE`；**授權邊界測試**（僅 `ChPeriods` 權限的測試管理員呼叫 `ta-skin` 端點）讀/寫皆正確回 403，驗證變體 proxy 架構如預期運作；測試管理員與測試資料事後清除零殘留。`dotnet build`/`ng build` 皆 0 warning。
- [x] **後台基礎資料 Phase 1：分院 + 醫師 CRUD + 排序（真實 DB 端對端驗證）** — Done 2026-07-02 [blueprints/admin-basic-data.md](blueprints/admin-basic-data.md)
  - **後端**：`Skin.Core/Dtos/BasicDataDtos.cs`（Branch/Doctor DTO + SortItem/SortRequest）+ `Skin.Services/BasicData/{Branch,Doctor}AdminService`（Dapper CRUD，交易式排序）+ `BranchesAdminController`/`DoctorsAdminController`（`admin/branches`、`admin/doctors`，`admin/` 前綴避開客戶前台既有 Member 端點路由）。刪除前置檢查改正確 `COUNT(...)==0`（修正舊系統死碼 bug）：分院查 Appointments+Rosters+Periods、醫師查 Appointments+Rosters。
  - **`UploadsController` 授權開放**：`[Authorize(Roles.Member)]` → `[Authorize]`（只要求已登入），後台上傳分院圖片可用；`StorageOptions.AllowedFolders` 白名單把關（依使用者拍板方案 A）。
  - **前端**：`BasicDataApiService`/`BasicUploadService` + `pages/basic/{branches-list,branch-form,doctors-list,doctor-form}`；分院排序沿用舊做法（每列數字輸入框+整批儲存）；路由 + `BUILT_KEYS` 加 `Branchs`/`Doctors`；`web-admin` 環境設定補 `uploadBase`。
  - **踩雷修復**：`Doctors.Name` 真實 DB 是 `nvarchar(30)`=15 字（非欄位命名暗示的更長），原本沒做長度驗證，測試時觸發 SQL truncation 例外→500；已加 `ValidateName` 長度檢查（15 字）改回友善 `BusinessException`；同步替 `Branchs.Title`/`Photo`（皆 `nvarchar(100)`=50 字）加長度驗證，避免同類問題。過程中誤刪一位真實醫師（劉柏亨，因其恰好無關聯資料，刪除守門判斷正確但測試選材不當）→ 已用原始 DoctorID+姓名復原，零殘留。
  - **真實 DB 實測**：分院/醫師 CRUD+排序全通過；分院刪除守門（台中院有預約/排班/時段）正確擋下 `BRANCH_IN_USE`；醫師刪除守門（施百潤有 3 筆預約）正確擋下 `DOCTOR_IN_USE`；圖片上傳到 Blob（Admin token）可讀回 200；未登入/假 token 皆 401。`dotnet build`/`ng build` 皆 0 warning 通過。
  - **未做**：瀏覽器互動點擊驗證（無 chrome-devtools/Playwright 可用，僅驗證 `ng build` + SPA 路由 200 回應，後續建議補）。
- [x] **Serilog 結構化 log 接上（API）** — Done 2026-07-02 [design/infrastructure.md](design/infrastructure.md)
  - `Program.cs`：`AddSerilog` 寫 Console + `CompactJsonFormatter`（JSON lines，機器可解析）；取代原 TODO。
  - `ApiRouterFunction`：每請求以 `LogContext.PushProperty("TraceId", req.HttpContext.TraceIdentifier)` 包覆，統一輸出 `HTTP {Method} {Path} -> {StatusCode} ({ElapsedMs}ms)` 摘要 log（原 `Dispatch` 內部邏輯不變，只加外層包裝）。
  - 範圍決策：本次**只做 Serilog**；App Insights sink 與 Key Vault 因依賴尚不存在的 Azure 資源/CI-CD，留待 P2 部署階段一起做（見上方 P0 backlog）。
  - **驗證**：本機 `func start`（Azurite 起）→ `curl /api/health`（200）與不存在路徑（404）→ log 檔確認皆為結構化 JSON，含 `TraceId`/`Method`/`Path`/`StatusCode`/`ElapsedMs`。`dotnet build` 0 warning。
- [x] **客戶預約照片上傳（Azure Blob）完成 — 真實 Blob/DB 端對端 + 前端 Playwright 驗證** — Done 2026-07-01 [blueprints/file-upload.md](blueprints/file-upload.md)
  - **後端**：`Skin.Services/Storage`（`IFileStorage`/`BlobFileStorage`/`StorageOptions`）+ `POST /api/uploads`（需登入，multipart）。連線字串**統一用 `AzureWebJobsStorage`**；容器 `upload` 下用**舊資料夾名**（appointments/branchs/categorys/memberquestions，方便整包搬遷）；目錄白名單（擋路徑穿越）+ 型別/大小驗證 + GUID 檔名 + public-blob 容器。`Appointments.Photo` 沿用只存檔名；`AppointmentDetailDto` 加回 Photo；router 可注入 `HttpRequest` 讀 multipart。
  - **前端**：`UploadService` + `appointment-form` 檔案選擇/預覽/移除；`complete`/`appointment-detail` 顯示照片；`environment.uploadBase`。
  - **踩雷修復**：`Azure.Storage.Blobs 12.29.1` 預設 service 版本 Azurite 3.35 不支援（500）→ 釘 `ServiceVersion.V2025_11_05`（正式 Azure 安全；本機不需特殊旗標）。見 [gotchas.md](gotchas.md)。
  - **驗證**：API（上傳→blob 公開 GET image/png→INVALID_TYPE/INVALID_FOLDER/401→建預約帶 photo→詳情回 photo→硬刪+刪 blob 零殘留）＋ Playwright 前端 14/14（選檔→預覽→送出→完成頁顯示圖）。`dotnet build` 0 warn、`ng build` 通過。
  - **未做**：後台分院/項目圖上傳；問卷檔案題型（無資料）；刪除端點。
  - **歷史檔案搬遷 ✅ 已完成（使用者確認 2026-07-04）**：舊 `~/Upload/{appointments,branchs,categorys,memberquestions}` 已 azcopy `--recursive` 整包搬進 `st20skinprod` 的 `upload` 容器（子路徑 1:1，DB 只存檔名故無需改）。詳見 [blueprints/file-upload.md](blueprints/file-upload.md) §歷史檔案搬遷與正式機驗證。
  - **正式機上傳/顯示驗證（部分）**：`GET /api/health` 200、受保護端點 401＝符合設計、兩前台 `environment.prod.ts` `uploadBase`/`apiBase` 正確且部署 JS 已無 localhost。**尚待實跑**（需瀏覽器＋真會員）：① login→上傳→顯示 click-path；② 抽既有檔名 GET Blob 確認 200+image（驗證搬遷檔可顯示、舊記錄不破圖）。
- [x] **客戶前台指定醫師流程完成 + 修 router async BusinessException→500 bug — 真實 DB 驗證** — Done 2026-07-01 [blueprints/customer-booking.md](blueprints/customer-booking.md)
  - **後端**：`GetTimeSlotsAsync` 加選用 `doctorId`（null→不指定 IsAppointment=0；有值→該醫師 IsAppointment=1）；`GET /api/rosters` 加 `doctorId` 參數。`POST /api/appointments` 早已支援指定醫師（roster 依 IsAppointment+DoctorID 解析）。
  - **router bug 修復**：async action 拋 `BusinessException`（FULL/DUPLICATE/NO_ROSTER/問卷 NOT_FOUND…）原誤回 HTTP 500 → 加 `catch (BusinessException)` 回 200 Fail（見 [gotchas.md](gotchas.md)）。
  - **前端**：`appointment-form` 加「不指定／指定」切換 → 指定則載入醫師清單 → 選醫師載入該醫師時段 → 送出帶 `doctorId`+`isAppointment=true`。
  - **真實 DB 實測**（施百潤 2022-03-18 指定排班）：醫師清單、指定 vs 不指定時段差異、FULL 回 200、暫解容量後建立成功（DoctorID＝該醫師、RosterID＝該 IsAppointment=1 排班、自動門診號）、硬刪＋還原容量零殘留。`dotnet build` 0 warn、`ng build` 通過。
- [x] **客戶前台初診註冊（JoinUs）完成 — 真實 DB 端對端驗證 + 硬刪零殘留** — Done 2026-07-01 [blueprints/member-auth.md](blueprints/member-auth.md)
  - **後端**：`MemberService.RegisterAsync`（Dapper INSERT）+ `POST /api/auth/member/register`（reCAPTCHA→ 身分證/手機/生日格式驗證→ 查無則建檔→ 簽 JWT 直接登入態）；`GET /api/zipcodes`（公開，城市→區→ZipcodeID）+ `LookupController`。身分證+生日已存在 → 回既有不重複建檔（沿用舊 JoinUs）；身分證轉大寫；Allergy/MedicalHistory 多選存 CSV；Createdate 台灣時間。
  - **前端**：`JoinUsComponent`（`/join-us`，公開路由）Reactive Forms（姓名/身分證/手機/民國年生日/性別/血型/email/緊急聯絡人）+ signals（城市→區連動、過敏史/病史多選＋「其他」自填）；`LookupService`；`AuthService.register`；登入查無會員時帶身分證+生日導入；舊 `/MainMs/JoinUs` redirect 到 `/join-us`。
  - **真實 DB 實測**（測試身分證 `Z199999990` 建檔 → 驗欄位/CSV/大寫/ZipcodeID → `/auth/me` → 同證登入 status 1 → 重複註冊不產 dup → 格式負向 INVALID_NUMBER/MOBILE/BIRTHDAY → 硬刪零殘留）全通過；`dotnet build` 0 warn、`ng build` 通過。
  - **未做**：登入 rate-limit；refresh token（待 schema）。（reCAPTCHA 前端 token 已於 2026-07-01 補上，見上方 reCAPTCHA 項）
- [x] **客戶前台問卷（術前電子病歷）完成 — 真實 DB 端對端驗證 + 零殘留** — Done 2026-07-01 [blueprints/questionnaire.md](blueprints/questionnaire.md)
  - **後端**：5 POCO + `QuestionService`（Dapper）+ `QuestionsController` 3 端點：`GET /api/question-types?clinic=&categoryId=`（清單+已答旗標）、`GET /api/question-types/{id}`（題目+選項+pre-fill）、`POST /api/member-questions`（交易內作答）。
  - **前端**：`QuestionnaireListComponent`（`/questionnaire`）+ `QuestionnaireComponent`（`/booking/questionnaire`，動態題型 radio/checkbox/其他）+ `QuestionnaireService` + store `setQuestionTypeId`；`category` 的 `IsQuestion` 改導問卷清單（全數作答才可回預約）；舊 `/MainMs/Questions*` redirect 到 `/questionnaire`。
  - **關鍵事實修正**：真實 DB `Questions.OptionType` **只有 1=單選/2=複選**（無文字/檔案）→ 問卷**不依賴檔案上傳**；`QuestionOptionType` enum 已改 `Single=1/Multiple=2`（見 [gotchas.md](gotchas.md)）。
  - **重填語義決策**：提交交易內先刪該會員此問卷舊作答再寫入（可重填/pre-fill 正確/冪等），改良舊「只新增不覆蓋」（歷史 5 萬筆重複）。
  - **真實 DB 實測**（青春痘門診暫啟用 3 問卷 → 測 → 還原）：登入取真 token → 清單/已答旗標、radio+checkbox 作答、「其他」自填寫入、pre-fill、**偽造 answerID 被濾除（0 落庫）**、未登入 401、不存在 NOT_FOUND 全通過；還原後 flags/member 列/`MemberQuestionID` 集合完全一致，**零殘留**。`dotnet build` 0 warn、`ng build` 通過。
  - **未做**：`OptionType 3=檔案`（真實資料不存在，不實作）；後台問卷編輯（admin-basic-data）。
  - 本機驗證：API `func start`(:7071, Azurite)；前端 `ng serve`(:4200)。
- [x] **後台地基 + 權限管理模組（真實 DB 端對端驗證）** — Done 2026-07-01 [blueprints/admin-auth-authority.md](blueprints/admin-auth-authority.md)
  - **地基**：管理員登入 `POST /api/auth/admin/login`（reCAPTCHA→超管設定比對 or `Admins` 明碼比對→攤平 `perms`→簽 JWT 帶 `is_super_admin`+`perms`）。
  - **資料驅動左側選單（忠於舊做法）**：`GET /api/admin/menu` 讀 `Lims`+`AdminLims` 回過濾後二層樹；前端 `admin-layout` 以 Tailwind 重現 SmartAdmin（深色側欄 + fa 圖示 + Ribbon 麵包屑 + 頂欄/頁尾），葉節點以 `menu-route-map`（Lims.Key→路由）導向；未建模組導 `/coming-soon`（選單仍完整顯示，像舊系統）。
  - **權限管理**：`AdminController`（`GET/POST/PUT/DELETE admins`、`GET lims`、`GET admin/check-username`）；前端 `admins-list`（依 `can` 顯示新增/編輯/刪除）+ `admin-form`（帳密/姓名 + 權限樹：模組→子功能 × IsAdd/IsUpdate/IsDelete + 整列/整模組全選）。`AdminService`(Dapper) + `AuthorizationDomain`（攤平/選單樹/權限樹）。
  - **API 逐操作授權**：`[Authorize(Resource,Op)]` + router 比對 JWT `perms`（超管 `is_super_admin` 放行），取代舊 `CheckSession` 字串 Contains。
  - **超管去硬編碼**：`weypro` 改設定驅動（`SuperAdmin:Username/Password`，local.settings，不入原始碼）。密碼沿用明碼比對（schema 不可改，雜湊待核准）。
  - **真實 DB 實測（零殘留）**：超管登入→選單顯示 5 模組（BasicMs/ShiftMs/MemberMs/ReserveMs/AuthorityMs，圖示 fa-cogs/calendar/list/hospital-o/key，實資料）；建立限權管理員（Admins 只給 add）→ 以其登入 perms 正確 + 選單只剩「權限管理/Admins」；授權 `GET 200 / PUT 403 / DELETE 403`；帳號唯一性；超管刪除後 `exists=false` 清乾淨。`dotnet build` 0 warn、`ng build` 通過。
  - **未做/後續**：basic/roster/reserve/member 4 模組（選單可見導 `/coming-soon`）；rate-limit / 帳號鎖定；JWT perms 過大時改 `/me` 補細項。reCAPTCHA 前端 token 已於 2026-07-03 補上（見上方 Recently Done）。
  - 本機：API `func start`(:7071)；web-admin `ng serve --port 4300`（避與客戶前台 :4200 衝突；CORS 已加 :4300）。超管帳號 `weypro`/`weypro12ab`（於 local.settings）。
- [x] **舊 `/MainMs/*` URL 後方相容 redirect（客戶前台）** — Done 2026-07-01
  - 需求：舊系統登入頁是 `/MainMs/Login`，怕使用者用舊書籤連不到新登入頁。
  - `app.routes.ts` 新增 `legacyRoutes`：所有舊 `/MainMs/*` redirect 到新 SPA 對應路由；帶 `?AppointmentID=` 的舊頁面以函式型 redirect 轉成新 `:id` 路徑；未重建頁面（JoinUs/問卷）導向最接近入口。
  - `ng build` 通過。**正式部署待辦**：SWA `staticwebapp.config.json` 需設 `navigationFallback`→index.html，`/MainMs/*` 深層路徑才會交給 SPA（歸 P2 CI/CD）。
  - 記錄於 [design/frontend-customer.md](design/frontend-customer.md) §舊 URL 後方相容。
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
