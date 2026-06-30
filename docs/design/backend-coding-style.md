---
title: 後端編碼風格（.NET 10 / Azure Functions）
purpose: 規範 API 的編碼慣例：isolated worker、DI、Dapper 參數化 SQL、FluentValidation、例外/ProblemDetails、Serilog、測試
applicable_when: 寫或審查 API 程式碼、建立 Controller/Service/Domain、設定 lint/分析器時
related_agents:
  - backend-engineer
  - code-review-optimizer
related_docs:
  - backend-design.md
  - api-design.md
  - database-design.md
keywords: [coding-style, dotnet10, azure-functions, ef-core, async, fluentvalidation, serilog, di, test]
last_updated: 2026-06-30
status: draft
---

## 核心慣例

- **Isolated worker**（.NET 10）；`Program.cs` 用 `HostBuilder` 註冊 DI、router、middleware。
- **DI**：建構子注入；介面化 Service/Infra（Blob/SMS/reCAPTCHA/JWT）以利測試替換。**不**手動 `new`（修舊系統反模式）。
- **async/await 全程**：Dapper 用 `QueryAsync`/`QueryFirstOrDefaultAsync`/`ExecuteAsync`，並傳 `CommandDefinition` 帶 `CancellationToken`。
- **資料存取**：SQL **一律參數化**（`@param`，禁止字串拼接）；連線經 `IDbConnectionFactory`，`using var conn = factory.Create()` 即用即關；多步驟以 `IDbTransaction` 包覆。
- **驗證**：FluentValidation 驗 request DTO；失敗回 422 + 訊息。
- **例外**：不吞例外回假成功（修舊 `IResult` 反模式）；全域 middleware → `ProblemDetails`；可預期的業務失敗回 `ApiResponse{success:false,code}`。
- **DTO 與 entity 分離**：DTO 在 `Skin.Core`，entity 為 `Skin.Data/Entities` 的 POCO（屬性名＝欄位名，供 Dapper 對應）；以 mapping 轉換。
- **時間**：`TimeZoneInfo`（Taipei）或 UTC 存、邊界轉換；禁止散落 `AddHours(8/9)`。

## 命名 / 結構
- 專案分層見 [backend-design.md](backend-design.md)。
- Controller 薄、Service 管交易、Domain service 純邏輯可單元測。
- 常數/列舉集中 `20Skin.Core/Constants`（移自舊 `Definition.cs`），列舉值見 [database-design.md](database-design.md)。

## 安全
- 機密一律從設定/Key Vault 讀，原始碼零明文（修舊硬編碼）。
- 會員資源查詢必加歸屬條件（修 IDOR）。
- 外呼一律 HTTPS、保留憑證驗證（修舊 `ServerCertificateValidationCallback=true`）。

## log
Serilog 結構化 + Application Insights；不記密碼/金鑰/token/完整身分證。

## 測試
xUnit + Mock；Domain service 必有單元測試（容量/編號/重複/簡訊組裝）；關鍵端點整合測試。CI 阻擋未過測試/分析器。
