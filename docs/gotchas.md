---
title: 已知陷阱（新系統）
purpose: 紀錄新系統（Angular SPA + Azure Functions + reused DB）開發中發現的踩雷、反模式、跨層約定，避免重複犯錯
applicable_when: 實作前 sanity check、遇到奇怪現象、code review 時
related_agents:
  - qa-test-engineer
  - code-review-optimizer
related_docs:
  - conventions.md
  - design/database-design.md
  - design/security.md
  - old/gotchas.md
keywords: [gotchas, 陷阱, 踩雷, 反模式, 新系統]
last_updated: 2026-07-22T14:00+08:00
---

> 新系統陷阱。**舊系統**陷阱見 [old/gotchas.md](old/gotchas.md)（含 reused DB 既有怪癖：時間戳命名不一致、無 FK、列舉值散落等，沿用時務必先讀）。

## reused DB（schema 不可改）衍生

### 不可加索引/欄位/約束
- 密碼雜湊、refresh token 表、unique constraint、補 FK 都**不可做**（會動 schema）→ 一律應用層處理或列待核准項。見 [design/database-design.md](design/database-design.md)。

### 與舊系統並行寫同一 DB
- 新舊系統可能同時讀寫 `20Skin`；欄位語意、列舉值、CASCADE 行為須與舊系統完全相容。Dapper 依「POCO 屬性名＝欄位名」對應，**勿自行「修正」既有怪欄位名**（`Createdate` 小寫 vs `CreateDate`），否則對應不到。

## 問卷（Questions）

### `OptionType` 實際值與文件不符（重要）
- **症狀**：舊文件與程式 enum 記為 `0=單選/1=複選/2=文字/3=檔案`，但真實 `20Skin` DB `Questions.OptionType` **只有 `1`（單選 radio，180 題）與 `2`（複選 checkbox，4 題）**，無 0、無 3（無文字/檔案題型）。舊 View 的 `if(OptionType==1)→radio else→checkbox` 才是對的。
- **影響**：問卷渲染只需 radio(1)/checkbox(2)；**不依賴檔案上傳/Blob**（本以為要等 file-upload 才能做，實際不用）。
- **預防**：`QuestionOptionType` enum 已更正為 `Single=1/Multiple=2`（[Enums.cs](../api/Skin.Core/Constants/Enums.cs)）；前後端一律以「1→radio、2→checkbox」處理。「其他」自填由 `Questions.IsOther`＋`MemberQuestions.Other` 表達，與 OptionType 無關。

### 問卷目前全數停用
- **症狀**：14 個 `QuestionTypes` 全 `IsEnabled=false`，且**沒有任何 `Categorys.IsQuestion=true`**（歷史用過，`MemberQuestions` 有 5 萬筆，但後台已關）。
- **影響**：預約流程的 `IsQuestion` 分支現在不會觸發；問卷清單也為空。功能正確、但要等後台把某問卷/項目啟用才會出現。驗證時須自行以交易暫啟用再還原。
- **預防**：後端誠實遵守 `IsEnabled`／`IsQuestion` 過濾，不硬塞。

### `MemberQuestionAnswers.QuestionAnswerID` 為 NOT NULL
- 每筆答案列必須有合法 `QuestionAnswerID`（該表**無 FK** 到 `QuestionAnswers`）→ 寫入前於應用層過濾非法/偽造的 answerID（`QuestionService.SubmitAsync`）。「其他」自填不佔答案列，存 `MemberQuestions.Other`。

### 手動簽的 JWT role claim 對不上（測試用）
- **症狀**：以 HS256 手簽 member token 時，`ClaimTypes.Role`（URI）與短名 `role` 皆無法被 `RequestContext.Role` 讀到（`/auth/me` role=null、`[Authorize(Roles.Member)]` 回 403）；但 `nameidentifier`/`name` 正常。
- **預防**：測試需要 member token 時，直接打 `POST /api/auth/member/login`（dev reCAPTCHA 空 secret 自動放行），用回傳的真 token，別手簽。

## 認證 / reCAPTCHA

### 前端寫死空字串 token → secret 一設定就必敗（已修 2026-07-03）
- **症狀**：後台管理員登入一律回 `reCAPTCHA 驗證失敗`（`RECAPTCHA_FAILED`）。
- **原因**：`web-admin/login.ts` 原本沒接 `RecaptchaService`、送出寫死的空字串 `googleCaptchaToken`；`api/20Skin.Api/local.settings.json` 的 `Recaptcha:SecretKey` 已設定真實值（非空），`RecaptchaVerifier` 的 dev bypass（secret 為空才放行）因此失效，空 token 一律判失敗。
- **修法**：比照客戶前台建立獨立的 `web-admin/src/app/core/services/recaptcha.service.ts`，`login.ts` 送出前呼叫 `recaptcha.execute('login')` 取得真實 token。
- **診斷升級（同日追加）**：`RecaptchaVerifier.VerifyAsync` 原本是黑盒，失敗時無法分辨是「token 為空」「Google 回 success:false」「score 不足」「action 不符」還是「伺服器連不到 google.com（網路被擋）」。已加 `ILogger` 於失敗時記錄 `success/score/action/expectedAction/error-codes`，呼叫 Google siteverify 拋例外時也記錄並 fail-closed（視為驗證失敗，不讓例外變成 500）。
- **預防**：**再遇到 `RECAPTCHA_FAILED`，先看 API log**（`LogWarning`/`LogError` 訊息含 `reCAPTCHA 驗證失敗：...`）判斷根因，不要重新用猜的：
  - log 顯示「前端未附上 token」→ 查瀏覽器 Network/Console，通常是 `grecaptcha` 腳本被 ad blocker / 公司網路擋掉 `www.google.com`，或忘記接 `RecaptchaService`。
  - log 顯示呼叫 siteverify 例外 → 伺服器對外網路連不到 `google.com`（本機或部署環境防火牆限制）。
  - log 顯示 `success=false` 或 `error-codes` 非空 → 檢查 site key／secret key 是否配對正確（本專案沿用舊系統 `reference/old/20Skin.Libs/Definition.cs` 的 `ClientreCAPTCHAKey`/`ServerreCAPTCHAKey`，兩把已確認為同組）。
  - log 顯示 `score` 低於 `MinScore` → 見下一則（Firefox 隱私保護導致低分）。

### Firefox 隱私/防指紋保護 → score 過低被擋（已定案 2026-07-03）
- **症狀**：後台登入 `RECAPTCHA_FAILED`；用上一則的診斷 log 查出 `success=true action=login errorCodes=""`，但 `score=0.3`，低於門檻 `0.5`。token 本身完全正常，純粹是分數不夠。
- **原因**：Firefox 開啟「數位指紋追蹤保護」（`privacy.resistFingerprinting` / 嚴格追蹤保護）會刻意打亂 `screen.availWidth/availHeight`、隱藏 `WEBGL_debug_renderer_info` 等裝置指紋訊號——這些正是 reCAPTCHA v3 用來判斷「像不像真人」的依據，訊號被干擾後即使是真人操作也常只拿到 0.2–0.4 分。Brave、Safari ITP 或部分隱私擴充功能也有類似效應。**不是本專案程式邏輯的錯誤**，`MinScore=0.5` 門檻本身是沿用舊系統（[old/design/security.md](old/design/security.md) `score > 0.5`）。
- **決策**：正式環境維持 `0.5`（與舊系統一致）；**本機 dev 的 `Recaptcha:MinScore` 調降為 `0.3`**（`api/20Skin.Api/local.settings.json`，gitignore 排除，不影響部署），方便用隱私保護瀏覽器測試不被誤擋。細節與 Why 見 [design/security.md](design/security.md) `MinScore` 門檻段落。
- **預防**：日後若在**正式環境**看到大量真實使用者卡在 `RECAPTCHA_FAILED` 且 log 顯示 `success=true` 但 `score` 偏低，先懷疑是使用者瀏覽器隱私設定造成，別急著當成 bug 修（也別直接調降正式門檻，會削弱防護）；若情況普遍再回來重新評估門檻或改用「低分不直接擋、改加二次驗證」的緩解策略。

## 自訂 router

### async action 拋 BusinessException → 曾誤回 500（已修 2026-07-01）
- **症狀**：controller 的 **async** action 內 `throw new BusinessException(...)`（如預約 FULL/DUPLICATE/NO_ROSTER、問卷 NOT_FOUND）原本回 HTTP 500，而非預期的 `200 {success:false, code}`。
- **原因**：router 以反射 `action.Invoke` 取得 `Task` 再 `await`；**async 例外直接以原型別拋出**，但 catch 只攔 `TargetInvocationException`（僅 sync Invoke 才會包裝）→ 落到通用 catch 回 500。
- **修法**：`ApiRouterFunction` 於通用 catch **之前**加 `catch (BusinessException be)` 直接回 `ApiResponse.Fail`；保留 `TargetInvocationException` 分支處理 sync 情形。
- **預防**：新增會拋 BusinessException 的端點時，記得業務錯誤應回 200 Fail 信封；若又見 500，先查此 catch 順序。

## 前端（Angular，客戶前台/後台通用）

### `[ngModel]` 置於 `<form>` 內未加 `standalone` → NG01352（已修 2026-07-01）
- **症狀**：`appointment-form` 的預約人數/日期 `<input [ngModel]="...">` 包在 `<form>` 內、且無 `name` 也無 `[ngModelOptions]="{standalone:true}"` → 執行時瀏覽器丟 `NG01352`，**日期輸入失效 → 無法載入時段 → 無法預約**。`ng build` 不會報錯（僅執行期才炸），故只有實際跑起前端才會發現。
- **修法**：所有 `<form>` 內的 `[ngModel]` 一律加 `[ngModelOptions]="{ standalone: true }"`（本專案表單狀態走 signals，不需 Angular form control 註冊）。
- **預防**：新頁面若在 `<form>` 內用 `[ngModel]`，務必加 `standalone`；**每個前端頁面至少用瀏覽器（Playwright headless）跑過一次**，別只信 `ng build`。可用 scratchpad 的 Playwright E2E（登入→分院→診別→項目→日期/時段/指定醫師→送出→查詢/詳情→JoinUs 城市區連動）當回歸。

### 選單資料表把 `path?query` 烤成單一字串餵給 `[routerLink]` → 點擊沒反應（已修 2026-07-03）
- **症狀**：後台左側選單點擊「台中健保時段」（及所有帶 query 參數的變體項目：時段 5 變體、排班 5 變體、科別項目 2 變體）完全沒反應，畫面不會導頁，也沒有任何錯誤訊息。使用者回報為「新系統還沒做此功能」，但實際上後端 API、前端頁面、選單資料全部都已存在且已 commit——問題出在選單本身的連結壞了，跟功能有沒有做無關。
- **原因**：`menu-route-map.ts` 的 `LIMS_ROUTE_MAP` 原本把路徑與 query 參數烤進同一個字串，例如 `TaPeriods: '/basic/periods?branch=ta&clinic=Skin'`，直接整串餵給 `<a [routerLink]="route(child.key)">`。Angular `RouterLink` 收到**純字串**時，只會用 `/` 切割成路徑片段（`computeNavigation`），完全不解析 `?`——`periods?branch=ta&clinic=Skin` 被當成單一路徑片段去匹配路由樹，永遠匹配不到任何已定義路由，最終落到 `{ path: '**', redirectTo: '' }` 靜默重導回首頁；若使用者本來就在首頁點擊，畫面看起來就是「完全沒反應」。沒有靜態編譯錯誤、`ng build` 也測不出來，因為這是 runtime 才會發生的路由匹配問題。
- **修法**：`LIMS_ROUTE_MAP` 值改成 `{ path, queryParams? }` 結構（`MenuRoute` 型別），路徑與 query 參數分開存放；模板同時綁定 `[routerLink]="route(key).path"` 與 `[queryParams]="route(key).queryParams"`（比照 `periods-list.ts` 內部頁籤切換原本就採用的正確寫法）。`admin-layout.ts` 判斷「目前網址屬於哪個選單項」的邏輯（breadcrumb、自動展開所屬模組）一併改為手動切開 `url.split('?')` 比對路徑前綴 + query 參數子集，取代原本對整串字串 `startsWith` 的脆弱比對。
- **預防**：**任何要餵給 `[routerLink]` 的動態路由字串，若包含 query 參數，一律拆成 `{ path, queryParams }` 兩份資料**，不可以拼字串方式組出 `path?a=1&b=2` 再整包丟給 `[routerLink]`（陣列語法 `[routerLink]="['/a','b']"` 同樣不會解析內含 `?` 的片段，問題一樣存在）。這類 bug 因為不影響型別檢查、也不影響直接用網址列輸入 URL 或頁面內部產生的正確 `[routerLink]+[queryParams]` 組合連結（如本案例 `periods-list.ts` 分頁籤本身可正常切換），只有「透過壞掉的選單連結進入」才會發現，排查時容易被誤判成「功能沒做」而非「連結壞了」——先查連結的 `routerLink` 是否為純字串且含 `?`，再懷疑功能本身。

### 動態選項 `<select [value]="signal()">` 首次渲染即帶入既有值 → 值套用失敗且永不自我修正（已修 2026-07-03）
- **症狀**：`member-form`（後台會員編輯頁）城市/區下拉在編輯既有會員時顯示空白（「請選擇縣市」placeholder），即使 API 回傳的 `city`/`zipcodeId` 正確、且下游 `areas()` computed 也證實訊號值正確（區下拉選項數量符合該城市的鄉鎮數）——問題只在 `<select>` 元素本身「看起來沒選中任何值」，且**放著等幾秒也不會自己修正**（並非 race condition，而是決定性的渲染順序問題）。
- **原因**：Angular 編譯後的樣板指令是依「宣告順序」執行：對同一個元素，**先套用該元素自身的屬性繫結（如 `[value]`），才會建立子節點（`@for` 產生的 `<option>`）**。若「表單第一次被建立到 DOM」的那一輪 render，剛好同時把 `selectedCity`/`zipcodeId` 設成非空值（例如整段表單包在 `@if(loaded())`，而 `loaded.set(true)` 與 `selectedCity.set(...)` 在同一顆 callback 內同步呼叫），瀏覽器原生 `<select>.value = X` 賦值當下對應的 `<option value="X">` 根本還不存在，賦值被瀏覽器靜默忽略（不丟例外）；且因為 `selectedCity` 訊號的值之後不再變動，Angular 不會再有理由重新套用這條繫結，永遠停留在空白狀態。**巢狀連動**（區依賴城市）會在下一層再犯一次同樣的問題：城市選好後，區的 `<option>` 才剛因 `areas()` 重新計算而出現，若這時同一輪就把 `zipcodeId` 設下去，一樣失敗。
- **修法**：把「讓表單第一次以空值掛載」和「回填既有值」拆成不同輪 render，用 `setTimeout(() => …)`（必要時巢狀多層，對應巢狀連動的下拉）延後賦值，確保賦值當下對應的 `<option>` 已經在上一輪 render 落地過。範例見 `web-admin/src/app/pages/member/member-form.ts` 的 `loadMember()`。
- **預防**：**任何「原生 `[value]` 綁定 + 選項來自 async 資料 + 需要預帶入既有值」的下拉，都要假設有此問題**，不能只看 `ng build` 過或訊號值正確就當作沒事——本案例的訊號值（`selectedCity`）與下游 computed（`areas()`）其實從頭到尾都是對的，唯獨 DOM 顯示是錯的，必須實際用瀏覽器（Playwright）讀 `<select>.value`/`<option selected>` 才驗得出來，光看 API 回應或型別檢查看不出來。若下拉改用 Reactive Forms 的 `formControlName` + `NgSelectOption`，**同樣的問題依然存在**（`SelectControlValueAccessor.writeValue` 一樣依賴當下已註冊的 option），並非「改用 Angular Forms 就沒事」。

## 檔案上傳 / Blob

### Azurite 不支援新 SDK 的 service 版本 → 釘版（2026-07-01）
- **症狀**：`Azure.Storage.Blobs 12.29.1` 預設 service 版本 `2026-06-06`，本機 Azurite 3.35 回 `400 InvalidHeaderValue: The API version ... is not supported`；上傳一律 500。Azurite 的 `--skipApiVersionCheck` **在此版無效**（試過仍擋）。
- **修法**：`BlobFileStorage` 以 `new BlobClientOptions(BlobClientOptions.ServiceVersion.V2025_11_05)` **釘住 service 版本**（正式 Azure 支援所有較舊版本，對正式安全）。→ 本機 Azurite **不需**任何特殊旗標。
- **預防**：升 `Azure.Storage.*` 後若上傳 500，先看是否又超出本機 Azurite 支援版本；升 Azurite 或調整釘版。

### 上傳走 multipart：router 需注入 HttpRequest
- 自訂 router 預設把複雜型別當 JSON body 綁定；檔案上傳要讀 multipart → 已讓 action 可宣告 `HttpRequest` 參數（router 直接傳 `req`），controller 用 `req.ReadFormAsync().Files`。

### Blob 公開容器：GET 可、DELETE 需授權
- 容器建為 `PublicAccessType.Blob`（`<img>` 直接讀）。**匿名只能讀**；刪除要用帳戶金鑰/SAS（測試清理時用 SDK 帶金鑰，別用匿名 DELETE，會 403）。

## 預約時段 / 門診號

### 二林 Periods 也全綁 OutpatientTimes——不可用「有無綁定」判斷分院模式（2026-07-04）
- **症狀**：以「時段有 `outpatientTimeTitle` 就是台中早晚診」做資料驅動判斷，二林會誤顯示「選擇早晚診」與「早上/下午/晚上」按鈕（時段選擇、完成/詳情頁時間欄同時中招）。
- **原因**：`Periods.OutpatientTimeID` 是 NOT NULL + FK，**二林全部 45 個時段也綁著早上/下午/晚上**；舊系統其實是硬編碼「台中 GUID + Clinic=='Skin'」才顯示早晚診（`AjaxController.cs:177`、`Complete.cshtml:51`）。
- **修法/預防**：判斷一律用「配號時段」＝`Branchs.IsAutoRowNumber=true` 且 `COALESCE(RosterPeriods.StartNumber, Periods.StartNumber) IS NOT NULL`（`BookingService.GetTimeSlotsAsync`／`AppointmentService.CreateAsync`／`GetByIdAsync` 三處同一條件）。真實資料：台中早/晚診 StartNumber=12、二林全 NULL。見 [blueprints/customer-booking.md](blueprints/customer-booking.md)。

### 台中時段「起始編號」是行為開關，清空會停止配號（2026-07-04）
- **症狀**：後台把台中健保某時段的「起始編號」清空，該時段立即變成「不配號＋時間文字呈現」（比照二林）。
- **原因**：這是刻意設計（使用者拍板）——台中細時段（比照二林的診療項目）就靠「起始編號留空」啟用；副作用是既有早/晚診的起始編號也成了敏感欄位。
- **預防**：台中早/晚診時段的起始編號（現為 12）**不可清空**；後台調整時段時先確認影響。另：一般項目與二林模式項目**不可綁同一張排班**（排班的時段清單是全項目共用，人數 0 才會隱藏）。
- **2026-07-22 更新**：後台三處已把「配號／現場取號」模式明確化（時段表單模式感知二選一、時段清單分組、排班容量表分組），且「配號＋現場取號人數混填同一張排班」已**前後端雙層硬擋**（`RosterAdminService.ValidateModeNotMixedAsync` 回 `ROSTER_MODE_MIXED`）——不再只靠人工 SOP。細節見 [design/frontend-backend.md](design/frontend-backend.md) §時段/排班模式感知呈現。若真要在同一天同時提供兩種，仍須**分開兩張排班**（科別不重疊）。

### 時段容量閘門原以「筆數」計，忽略單筆預約人數（Amount）——已改人數計（2026-07-22 修復）
- **症狀**：後台把某時段容量（`RosterPeriods.Patients`）設 1 人，前台預約人數輸入 3，仍可預約成功，1 人時段被塞進 3 個人。
- **原因**：`Appointments.Amount` 新系統語意＝「預約人數」（單筆可多人，前台顯示 `{{ a.amount }}人`），但容量檢查沿用舊系統照抄的 `COUNT(*)`（筆數）＝把「每筆＝佔 1 名額」，且從未把本次 `req.Amount` 加進去比對。舊藍圖 [old/blueprints/customer-booking.md](old/blueprints/customer-booking.md) 的容量檢查本就是 `COUNT(Appointments) >= Patients`，新系統改了 Amount 語意卻沒同步閘門。前台人數框也只有 `min="1"`、無上限。
- **修法**：容量以人數為單位一致化——
  1. `AppointmentService.CreateAsync`（交易內閘門）：`used = COALESCE(SUM(Amount),0)`，判斷改 `used + req.Amount > Capacity` → 回 `FULL`（帶「僅剩 N 個名額」）。
  2. `BookingService.GetTimeSlotsAsync`（前台餘額／額滿排除）：`Used` 子查詢 `COUNT(*)` → `COALESCE(SUM(Amount),0)`。
  3. `AppointmentAdminService.GetPeriodAmountsAsync`（後台名額統計）：`COUNT(*)` → `COALESCE(SUM(Amount),0)`，**刻意偏離舊系統照抄**以與前台一致。
  4. 前台 `appointment-form`：人數框加 `[max]="selectedAvailable()"` + `amountExceedsCapacity` 前擋，超額不可送出（後端仍為權威）。
- **預防**：凡「時段占用/餘額」計算一律用 `SUM(Amount)`（人數），不可再用 `COUNT(*)`（筆數）；三處查詢語意須同步。見 [blueprints/customer-booking.md](blueprints/customer-booking.md)。

### reused DB 禁加索引 → 大表查詢皆全表掃描；避免相關子查詢放大成本（2026-07-22）
- **背景**：[database-design.md](design/database-design.md) §核心原則明文**禁止對 reused DB 加任何索引**。`Appointments`（12.4 萬列）、`Members`（5.4 萬列）都只有 GUID 主鍵叢集索引，**所有篩選欄位（BranchID/AppointmentDate/MemberID/Number/Mobile…）皆無索引** → 每次查詢都是全叢集掃描，`ORDER BY AppointmentDate` 也需整批排序。開發機因整個 DB 被快取在記憶體才顯得快（8–189ms），冷快取/併發/資料成長會明顯放大。
- **踩雷**：後台預約列表原用**相關子查詢**算初診數 `(SELECT COUNT(*) FROM Appointments a2 WHERE a2.MemberID=a.MemberID …)` 投影在分頁大查詢內 → 在無索引下形同為每頁列各掃一次全表，列表 CPU 近乎翻倍（實測 189ms vs 53ms）。
- **修法/預防**：凡「每列再撈一次」的相關子查詢，改成**分頁後單次 IN 清單 group-by** 批次計算（見 `AppointmentAdminService.ListAsync`/`ExportCheckinAsync`）。更廣泛地說，在此 DB 上一切查詢設計都要以「反正是全表掃描」為前提——**盡量把一次請求的全表掃描次數壓到最少**，不要用相關子查詢把單次掃描放大成 N 次。
- **量測法**：`docker exec sqlserver /opt/mssql-tools18/bin/sqlcmd …` 加 `SET STATISTICS IO/TIME ON`，看 `Appointments'. Scan count` 與 `logical reads`（單次全表 ≈ 3161 reads）。

### 索引例外已放行 → 後台預約列表加索引，但萬用 predicate 需搭 OPTION(RECOMPILE)（2026-07-22）
- **背景**：上一條「禁索引」已由 DB 擁有者**逐案放行例外**（見 [database-design.md](design/database-design.md) §核心原則·例外）。後台預約列表已加四索引：`Appointments(BranchID, AppointmentDate)`、`Appointments(MemberID, Status)`、`Members(Number)`、`Members(Mobile)`（腳本 `scripts/db/2026-07-22-add-appointment-indexes.sql`）。每次列表 Appointments logical reads ≈12,644→≈1,200（約 10 倍）。
- **踩雷**：`ListAsync` 的 COUNT 與分頁主查詢含 `(@dateOnly IS NULL OR a.AppointmentDate=@dateOnly)` 等萬用 predicate；**光加索引無效**，優化器為「日期給/不給」共用一個保守計畫仍走全表掃描（實測索引上線後主查詢仍 3161 reads）。
- **修法**：這兩條查詢加 `OPTION (RECOMPILE)`（每次以實際參數編譯），才會 seek（COUNT 3161→3、主查詢 3161→302）。初診 group-by／容量表因 predicate 全為無條件等值/IN，免 RECOMPILE 即 seek。
- **預防**：① 索引與程式端 `OPTION (RECOMPILE)` 必須**同一次部署**，只上其一等於沒改。② 日後凡在此 DB 加索引，先檢查目標查詢有無 `(@p IS NULL OR …)` 萬用 predicate，有就要一併加 RECOMPILE（或改動態 SQL 只拼有值的條件）。③ 加索引一律需擁有者放行 + 腳本留檔 `scripts/db/`。

### Dapper record DTO 與 SQL 欄位型別必須嚴格匹配（bit vs int，2026-07-04 修復）
- **症狀**：`GET /api/appointments/{id}`（完成頁/詳情頁）自 2026-07-02 起一直 500：`A parameterless default constructor or one matching signature ... is required for AppointmentDetailDto materialization`。
- **原因**：`COALESCE(c.IsQuestion, 0)` 中 int 字面值使結果型別升為 **int**，但 `AppointmentDetailDto.IsQuestion` 是 `bool`——Dapper 對 positional record 的建構子匹配不做 int→bool 轉換，直接找不到建構子而拋例外。
- **修法**：`CAST(COALESCE(c.IsQuestion, 0) AS BIT)`（同查詢 `QuestionAnswered` 本來就有 CAST，正確）。
- **預防**：回傳 record DTO 的查詢，凡 `COALESCE`/`CASE` 混入 int 字面值的 bit 欄位一律補 `CAST(... AS BIT)`；驗證要真的打到該 endpoint，不能只驗 build。

## 開發環境 / 編輯器

### 編輯器報「找不到 Mono」→ 誤載入舊系統 .sln（已修 2026-07-03）
- **症狀**：VSCode 開啟專案時 C# 擴充跳出「無法載入專案，因為找不到 Mono。請確認已安裝 Mono 和 MSBuild」。
- **原因**：C# 擴充自動偵測到 `reference/old/20Skin.sln`（舊系統 .NET Framework、舊格式 `.csproj`），在 macOS 上此類專案需要 Mono 才能被 MSBuild 解析；`reference/old/` 純屬逆向分析參考，不需建置。新系統專案在 `api/`，已有 `api/20Skin.slnx`（新版 SDK-style，不需 Mono）。
- **修法**：`.vscode/settings.json` 加 `"dotnet.defaultSolution": "api/20Skin.slnx"` 明確指定方案，並將 `reference/old/**` 加入 `files.watcherExclude` / `search.exclude`，避免編輯器掃描或監看該目錄。
- **預防**：不要在編輯器內開啟 `reference/old/20Skin.sln`；如需再次確認 Mono/MSBuild 相關報錯，先檢查 `dotnet.defaultSolution` 是否仍指向 `api/20Skin.slnx`。

## 待補充

（開發開始後，把新系統實際踩到的雷紀錄於此；格式：症狀 / 影響 / 預防）
