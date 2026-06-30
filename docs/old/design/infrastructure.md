---
title: 基礎建設與部署
purpose: 描述 20Skin 的部署拓樸、Web.config 環境設定、IIS 站點配置、CheckSms 排程、log 取得方式
applicable_when: 要部署 / 升版、要查環境設定、要排查 production 問題、要規劃 CI/CD（目前無）
related_agents:
  - backend-engineer
related_docs:
  - ../architecture.md
  - backend-design.md
  - security.md
keywords: [infrastructure, deploy, iis, web.config, hosting, scheduler, checksms, logs]
last_updated: 2026-05-26
---

## 部署拓樸

```
┌─────────────────── Windows Server ───────────────────┐
│                                                       │
│   ┌──────────────┐    ┌─────────────────────┐         │
│   │   IIS 站台   │    │   IIS 站台          │         │
│   │   20Skin     │    │   20SkinBackend     │         │
│   │ (前台 Web)   │    │ (後台 Web)          │         │
│   │ booking.     │    │ (內部網址 / 子網域) │         │
│   │ 20skin.tw    │    │                     │         │
│   └──────┬───────┘    └──────┬──────────────┘         │
│          │                    │                       │
│          └─────────┬──────────┘                       │
│                    ▼                                  │
│          ┌──────────────────┐                         │
│          │  SQL Server      │                         │
│          │  DB: 20Skin      │                         │
│          └──────────────────┘                         │
│                                                       │
│   ┌────────────────────────────────────┐              │
│   │  Windows Task Scheduler            │              │
│   │   └─ CheckSms.exe (Console)        │              │
│   │       └─ HTTP GET                  │              │
│   │          booking.20skin.tw/        │              │
│   │          MainMs/CheckSms           │              │
│   └────────────────────────────────────┘              │
└───────────────────────────────────────────────────────┘
                    ↓ (HTTP)
        ┌─────────────────────────┐
        │  智邦通訊 SMS Gateway   │
        │  pp.url.com.tw          │
        └─────────────────────────┘
```

## 環境

| 環境 | 載體 | URL | 部署方式 |
|---|---|---|---|
| local dev | IIS Express / VS Debug | `localhost:{port}` | F5 |
| production | IIS 站台 | `booking.20skin.tw`（前台）+ 內部後台 | **手動**（無 CI/CD） |

**無 staging / dev / uat** 環境分離。`Web.config` 透過 `Web.Debug.config` / `Web.Release.config` 做轉換。

## Web.config 設定區塊

### 兩端共用

- `connectionStrings.SkinEntities` — EF6 連線字串（指向 SQL Server）
- `system.web.globalization.culture` — `zh-TW`
- `system.web.compilation.targetFramework` — `4.8`
- `entityFramework.providers` — `System.Data.SqlClient`

### 前台 `20Skin/Web.config`

- `appSettings.config:ApiUrl` — Web API base URL
- `appSettings.webpages:Version` / `webpages:Enabled`
- `system.web.sessionState` — 未顯式設定（InProc / 預設 20 分鐘）

### 後台 `20SkinBackend/Web.config`

- `appSettings.config:CurrentTheme` — `fixed-navigation`（SmartAdmin 主題變體）
- `system.web.sessionState` — `<sessionState timeout="480" />`（8 小時）
- 自訂 `routes` / `bundles`

### Web.config 轉換

- `Web.Debug.config` — dev 用，`customErrors mode="Off"`（顯示 yellow screen）
- `Web.Release.config` — production 用，應設 `customErrors mode="RemoteOnly"`（待驗證）

## 環境變數 / Secret

| 載體 | 用途 |
|---|---|
| Web.config `connectionStrings` | DB 連線（含帳密） |
| Web.config `appSettings` | SMS API key / username / password / reCAPTCHA secret 等 |

**規則**：
- 不可 commit production Web.config 完整版到 repo（檢視 `.gitignore` 是否覆蓋）
- 修改設定後須**手動部署到 IIS**

## CI/CD

**無**。目前所有部署為手動：

1. 在本機 VS 用 `Release` build
2. 透過 Publish（File System / FTP）上傳到 IIS 對應路徑
3. IIS 自動 recycle Application Pool 後生效

未來建立 pipeline 候選：GitHub Actions / Azure DevOps（見 [../status.md](../../status.md) Backlog）。

## 容器化

**無** Dockerfile / docker-compose。.NET Framework 4.8 在 Windows container 上可行但未實作。

## CheckSms 排程

| 項目 | 設定 |
|---|---|
| 載體 | Windows Task Scheduler |
| 執行檔 | `CheckSms.exe`（Console App，獨立部署目錄） |
| 動作 | `WebRequest.Create("http://booking.20skin.tw/MainMs/CheckSms").GetResponse()` |
| 頻率 | （依現場排程設定；建議：每日一次或數小時一次） |
| 失敗處理 | 無重試；下次排程時若 `Status IS NULL` 仍會再嘗試 |

**注意**：CheckSms 不在 IIS 內，部署新版本須**獨立發布**到 Task Scheduler 指向的路徑。

## 檔案上傳路徑

- 本機暫存：`~/Upload/{EntityID}`（IIS 站台目錄下）
- 對外公開：透過 `Librarys.UploadFileToFrontend` 上傳到前台靜態資源伺服器
- `Upload/` 在 `.gitignore` 內，**正式檔案不在版控**（需另行備份策略）

## 觀測 / Log

| 來源 | 用途 |
|---|---|
| IIS Log（`C:\inetpub\logs\LogFiles\`） | HTTP request log |
| Windows Event Log | 未捕捉的例外（ASP.NET 預設行為） |
| `SmsStatus` 表 | 簡訊發送結果追蹤 |

**無**結構化 log（Serilog / NLog）、**無** APM（Application Insights / DataDog）、**無**中央 log 系統、**無** traceId 串接。

## 災難復原

- DB 備份策略：依 SQL Server 設定（未在 repo 內描述）
- Web 部署檔備份：依 IIS 主機備份策略
- RTO / RPO：（待補）

## 升級候選

詳見 [../status.md](../../status.md) Backlog：

- 容器化（Windows container 或遷移 .NET 8 + Linux container）
- CI/CD pipeline 建立
- 結構化 log 引入
- 環境分離（dev / staging / prod）
- Upload 改用雲端儲存
