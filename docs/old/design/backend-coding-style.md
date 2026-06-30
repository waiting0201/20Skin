---
title: 後端程式碼風格（C# / SQL）
purpose: 20Skin 後端 C# 與 SQL 撰寫風格指南；針對 .NET Framework 4.8 / MVC 5 / EF6 慣例，作為 code review 客觀依據
applicable_when: 撰寫 / review 後端 C# 或 SQL、設定 lint rule、新人 onboarding
related_agents:
  - backend-engineer
  - code-review-optimizer
related_docs:
  - backend-design.md
  - api-design.md
  - database-design.md
  - security.md
  - ../conventions.md
keywords: [coding-style, backend, csharp, sql, ef6, style-guide]
last_updated: 2026-05-26
---

## 0. 元規則

四條原則優先於後續所有具體規則：

1. **可驗證 > 願望**：每條規則應對應到 compiler warning、analyzer rule、或 review checklist；無法自動驗證的標 `[guideline]`
2. **一致 > 個人偏好**：要改就改規則本身（PR 改本檔）
3. **清楚 > 簡短**：除非簡短就清楚
4. **入口驗證、內部信任**：Controller 做完整輸入驗證；Service / Models 層 trust 上層，不重複 null check

## 1. 通則

### 結構

- **Early return** 勝過多層 nesting（≥ 3 層觸發拆分檢討）
- 函式單一職責；超過 ~50 行考慮拆分（`[guideline]`）
- 檔案 ≥ 300 行考慮拆分（`[guideline]`）
  - **既有現況**：`ShiftMsController` ~92KB / `ReserveMsController` ~57KB 為歷史包袱；新功能盡量下沉到 Service，勿再加大這兩個檔案
- 偏好純函式（無副作用）；副作用集中於 Controller / Service 邊界

### 命名

- 表達意圖、避免無意義縮寫
- Boolean：`Is` / `Has` / `Can` 前綴；避免雙重否定
- C# async 方法：`XxxAsync` 後綴（注意：**本專案絕大多數 Service 為 sync**；改 async 需配套修 Controller）

### 註解

- 預設**不寫**；只寫 **why**，不寫 what
- TODO / FIXME 必含 owner 或 issue 連結
- 公開 API 寫 XML doc（`/// <summary>`）

### Magic numbers / 設定值

- 抽常數放 `20Skin.Libs/Definition.cs`
- 環境差異值放 `Web.config` `appSettings`（不寫死於 code）
- **既有現況**：`ReserveMsController.TaAppointments` 硬編碼 `BranchID = Guid("e65f4720…")`、`PostCancel` 硬編碼 `now + 9h` 時區補正 — 屬遺留陷阱，新功能勿仿效

### 日期 / 時區 / 金額

- DB 欄位 `datetime` 預設**本地時間**（既有現況：`Createdate` / `AppointmentDate` 等）
- C# 端用 `DateTime`（既有沿用）；新功能可考慮 `DateTimeOffset` 但需配套
- 金額用 `decimal`；**不**用 `double` / `float`
- 單位明確（`durationMinutes`、`amountTwd`）

### Logging

- **既有現況**：無結構化 log；ASP.NET 預設行為 + IIS log + Event Log
- 重要操作（登入、預約建立、SMS 發送結果）寫入對應 DB 表（如 `SmsStatus`）
- **不** log PII / Password / API key（cross-link [security.md](security.md)）

### Test 風格

- AAA pattern（Arrange-Act-Assert）
- Test 名稱表達意圖：`Should_<behavior>_When_<condition>`
- **既有現況**：專案目前**無單元測試**；新功能建議補 xUnit / NUnit
- 整合測試碰 DB 需用獨立 schema 或 transaction rollback

### Error message

- **對使用者**（View / TempData）：友善、可行動，不洩漏 stack
- **對開發者**（IIS log / Event Log）：詳細
- AJAX 錯誤碼遵循 [api-design.md](api-design.md)

### Defensive programming 邊界

- Controller 做完整輸入驗證（Data Annotation + `ModelState.IsValid`）
- Service 層 trust Controller，不重複 null check
- 對外部呼叫（SQL、智邦通訊 SMS API）必設 timeout

## 2. C# / .NET Framework 4.8

### 基礎

- .NET Framework 4.8（**非 .NET Core**），語法上限為對應的 C# 版本（依 csproj `<LangVersion>` 設定）
- **Nullable reference types** 未開啟（Framework 4.8 不支援 first-class）；判 null 仍須手動
- 偏好 `readonly` 欄位；常數用 `const`（值型別）或 `static readonly`（參考型別）
- `var` 政策：當右側型別明顯時用 `var`；否則寫明型別

### Naming

- 類別 / 方法 / 屬性：`PascalCase`
- 私有欄位：本專案沿用 `_camelCase`（既有 BaseService.cs 慣例）
- Interface：`IXxx`（如 `IBaseService<T>`、`IResult`）
- 常數：`PascalCase`（C# 慣例）

### LINQ

- 偏好可讀性；複雜 query 拆多步
- 避免在熱路徑連續 `.ToList()` / `.ToArray()`
- `IEnumerable` vs `IQueryable` 區分清楚（前者記憶體、後者 DB）
- **EF6 慣例**：寫入用 `db.Entities.Add() / Remove()` 後一次 `SaveChanges()`；跨表交易用 `using (var tx = db.Database.BeginTransaction()) { ... tx.Commit(); }`

### Async

- 本專案 Service 大量為 sync；新增異步請評估 controller 鏈影響
- 若改 async：用 `async Task` / `async Task<T>`，**不**用 `async void`
- **禁** `.Result` / `.Wait()`（會 deadlock）

### 錯誤處理

- 使用 `IResult` pattern（既有現況）：`Service` 內 try/catch 包，回 `{ Success, Message, Data, Exception }`
- **禁** catch `Exception` 通殺（除非最外層 filter）
- 例外用於異常情境，**不**用於控制流程

### DI / 生命週期

- 本專案**無 DI 容器**；Service 在 Controller 內手動 `new`
- 不要在 Service constructor 內呼叫其他 Service（避免循環依賴）
- 未來導入 DI 時，預設 Scoped 生命週期

### EF6 / SQL Server

- 詳見 [database-design.md](database-design.md)
- 避免 `Include` 過深 → N+1 query
- 大量讀取用 `AsNoTracking()`
- 寫入請走 `SaveChanges()`，**不**在迴圈內逐筆 SaveChanges
- 修改 schema 流程嚴格走「DB 改 → EDMX update → T4 重跑」

### Session 操作

- 只在 Controller 讀寫 Session
- Service 層**不依賴** `HttpContext.Current`
- 跨 Action 暫存物件（如預約 `Reservation`）放 Session，並寫 helper 統一存取

## 3. SQL（直接寫的場合）

> 結構設計詳見 [database-design.md](database-design.md)；本段為**寫 query 風格**。

- 關鍵字大寫（`SELECT` / `FROM` / `WHERE` / `JOIN`）
- 表名 / 欄位沿用 EF 慣例：`PascalCase`（如 `Appointments`、`AppointmentDate`）
- JOIN 條件寫 `ON`，**不**塞到 `WHERE`
- 大查詢用 CTE（`WITH`）拆步驟
- 避免 `SELECT *`；明列欄位
- 分頁用 `OFFSET / FETCH NEXT`（SQL Server 2012+）或 ROW_NUMBER；避免大 OFFSET 拖慢
- 動態 SQL 必用參數化（`SqlParameter`），**不**字串拼接
- DDL 變更前後備份；正式環境變更需 DBA 審核（無 Migration 自動化）

## 4. 與其他文件的關係

- **架構決策**（分層、模組職責）：[backend-design.md](backend-design.md)
- **API 契約**（endpoint、錯誤碼）：[api-design.md](api-design.md)
- **DB schema / 索引**：[database-design.md](database-design.md)
- **流程約定**（commit、branch、檔名）：[../conventions.md](../../conventions.md)
- **安全相關**（PII、認證、授權）：[security.md](security.md)
- **常見踩雷**：[../gotchas.md](../gotchas.md)
