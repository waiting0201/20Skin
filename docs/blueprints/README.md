---
title: Blueprints 索引
purpose: 列出所有功能藍圖，方便查找與了解 20Skin 功能全貌
applicable_when: 想了解 20Skin 有哪些功能、要找特定功能的設計文件、要新增功能藍圖
related_agents:
  - software-architect-blueprint
related_docs:
  - _template.md
  - ../architecture.md
  - ../project-overview.md
keywords: [blueprints, 藍圖, 功能, 索引]
last_updated: 2026-07-04
---

> 本資料夾為**新系統**功能藍圖。舊系統功能藍圖見 [../old/blueprints/](../old/blueprints/)。每份新藍圖皆含「對應舊系統」連結。

## 如何新增藍圖

1. 複製 [_template.md](_template.md) 為 `<feature-name>.md`
2. 填入 frontmatter（特別注意 `related_agents` / `related_docs` / `keywords`）
3. 在本檔加入下方表格條目
4. 開發過程中**持續更新** `status` 與 `last_updated`

## 已存在的 Blueprint（新系統，規劃中）

| 功能 | Status | 主要 agent | 連結 |
|---|---|---|---|
| 會員認證（登入/註冊） | draft | backend-engineer / frontend-architect | [member-auth.md](member-auth.md) |
| 客戶線上預約 | draft | backend-engineer / frontend-architect | [customer-booking.md](customer-booking.md) |
| 問卷 | draft | backend-engineer / frontend-architect | [questionnaire.md](questionnaire.md) |
| 簡訊提醒（雙寫+排程） | draft | backend-engineer / deployment-engineer | [sms-reminder.md](sms-reminder.md) |
| 檔案上傳（Blob） | draft | backend-engineer | [file-upload.md](file-upload.md) |
| 後台認證與權限 | draft | backend-engineer / frontend-architect | [admin-auth-authority.md](admin-auth-authority.md) |
| 後台基礎資料 | draft | backend-engineer / frontend-architect | [admin-basic-data.md](admin-basic-data.md) |
| 後台排班 | draft | backend-engineer / frontend-architect | [admin-roster.md](admin-roster.md) |
| 後台預約管理 | draft | backend-engineer / frontend-architect | [admin-reserve.md](admin-reserve.md) |
| 後台會員管理 | draft | backend-engineer / frontend-architect | [admin-member.md](admin-member.md) |
| 後台儀表板 | in-progress | backend-engineer / frontend-architect | [admin-dashboard.md](admin-dashboard.md) |

## Status 定義

- **draft**：規劃中，尚未開發
- **in-progress**：開發中
- **shipped**：已上線
- **deprecated**：已廢棄（保留紀錄供查詢）
