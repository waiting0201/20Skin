---
title: 客戶線上預約
purpose: 病患多步驟預約流程（分院→診別→項目→問卷→日期/醫師/時段→建立），含容量計算、自動門診號、重複預約限制
status: draft
applicable_when: 要實作或修改預約流程、容量/編號/重複規則、預約查詢與取消時
related_agents:
  - software-architect-blueprint
  - backend-engineer
  - frontend-architect
related_docs:
  - ../design/frontend-customer.md
  - ../design/backend-design.md
  - ../design/api-design.md
  - ../design/database-design.md
  - sms-reminder.md
  - questionnaire.md
keywords: [booking, appointment, capacity, outpatient-number, duplicate, cancel, doctor, designated, numbered-slot, erlin-mode]
last_updated: 2026-07-04
---

## 台中特定診療項目「二林模式」＋配號時段概念（2026-07-04）

**需求**：台中既有功能不動，但特定診療項目要比照二林——不配門診號、時段以時間文字呈現、逐細時段設定人數。

**核心概念「配號時段」**（使用者拍板，資料驅動、無設定清單）：
`分院 IsAutoRowNumber=true 且 COALESCE(RosterPeriods.StartNumber, Periods.StartNumber) IS NOT NULL`
- 配號時段 → 自動配門診號＋早晚診標題呈現（台中現有早/晚診，`StartNumber=12`，行為不變）
- 非配號時段 → 不配號（完成頁/簡訊「請至現場取號」）＋以 `Periods.Title` 時間文字呈現（二林全部、台中起始編號留空的細時段）

**為何棄用「有無 outpatientTimeTitle」判斷（推翻 2026-07-02 第二輪 audit 第 3 點）**：真實 DB 查證發現**二林 45 個 Periods 也全部綁著 OutpatientTimes（早上/下午/晚上）**，「僅台中門診設定會有值」是錯誤假設——該判斷會讓二林誤顯示「選擇早晚診」與早/午/晚按鈕（既有 bug，本次修正）。舊系統實際是硬編碼 `台中 GUID + Clinic=="Skin"` 才顯示早晚診（`AjaxController.cs:177`、`Complete.cshtml:51`），其餘顯示 `Periods.Title`。新系統改用上述「配號時段」概念：與台中/二林現況資料完全吻合（台中 2 時段皆有 StartNumber、二林 45 時段皆無），且天然支援台中細時段擴充。

**其餘決策**：
- 「不可預約當日」「前後 2 天不可重複」**維持台中分院層級規則不變**（細時段項目在台中仍受限）；指定醫師提前 2 天亦維持分院層級。
- 後台「台中健保時段」頁**解除隱藏「新增時段」按鈕**（見 [admin-basic-data.md](admin-basic-data.md)）。

**實作**（門診號與呈現共用同一驅動）：
- `BookingService.GetTimeSlotsAsync`：SELECT 加 `COALESCE(rp.StartNumber, p.StartNumber)`；非配號時段將 `OutpatientTimeId`/`OutpatientTimeTitle` 回 null → 前端 `periodSectionTitle`/按鈕文字零改動自動正確。
- `AppointmentService.CreateAsync`：配號條件由 `IsAutoRowNumber` 收斂為 `IsAutoRowNumber && StartNumber != null`。
- `AppointmentService.GetByIdAsync`：`PeriodTitle` 改 CASE（配號時段才用 `ot.Title`），補 `LEFT JOIN RosterPeriods`；**順帶修正既有 500 bug**——`COALESCE(c.IsQuestion, 0)` 產出 int 使 Dapper 無法匹配 `AppointmentDetailDto.IsQuestion`(bool) 建構子，詳情/完成頁自 2026-07-02 起一直 500，已補 `CAST(... AS BIT)`（見 [gotchas.md](../gotchas.md)）。

**營運 SOP（無程式碼，靠排班資料分流）**：
1. 後台「台中健保時段」新增細時段（如 10:00），**起始編號留空**、人數設各時段容量；「時間」照常選早/午/晚（僅分類用，不影響呈現）。
2. 二林模式項目**另開獨立排班**：只勾這些項目、只給細時段人數（早/晚診列留 0）。
3. 台中原有排班照舊（早/晚診給人數、細時段列留 0）。
4. ⚠️ 同一張排班綁的所有項目共用其時段——**一般項目與二林模式項目不可同排班**（誤將細時段人數填 >0 到一般項目排班會讓一般項目出現細時段）。

**驗證（2026-07-04，真實 DB 端到端，測試資料硬刪零殘留）**：二林時段 API 回 `outpatientTimeTitle=null`＋詳情頁「09:00」（bug 修正）；台中早/晚診照舊（「早上/晚上」＋配號 12、詳情「早上」）；台中細時段（StartNumber=NULL、人數 2）→ 一般時段呈現、建立後 `outpatientNum=null`、簡訊「請至現場取號」、與一般項目時段互不可見。

## 客戶前台全頁面重新對齊舊系統（2026-07-02，第三輪 audit）

使用者要求「參照舊系統重新檢視所有客戶前台頁面功能」，五組並行重新逐行比對後修復 8 項缺口（前兩輪只涵蓋 AppointmentForm；本輪涵蓋全部 11 頁）。以下 3 項是需要業務決策、已與使用者確認拍板的項目：

1. **醫學美容線上掛號入口改回隱藏**：審查發現舊系統 `Clinic.cshtml` 的「醫學美容」`<li>` 整段被 Razor 註解，代表**舊系統實際上線行為是全院禁止新建醫美預約**（僅保留歷史醫美預約的查詢/詳情顯示）。新系統原本讓「台中以外」分院都能選醫美掛號，與舊系統實際行為不符。**使用者拍板：比照舊系統全院隱藏**，`ClinicComponent` 已移除該分支。若日後要重新開放醫美線上掛號，需先與診所業務確認（後台醫美排班管理功能本身不受影響，可正常維運）。
2. **取消預約規則改為精確依看診時刻計算**：舊系統原意是「距實際看診時段 1 小時內不可取消」，但其 `DateTime.Parse(AppointmentDate + Periods.Title)` 在多數時段格式下會直接拋例外（舊系統此功能本身常態性崩潰，非設計原意）。新系統原本簡化為「`AppointmentDate` 加 1 小時」，等同「預約當天一律不可取消」，比原意更嚴格。**使用者拍板：改為精確依時段時間計算**（解析 `Periods.Title` 起始時間，失敗則 fallback 回「當天禁止」規則並記警告 log，不可拋例外）。
3. **額滿時段改回隱藏**：舊系統會把已額滿的時段整個從清單移除；新系統原本改為灰階顯示「餘 0」讓客戶看得到但不能選。**使用者拍板：改回舊系統行為，額滿時段直接不回傳**（`BookingService.GetTimeSlotsAsync` 篩除，非前端隱藏）。

其餘 5 項純缺陷修復（無需業務決策，直接對齊舊系統或補齊資訊缺口）：台中分院「不可預約當日」規則、完成頁/詳情頁問卷填寫狀態欄位、完成頁二林分院兩則提示、完成頁台中皮膚科早晚診標題、預約清單頁分頁 UI。詳見 [design/frontend-customer.md](../design/frontend-customer.md) 對應段落。

## 預約表單老系統對齊補完（2026-07-02，第二輪 audit）

重新比對 `reference/old/20Skin/Controllers/{AjaxController,MainMsController}.cs` 與 `Views/MainMs/AppointmentForm.cshtml`，找出並補上以下缺口（前一輪只補了重複預約檢查）：

1. **時段可用性完全沒做日期/時間過濾** — `GetTimeSlotsAsync` 原本只檢查容量。舊系統 `GetRosters`/`GetDoctorRosters` 額外擋：
   - **週日一律不可預約**（`dt.DayOfWeek != DayOfWeek.Sunday`，兩流程皆有）→ `GetTimeSlotsAsync` 補：`date.DayOfWeek == Sunday` 直接回空陣列。
   - **已過去的時段不可選**（`dt > dtnow`）→ 用 `Periods.Title`（形如 `"9:00~9:30"`）取 `~` 前的起始時間解析出 `slotStart`，`slotStart <= TaiwanNow` 則排除；解析失敗（非預期格式）不擋，避免資料異常時整段時段消失。
   - **指定醫師 + 自動配號分院（IsAutoRowNumber）需至少提前 2 天**（`GetDoctorRosters` 的 `t1 > t2` 比較）→ 一併補上。**注意**：此規則舊系統從未真正上線過（指定醫師整體功能被 `1==2` 停死），是新系統啟用指定醫師時一併沿用的規則，如與業務認知不符可調整/移除 `BookingService.GetTimeSlotsAsync` 內該段判斷。
   - 實作見 [BookingService.cs](../../api/Skin.Services/Booking/BookingService.cs) `GetTimeSlotsAsync`/`TryGetSlotStart`。
2. **「限定人數 1 人」（IsOnly/ChIsOnly/ChDentistIsOnly）未實作** — 舊系統依 `Categorys.IsOnly`（台中）/`ChIsOnly`（二林皮膚）/`ChDentistIsOnly`（二林齒科）鎖定「預約人數」欄位唯讀=1。這 3 欄位後台 CRUD 已存在，但客戶端 `CategoryDto` 未曾暴露。已補：`GetCategoriesByClinicAsync(branchId, clinic)` 依 `branchId` 用 `PeriodsOptions.AliasFor`（重用既有 Ta/Ch/ChDentist 分院別名設定，不新增硬編碼 GUID）解析出對應旗標，回傳單一 `CategoryDto.IsAmountLocked`；`GET /api/categories` 加 `branchId` 必填參數；前端 `appointment-form.ts` 依 `store.category()?.isAmountLocked` 將人數欄位改唯讀顯示 1，送出強制 `amount=1`。
3. **時段區塊標題「選擇早晚診」/「選擇時段」未依分院切換** — 舊系統台中顯示「選擇早晚診」（`ViewBag.SelectPeriodTitle`），其餘「選擇時段」。前端 `periodSectionTitle` computed 依已載入的時段是否帶 `outpatientTimeTitle` 決定標題。~~「僅台中門診設定會有值」~~ **此假設已於 2026-07-04 被真實資料證偽並修正**：後端改依「配號時段」決定是否輸出 `outpatientTimeTitle`（見上方「台中特定診療項目二林模式」段）；前端判斷式不變。

## 前端重複預約檢查（2026-07-02）

舊系統 `AppointmentForm.AppointmentDate` 用 `[Remote("CheckAppointmentDate", ...)]` 於選日期當下即時驗證，錯誤訊息固定「三日內不可重複預約」；實際規則依分院不同（見下方「重複預約限制」）。新系統對應：
- 後端 `POST /api/rosters/check-availability`（`BookingService.CheckDuplicateAsync`）與建立時的伺服器端二次檢查（`AppointmentService.CreateAsync`）本已存在，回傳訊息依視窗天數精確化（`前後 N 天內已有預約` / `當日已有預約`）。
- **前端 `appointment-form.ts` 原先未呼叫此 API**，選日期後直接進指定醫師/選時段——已補上：`onDateChange()` 先呼叫 `checkAvailability`，未通過則顯示 `dateError`（fallback 文案沿用舊系統「三日內不可重複預約」）並擋住後續指定醫師/選時段區塊（`dateAvailable` signal 控制 `showSlots`/`canSubmit`）。
- 建立時仍保留伺服器端二次檢查作為最終防線（防競態：check 通過後、送出前被其他分頁搶先預約）。

## 指定醫師流程（2026-07-01 完成，真實 DB 驗證）

舊系統將此功能以 `1 == 2` 停用（資料稀少）；新系統補齊：
- **後端**：`GetTimeSlotsAsync` 加選用 `doctorId`——null → 不指定（`IsAppointment=0`）；有值 → 該醫師（`IsAppointment=1 且 DoctorID=doctorId`）。`GET /api/rosters` 加 `doctorId` 參數。`POST /api/appointments` 早已支援（roster context 依 `IsAppointment=@IsAppointment` + `(@DoctorId IS NULL OR r.DoctorID=@DoctorId)` 解析），指定時 `isAppointment=true`＋`doctorId` 即綁定該醫師排班。
- **前端**：`appointment-form` 加「不指定／指定」切換；選「指定」→ 載入 `/api/rosters/doctors` → 選醫師 → 載入該醫師時段（`/api/rosters?...&doctorId=`）→ 送出帶 `doctorId`＋`isAppointment=true`。
- **順帶修 router bug**：async action 拋 `BusinessException`（如 FULL/DUPLICATE）原誤回 500，已修為 200 Fail（見 [gotchas.md](../gotchas.md)）。
- **驗證**（施百潤 2022-03-18 指定排班）：醫師清單、指定 vs 不指定時段差異、FULL 回 200、暫解容量後建立成功（`DoctorID`＝該醫師、`RosterID`＝該 `IsAppointment=1` 排班）、硬刪＋還原零殘留。

## 背景與動機
系統核心。重寫保留全部預約業務行為（需求 7），改為 SPA + JSON API + 前端 signal store。

## 範圍
### 做什麼
- 多步驟預約：分院 → 診別(Skin/Cosmetic/Dentist) → 項目(Category) → (需問卷則填) → 日期/醫師/時段 → 建立。
- 容量檢查、自動門診號、重複預約限制、可選上傳照片。
- 預約查詢（分頁）、詳情、取消（>1 小時）。
- 建立成功觸發簡訊雙寫（見 [sms-reminder.md](sms-reminder.md)）。
### 不做什麼
- 不改 schema；不加金流。

## 使用者流程
見 [frontend-customer.md](../design/frontend-customer.md) §流程圖。狀態以 reservation signal store 保存（取代舊 Session）。

## 設計決策（必保留業務邏輯）
- **容量**：`capacity = RosterPeriods.Patients ?? Periods.Patients`；已用 `= COUNT(Appointments WHERE Status=1 AND AppointmentDate AND PeriodID)`；滿則擋。
- **自動門診號**（2026-07-04 收斂為「配號時段」）：`Branchs.IsAutoRowNumber=true` **且** `COALESCE(RosterPeriods.StartNumber, Periods.StartNumber)` 有值才配號，從該 StartNumber 起每次 +2 取偶數，掃描現有 `OutpatientNum` 找首個空缺；StartNumber 為空的時段不配號（台中比照二林的細時段），呈現亦以此判斷（見上方「台中特定診療項目二林模式」段）。
- **重複預約限制**：台中同診別**前後 2 天內**不可重複（且不可當天）；其他分院同診別**當天**不可重複。→ **改為依 Branch 設定/DB 驅動，移除硬編碼 GUID**（舊 `e65f4720…`）。
- **台中分院不可預約當日**（2026-07-02 補回）：與上述重複視窗檢查無關的獨立規則，`BookingService.CheckDuplicateAsync` 對台中分院（依 `PeriodsOptions.AliasFor` 別名解析）在 `date.Date == TaiwanNow.Date` 時直接擋下，對應舊 `AjaxController.CheckAppointmentDate` 的 `cp==0` 判斷。
- **問卷強制**：`Category.IsQuestion=true` 須先完成對應問卷。
- **並發**：建立預約以 transaction 包「容量檢查+INSERT+SmsStatus 雙寫」；以 isolation/重試降低超賣（不可加 unique constraint）。
- **時段資料**：API 回 JSON（取代舊 HTML 片段）；額滿（剩餘容量 ≤0）時段直接不回傳（2026-07-02 改回舊系統隱藏行為，取代先前灰階顯示「餘0」的版本）。
- **IDOR 修正**：詳情/取消加 `Appointment.MemberID == JWT.sub`。
- **取消時限**（2026-07-02 改為精確計算）：解析 `Periods.Title` 起始時間組合 `AppointmentDate` 得實際看診時刻，距看診時刻 1 小時內不可取消；解析失敗 fallback 回「當天禁止取消」並記警告 log（`AppointmentService.CancelAsync` / `TryGetSlotStart`）。
- **`AppointmentDetailDto` 新增欄位**（2026-07-02）：`branchId`（分院 GUID，供分院條件渲染）、`isQuestion`/`questionAnswered`（問卷填寫狀態）。

### 取捨
舊「Session 狀態機」改前端 store + sessionStorage（F5 不丟）；犧牲一點 server 端可追蹤性換無狀態擴展。

## 跨層影響
| 層級 | 影響 | 摘要 |
|---|---|---|
| 視覺 | 否 | 沿用外觀 |
| 前端 | 是 | Index/Clinic/Category/AppointmentForm/Complete/AppointmentList/Detail/Cancel + reservation store |
| 後端 | 是 | AppointmentController + AppointmentDomain（容量/編號/重複）+ transaction |
| API | 是 | `/api/branches|categories|rosters|appointments...`（clinic 參數化） |
| 資料庫 | 否 | 讀寫既有表 |
| 安全 | 是 | 歸屬檢查、JWT |

## 驗收標準
- [ ] 容量計算與舊系統一致（RosterPeriods 覆蓋 Periods）
- [ ] 自動門診號 +2 偶數正確
- [x] 重複限制（台中±2天 / 其他當天）正確且來自設定非硬編碼（後端已完成；前端已補即時檢查，2026-07-02）
- [x] 台中分院不可預約當日（2026-07-02，第三輪 audit 補回）
- [x] 取消 >1 小時限制（精確依看診時刻計算）+ 標記未發 SMS=CANCEL（2026-07-02）
- [ ] 並發不超賣
- [x] 詳情/取消有歸屬檢查（IDOR）
- [x] 時段可用性正確排除週日與已過去時段（2026-07-02）
- [x] `IsOnly`/`ChIsOnly`/`ChDentistIsOnly` 人數鎖定正確依分院生效（2026-07-02）
- [x] 時段標題依分院切換「選擇早晚診」/「選擇時段」（2026-07-02）
- [x] 額滿時段直接隱藏、不回傳給前端（2026-07-02）
- [x] 醫學美容線上掛號入口比照舊系統全院隱藏（2026-07-02）
- [x] 完成頁/詳情頁問卷填寫狀態欄位、二林分院提示、台中皮膚科早晚診標題（2026-07-02）
- [x] 預約清單頁分頁 UI（2026-07-02）

## 風險與未解問題
- 並發超賣（無 unique constraint 可用）→ 靠 transaction/重試，需壓測。
- 重複限制規則「來源」需定（Branch 欄位 or 設定檔）。

## 對應舊系統
- [old/design/frontend-customer.md](../old/design/frontend-customer.md)、[old/blueprints/customer-booking.md](../old/blueprints/customer-booking.md)
- `reference/old/20Skin/Controllers/MainMsController.cs`（建立/自動編號）、`AjaxController.cs`（GetRosters/CheckAppointmentDate）
