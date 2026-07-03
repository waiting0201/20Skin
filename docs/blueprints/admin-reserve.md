---
title: 後台預約管理
purpose: 預約查詢（多條件/分頁）、詳情、取消、時段容量批次更新、簽到單 Excel 與問卷結構化 JSON 匯出，clinic 參數化
status: shipped
applicable_when: 要實作或修改後台預約查詢/取消/匯出、容量批次更新時
related_agents:
  - software-architect-blueprint
  - backend-engineer
  - frontend-architect
related_docs:
  - ../design/frontend-backend.md
  - ../design/api-design.md
  - ../design/backend-design.md
  - sms-reminder.md
  - admin-roster.md
  - admin-member.md
keywords: [admin, reserve, appointment, export, excel, questionnaire, capacity, cancel]
last_updated: 2026-07-03T18:00+08:00
---

## 背景與動機
員工查看與處理病患預約。舊 `ReserveMsController`(~1,225 行) 三組變體 + NPOI/iTextSharp 匯出。重寫參數化 + 雲端匯出。

## 範圍
### 做什麼
- 預約列表：多條件篩選（診別/項目/日期/會員編號/手機/姓名/生日）+ 分頁（固定 50 筆）+ 時段名額統計。
- 詳情（含會員完整資料 + 問卷作答）、取消（Status=0 + 標記未發 SMS=CANCEL）。
- 時段容量批次更新（`Periods.Patients`/`RosterPeriods.Patients`）。
- 匯出：簽到單 Excel（.xlsx）、問卷結構化 JSON（前端另做可列印頁面）。
### 不做什麼
- 不改 schema；不在後端產生問卷 PDF。

## 使用者流程
```
/reserve/{ta|ch|ch-dentist}?... → 篩選列表(+名額統計) → 詳情 / 取消 / 容量編輯 / 匯出
取消 → Status=0 + 未發 SmsStatus=CANCEL（見 sms-reminder）
匯出 → GET admin/appointments/{slug}/export/checkin(.xlsx) 或 /export/questionnaire(JSON)
```

## 設計決策
- **只有 3 組變體（非 5 組）**：舊 `ReserveMsController` 僅 `TaAppointments`/`ChAppointments`/`ChDentistAppointments`，Ta/Ch 各自用 `sClinic` 查詢參數在 Skin/Cosmetic 間切換（同一頁面），非各自獨立頁面；ChDentist 固定 `Clinic="Dentist"`、無 clinic/category 篩選。真實 `Lims`（`ParentID=18`）三個 Key 精確為 `TaAppointments`/`ChAppointments`/`ChDentistAppointments`，JWT perms claim 比對區分大小寫，Controller 3 組 proxy 的 `Resource` 字串須精確相符。Service 完全參數化（branchId+clinic），與 [admin-roster.md](admin-roster.md)/[admin-basic-data.md](admin-basic-data.md) 同一設計理由，分院別名解析重用既有 `Skin.Services.BasicData.PeriodsOptions`。
- **pageSize 固定 50（非其他模組常見的 20）**：舊系統 `ToPagedList(pageNumber: p, pageSize: 50)` 寫死 50，刻意沿用不對外開放調整，與 [admin-member.md](admin-member.md) 的 20 不同。
- **避免 N+1**：初診判斷（`IsFirstVisit`）用相關子查詢 `(SELECT COUNT(*) FROM Appointments a2 WHERE a2.MemberID=a.MemberID AND a2.Status=1)` 隨列表單次投影取得（分頁上限 50 筆，相關子查詢優於額外一次分頁後 group-by 往返）；判斷全域（跨分院/診別）累計次數，非本次查詢範圍限定，忠於舊系統 `appointmentsService.Get().Where(a => a.Status==1)` 無 Branch/Clinic 篩選的既有語意。動態計算不讀既有 `Appointments.IsFirstVisit` 欄位（該欄位存在但列表/匯出皆不使用，忠於舊系統既有行為）。
- **「時間」欄兩處刻意不同的 fallback 行為（照抄舊系統，勿「修正」為一致）**：列表頁/詳情頁的「時間」欄 `COALESCE(Rosters.OutpatientTimes.Title, Periods.OutpatientTimes.Title)`（有 fallback，忠於 `ViewTaAppointments.cshtml` 第176行）；簽到單 Excel 匯出的「時間」欄僅取 `Rosters.OutpatientTimes.Title`（**無** fallback，忠於 `ExportTaAppointments` 等 action 第 273/662/1034 行的既有行為）。已用真實資料驗證兩者確實不同（無 Roster 時列表顯示 fallback 標題，匯出留空）。
- **時段容量表（PeriodAmounts）計算邏輯完整照抄舊系統**：對該分院+診別每個 `Periods` 模板，用 `OUTER APPLY` 找當天是否有符合 `BranchID+RosterDate+Clinic` 的 `Roster`（ta/ch 額外要求 `RosterCategorys` 含指定 `categoryId`；ch-dentist 不比對科別，`categoryId` 恆為 null 略過該條件）→ 有對應 `RosterPeriods` 用其 `Patients` 覆蓋，否則退回 `Periods.Patients`；`AppointmentAmount` 依 `PeriodID+RosterID` 分組統計 `Status=1` 預約數（無對應 Roster 則單純依 `PeriodID` 加總，涵蓋未綁定 Roster 的歷史預約）。真實 DB 驗證：ta/ch 正確比對 category、ch-dentist 正確略過。
- **取消加一條舊系統沒有的防禦性檢查（刻意的安全強化，非破壞相容性）**：`Status` 已為 0 時重複取消擋下 `BusinessException("此預約已取消","ALREADY_CANCELLED")`；舊系統 `DeleteTaAppointments` 等對已取消預約重複觸發會靜默重複執行（無害但不必要），比照本專案 roster/member 刪除守門的既有慣例補上防禦。取消**沒有**客戶端 `AppointmentService.CancelAsync` 的「預約前 1 小時內不可取消」限制——舊系統後台本來就無此規則，此限制是客戶自助取消才有的規則，不應套用到後台管理操作。
- **匯出策略**：簽到單改用 `ClosedXML` 產生 `.xlsx`（取代舊 NPOI `.xls`，去 65536 列上限），只匯出 `Status=1` 的預約，欄位順序/內容完全照抄舊程式碼（分院/醫師/預約日期/時間/時段/類型/項目/姓名/手機號碼/編號/生日(民國年)/初診），查無資料回 `BusinessException("查無可匯出的預約資料","NO_DATA")`（取代舊系統 redirect 行為，因為現在是純 API）。問卷匯出**不在後端產生 PDF**（`frontend-backend.md` 已定案「先採前端方案降後端負擔」），改回傳結構化 JSON（`QuestionnaireExportDto`），前端另做可列印頁面走瀏覽器原生列印產生 PDF；查詢刻意**不篩選 Status**（連已取消預約只要有填問卷也匯出，忠於舊 `ExportQuestionXxxAppointments` 既有行為，真實 DB 驗證已確認含已取消預約），查無資料回空陣列而非例外（JSON 查詢非檔案下載，空清單是合法回應，與簽到單匯出的例外處理刻意不同）。
- **問卷 join 重用既有 `IQuestionService.GetFormAsync`**（`includeDisabled: true`），不重新寫 join 邏輯；回傳的 `QuestionFormDto` 與 `web-admin` 既有 `member-questionnaire-view.ts` 同一份資料格式，前端可直接重用渲染邏輯（同 [admin-member.md](admin-member.md) 的既有慣例）。問卷匯出對每筆呼叫一次（N 次呼叫），屬低頻匯出操作非列表熱路徑，可接受，不刻意避免 N+1。
- **列表排序統一補上 `OutpatientNum` 為第三排序鍵（與舊系統 3 組變體不完全一致，微幅改動）**：舊系統僅 `TaAppointments` 的排序含 `.ThenBy(a => a.OutpatientNum)`，`ChAppointments`/`ChDentistAppointments`/三者的匯出 action 中僅 `ExportTaAppointments` 含此鍵，其餘皆缺漏（應屬舊系統疏漏而非刻意設計）。新系統 3 組列表 + 匯出一律補上 `ORDER BY ... , OutpatientNum`，確保分頁結果穩定排序（避免同分數下的隨機順序造成分頁重複/漏掉列），純粹的穩定性修正，不影響任何業務語意。
- **時段容量批次更新**：逐筆 `UPDATE Periods SET Patients=...`，`RosterPeriodId` 有值時同時 `UPDATE RosterPeriods SET Patients=...`（同一 transaction），完全比照舊 `SortTaAppointments` 等 action 邏輯。

## 跨層影響
| 層級 | 影響 | 摘要 |
|---|---|---|
| 前端 | 是 | `web-admin/src/app/pages/reserve/`（reserve-list/appointment-detail/questionnaire-print）+ `reserve-api.service.ts`，見下方「前端實作紀錄」 |
| 後端 | 是 | `AppointmentsAdminController`（3 組 proxy）+ `AppointmentAdminService` + ClosedXML 匯出 |
| API | 是 | `admin/appointments/{ta\|ch\|ch-dentist}`、`/{id}`、`/{id}/cancel`、`/capacity`、`/export/{checkin\|questionnaire}`（見下方實作紀錄） |
| 資料庫 | 否 | 讀寫既有 `Appointments`/`SmsStatus`/`Periods`/`RosterPeriods`/`Members`/`Zipcodes`/`Categorys`/`QuestionTypes` |
| 安全 | 是 | 依變體粒度 perms 授權（Resource=`TaAppointments`/`ChAppointments`/`ChDentistAppointments`），真實 DB 驗證授權邊界正確 |

## 驗收標準（真實 DB 端對端已驗證，2026-07-03）
- [x] 多條件篩選（clinic/categoryId/appointmentDate/memberNumber/memberMobile/memberName/birthday）+ 分頁（固定 50）+ 名額統計
- [x] 初診判斷（`IsFirstVisit`）動態計算正確（新增第 2 筆有效預約後由 true 轉 false）
- [x] 容量表（PeriodAmounts）僅於條件齊全時回傳；ta/ch 正確比對 `RosterCategorys`、ch-dentist 正確略過科別比對
- [x] 容量批次更新確實寫入 `Periods.Patients`/`RosterPeriods.Patients`
- [x] 詳情含會員完整資料 + 問卷（含既有作答 pre-fill 正確勾選）
- [x] 取消：狀態改 0、未發 SmsStatus 標記 CANCEL、重複取消擋下 `ALREADY_CANCELLED`、查無預約回 `NOT_FOUND`
- [x] Excel(.xlsx) 匯出內容正確（分院/醫師/日期/時間(**無** fallback)/時段/類型/項目/姓名/手機/編號/民國年生日/初診判斷皆正確；查無資料回 `NO_DATA`）
- [x] 問卷 JSON 匯出結構正確，且正確包含已取消預約（無 Status 篩選）
- [x] 授權邊界：僅 `TaAppointments` read 權限之測試管理員呼叫 `ch`/`ch-dentist` 端點正確回 403；呼叫 `ta` 的 update/delete 操作正確回 403（無對應權限旗標）；未帶 token 回 401
- [x] clinic/branch 參數化（無硬編碼 GUID，重用 `PeriodsOptions`）

## 實作紀錄（Done 2026-07-03）

- **程式位置**：DTO `api/Skin.Core/Dtos/AppointmentAdminDtos.cs`；Service `api/Skin.Services/Reserve/{IAppointmentAdminService,AppointmentAdminService}.cs`；Controller `api/20Skin.Api/Controllers/AppointmentsAdminController.cs`；DI 註冊於 `api/20Skin.Api/Program.cs`；套件 `ClosedXML` 加入 `api/Skin.Services/Skin.Services.csproj`。
- **Phase 0（研究）**：完整讀完 `ReserveMsController.cs`（1225 行）確認僅 3 組變體（非 5 組）；對真實 DB 查證 `Lims`（`ParentID=18`）三個 Key 精確拼字；查證 `Branchs.IsAutoRowNumber`（列表回傳 `BranchIsAutoRowNumber` 供前端決定是否顯示看診號碼欄，並影響簡訊文案，見舊 `MainMsController.cs`/`AjaxController.cs`）；查證 `Appointments.Photo`（詳情用，上傳圖檔名）與 `Appointments.IsFirstVisit`（存在但列表/匯出皆不讀取，改用動態計算）；查證 `Zipcodes` 有獨立 `City`/`Area` 欄位。
- **真實 DB 實測**（測試日期 2099-01-01/02，避開真實資料；測試會員沿用既有 `B121583140`，測試前確認其無既存預約）：建立 2 個測試管理員（全權限 / 僅 `TaAppointments` 唯讀）驗證授權邊界；台中(Ta)/二林(Ch)/二林齒科(ChDentist) 三分支各建立測試 Roster+RosterCategorys+RosterPeriods+Appointments(含 1 筆已取消)+SmsStatus+MemberQuestions/MemberQuestionAnswers，逐一驗證列表篩選、容量表、詳情問卷 pre-fill、取消（含重複取消/查無預約）、Excel 匯出（用 `openpyxl` 解析實際儲存格內容逐欄核對，含確認「時間」欄無 fallback 留空、民國年生日 `67-02-01` 正確）、問卷 JSON 匯出（含已取消預約）。**二林．齒科（ChDentist）分院在本機開發 DB 完全沒有 Dentist 診別的 `Categorys`/`Periods` 基礎資料**（真實查證：全庫 0 筆），為端對端驗證該分支暫建最小測試用 `Categorys`/`Periods`（`Clinic='Dentist'`），測試完一併刪除；此為既有開發環境資料缺口，非本次功能範圍。測試管理員/預約/排班/簡訊/問卷/暫建基礎資料事後全數清除，SQL 逐表核對零殘留（`Appointments`/`SmsStatus`/`Rosters`/`Periods`/`Categorys`/`Admins`/`MemberQuestions` 皆為 0）。`dotnet build` 全專案 0 warning 0 error。
- **未做**：前端（本次任務範圍僅後端 API；`web-admin` 對應頁面待後續排入）。

## 前端實作紀錄（Done 2026-07-03）

- **程式位置**：`web-admin/src/app/core/services/reserve-api.service.ts`（`RESERVE_SLUG`/`RESERVE_RESOURCE`/`RESERVE_LABEL` 3 組 branch 別名對照 `ta`/`ch`/`chDentist`，比照 `roster-api.service.ts` 同一設計理由）；頁面 `web-admin/src/app/pages/reserve/{reserve-list,appointment-detail,questionnaire-print}.ts`；`core/models.ts` 新增 8 個型別（`AppointmentAdminListItem`/`AppointmentAdminListResult`/`PeriodAmount`/`AppointmentAdminDetail`/`CapacityItemInput`/`CapacityUpdateRequest`/`QuestionnaireExportItem`/`QuestionnaireExportResult`）；路由 `app.routes.ts` 新增 `reserve`/`reserve/print/questionnaire`/`reserve/:id`（無靜態 `data.perm`，資源 key 依 `branch` query param 動態決定，比照 `roster`/`basic/periods`/`basic/categories` 既有慣例）；`menu-route-map.ts` 的 `BUILT_KEYS` 加入 `TaAppointments`/`ChAppointments`/`ChDentistAppointments`（`LIMS_ROUTE_MAP` 3 條路由本已預留）。
- **版面比照舊系統**：`reserve-list.ts` 左窄欄「時段容量表」（設定人數可編輯 input + 預約人數/剩餘人數唯讀 + 確認按鈕呼叫 `updateCapacity`）+ 右寬欄「預約列表」，僅當後端回傳 `periodAmounts` 非空時顯示容量表（對應 ta/ch 的 clinic+categoryId+appointmentDate 三者皆選、或 chDentist 僅需 appointmentDate）。列表 grid 欄位/寬度/對齊已補入 [design/frontend-backend.md](../design/frontend-backend.md) 三個對照表（第 10 頁）；`pageSize` 固定 50（沿用舊系統 `ToPagedList(pageSize: 50)`，與其餘模組的 20 刻意不同）。
- **逐欄比對舊 `TaAppointments.cshtml`/`ViewTaAppointments.cshtml` 發現並修正一處欄位對齊落差**：任務規格原稿標註「項目」欄為靠左（L），但實際讀取舊 `.cshtml` 原始碼確認該欄 `<th>`/`<td>` 皆有 `class="text-center"`，依 [design/frontend-backend.md](../design/frontend-backend.md) 已定案的「判斷標準只有一個：該欄在對應舊 View 是否有 `text-center`」規則，改以實際原始碼為準，「項目」欄最終實作為置中（C），已同步寫入該文件的欄位對齊對照表。
- **詳情頁不設頁籤**：`appointment-detail.ts` 比照本專案「列表頁不設頁籤」定案（見 `design/frontend-backend.md` §RWD），「預約資料」+「問卷」兩段直接上下堆疊，不做舊系統原有的 tab 切換；`questionnaire===null` 時顯示「不需填寫問卷」，同時涵蓋舊系統 3 變體中「ChDentistAppointments 本來就沒有問卷 tab」與「Ta/Ch 有填問卷但尚未作答」兩種情境（單一文案無法區分兩者語意，已知簡化，非誤判）。
- **匯出策略最終決定：問卷改用瀏覽器原生列印，不用 `pdfmake`/`html2pdf`**（取代「風險與未解問題」原先記錄的待實作項）：`questionnaire-print.ts` 呼叫 `exportQuestionnaire` 取得結構化 JSON 後渲染唯讀勾選表格（重用 `member-questionnaire-view.ts` 的表格樣式），頁面自帶「列印」按鈕呼叫 `window.print()`（不自動彈窗）。刻意不引入 `pdfmake`/`html2pdf`：避免新增 npm 依賴、避免 CJK（中文）字型嵌入問題（`pdfmake` 預設字型不含中文，需額外處理 base64 字型檔，維護成本高於瀏覽器原生列印）。列印時透過 `web-admin/src/styles.css` 新增的全域 `@media print` 規則隱藏 `AdminLayoutComponent` 的側欄（`aside`）/頂欄（`header`）/Ribbon（新增 `.app-ribbon` class）/頁尾（`footer`），只印內容本體；列印按鈕本身加 Tailwind `print:hidden`。
- **匯出簽到單 Excel**：`reserve-list.ts` 用 `HttpClient` `responseType:'blob'`+`observe:'response'` 接收，讀 `Content-Disposition` header 解析檔名（失敗則 fallback `${appointmentDate}預約.xlsx`），建立 `<a>`+`URL.createObjectURL`+click 觸發瀏覽器下載後 `revokeObjectURL`。匯出前（Excel 與問卷列印皆同）以 `alert()` 擋下未選 clinic（僅 ta/ch 需要）/appointmentDate 的情況，忠實比照舊系統 `btnExport`/`btnQuestionExport` 的 JS 前置檢查行為（含訊息文案「請選擇項目！」/「請選擇預約日期！」）。
- **驗證**：`ng build` 0 error；`tsc --noEmit` 額外確認 0 型別錯誤；編譯後 `styles-*.css` 已逐一比對確認新用到的 Tailwind class（含 `lg:w-80`/`lg:flex-row`/`disabled:opacity-30`/`disabled:cursor-not-allowed`/`print:hidden`/`break-inside-avoid`/自訂 `@media print` 選擇器）皆正確產生對應規則。**未做**：瀏覽器互動實測（本次會話無 Playwright/chrome-devtools 工具可用，僅型別檢查+編譯+編譯後 CSS 比對，誠實記錄未做的部分，比照本專案其餘模組一貫做法），建議下次有瀏覽器工具時針對「篩選+容量編輯送出+詳情頁瀏覽+取消+Excel 下載+問卷列印頁渲染」逐一驗證。

## 風險與未解問題
- **二林．齒科（ChDentist）分院基礎資料缺口**：本機開發 DB 目前無任何 `Clinic='Dentist'` 的 `Categorys`/`Periods` 資料，正式環境資料庫是否有對應資料未經本次驗證（僅驗證程式邏輯正確，未驗證正式環境資料完整性）；若正式環境同樣缺漏，`ch-dentist` 端點會因缺少可選科別/時段而無法正常預約流程（非本模組問題，但會影響驗收體感）。
- 前端頁面尚未經瀏覽器互動實測（見上方「前端實作紀錄」未做段落），建議正式上線前補做一次端對端點擊驗證。

## 對應舊系統
- [old/blueprints/backend-admin.md](../old/blueprints/backend-admin.md) §ReserveMs
- `reference/old/20SkinBackend/Controllers/ReserveMsController.cs`
