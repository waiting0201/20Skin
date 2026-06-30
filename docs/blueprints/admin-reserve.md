---
title: 後台預約管理
purpose: 預約查詢（多條件/分頁）、詳情、取消、時段容量批次更新、簽到單 Excel 與問卷 PDF 匯出，clinic 參數化
status: draft
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
keywords: [admin, reserve, appointment, export, excel, pdf, capacity, cancel]
last_updated: 2026-06-30
---

## 背景與動機
員工查看與處理病患預約。舊 `ReserveMsController`(~1,225 行) 三組變體 + NPOI/iTextSharp 匯出。重寫參數化 + 雲端匯出。

## 範圍
### 做什麼
- 預約列表：多條件篩選（診別/項目/日期/會員編號/手機/姓名/生日）+ 分頁 + 時段名額統計。
- 詳情（含問卷作答）、取消（Status=0 + 標記未發 SMS=CANCEL）。
- 時段容量批次更新（`Periods.Patients`/`RosterPeriods.Patients`）。
- 匯出：簽到單 Excel、問卷 PDF。
### 不做什麼
- 不改 schema。

## 使用者流程
```
/reserve?clinic=&branch= → 篩選列表(+名額統計) → 詳情 / 取消 / 匯出
取消 → Status=0 + 未發 SmsStatus=CANCEL（見 sms-reminder）
匯出 → /api/appointments/export/checkin(.xlsx) 或 /questionnaire(.pdf)
```

## 設計決策
- **避免 N+1**：列表用一次 group 查詢算初/複診（沿用舊優化思路，Dapper 單次 SQL 投影）。
- **匯出**：Excel 改 `ClosedXML`/OpenXML（`.xlsx`，去 65536 列上限）；問卷 PDF 優先前端 `pdfmake`/`html2pdf`（後端回 JSON），或後端 PDF。見 [frontend-backend.md](../design/frontend-backend.md)。
- **clinic/branch 參數化**取代三組變體（含齒科無 clinic/category 篩選的差異）。
- **取消**與簡訊標記在同一 transaction。

## 跨層影響
| 層級 | 影響 | 摘要 |
|---|---|---|
| 前端 | 是 | Reserve 模組（列表/詳情/取消/匯出/容量編輯） |
| 後端 | 是 | AppointmentController(admin) + Service + 匯出 |
| API | 是 | `/api/appointments`(admin 篩選)、`/cancel`、`/export/{checkin\|questionnaire}`、容量批次 |
| 資料庫 | 否 | 讀寫既有 Appointments/SmsStatus/Periods |
| 安全 | 是 | 依 perms 授權 |

## 驗收標準
- [ ] 多條件篩選 + 分頁 + 名額統計
- [ ] 取消同步標記未發 SMS=CANCEL
- [ ] 容量批次更新生效
- [ ] Excel(.xlsx) / PDF 匯出內容正確（含民國年/初診判斷）
- [ ] clinic/branch 參數化

## 風險與未解問題
- 匯出 PDF 前端 vs 後端方案需定（中文字型）。

## 對應舊系統
- [old/blueprints/backend-admin.md](../old/blueprints/backend-admin.md) §ReserveMs
- `reference/old/20SkinBackend/Controllers/ReserveMsController.cs`
