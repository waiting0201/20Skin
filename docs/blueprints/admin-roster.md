---
title: 後台排班管理
purpose: 醫師排班 CRUD、重複展開（每日/每週+截止）、RosterCategorys/RosterPeriods 容量覆蓋，clinic 參數化
status: draft
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
last_updated: 2026-06-30
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
/roster?clinic=&branch= → 列表(篩選日期/醫師)
新增 → 選分院/醫師/日期/班別/診別 + 勾項目 + 各時段人數 + 重複模式/截止 → 展開建立
編輯 → 清空 RosterCategorys/RosterPeriods 再重建（沿用；建議加樂觀鎖）
刪除 → 有有效預約(Status=1)則擋；否則連同取消預約一併刪
```

## 設計決策
- **重複展開**（`RosterDomain`）：迴圈逐日/逐週新增，**每次查重**（BranchID+DoctorID+Clinic+RosterDate+CategoryID）。
- **容量覆蓋**：`RosterPeriods.Patients` 覆蓋 `Periods.Patients`，供預約容量計算（見 [customer-booking.md](customer-booking.md)）。
- **clinic/branch 參數化**取代 5 組變體。
- **並發**：舊「清空再重建」無樂觀鎖（後寫覆蓋）→ 新系統建議加版本/重試（無 RowVersion 欄位可用，靠應用層比對或交易）。

## 跨層影響
| 層級 | 影響 | 摘要 |
|---|---|---|
| 前端 | 是 | Roster 模組（list/add/edit，dual-listbox 選項目、時段人數表） |
| 後端 | 是 | RosterController + RosterDomain（展開）+ Service |
| API | 是 | `/api/rosters`（`?clinic=&branch=`，含展開） |
| 資料庫 | 否 | 讀寫既有 Rosters/RosterPeriods/RosterCategorys |
| 安全 | 是 | 依 perms 授權 |

## 驗收標準
- [ ] 排班 CRUD + 重複展開正確（查重）
- [ ] RosterPeriods 容量覆蓋生效於預約
- [ ] 刪除前置檢查（有有效預約則擋）
- [ ] clinic/branch 參數化
- [ ] 並發編輯不互相覆蓋（樂觀鎖/交易）

## 風險與未解問題
- 無 `RowVersion` 欄位（schema 不可改）→ 樂觀鎖需替代方案。

## 對應舊系統
- [old/blueprints/backend-admin.md](../old/blueprints/backend-admin.md) §ShiftMs、[old/gotchas.md](../old/gotchas.md)（班表無樂觀鎖）
- `reference/old/20SkinBackend/Controllers/ShiftMsController.cs`
