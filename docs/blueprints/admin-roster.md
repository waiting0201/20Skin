---
title: 後台排班管理
purpose: 醫師排班 CRUD、重複展開（每日/每週+截止）、RosterCategorys/RosterPeriods 容量覆蓋，clinic 參數化
status: shipped
applicable_when: 要實作或修改排班（班表）功能、重複排班、時段容量覆蓋時
related_agents:
  - software-architect-blueprint
  - backend-engineer
  - frontend-architect
related_docs:
  - ../design/frontend-backend.md
  - ../design/backend-design.md
  - ../design/api-design.md
  - ../design/database-design.md
  - customer-booking.md
keywords: [admin, roster, shift, repeat, roster-period, capacity, clinic]
last_updated: 2026-07-04T01:00+08:00
---

## 背景與動機
排班決定客戶端可預約的時段與容量。舊 `ShiftMsController`(~2,089 行) 為最複雜模組，5 組變體(Ta/TaCosmetic/Ch/ChCosmetic/ChDentist) 程式碼幾乎相同。重寫參數化。

## 範圍
### 做什麼
- 排班 CRUD（分院/醫師/日期/班別/診別/是否開放預約）。
- 勾選本診次診療項目（`RosterCategorys`）。
- 各時段接診人數（`RosterPeriods`，覆蓋 `Periods` 預設）。
- 重複展開：每日(1)/每週(2)/不重複 + `ExpireDate`。
### 不做什麼
- 不改 schema；不重建變體頁。

## 使用者流程
```
/roster?branch=&clinic= → 列表（5 頁籤 + 篩選日期/醫師 + 分頁）
新增 → 選醫師(可不指定)/日期/班別 + 勾開放科別 + 各時段容量 + 重複模式/截止 → 展開建立，回報跳過的衝突日期
編輯 → RosterCategorys/RosterPeriods 皆為 diff 比對（現有不在送出→刪；送出中新的→增），僅單一天，不含重複設定
刪除 → 有任何 Appointments 引用（不論狀態）即擋
```

## 設計決策
- **Service 完全參數化，Controller 保留變體 proxy**：同 [admin-basic-data.md](admin-basic-data.md) Periods/Categorys 的設計理由——真實 `Lims` 權限仍是變體粒度（`TaRosters`/`ChRosters`/`TaCosmeticRosters`/`ChCosmeticRosters`/`ChDentistRosters`），router 授權是啟動時綁死在單一 method 的靜態屬性，故保留 5 組「瘦」proxy action；分院別名解析重用既有 `PeriodsOptions`（語意通用，避免重複設定）。
- **重複展開**：迴圈逐日(1)/逐週(2)到 `ExpireDate`，每天即時查重（`BranchID+DoctorID+Clinic+RosterDate`），若當天已存在排班**任一個**已含本次送出的**任一個**科別，該天整批跳過（all-or-nothing，沿用舊系統邏輯）；**但改為明確回報跳過的日期**（`RosterCreateResult.SkippedDates`），取代舊系統的靜默跳過（UX 改善，非破壞性）。
- **容量覆蓋**：`RosterPeriods.Patients` 完全取代 `Periods.Patients`（非取較小值/疊加），只有找不到符合條件的 Roster 才退回用 `Periods.Patients`（已驗證自新系統 `BookingService.GetTimeSlotsAsync` 與舊 `MainMsController` 訂位邏輯）。`RosterPeriods` 涵蓋該分院診別**全部** Period 模板，不受 `Rosters.OutpatientTimeID` 篩選（已讀舊碼確認，該欄位只是排班本身班別標記，不影響容量表範圍）。
- **編輯是 diff，非清空重建**（**修正本文件原先錯誤敘述**，已讀 `ShiftMsController.cs` 程式碼確認）：`RosterCategorys` 以 `CategoryID` 為鍵、`RosterPeriods` 以 `PeriodID` 為鍵（新系統簡化：因一個 Roster 對一個 PeriodID 本來就是 1:1，不像舊系統另外用 opaque `RosterPeriodID` 追蹤）。
- **刪除守門改更嚴格**：有任何 `Appointments.RosterID` 引用（不論 `Status`）即擋，不像舊系統「無有效(Status=1)預約就先硬刪已取消的預約再刪排班」（該邏輯是因 `Appointments→Rosters` 為 `NO_ACTION` FK 不清就會被 DB 擋）。新做法保留歷史取消記錄完整性，與 [admin-basic-data.md](admin-basic-data.md) 已建立的 Branchs/Doctors/Periods/Categorys 刪除守門風格一致（使用者已拍板）。
- **修正舊系統兩個欄位遺漏 bug**：(1) 展開產生的 `RosterPeriods` 原本沒複製 `StartNumber`（只有第一天有值）；(2) 編輯 `RosterPeriods` 原本只更新 `Patients` 沒更新 `StartNumber`。新系統兩處皆正確處理（使用者已拍板為非破壞性修正）。
- **並發**：無 `RowVersion` 欄位（schema 不可改），維持既有風險（後寫覆蓋），未額外實作樂觀鎖；diff 式寫入本身已比舊系統的「清空重建」更能局部保留未變更資料，一定程度降低衝突影響範圍。
- **頁面改為忠於舊系統，移除頁籤，並修正 3 處表單/列表落差（2026-07-03 追加，使用者要求「門診管理裡都有同樣的問題，拿掉tab，要跟舊系統對齊表單」）**：與 [admin-basic-data.md](admin-basic-data.md) 的 periods/categories 同一批修正。逐行比對 `TaRosters`/`AddTaRosters`/`EditTaRosters.cshtml`（5 變體結構完全相同）後：
  1. 移除 `rosters-list.ts` 原自創的 5 頁籤切換列（舊系統 5 變體本是各自獨立頁面）。
  2. **列表「項目」欄取代「班別」欄**：舊系統顯示 `RosterCategorys`（依 `Categorys.Sort` 排序）逗號串接的科別標題，完全沒有「班別」（`OutpatientTimeTitle`）欄；初版誤用後者。已在 `RosterListItemDto` 加 `CategoryTitles`（`RosterAdminService.ListAsync` 用 `STRING_AGG(...) WITHIN GROUP (ORDER BY c.Sort)` 子查詢取得）。
  3. **「需預約」只在有選醫師時顯示**：查證舊 `$("#DoctorID").change` 行為（清空醫師會強制取消勾選並隱藏該欄位），初版誤做成常駐顯示。已在 `roster-form.ts` 加 `onDoctorChange()` 條件顯示+重置。
  4. **「門診日期」新增與編輯皆可改**：查證舊 `EditTaRosters` POST 的 `TryUpdateModel` 白名單明確含 `RosterDate`，初版誤判為編輯不可改日期而整個隱藏。已在 `RosterUpdateRequest` 補上 `RosterDate` 欄位、`RosterAdminService.UpdateAsync` 一併更新該欄位；舊系統編輯時對新日期不重新查衝突，新系統維持同樣寬鬆行為。
  5. **「起始號碼」改唯讀**：查證舊系統該值一律是 hidden input（直接複製 `Periods.StartNumber` 模板值），從未提供編輯介面；初版誤做成可編輯輸入框。已改為純文字顯示，只有「人數」可編輯。
  詳見 [design/frontend-backend.md](../design/frontend-backend.md) §rosters-list 不設頁籤。
- **移除「班別」欄位 + 「重複」用詞/順序改回舊系統（同日追加，使用者回饋「門診表單要參照舊系統」）**：再次逐行核對 `AddTaRosters`/`EditTaRosters.cshtml` 後發現「班別」（`OutpatientTimeID`）下拉整段被 Razor 註解隱藏（第 107–113 行），從未實際渲染，屬死碼——`Rosters.OutpatientTimeID` 因此一律維持建立時預設值不變，且客戶預約真正讀取的時間欄位是 `Periods.OutpatientTimeID`（`BookingService` join 路徑），與 `Rosters.OutpatientTimeID` 無關，拿掉此欄位不影響預約流程。初版誤將此死碼欄位做成可互動下拉，已移除（表單欄位保留但不渲染：新增固定送 `null`，編輯原樣回傳既有值不覆寫）。同時「重複」單選鈕文字/順序改回舊系統原詞「每天/每周/永不」（原「不重複/每日/每週」），「截止日」改回舊 placeholder「重複結束日期」。

## 跨層影響
| 層級 | 影響 | 摘要 |
|---|---|---|
| 前端 | 是 | `pages/roster/{rosters-list,roster-form}`（5 頁籤 + 分頁篩選、動態時段容量表 + 科別多選 + 重複模式） |
| 後端 | 是 | `RostersAdminController`（5 組 proxy）+ `RosterAdminService`（展開演算法 + diff） |
| API | 是 | `admin/rosters/{ta-skin\|ta-cosmetic\|ch-skin\|ch-cosmetic\|ch-dentist}`（見 [api-design.md](../design/api-design.md)） |
| 資料庫 | 否 | 讀寫既有 `Rosters`/`RosterCategorys`/`RosterPeriods` |
| 安全 | 是 | 依變體粒度 perms 授權（已驗證授權邊界） |

## 驗收標準
- [x] 排班 CRUD + 重複展開正確（查重，含跳過日期回報）
- [x] RosterPeriods 容量覆蓋生效於預約（沿用既有 `BookingService` 讀取邏輯，未變更）
- [x] 刪除前置檢查（有任何預約引用即擋，比舊系統更嚴格）
- [x] clinic/branch 參數化（無硬編碼 GUID，重用 `PeriodsOptions`）
- [ ] 並發編輯不互相覆蓋（樂觀鎖/交易）——**未完全解決**，見風險段

## 實作紀錄（Done 2026-07-02）

- **程式位置**：API `Skin.Services/Roster/{IRosterAdminService,RosterAdminService}`、`20Skin.Api/Controllers/RostersAdminController`、DTO `Skin.Core/Dtos/RosterDtos.cs`；前端 `web-admin/src/app/core/services/roster-api.service.ts`、`pages/roster/{rosters-list,roster-form}.ts`。
- **Phase 0（研究）**：對真實 DB 查證 `RosterCategorys→Rosters`/`RosterPeriods→Rosters` 皆 `CASCADE`，`Appointments→Rosters` 為 `NO_ACTION`；直接讀 `ShiftMsController.cs` 用 diff 比對 5 組變體確認純複製貼上（僅 BranchID/Clinic 常數不同）；讀程式碼證實編輯是 diff 非清空重建、容量覆蓋語意、RosterPeriods 涵蓋範圍不受班別篩選。
- **真實 DB 實測**（測試日期 2099-01-01~04，避開真實資料）：單一排班建立三表正確寫入；每日重複展開 4 天，其中刻意製造 1 天衝突 → 正確跳過並回報於 `skippedDates`，其餘 3 天正確建立；展開出的非首日排班 `RosterPeriods.StartNumber` 正確複製（驗證 bug 已修正，非 NULL）；編輯 diff（替換科別、更新+移除時段）逐一驗證正確；刪除守門對「僅有已取消(Status=0)預約引用」的排班正確擋下（驗證更嚴格政策生效）；無引用的測試排班可正常刪除；**授權邊界測試**（僅 `ChRosters` 權限呼叫 `ta-skin` 端點）讀取正確回 403；測試管理員/預約/排班事後清除零殘留。`dotnet build`/`ng build` 皆 0 warning。
- **未做**：前端瀏覽器互動點擊驗證（無 chrome-devtools/Playwright 可用，僅驗證 `ng build` + SPA 路由 200 回應 + 後端完整 E2E，同 [admin-basic-data.md](admin-basic-data.md) 的既有限制）。

## 風險與未解問題
- 無 `RowVersion` 欄位（schema 不可改）→ 樂觀鎖仍無法實作，並發編輯排班仍是後寫覆蓋（風險範圍已因 diff 寫入縮小，但未消除）。

## 對應舊系統
- [old/blueprints/backend-admin.md](../old/blueprints/backend-admin.md) §ShiftMs、[old/gotchas.md](../old/gotchas.md)（班表無樂觀鎖）
- `reference/old/20SkinBackend/Controllers/ShiftMsController.cs`
