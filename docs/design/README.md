---
title: 新系統設計文件索引
purpose: docs/design 各層級設計文件的索引（新系統：兩 Angular SPA + Azure Functions .NET 10 + reused DB）
applicable_when: 要查新系統某一層設計、或開始規劃/撰寫新設計文件時
related_agents:
  - software-architect-blueprint
  - system-analyst
related_docs:
  - ../project-overview.md
  - ../architecture.md
  - ../old/README.md
  - ../old/modernization.md
keywords: [design, index, 新系統, angular, azure-functions]
last_updated: 2026-06-30
status: draft
---

# 新系統設計文件（docs/design）

新系統＝**客戶前台 Angular SPA + 後台 Angular SPA + Azure Functions(.NET 10) API**，沿用營運中的 SQL Server `20Skin`（schema 不可改）。總覽見 [../project-overview.md](../project-overview.md)、架構見 [../architecture.md](../architecture.md)。

| 文件 | 內容 |
|---|---|
| [database-design.md](database-design.md) | 沿用 schema、Dapper 存取、禁改 schema 與衍生限制 |
| [api-design.md](api-design.md) | 自訂 router MVC、REST 慣例、端點目錄、回應/錯誤格式 |
| [backend-design.md](backend-design.md) | Functions 專案結構、分層、Domain services、交易 |
| [security.md](security.md) | JWT 認證授權、claims、密碼/refresh 限制與緩解 |
| [frontend-customer.md](frontend-customer.md) | 客戶前台 Angular（signals/Tailwind/reservation store） |
| [frontend-backend.md](frontend-backend.md) | 後台 Angular（權限選單、clinic 參數化、匯出） |
| [visual-design.md](visual-design.md) | 視覺不改：main.css / SmartAdmin → Tailwind 對應 |
| [infrastructure.md](infrastructure.md) | 部署（Static Web Apps + Functions）、Blob/Key Vault/排程/CI-CD |
| [frontend-coding-style.md](frontend-coding-style.md) | Angular 編碼慣例 |
| [backend-coding-style.md](backend-coding-style.md) | .NET 10 / Functions 編碼慣例 |

> 每份皆含「對應舊系統」連結到 [../old/](../old/)。功能規格見 [../blueprints/](../blueprints/)。
