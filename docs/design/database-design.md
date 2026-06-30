---
title: 資料庫設計（沿用）
purpose: 規範新系統如何沿用營運中的 SQL Server 20Skin schema：以 Dapper + 參數化 SQL 存取、禁止 schema 變更、列出衍生限制與處理
applicable_when: 要寫資料存取、寫查詢 SQL、查欄位、處理 GUID/ntext/缺 FK、或評估任何 schema 相關需求時
related_agents:
  - backend-engineer
  - system-analyst
related_docs:
  - ../old/design/database-design.md
  - backend-design.md
  - security.md
  - ../project-overview.md
keywords: [database, schema, reused, dapper, sql, micro-orm, sql-server, 沿用]
last_updated: 2026-06-30
status: draft
---

> **schema 真相在舊文件**：完整 20 張表欄位定義、ER、列舉值見 [old/design/database-design.md](../old/design/database-design.md)。本文只規範「新系統如何沿用」。

## 核心原則：schema 完全不可改

資料庫 `20Skin` **正在營運**，新舊系統可能並行一段時間，因此：

- **禁止** `ALTER` / `CREATE` / `DROP` 任何表、欄位、索引、約束。
- 新系統只能**讀寫既有欄位**，行為須與舊系統相容（同一 DB 同時被舊系統使用）。
- 任何「需要動 schema」的需求（密碼雜湊欄位、refresh token 表、audit 欄位、補 FK），一律列為**待核准的後續項**，不在本次實作；見各 doc 的延後項。

## 存取方式：Dapper + 參數化 SQL（決策 2026-06-30）

**決策**：資料層用 **Dapper**（micro-ORM），不用 EF Core。
**理由**：DB 為 reused、schema 不可改、無 migration、無 schema ownership；Dapper 直接對既有表下手寫參數化 SQL，無 DbContext/migration/變更追蹤包袱，對「沿用」情境最輕量、最可控，且效能佳。EF Core 的 DbContext/scaffolding 對此情境是多餘負擔。

| 項目 | 做法 |
|---|---|
| 連線 | `IDbConnectionFactory` → `SqlConnectionFactory`（`Microsoft.Data.SqlClient`），DI singleton；每次操作 `using var conn = factory.Create()` |
| 查詢 | Dapper `QueryAsync` / `QueryFirstOrDefaultAsync` + **參數化** `@param`（防 injection）；手寫 SQL |
| 寫入 | Dapper `ExecuteAsync`；多步驟以 `IDbTransaction` 包覆（見 [backend-design.md](backend-design.md) 交易段） |
| 實體 | 純 POCO（`Skin.Data/Entities`），Dapper 依「屬性名 = 欄位名」對應；無 EF 註解、無導覽屬性 |
| Repository | **不沿用**舊 `GenericRepository`/`BaseService`；SQL 寫在各 Service（見 [backend-design.md](backend-design.md)） |

## POCO 對應注意點（沿用既有怪癖）

| 怪癖 | 處理 |
|---|---|
| 全 GUID PK（多數表） | 新增時於應用層產生 `Guid`（`Guid.NewGuid()`），INSERT 帶入 |
| `OutpatientTimes` / `Lims` / `Zipcodes` int identity PK | INSERT 後用 `SELECT SCOPE_IDENTITY()` 取回 |
| `SmsStatus.SmsBody` 為 `ntext`（已棄用） | 沿用（不可改）；Dapper 對應 `string`；**不**改 nvarchar(max)（屬 schema 變更） |
| `MemberQuestionAnswers.QuestionAnswerID` 無 FK | SQL 自行 join，注意孤兒資料 |
| 時間戳命名不一致（`Createdate` vs `CreateDate`） | POCO 屬性名須**完全比照欄位名**（Dapper 依名對應），勿「修正」大小寫 |
| CASCADE 刪除（FK 既定） | 沿用；刪除高風險實體（Members/Branchs）前在 Service 加前置檢查 |
| 列舉值散落（Status/BranchType/Gender/OptionType） | 在 `Skin.Core/Constants` 定義對照，值見 [old/design/database-design.md](../old/design/database-design.md) §列舉值對照 |
| 無唯一索引（Members.Number / Admins.Username） | DB 未強制，應用層查重；**不**新增 unique index（schema 變更） |

> 已實作範例：`Skin.Data/Entities/Members.cs`（POCO）、`Skin.Data/IDbConnectionFactory.cs`、`Skin.Services/MemberService.cs`（Dapper 參數化查詢）。

## 必保留的資料層邏輯（連到新系統實作位置）

| 邏輯 | 涉及表 | 規格出處 |
|---|---|---|
| 預約容量 | `RosterPeriods` / `Periods` / `Appointments` | [blueprints/customer-booking.md](../blueprints/customer-booking.md) |
| 自動門診號 | `Appointments.OutpatientNum` / `Periods.StartNumber` / `Branchs.IsAutoRowNumber` | 同上 |
| 重複預約限制 | `Appointments`（依 Branch 規則） | 同上 |
| 簡訊雙寫 | `SmsStatus` | [blueprints/sms-reminder.md](../blueprints/sms-reminder.md) |
| 權限 | `Admins` / `Lims` / `AdminLims` → JWT claims | [design/security.md](security.md)、[blueprints/admin-auth-authority.md](../blueprints/admin-auth-authority.md) |

## 並發

舊系統「`COUNT` + `INSERT`」無交易隔離，極端並發可超賣。新系統在 Service 以 Dapper `IDbTransaction` + 適當 isolation level（或 `UPDLOCK`/`HOLDLOCK` 提示）處理；**不可**靠新增 unique constraint（schema 變更）。詳見 [blueprints/customer-booking.md](../blueprints/customer-booking.md) 風險段。
