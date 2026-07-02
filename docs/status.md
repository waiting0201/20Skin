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
last_updated: 2026-07-02T20:00+08:00
---

> 本檔由 Claude **自動維護**。任務開始/完成/卡住都必須更新。詳細規則見 [../CLAUDE.md](../CLAUDE.md) 「狀態追蹤規則」。
> **目前階段：核心功能實作中**。已完成 = 舊系統分析歸檔 → 新系統設計文件 → 三專案骨架 → **會員認證** → **客戶預約（讀+寫，真實 DB 驗證）** → **客戶 SPA 前端串接 API（登入→預約→查詢/取消）** → **後台地基 + 權限管理（資料驅動選單 + Admins CRUD，真實 DB 驗證）** → **客戶前台問卷（術前病歷，動態題型 + 重填語義，真實 DB 驗證）** → **初診註冊 JoinUs（城市區連動 + 過敏/病史 CSV + 註冊即登入）** → **指定醫師流程（+ 修 router 500 bug）** → **預約照片上傳（Azure Blob）** → **reCAPTCHA v3 前端（動態載入 + 登入/註冊送 token，mock 驗證）** → **Serilog 結構化 log** → **後台基礎資料全數完成（分院/醫師/時段/科別項目/問卷主檔，4 Phase）** → **後台排班管理（重複展開 + diff 編輯，真實 DB 驗證）**。
> 連線：本機 `(local)` `20Skin` 已可用，連線字串在 `api/20Skin.Api/local.settings.json`（gitignore 排除）。測試會員：`B121583140` / `1978-02-01`。**簡訊一律 no-op（`DevNoOpSmsSender`），測試不真發**。
> 本機啟動：API `cd api/20Skin.Api && func start`（:7071，需 Azurite）；前端 `cd web-customer && npx ng serve`（:4200）。CORS 已允許 :4200（`local.settings.json` Host.CORS）；`environment.apiBase` = `http://localhost:7071/api`。

## 🔄 In Progress

> 一次最多 3–5 項

（目前無 — 後台排班管理已完成，見下方 Recently Done；下一步為後台剩餘 2 模組：預約管理/會員管理）

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
  - **未做**：後台分院/項目圖上傳；問卷檔案題型（無資料）；刪除端點；歷史 4275 張照片＋分院/項目圖搬進 `upload` 容器（部署 azcopy）。
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
  - **未做/後續**：basic/roster/reserve/member 4 模組（選單可見導 `/coming-soon`）；reCAPTCHA 前端 token（dev bypass）；rate-limit / 帳號鎖定；JWT perms 過大時改 `/me` 補細項。
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
