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
keywords: [booking, appointment, capacity, outpatient-number, duplicate, cancel, doctor, designated]
last_updated: 2026-07-01
---

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
- **自動門診號**（`Branchs.IsAutoRowNumber=true`，台中健保）：從 `Periods.StartNumber`(預設 2) 起每次 +2 取偶數，掃描現有 `OutpatientNum` 找首個空缺。
- **重複預約限制**：台中同診別**前後 2 天內**不可重複（且不可當天）；其他分院同診別**當天**不可重複。→ **改為依 Branch 設定/DB 驅動，移除硬編碼 GUID**（舊 `e65f4720…`）。
- **問卷強制**：`Category.IsQuestion=true` 須先完成對應問卷。
- **並發**：建立預約以 transaction 包「容量檢查+INSERT+SmsStatus 雙寫」；以 isolation/重試降低超賣（不可加 unique constraint）。
- **時段資料**：API 回 JSON（取代舊 HTML 片段）。
- **IDOR 修正**：詳情/取消加 `Appointment.MemberID == JWT.sub`。

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
- [ ] 重複限制（台中±2天 / 其他當天）正確且來自設定非硬編碼
- [ ] 取消 >1 小時限制 + 標記未發 SMS=CANCEL
- [ ] 並發不超賣
- [ ] 詳情/取消有歸屬檢查（IDOR）

## 風險與未解問題
- 並發超賣（無 unique constraint 可用）→ 靠 transaction/重試，需壓測。
- 重複限制規則「來源」需定（Branch 欄位 or 設定檔）。

## 對應舊系統
- [old/design/frontend-customer.md](../old/design/frontend-customer.md)、[old/blueprints/customer-booking.md](../old/blueprints/customer-booking.md)
- `reference/old/20Skin/Controllers/MainMsController.cs`（建立/自動編號）、`AjaxController.cs`（GetRosters/CheckAppointmentDate）
