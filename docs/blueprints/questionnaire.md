---
title: 問卷（術前電子病歷）
purpose: 問卷定義（QuestionType→Question→Answer）與會員作答（MemberQuestion→MemberQuestionAnswer），含 IsQuestion 強制與題型處理
status: draft
applicable_when: 要實作或修改問卷顯示/作答/強制邏輯、題型渲染時
related_agents:
  - software-architect-blueprint
  - backend-engineer
  - frontend-architect
related_docs:
  - ../design/frontend-customer.md
  - ../design/api-design.md
  - ../design/database-design.md
  - customer-booking.md
keywords: [questionnaire, question, answer, member-question, option-type, is-question]
last_updated: 2026-06-30
---

## 背景與動機
特定診療項目需病患預約前填術前問卷；醫師看診前可審視。重寫保留結構與強制邏輯。

## 範圍
### 做什麼
- 取問卷定義（依 Category）+ 會員既有答案。
- 作答儲存到 `MemberQuestions` + `MemberQuestionAnswers`（含「其他」自填、檔案）。
- 題型：OptionType 0=單選 / 1=複選 / 2=文字 / 3=檔案。
- `Category.IsQuestion=true` → 預約前強制完成。
### 不做什麼
- 不改問卷表 schema；不做問卷編輯（後台功能，見 admin-basic-data）。

## 使用者流程
```
選項目(IsQuestion) → /booking/questionnaire?questionTypeID= → 依題型渲染
  → 填答(可帶「其他」/上傳) → POST /api/member-questions → 回預約表單
```

## 設計決策
- **題型渲染**：0 radio / 1 checkbox / 2 text(`Other`) / 3 file(`Filename` via 上傳，見 [file-upload.md](file-upload.md))。
- **多選**：寫多筆 `MemberQuestionAnswers`；注意該表**無 FK 到 QuestionAnswers**（[database-design.md](../design/database-design.md)），應用層確保有效 answerID。
- **既有答案 pre-fill**：取會員該 QuestionType 已答帶入。
- 表單索引化改 Angular signal 陣列（取代舊手動遞增 name，較不易錯位）。

## 跨層影響
| 層級 | 影響 | 摘要 |
|---|---|---|
| 前端 | 是 | QuestionnaireComponent / QuestionnaireListComponent（動態題型） |
| 後端 | 是 | QuestionController + MemberQuestionService |
| API | 是 | `/api/question-types?clinic=`、`/{id}`、`POST /api/member-questions` |
| 資料庫 | 否 | 讀寫既有問卷表 |
| 安全 | 是 | 作答綁定 JWT 會員 |

## 驗收標準
- [ ] 四種題型正確渲染與儲存
- [ ] 「其他」自填、檔案上傳可存
- [ ] 既有答案 pre-fill
- [ ] IsQuestion 強制：未填不可完成預約
- [ ] 多選不產生孤兒 answerID

## 風險與未解問題
- `MemberQuestionAnswers` 無 FK → 需應用層驗證。

## 對應舊系統
- [old/design/frontend-customer.md](../old/design/frontend-customer.md)、[old/design/database-design.md](../old/design/database-design.md) §問卷
- `reference/old/20Skin/Views/MainMs/Questions.cshtml`、`MainMsController`（Questions）
