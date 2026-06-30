---
title: 後台基礎資料管理
purpose: 分院/醫師/時段/科別項目/問卷 主檔 CRUD 與排序，clinic 參數化取代舊 Ta/Ch/ChDentist 變體
status: draft
applicable_when: 要實作或修改後台主檔維護（分院/醫師/時段/科別/問卷）時
related_agents:
  - software-architect-blueprint
  - backend-engineer
  - frontend-architect
related_docs:
  - ../design/frontend-backend.md
  - ../design/api-design.md
  - ../design/database-design.md
  - questionnaire.md
keywords: [admin, basic-data, master-data, branch, doctor, period, category, question, crud]
last_updated: 2026-06-30
---

## 背景與動機
後台維護預約所需的主檔。舊系統 `BasicMsController`(~1,427 行) 把時段等拆成 Ta/Ch/ChDentist(+Cosmetic) 多套幾乎相同程式碼。重寫**參數化**消除重複。

## 範圍
### 做什麼
- 分院（含圖片）、醫師、時段（各院各診別）、科別項目（Skin/Cosmetic）、問卷類型/題目/選項 的 CRUD + 排序。
- 圖片上傳走 Blob（見 [file-upload.md](file-upload.md)）。
- 問卷類型/題目刪除＝軟刪除（`IsEnabled=false`，沿用）。
### 不做什麼
- 不改 schema；不重建變體頁（改參數化）。

## 使用者流程
```
/basic/periods?clinic=skin&branch={id} → 列表/新增/編輯/刪除/排序（單一元件吃參數）
科別啟用問卷(IsQuestion) → 驗證已有 QuestionType 才可存
```

## 設計決策
- **clinic/branch 參數化**：單一 Controller/元件 + query 參數取代舊 15+ 變體（[modernization.md](../old/modernization.md) A5）。
- **時段** `BranchID`/`Clinic` 由參數帶入（舊由 Controller 硬設）。
- **刪除前置檢查**：醫師/分院/時段有關聯（排班/預約）則擋（沿用）。
- 問卷題目編輯：比對新舊 answerID 做增/改/刪（沿用）。

## 跨層影響
| 層級 | 影響 | 摘要 |
|---|---|---|
| 前端 | 是 | Basic 模組各實體 list/form 元件（參數化） |
| 後端 | 是 | BasicData Controllers + Services |
| API | 是 | `/api/branches|doctors|periods|categories|question-types|questions`（`?clinic=`） |
| 資料庫 | 否 | 讀寫既有主檔表 |
| 安全 | 是 | 依 perms 授權 |

## 驗收標準
- [ ] 各主檔 CRUD + 排序
- [ ] clinic/branch 參數化（無硬編碼 GUID）
- [ ] 刪除前置檢查
- [ ] 問卷軟刪除、題目選項差異更新
- [ ] 圖片走 Blob

## 風險與未解問題
- 各診別細微差異（舊變體間）需逐一比對確認可參數化。

## 對應舊系統
- [old/blueprints/backend-admin.md](../old/blueprints/backend-admin.md) §BasicMs、[old/design/frontend-backend.md](../old/design/frontend-backend.md)
- `reference/old/20SkinBackend/Controllers/BasicMsController.cs`
