---
title: 舊系統參考文件索引（docs/old）
purpose: docs/old 是舊版 20Skin（.NET Framework）系統的逆向分析與設計參考；新系統規劃請看 docs/ 頂層
applicable_when: 要查舊系統任一面向（業務 / 前台 / 後台 / 資料庫 / 架構 / 安全 / 部署）、或在規劃新系統時對照舊行為
related_agents:
  - system-analyst
  - software-architect-blueprint
related_docs:
  - ../status.md
  - modernization.md
keywords: [old-system, legacy, reference, index, 舊系統, 參考]
last_updated: 2026-06-30
status: reference-only
---

# 舊系統參考文件（docs/old）

本資料夾是對 [reference/old/](../../reference/old/) **舊版 20Skin 系統**（.NET Framework 4.8、ASP.NET MVC5、EF6 Database-First）的完整逆向分析，**僅供新系統規劃時參考**，不代表新系統設計。新系統的規劃文件放在 `docs/` 頂層（design/、blueprints/）。

## 文件導覽

| 主題 | 文件 |
|---|---|
| 系統定位 / 一頁式簡介 | [overview.md](overview.md) |
| 業務 / 6 子專案總覽 / 技術約束 | [project-overview.md](project-overview.md) |
| 6 專案分層 / 依賴 / 執行邊界 | [architecture.md](architecture.md) |
| 資料庫 20 張表 / FK / 列舉值 | [design/database-design.md](design/database-design.md) |
| 客戶前台設計 | [design/frontend-customer.md](design/frontend-customer.md) |
| 後台設計 | [design/frontend-backend.md](design/frontend-backend.md) |
| 後端服務 / 資料流 | [design/backend-design.md](design/backend-design.md) |
| API / endpoint 慣例 | [design/api-design.md](design/api-design.md) |
| 認證 / 授權 / Session | [design/security.md](design/security.md) |
| 部署 / IIS / 排程 | [design/infrastructure.md](design/infrastructure.md) |
| 視覺 / 編碼風格 | [design/visual-design.md](design/visual-design.md)、[design/frontend-coding-style.md](design/frontend-coding-style.md)、[design/backend-coding-style.md](design/backend-coding-style.md) |
| 功能藍圖 | [blueprints/customer-booking.md](blueprints/customer-booking.md)、[blueprints/backend-admin.md](blueprints/backend-admin.md)、[blueprints/sms-reminder.md](blueprints/sms-reminder.md) |
| 已知陷阱 / 踩雷 | [gotchas.md](gotchas.md) |
| **重建必修清單（給新系統）** | [modernization.md](modernization.md) |

## 系統速覽

| 項目 | 內容 |
|---|---|
| 平台 | .NET Framework 4.8、ASP.NET MVC 5.2.7、EF 6.4.4（Database-First edmx） |
| 資料庫 | SQL Server `(local)`，catalog `20Skin`，19 DbSet / 20 表 |
| 分院 | 台中院（Ta）、二林院（Ch）、二林齒科院（ChDentist） |
| 診別 | Skin（健保）/ Cosmetic（醫美）/ Dentist（牙科） |
| 6 專案 | `20Skin`（前台）、`20SkinBackend`（後台）、`20Skin.Service`、`20Skin.Models`、`20Skin.Libs`、`CheckSms` |
| 正式站 | `http://booking.20skin.tw/` |

> 本機無 SQL Server 客戶端，資料庫 schema 以 EF Database-First 逆向模型為準。
