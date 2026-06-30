---
title: 基礎建設與部署（新系統）
purpose: 規範新系統部署拓樸：兩 Angular SPA(Static Web Apps) + Azure Functions API + reused Azure SQL + Blob + Key Vault + App Insights + Timer trigger + CI/CD
applicable_when: 要部署/升版、設定環境變數與機密、規劃 CI/CD、處理檔案儲存或排程時
related_agents:
  - deployment-engineer
  - backend-engineer
related_docs:
  - ../architecture.md
  - backend-design.md
  - security.md
  - ../old/design/infrastructure.md
keywords: [infrastructure, deploy, azure, static-web-apps, functions, blob, key-vault, timer, ci-cd]
last_updated: 2026-06-30
status: draft
---

> 舊部署（IIS + Web.config + CheckSms console + 本機 Upload）見 [old/design/infrastructure.md](../old/design/infrastructure.md)。新系統全面 Azure 雲端化。

## 部署拓樸

```
客戶前台 SPA  ─┐
              ├─ HTTPS + JWT ─→ Azure Functions API (.NET 10 isolated)
後台 SPA      ─┘                   ├─ Dapper ─→ Azure SQL 20Skin (reused, schema 不可改)
                                   ├─→ Azure Blob Storage (圖片/問卷檔)
                                   ├─→ 智邦 SMS API (HTTPS)
                                   ├─ 讀機密 ─→ Azure Key Vault
                                   └─ Timer trigger (每日) → 發待發 SmsStatus
觀測：Application Insights ← 三者
```

## 環境與載體

| 單元 | 載體 |
|---|---|
| 客戶前台 SPA | Azure Static Web Apps（獨立站） |
| 後台 SPA | Azure Static Web Apps（獨立站，可加 IP 限制/私網） |
| API | Azure Functions（.NET 10 isolated）|
| DB | Azure SQL `20Skin`（reused；最小權限帳號或 Managed Identity，取代舊 `sa`）|
| 檔案 | Azure Blob Storage（取代 `~/Upload`）|
| 機密 | Azure Key Vault |
| 排程 | Functions Timer trigger（取代 `CheckSms.exe` + Windows 排程）|

環境分離：dev / staging / production（取代舊「只有 local 與 prod」）。

## 機密與設定（移除舊硬編碼）

全部進 Key Vault / App Settings：DB 連線、SMS api_key/帳密、reCAPTCHA secret、JWT 簽章金鑰、Blob 連線。對照舊硬編碼位置（`SmsHandler`/`Definition.cs`/Web.config）見 [security.md](security.md)。

```jsonc
// Functions App Settings（值來自 Key Vault 參照）
"ConnectionStrings:SkinDatabase", "Sms:ApiUrl", "Sms:ApiKey",
"Recaptcha:SecretKey", "Jwt:SigningKey", "AzureBlob:ConnectionString"
```

## 檔案上傳
舊三段式（本機暫存→上傳前台→刪）改為直接 Blob：上傳端點寫入容器、回 URL；刪除走 Blob API。見 [blueprints/file-upload.md](../blueprints/file-upload.md)。

## 排程（CheckSms 取代）
Functions Timer trigger（如每日台灣 08:00）執行：撈 `SmsStatus` 當日待發（`Status IS NULL`）→ 呼叫智邦 API → 回寫 `Status/Message/UpdateDate`。無外部 HTTP 觸發、無公開端點（修舊安全問題）。見 [blueprints/sms-reminder.md](../blueprints/sms-reminder.md)。

## refresh token 儲存
不可進 20Skin DB（schema 不可改）→ 用 Functions 連的 Storage account（Azure Table）或 Redis；或採無狀態短效 token。見 [security.md](security.md)。

## CI/CD
- 兩 SPA：GitHub Actions → Static Web Apps（build Angular → 部署）。
- API：GitHub Actions → Functions（`dotnet publish` → 部署）。
- 每單元獨立 pipeline。

## 觀測
Application Insights（結構化 log via Serilog + traceId），取代舊「IIS log + Event Log、無集中 log」。

## 對應舊系統
[old/design/infrastructure.md](../old/design/infrastructure.md)、`reference/old/CheckSms/`。
