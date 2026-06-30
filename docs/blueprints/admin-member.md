---
title: 後台會員管理
purpose: 會員查詢/編輯、黑名單、問卷答案檢視與維護（無新增/刪除會員，沿用舊範圍）
status: draft
applicable_when: 要實作或修改後台會員資料維護、黑名單、會員問卷檢視時
related_agents:
  - software-architect-blueprint
  - backend-engineer
  - frontend-architect
related_docs:
  - ../design/frontend-backend.md
  - ../design/api-design.md
  - ../design/database-design.md
  - questionnaire.md
keywords: [admin, member, blacklist, member-questions, edit]
last_updated: 2026-06-30
---

## 背景與動機
員工維護病患資料與黑名單、檢視問卷。舊 `MemberMsController`：會員只有查詢/編輯（無新增/刪除），問卷答案 CRUD。

## 範圍
### 做什麼
- 會員列表（篩選：分院/編號/生日）+ 分頁；含初診判斷與就診分院。
- 編輯會員（姓名/手機/生日/性別/血型/email/地址/過敏史/病史/黑名單）。
- 會員問卷答案檢視/新增/編輯/刪除（含檔案）。
### 不做什麼
- 不新增/刪除會員（沿用舊範圍）。
- 不改 schema（過敏史/病史沿用 CSV 字串欄位）。

## 使用者流程
```
/member → 篩選列表 → 編輯會員(含黑名單切換)
/member/{id}/questionnaires → 檢視/新增/編輯/刪除問卷答案
```

## 設計決策
- **過敏史/病史**：DB 為 CSV 字串（沿用）；前端以陣列 ↔ CSV 轉換。
- **黑名單** `IsBlackList`：後台可切換；登入端據此擋（見 [member-auth.md](member-auth.md)）。
- 問卷答案維護重用問卷渲染（見 [questionnaire.md](questionnaire.md)）。
- 列表初/複診判斷用 group 查詢避免 N+1。

## 跨層影響
| 層級 | 影響 | 摘要 |
|---|---|---|
| 前端 | 是 | Member 模組（列表/編輯/問卷答案） |
| 後端 | 是 | MemberController(admin) + Service |
| API | 是 | `/api/members`、`/{id}`、`/{id}/questionnaires`、`/api/member-questions` |
| 資料庫 | 否 | 讀寫既有 Members/MemberQuestions |
| 安全 | 是 | 依 perms 授權；PII 處理 |

## 驗收標準
- [ ] 列表篩選 + 分頁 + 初診判斷
- [ ] 編輯（含過敏史/病史 CSV、黑名單）
- [ ] 問卷答案 CRUD（含檔案）
- [ ] 依 perms 授權

## 風險與未解問題
- PII（身分證/病史）顯示與 log 需遵循 [security.md](../design/security.md)（不記敏感資料）。

## 對應舊系統
- [old/blueprints/backend-admin.md](../old/blueprints/backend-admin.md) §MemberMs
- `reference/old/20SkinBackend/Controllers/MemberMsController.cs`、`Models/ViewModels/`
