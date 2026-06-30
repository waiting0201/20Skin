---
title: 已知陷阱（新系統）
purpose: 紀錄新系統（Angular SPA + Azure Functions + reused DB）開發中發現的踩雷、反模式、跨層約定，避免重複犯錯
applicable_when: 實作前 sanity check、遇到奇怪現象、code review 時
related_agents:
  - qa-test-engineer
  - code-review-optimizer
related_docs:
  - conventions.md
  - design/database-design.md
  - design/security.md
  - old/gotchas.md
keywords: [gotchas, 陷阱, 踩雷, 反模式, 新系統]
last_updated: 2026-06-30
---

> 新系統陷阱。**舊系統**陷阱見 [old/gotchas.md](old/gotchas.md)（含 reused DB 既有怪癖：時間戳命名不一致、無 FK、列舉值散落等，沿用時務必先讀）。

## reused DB（schema 不可改）衍生

### 不可加索引/欄位/約束
- 密碼雜湊、refresh token 表、unique constraint、補 FK 都**不可做**（會動 schema）→ 一律應用層處理或列待核准項。見 [design/database-design.md](design/database-design.md)。

### 與舊系統並行寫同一 DB
- 新舊系統可能同時讀寫 `20Skin`；欄位語意、列舉值、CASCADE 行為須與舊系統完全相容。Dapper 依「POCO 屬性名＝欄位名」對應，**勿自行「修正」既有怪欄位名**（`Createdate` 小寫 vs `CreateDate`），否則對應不到。

## 待補充

（開發開始後，把新系統實際踩到的雷紀錄於此；格式：症狀 / 影響 / 預防）
