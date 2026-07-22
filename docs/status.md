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
last_updated: 2026-07-22T10:00+08:00
---

> 本檔由 Claude **自動維護**。任務開始/完成/卡住都必須更新。詳細規則見 [../CLAUDE.md](../CLAUDE.md) 「狀態追蹤規則」。
> **目前階段：核心功能實作中**。已完成 = 舊系統分析歸檔 → 新系統設計文件 → 三專案骨架 → **會員認證** → **客戶預約（讀+寫，真實 DB 驗證）** → **客戶 SPA 前端串接 API（登入→預約→查詢/取消）** → **後台地基 + 權限管理（資料驅動選單 + Admins CRUD，真實 DB 驗證）** → **客戶前台問卷（術前病歷，動態題型 + 重填語義，真實 DB 驗證）** → **初診註冊 JoinUs（城市區連動 + 過敏/病史 CSV + 註冊即登入）** → **指定醫師流程（+ 修 router 500 bug）** → **預約照片上傳（Azure Blob）** → **reCAPTCHA v3 前端（動態載入 + 登入/註冊送 token，mock 驗證）** → **Serilog 結構化 log** → **後台基礎資料全數完成（分院/醫師/時段/科別項目/問卷主檔，4 Phase）** → **後台排班管理（重複展開 + diff 編輯，真實 DB 驗證）** → **後台會員管理（列表/編輯/黑名單 + 問卷掃描檔上傳維護，真實 DB 驗證）** → **後台預約管理（3 組變體 + 容量表 + Excel/問卷列印 + 後端真實 DB 驗證 + 前端頁面完整實作，後台六模組全數完成）** → **正式環境首次上線（`rg-20skin-prod`，三個可部署單元皆已透過 CI/CD 成功部署並驗證存活：客戶前台/後台 SWA 200、API 401=符合設計）** → **後台儀表板（權限過濾統計 + 未來 7 天趨勢，真實 DB + Playwright 驗證）＋後台登入效期改 10 小時**。
> 連線：本機 `(local)` `20Skin` 已可用，連線字串在 `api/20Skin.Api/local.settings.json`（gitignore 排除）。測試會員：`B121583140` / `1978-02-01`。**簡訊一律 no-op（`DevNoOpSmsSender`），測試不真發**。
> 本機啟動：API `cd api/20Skin.Api && func start`（:7071，需 Azurite）；前端 `cd web-customer && npx ng serve`（:4200）。CORS 已允許 :4200（`local.settings.json` Host.CORS）；`environment.apiBase` = `http://localhost:7071/api`。

## 🔄 In Progress

> 一次最多 3–5 項

（目前無）

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
- [x] **後台儀表板** ✅ Done 2026-07-04（權限過濾統計 + 未來 7 天趨勢，真實 DB + Playwright 驗證，見 Recently Done） [blueprints/admin-dashboard.md](blueprints/admin-dashboard.md)

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

- [x] **後台時段/排班「配號 vs 現場取號」模式明確化（時段表單模式感知＋清單分組＋排班容量表分組 SOP）** — Done 2026-07-22 [design/frontend-backend.md](design/frontend-backend.md) §時段/排班模式感知呈現、[blueprints/customer-booking.md](blueprints/customer-booking.md)
  - **緣起**：使用者反映「台中健保時段維護，舊系統只需選『時間』很清楚，現在又有時間又有時段，意義不同、分不清」。查證確認底層兩欄語意與中文直覺相反（「時間」=診次 OutpatientTimeID、「時段」=HH:MM Title），且客戶每次只看到其中一個，由隱性開關「起始編號」決定（配號 vs 現場取號，同 `BookingService.numbered`）。二林模式上線後兩欄同時有意義才浮現混淆。經 AskUserQuestion 拍板「表單改模式感知二選一」「清單分組」「排班容量表分組＋SOP 提醒」，**刻意偏離「忠於舊系統用詞」**（使用者同意）。
  - **共用端點**：`GET admin/periods/branch-meta?branch={ta|ch|chDentist}` → `{ isAutoRowNumber }`（`PeriodsAdminController.BranchMeta` + `PeriodAdminService.GetBranchIsAutoRowNumberAsync`，授權沿用 `Branchs.read`）。資料驅動、不硬編碼 `branch==='ta'`；獨立端點以涵蓋「新增且變體 0 筆時段」情境。前端 `getPeriodBranchMeta` + model `PeriodBranchMeta`。**upsert 完全不動**。
  - **前端三改**：①`period-form.ts` 模式感知（頂部「配號／一般時段」單選，二林鎖死一般；依模式顯示/淡化欄位、動態 Validators 鎖 startNumber、即時預覽「客戶會看到」）；②`periods-list.ts` 分「配號時段／現場取號時段」兩區（空區不列、二林單區省小標題）；③`roster-form.ts` 容量表分組＋⚠️「一般/二林項目分開排班」警語，**順帶修 bug**：新增排班「起始號碼」欄原恆顯示 `—`，改顯示 Periods 模板值（新增 display-only `templateStartNumber`），**送出的 `RosterPeriods.StartNumber` 寫入語意完全不變**（新增送 null、編輯送既有值），避免誤啟用休眠的覆寫能力。
  - **驗證**：`dotnet build`／`ng build` 0 error、`tsc --noEmit` 乾淨、新 Tailwind class 比對編譯後 CSS 確認產生。真實 DB 端對端（func + azurite + 超管登入）：`branch-meta` 未帶 token 401、`ta`→`true`／`ch`／`chDentist`→`false`；建立台中健保現場取號細時段（StartNumber=null）→ 清單正確分「配號 [09:00,17:00]／現場取號 [10:00]」兩區 → 硬刪剩 2 筆零殘留。**未做**：三頁瀏覽器互動實測（模式切換動態欄位、分組視覺、排班警語渲染），本次會話未跑 Playwright，建議下次補。
  - **追加：混掛防呆（前後端雙層）** — 使用者追問「配號＋現場取號人數都填會怎樣」。查證：資料不會壞（各自獨立可訂、容量/門診號以 PeriodID 為鍵互不干擾），但客戶端會把早/晚診與細時段按鈕交錯混排、語意混亂（`appointment-form` 的 `periodSectionTitle` 是 `some()` 判斷＋扁平迴圈無分組）。裁示「介面分流＋說明簡單明白＋後端也要檢查」。**後端** `RosterAdminService.ValidateModeNotMixedAsync`（Create+Update，僅自動配號分院；以 `Periods.StartNumber` 模板值判模式，非送出的 rp 值）：混填配號＋現場取號人數 → `ROSTER_MODE_MIXED` 拒絕。**前端** roster-form 簡化警語（「一張排班只能填一種」）＋送出前擋下不打 API。客戶前台不動（硬擋後無混掛資料）。真實 DB 端對端：混掛 create/update 皆拒絕、只填一種成功、二林不受影響、測試資料硬刪零殘留。
- [x] **後台儀表板（Dashboard）：權限過濾統計 + 未來 7 天趨勢，取代舊空殼首頁** — Done 2026-07-04 [blueprints/admin-dashboard.md](blueprints/admin-dashboard.md)
  - **緣起**：使用者需求「依照系統性質，設計 Dashboard」。查證舊 `20SkinBackend/Views/Main/Index.cshtml` 為空殼 widget（只有標題），故為新系統新增功能，依診所預約管理性質設計。
  - **後端**：`GET admin/dashboard`（`DashboardAdminController` + `Skin.Services.Dashboard.DashboardAdminService`，Dapper 彙總）——單一端點 `[Authorize(Roles.Admin)]`，**回應區塊依可讀權限過濾**（新增 `RequestContext.CanRead(resource)`，read 語意與 router `HasPermission` 一致）：分院當日統計（有效/初診/已取消 + 診別分解，對應 `TaAppointments`/`ChAppointments`/`ChDentistAppointments`）、未來 7 天趨勢（僅 Status=1）、會員統計（總數/今日新增/本月新增/黑名單，需 `Members`）。統計口徑刻意同預約列表頁（初診=該會員 Status=1 總數≤1 動態計算）。分院別名未設定時防禦性略過（不像逐分院端點丟例外）。
  - **前端**：`dashboard.ts` 改寫（原佔位）＋ `dashboard-api.service.ts` ＋ models 5 介面。會員 4 卡 → 分院 3 卡（含「預約維護」快速連結帶 queryParams）→ 7 天水平堆疊長條（純 Tailwind div 不引入圖表函式庫；系列色固定順序 ta=#00538d/ch=#d97706/chDentist=#059669，通過 dataviz 調色盤驗證）。全無權限顯示引導文字。
  - **踩雷**：`SUM(CASE WHEN (子查詢)…)` 觸發 SQL Server Error 130（彙總函式內不可含子查詢），改衍生表逐列算 CASE 再 SUM。
  - **驗證（真實 DB + 瀏覽器端對端）**：超管見 3 分院+會員區塊（台中今日 29/初診 11/取消 8，與預約列表 total 37=29+8 交叉核對一致）；建拋棄式測試管理員（僅 `TaAppointments`）驗證只回 ta、members=null、trend 只含 ta，測畢刪除零殘留；會員 token 403/匿名 401；Playwright 登入→首頁渲染桌面+手機截圖、無 console 錯誤；`dotnet build`/`ng build` 0 warning 0 error、新 Tailwind class 比對編譯後 CSS 確認產生。
- [x] **後台登入 JWT 效期延長為 10 小時（會員維持 60 分鐘）** — Done 2026-07-04 [design/security.md](design/security.md) §token 效期
  - `JwtOptions.AdminAccessTokenMinutes`（`Jwt:AdminAccessTokenMinutes`，預設 600）+ `JwtTokenService.CreateToken(claims, lifetimeMinutes)` 覆寫參數，僅 `CreateAdminToken` 傳入；會員簽發路徑不變。`local.settings.json` 與 `infra/modules/function-app.bicep`（`Jwt__AdminAccessTokenMinutes: '600'`）已同步。
  - Why：櫃檯整天作業，60 分鐘會在工作中途被登出打斷；schema 不可加 refresh token 表，拉長效期為務實解（見 security.md 取捨）。
  - 實測：後台登入 token exp=600.0 分鐘、會員=60.0 分鐘（解碼 JWT 驗證）。
- [x] **台中特定診療項目「二林模式」＋配號時段概念** — Done 2026-07-04 [blueprints/customer-booking.md](blueprints/customer-booking.md) §台中特定診療項目二林模式
  - 使用者拍板三決策：①判定資料驅動（配號時段＝`IsAutoRowNumber` 分院＋時段 `StartNumber` 有值，無設定清單）；②「不可當日」「±2 天重複」維持台中分院層級不變；③後台 TaPeriods 解除「新增時段」按鈕隱藏（業務性偏離舊系統）
  - 程式：`GetTimeSlotsAsync` 非配號時段回 null `outpatientTimeTitle`、`CreateAsync` 配號條件收斂（移除 `?? 2`）、`GetByIdAsync` PeriodTitle 改 CASE＋補 JOIN RosterPeriods、`periods-list.ts` 解隱藏、`period-form.ts` 起始編號提示改為配號開關語意；客戶前台零改動
  - **順帶修 2 個既有 bug**：①二林誤顯示「選擇早晚診」與早/午/晚按鈕（二林 Periods 其實全綁 OutpatientTimes，「有無綁定」判斷是錯誤假設，見 [gotchas.md](gotchas.md)）；②詳情/完成頁 API 自 2026-07-02 起 500（`COALESCE(c.IsQuestion,0)` int vs bool record 建構子，補 `CAST AS BIT`）
  - 驗證：真實 DB 端到端（二林回歸/台中回歸/台中細時段建約不配號＋簡訊「請至現場取號」＋項目分流互不可見），測試資料硬刪零殘留
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
## 🗄 Archive


> 以下為 Recently Done 歸檔摘要（依日期新→舊；詳情見各 blueprint / design doc / git log）：

- 修復後台選單「點擊沒反應」：`LIMS_ROUTE_MAP` path/query 混成單一字串餵 `[routerLink]` 永遠匹配不到路由（2026-07-03）→ [gotchas.md](gotchas.md)
- 後台 RWD：側欄 off-canvas + 13 個 table 頁橫向捲動容器（2026-07-03）→ [design/frontend-backend.md](design/frontend-backend.md) §RWD
- 後台會員管理：列表/編輯/刪除/黑名單 + 問卷掃描檔維護，真實 DB 驗證；含 4 輪使用者回饋追加修正（分院下拉/排序/篩選載入態/表單 grid 密度）與 `<select>` 動態選項預帶值踩雷（2026-07-03）→ [blueprints/admin-member.md](blueprints/admin-member.md)、[gotchas.md](gotchas.md)
- 後台列表頁欄位對齊（置中/靠左）逐頁修正 + 對齊規範定案（2026-07-03）→ [design/frontend-backend.md](design/frontend-backend.md) §欄位對齊規範
- 後台列表頁補回分頁（分院/科別/管理員，pageSize 20）+ 分頁規範定案 + 全量端點 `/all` 踩雷修復（2026-07-03）→ [design/frontend-backend.md](design/frontend-backend.md) §分頁規範
- 後台列表 Grid 欄位規範定案：欄位順序/顯示欄位/文字忠於舊系統、操作欄純 icon 置中、逐欄寬度分級（2026-07-03）→ [design/frontend-backend.md](design/frontend-backend.md) §列表頁 Grid 欄位規範
- 修復後台登入 reCAPTCHA bug（原寫死空 token）+ 查明 Firefox 隱私保護壓低 score、MinScore dev 調 0.3/正式維持 0.5 決策（2026-07-03）→ [design/security.md](design/security.md)、[gotchas.md](gotchas.md)
- 後台視覺改採企業識別品牌 token（取代 SmartAdmin 通用配色），19 頁套用（2026-07-03）→ [design/visual-design.md](design/visual-design.md) §後台視覺策略
- 客戶前台第三輪 audit：5 組並行比對 11 頁、修復 8 缺口 + 3 業務決策（美容入口隱藏/取消依看診時刻/額滿隱藏）（2026-07-02）→ [blueprints/customer-booking.md](blueprints/customer-booking.md)
- 預約表單老系統對齊 audit 兩輪：重複預約檢查前端接上、時段週日/過期過濾、人數鎖定、早晚診標題資料驅動（2026-07-02）→ [blueprints/customer-booking.md](blueprints/customer-booking.md)
- 客戶前台登出移出 header + 補回「初診/複診」麵包屑（後端 `isFirstVisit`）（2026-07-02）→ [design/frontend-customer.md](design/frontend-customer.md)
- 後台排班管理：CRUD + 重複展開 + RosterCategorys/RosterPeriods diff，修舊系統 `StartNumber` 遺漏 bug、刪除守門更嚴格，真實 DB 驗證（2026-07-02）→ [blueprints/admin-roster.md](blueprints/admin-roster.md)
- 後台基礎資料 Phase 4：問卷類型 + 題目/選項 CRUD（選項 diff 三情境、軟刪），真實 DB 驗證（2026-07-02）→ [blueprints/admin-basic-data.md](blueprints/admin-basic-data.md)
- 後台基礎資料 Phase 3：科別項目 2 變體參數化 + CASCADE 刪除守門，真實 DB 驗證（2026-07-02）→ [blueprints/admin-basic-data.md](blueprints/admin-basic-data.md)
- 後台基礎資料 Phase 2：時段 5 變體參數化 + 授權 proxy + 修 `chDentist` 分院別名誤植，真實 DB 驗證含授權邊界（2026-07-02）→ [blueprints/admin-basic-data.md](blueprints/admin-basic-data.md)
- 後台基礎資料 Phase 1：分院 + 醫師 CRUD + 排序 + 上傳授權開放，真實 DB 驗證；`Doctors.Name` 長度踩雷（2026-07-02）→ [blueprints/admin-basic-data.md](blueprints/admin-basic-data.md)
- Serilog 結構化 log（Console JSON lines + TraceId；App Insights sink 留待部署階段）（2026-07-02）→ [design/infrastructure.md](design/infrastructure.md)
- 客戶預約照片上傳（Azure Blob）+ Azurite 版本釘選踩雷；歷史檔案搬遷已完成（2026-07-04 使用者確認），正式機 click-path 驗證尚待實跑（2026-07-01）→ [blueprints/file-upload.md](blueprints/file-upload.md)
- 客戶前台指定醫師流程 + 修 router async `BusinessException`→500 bug（2026-07-01）→ [blueprints/customer-booking.md](blueprints/customer-booking.md)、[gotchas.md](gotchas.md)
- 客戶前台初診註冊 JoinUs（城市區連動 + 過敏/病史 CSV + 註冊即登入），真實 DB 驗證（2026-07-01）→ [blueprints/member-auth.md](blueprints/member-auth.md)
- 客戶前台問卷（術前病歷，動態題型 + 重填語義；`OptionType` 實為 1=單選/2=複選），真實 DB 驗證（2026-07-01）→ [blueprints/questionnaire.md](blueprints/questionnaire.md)
- 後台地基 + 權限管理：管理員登入/資料驅動選單/Admins CRUD + 權限樹/逐操作授權/超管去硬編碼，真實 DB 驗證（2026-07-01）→ [blueprints/admin-auth-authority.md](blueprints/admin-auth-authority.md)
- 舊 `/MainMs/*` URL 後方相容 redirect（客戶前台）（2026-07-01）→ [design/frontend-customer.md](design/frontend-customer.md) §舊 URL 後方相容
- 客戶前台視覺改直接套用舊 `main.css`（移除 Tailwind，template 還原舊標記；取代同日 Tailwind 重建版）（2026-06-30）→ [design/visual-design.md](design/visual-design.md)
- 客戶前台 SPA 串接 API：8 頁 + 2 service + interceptor/guard/store，登入→預約→查詢/取消全流程（2026-06-30）→ [design/frontend-customer.md](design/frontend-customer.md)
- 客戶預約寫入面（建立/取消：容量交易防超賣/自動門診號/重複限制/問卷強制/簡訊雙寫 no-op），真實 DB 驗證（2026-06-30）→ [blueprints/customer-booking.md](blueprints/customer-booking.md)
- 客戶預約讀取面 + 自訂 router model binding 修正（Guid/DateTime/enum 誤判複雜型別）（2026-06-30）→ [blueprints/customer-booking.md](blueprints/customer-booking.md)
- 會員認證 happy path 實測通過（真實 DB + 真實會員）（2026-06-30）→ [blueprints/member-auth.md](blueprints/member-auth.md)
- 決策：資料層改用 Dapper 取代 EF Core（reused DB、schema 不可改、無 migration）（2026-06-30）→ [design/backend-design.md](design/backend-design.md)
- 新系統三專案骨架（api 自訂 router + JWT；web-customer/web-admin Angular 21 + signals + Tailwind）可編譯可跑（2026-06-30）
- 新系統設計文件完成（project-overview/architecture/10 design/10 blueprints）（2026-06-30）
- 舊系統逆向分析歸檔 docs/old/ + modernization 重建必修清單（2026-06-30）

- harness 初始建立（2026-05-07）：docs/ 結構 + CLAUDE.md + agents-catalog + workflows
- 舊系統文件對齊（2026-05-26）→ 已移入 [old/](old/)
