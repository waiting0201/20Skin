---
title: 基礎建設與部署（新系統，prod-only）
purpose: 規範新系統正式環境（prod-only，暫不含 dev/staging）部署拓樸：兩 Angular SPA(Static Web Apps Free) + Azure Functions API(Flex Consumption) + reused Azure SQL + Blob/Table + Key Vault + App Insights + Timer trigger + CI/CD，含資源命名、機密清單、CORS、一次性手動步驟
applicable_when: 要部署/升版、設定環境變數與機密、規劃 CI/CD、處理檔案儲存或排程、調整 Bicep/GitHub Actions、新增 Azure 資源時
related_agents:
  - deployment-engineer
  - backend-engineer
related_docs:
  - ../architecture.md
  - ../project-overview.md
  - backend-design.md
  - security.md
  - database-design.md
  - ../conventions.md
  - ../old/design/infrastructure.md
keywords: [infrastructure, deploy, azure, static-web-apps, functions, flex-consumption, blob, key-vault, managed-identity, oidc, github-actions, bicep, timer, ci-cd, cors]
last_updated: 2026-07-04
status: active
---

> 舊部署（IIS + Web.config + CheckSms console + 本機 Upload）見 [old/design/infrastructure.md](../old/design/infrastructure.md)。
> **本文為正式環境（prod-only）具體方案**，對應 IaC 見 [`infra/`](../../infra/README.md)、CI/CD 見 [`.github/workflows/`](../../.github/workflows/)。
> **狀態（2026-07-04）**：Bicep 已在真實 Azure 訂閱（`rg-20skin-prod`）成功套用，17 項資源全數建立；
> 既有 SQL AAD 系統管理員 + Function App 的 contained user + Key Vault 機密皆已設定完成。
> 尚未完成：GitHub Environment `production` + secrets（需 `gh auth login`，見下方一次性手動步驟）、
> 兩份 SPA 尚未真正部署程式碼（`.github/workflows/` 尚未觸發過）。實際部署細節與過程中發現的
> 3 個平台限制修正見下方「部署實測記錄」。

## 部署拓樸

```
客戶前台 SPA (SWA Free) ─┐
                          ├─ HTTPS + JWT Bearer + CORS ─→ Azure Functions API (.NET 10 isolated, Flex Consumption)
後台 SPA (SWA Free)      ─┘                                   ├─ Managed Identity ─→ Azure SQL 20Skin（reused，schema 不可改）
                                                               ├─ 連線字串(KV) ─→ Storage（upload blob + RefreshTokens table）
                                                               ├─→ 智邦 SMS API（HTTPS，尚未實作）
                                                               ├─ 讀機密 ─→ Azure Key Vault（RBAC）
                                                               └─ Timer trigger（尚未實作）→ 發待發 SmsStatus
觀測：Application Insights（workspace-based）← 三者
```

**關鍵決策：兩個 SWA 不使用 SWA 的「Bring your own API」/ Managed Functions 連結機制**，
API 為完全獨立部署的 Azure Functions，前端純粹以瀏覽器 `fetch` + CORS 直接呼叫。原因見下方
「不使用 SWA API linking 決策」——這不只是本專案「兩站共用一支 API」的架構偏好，**Free tier
本身也不支援 Bring-your-own-API 這個功能**（官方文件僅 Standard tier 開放），所以即使沒有共用
API 的需求，Free tier 下也只能走這條路。

## 資源命名（`rg-20skin-prod`，遵循 [conventions.md](../conventions.md) kebab-case 慣例）

| 資源 | 名稱 | 備註 |
|---|---|---|
| Resource Group | `rg-20skin-prod` | ✅ 已建立（2026-07-04） |
| 客戶前台 SWA | `swa-20skin-customer-prod` | ✅ 已建立；**Standard tier**（非 Free，見下方變更說明），實際網域 `victorious-cliff-0a9afa71e.7.azurestaticapps.net` |
| 後台 SWA | `swa-20skin-admin-prod` | ✅ 已建立；Free tier，實際網域 `red-pebble-00ef32a1e.7.azurestaticapps.net` |
| Function App | `func-20skin-api-prod` | ✅ 已建立；Flex Consumption（Linux），`func-20skin-api-prod.azurewebsites.net` |
| App Service Plan | `plan-20skin-api-prod` | `FC1` / `FlexConsumption` |
| Storage Account | `st20skinprod` | ✅ 已建立（名稱未衝突，沿用原規劃） |
| Key Vault | `kv-20skin-prod-lnjm` | ✅ 已建立（實際隨機後綴 `lnjm`，`uniqueString(resourceGroup().id)` 產生） |
| Log Analytics Workspace | `log-20skin-prod` | ✅ 已建立 |
| Application Insights | `appi-20skin-prod` | ✅ 已建立；workspace-based（classic 模式已淘汰） |
| CI OIDC 身分 | `id-20skin-ci-prod` | ✅ 已建立；federated credential 綁定 `repo:waiting0201/20Skin:environment:production` |

區域：`westus2`（與既有 Azure SQL Server `weyprous`（RG `WeyproUS`）同區）。既有 SQL Server 資訊：
`weyprous.database.windows.net`（RG `WeyproUS`），Microsoft Entra 系統管理員已設為 `Weypro`
（帳號 `waiting61@hotmail.com`，2026-07-04）；Function App 的 Managed Identity 已在 `20Skin`
資料庫建立 contained user（`db_datareader`/`db_datawriter`）。

## Azure Static Web Apps 決策依據

實際查證 [Microsoft Learn quotas 頁](https://learn.microsoft.com/en-us/azure/static-web-apps/quotas)（非训练资料印象）：

| 項目 | Free tier | Standard tier |
|---|---|---|
| 頻寬（每月） | 100 GB（超過即不可用，無法超額付費） | 100 GB（超過 $0.20/GB） |
| 每訂閱可建立的 SWA 數 | 10 | 100 |
| Preview（staging）環境 | 3 | 10 |
| 總儲存空間（含所有環境） | 500 MB | 2 GB |
| 自訂網域數 | 2 | 6 |
| Private Endpoint | 不支援 | 1 |
| IP 範圍限制 | 不支援 | 25 |
| **Bring your own API（linked backend）** | **不支援（僅 Standard）** | 支援 |
| Managed Functions（SWA 自動託管的 API） | 支援 | 支援 |
| 單次請求大小上限 | 30 MB | 30 MB |

本專案兩站皆為純 SPA、無需 SSR/大型靜態資源，兩個 tier 的頻寬/儲存/自訂網域對現階段流量都足夠。

### 客戶前台改用 Standard tier（2026-07-04 實際部署時變更）

首次套用 Bicep 時，客戶前台 SWA 建立失敗：`This subscription has too many static sites with SKU: Free.`
——這個 Azure 訂閱（`WeyproUS` 名下）本來就有 9 個其他專案的 Free tier SWA
（`weypro`/`drafter3d-web`/`quotation`/`jabez-staging`/`ichiran`/`futures-tw`/`jabez`/`ogham`/
`tfoodies-admin`），加上後台 SWA 建立成功後已滿 10 個訂閱上限，客戶前台無法再用 Free tier。

**決策（使用者選擇）**：客戶前台改用 **Standard tier**（約 $9 USD/月），不動其他既有專案的資源；
後台維持 Free（已在額滿前搶到最後一個名額）。若之後想把客戶前台也改回 Free，需先清出其他專案的
Free tier 名額。

### 不使用 SWA API linking 決策

- **官方限制**：`Bring your own APIs`（把既有 Azure Functions/App Service/Container Apps/APIM 連結為 SWA 的
  `/api` 反向代理，不需自行處理 CORS）**只在 Standard tier 開放**，Free tier 完全不能用。
- **即使升級 Standard 也不會採用**：linked backend 是 **1 個 SWA environment 對 1 個後端**的關係，
  無法讓「客戶前台」與「後台」兩個獨立 SWA 共用同一支 Functions（linking 後 `/api` 路由會綁定各自的
  SWA 網域，等於要嘛部署兩份幾乎相同的 API，要嘛放棄「單一 API 服務兩端」的設計）。
- **決策**：Functions 完全獨立部署（有自己的 `func-20skin-api-prod.azurewebsites.net` 網域），
  兩個 SPA 的 `environment.prod.ts` 直接打這個絕對網址；Functions 端用標準 CORS
  （`Microsoft.Web/sites` 的 `siteConfig.cors.allowedOrigins`）白名單兩個 SWA 的預設網域。
  代價：需要自行維護 CORS 清單（新增自訂網域時要同步更新，见下方 CORS 段落）；
  好處：兩站與 API 版本/生命週期完全解耦，且不受 Free tier 限制。

**已同步修正的既有程式碼**：兩份 SPA 的 `environment.prod.ts` 原本寫 `apiBase: '/api'`
（隱含假設走 SWA linked backend 的相對路徑），與上述決策不符——若照原樣部署，正式環境會對
自己的 SWA 網域打 `/api`，因為沒有 linked backend 而 404。已改為指向 Function App 絕對網址
`https://func-20skin-api-prod.azurewebsites.net/api`（見
`web-customer/src/environments/environment.prod.ts`、`web-admin/src/environments/environment.prod.ts`）。

## Function App 方案選擇：Flex Consumption（非傳統 Consumption）

| 面向 | 傳統 Consumption（Y1） | **Flex Consumption（採用）** |
|---|---|---|
| .NET 10 isolated 支援 | Windows 可、**Linux 不可**（Linux Consumption 即將於 2028-09-30 淘汰） | 支援（Linux only，runtime `dotnet-isolated` version `10.0`） |
| 計費模式 | 依用量，有免費額度 | 依用量，有免費額度（精神與 Free tier 一致） |
| Cold start | 較慢 | 有 always-ready 選項，且整體優化較新 |
| VNet / 每函式獨立擴縮 | 不支援 | 支援（本次未使用，但保留未來彈性） |
| 部署套件存取 | 連線字串 | **強制走 Managed Identity（無金鑰）**，見下方 Storage 設計 |

**決策**：採 Flex Consumption。理由：本專案是全新（green-field）部署，沒有既有 Consumption 資源要延續；
.NET 10 isolated 在 Linux 上官方就是走 Flex（Linux Consumption 對 .NET 10 不支援），與其未來被迫遷移，
不如一開始就上 Flex。取捨是 Flex 僅支援 Linux，但本專案 API 無任何 Windows-only 依賴（Dapper/
Microsoft.Data.SqlClient/Azure.Storage.Blobs 皆跨平台），可接受。

## Storage 帳戶設計：單一帳戶身兼三用（決策）

查證現有程式碼（`api/20Skin.Api/Program.cs:111-117`）後發現：**檔案上傳（Blob）目前直接重用
`AzureWebJobsStorage` 這條連線字串**（`ConnectionString = config["AzureWebJobsStorage"]`），並非
獨立的 `AzureBlob:ConnectionString`（那是舊草稿設想、程式碼實際未採用）。因此正式環境的 Storage
帳戶規劃改依「現況程式碼」而非原先設想的兩顆分離帳戶：

| 用途 | 承載方式 | 存取方式 |
|---|---|---|
| Functions host（Timer trigger 分散式鎖、binding） | 同一顆 Storage 的 `AzureWebJobsStorage` App Setting | **連線字串**（走 Key Vault reference，見下）——維持現況程式碼相容，零程式碼改動 |
| 檔案上傳（圖片/問卷掃描檔，取代 `~/Upload`） | 同一顆 Storage，`upload` 容器（`PublicAccessType.Blob`，沿用 `BlobFileStorage.cs` 既有公開讀取假設） | 走上面同一條 `AzureWebJobsStorage` 連線字串（`BlobFileStorage` 建構子直接吃連線字串） |
| refresh token 儲存（20Skin DB schema 不可改，見 [security.md](security.md)） | 同一顆 Storage，`RefreshTokens` table（本次 IaC 先建好，程式碼尚未實作寫入邏輯） | 待實作時決定連線方式（可延用連線字串或改 `Azure.Data.Tables` + Managed Identity） |
| Flex Consumption **部署套件**（zip deploy 目標） | 同一顆 Storage，獨立容器 `app-package-deploy` | **System-Assigned Identity**（`Storage Blob Data Owner`），無金鑰，Flex Consumption 官方要求/建議做法 |

**取捨說明**：原始規劃考慮拆成「Functions 內部用」與「業務資料」兩顆帳戶（降低 blast radius），
但既有程式碼已把兩者綁在同一條連線字串上，若照原規劃拆分需同步請 backend-engineer 改
`BlobFileStorage`/`Program.cs` 改用獨立連線字串（甚至改走 Managed Identity 的
`BlobServiceClient(Uri, TokenCredential)` 建構子）——這超出本次部署任務範圍。故本次先以**單一
Storage 帳戶**達成「零程式碼改動即可部署」，並在此明確記錄：**後續待辦（backend-engineer）**：
把 Blob 存取改為身分驗證（`DefaultAzureCredential`/`ManagedIdentityCredential`），即可讓
`AzureWebJobsStorage` 這條連線字串徹底從機密清單移除。

`AzureWebJobsStorage` 連線字串（含帳戶金鑰）存在 Key Vault 密鑰 `Storage-ConnectionString`，
Function App 用 Key Vault reference 讀取（`AzureWebJobsStorage` 這個 App Setting 本身的值是
`@Microsoft.KeyVault(...)`，不是明文金鑰）。

## 既有 Azure SQL 連線方式決策

**採用：Function App System-Assigned Managed Identity + Microsoft Entra 驗證**（取代舊 `sa` 帳號），
**零程式碼改動**——因為 `Skin.Data/IDbConnectionFactory.cs` 的 `SqlConnectionFactory` 只是把設定檔
的連線字串原樣傳給 `SqlConnection`，只要連線字串內容改用
`Authentication=Active Directory Managed Identity` 語法（`Microsoft.Data.SqlClient` 6.x 原生支援，
無需密碼），程式碼完全不用動：

```
Server=tcp:<既有SQL Server>.database.windows.net,1433;Initial Catalog=20Skin;
Authentication=Active Directory Managed Identity;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;
```

此連線字串**不含密碼，非機密**，直接以明文 App Setting（`ConnectionStrings:SkinDatabase`）存在，
不需要進 Key Vault。

**前提（一次性手動步驟，Bicep 無法完成）**：既有 SQL Server 需已設定（或請 DBA 設定）Microsoft
Entra 系統管理員，並由該管理員身分登入一次，替 Function App 的 Managed Identity 建立
**contained database user**（Azure SQL 用 `CREATE USER ... FROM EXTERNAL PROVIDER` 語法，非傳統
server login）。防火牆規則（`AllowAzureServices`，見 `infra/modules/sql-firewall.bicep`）已納入 IaC，
但這個 T-SQL DDL 步驟無法用 Bicep 完成，指令見下方「一次性手動步驟」。

**Fallback（若無法/不便設定 AAD 系統管理員）**：改回 SQL 帳密（**建議另建最小權限帳號，不可沿用
`sa`**），連線字串整條進 Key Vault 密鑰 `Sql-ConnectionString-Fallback`，`ConnectionStrings:SkinDatabase`
App Setting 改成該密鑰的 Key Vault reference。兩種方式互斥，二擇一即可，不需同時做。

## 機密清單（Key Vault，RBAC 授權模式）

Key Vault（`kv-20skin-prod-*`）只由 Bicep 建立「空的」Vault + RBAC 角色指派（Function App 的
Managed Identity 取得 `Key Vault Secrets User`）。**實際機密值一律由人工事後寫入**（見下方一次性
手動步驟），不可出現在 Bicep 參數、`main.parameters.json`、或任何 commit 歷史。

| Key Vault 密鑰名稱 | 對應 App Setting | 用途 | 現況 |
|---|---|---|---|
| `Storage-ConnectionString` | `AzureWebJobsStorage` | Functions host + 檔案上傳 Blob | 必填 |
| `Jwt-SigningKey` | `Jwt:SigningKey` | JWT 簽章金鑰 | 必填 |
| `Recaptcha-SecretKey` | `Recaptcha:SecretKey` | reCAPTCHA v3 後端驗證 | 必填 |
| `SuperAdmin-Username` | `SuperAdmin:Username` | 超管過渡帳號 | 必填（見 [security.md](security.md) §超管處理） |
| `SuperAdmin-Password` | `SuperAdmin:Password` | 超管過渡密碼 | 必填 |
| `Sql-ConnectionString-Fallback` | `ConnectionStrings:SkinDatabase`（覆寫） | DB 連線（僅 Managed Identity 不可行時使用） | 選填（fallback） |
| `Sms-ApiKey` | `Sms:ApiKey`（目前 Bicep 中為註解，未掛載） | 智邦 SMS API 金鑰 | **尚未實作**（`DevNoOpSmsSender` 佔位），簡訊功能真正串接時才需要 |

非機密的一般設定（`Jwt:Issuer`/`Jwt:Audience`/`Jwt:AccessTokenMinutes`/`Recaptcha:MinScore`/
`Booking:DuplicateWindowDaysByBranch:*`/`Periods:BranchIdByAlias:*`）直接寫在 Bicep 的 App Settings，
不進 Key Vault（比照 [security.md](security.md) 機密判斷原則：只有「洩漏會造成可利用風險」的值才進 KV）。

> **`Booking:DuplicateWindowDaysByBranch:*` / `Periods:BranchIdByAlias:*` 需要真實 prod DB 的
> `Branchs.BranchID`**：這些 GUID 是既有資料表的實際主鍵值，本機開發用的值不保證等於正式環境
> DB 的實際值（需查證，見一次性手動步驟）。**重要提醒**：`Microsoft.Web/sites/config` 的
> `appsettings` 資源是**整批覆寫**、不是 patch——之後如果有人用 `az functionapp config
> appsettings set` 手動加設定，下次套用 Bicep 會被整批覆蓋清空，因此任何要長期存在的設定都必須
> 維護在 `infra/main.parameters.json`，不要繞過 IaC。

## CORS

Function App 的 `siteConfig.cors.allowedOrigins` 由 `infra/main.bicep` 自動組出：兩個 SWA 的
`defaultHostname`（部署當下由 Azure 動態產生的 `*.azurestaticapps.net` 網域，Bicep 內用 module
output 串接，不需人工查詢/填入）+ `additionalCorsOrigins` 參數（供日後加自訂網域）。
`supportCredentials: false`（認證走 `Authorization: Bearer <JWT>`，非 cookie，不需要 credentialed CORS，
見 [security.md](security.md)）。

**待辦（有自訂網域後）**：於 `main.parameters.json` 的 `additionalCorsOrigins` 加入自訂網域，
重新套用 `deploy-infra.yml`；同時把該網域填入 Google reCAPTCHA 後台的允許網域清單（後台 SPA，見
[security.md](security.md) §reCAPTCHA 前端）。

## 檔案上傳

舊三段式（本機暫存→上傳前台→刪）已改為直接 Blob（`upload` 容器，`PublicAccessType.Blob`）：
上傳端點寫入容器、回 URL；刪除走 Blob API。見 [blueprints/file-upload.md](../blueprints/file-upload.md)。

## 排程（CheckSms 取代，尚未實作）

Functions Timer trigger（如每日台灣 08:00，App Setting 已預先設定 `WEBSITE_TIME_ZONE=Asia/Taipei`）
執行：撈 `SmsStatus` 當日待發（`Status IS NULL`）→ 呼叫智邦 API → 回寫 `Status/Message/UpdateDate`。
無外部 HTTP 觸發、無公開端點（修舊安全問題）。見 [blueprints/sms-reminder.md](../blueprints/sms-reminder.md)。

## refresh token 儲存

不可進 20Skin DB（schema 不可改）→ 用同一顆 Storage 的 `RefreshTokens` table（本次 IaC 已建立，
程式碼待實作）。見 [security.md](security.md)。

## CI/CD 設計

四個獨立 workflow（[`.github/workflows/`](../../.github/workflows/)），各自 path filter，互不干擾：

| Workflow | 觸發 | 認證方式 | 說明 |
|---|---|---|---|
| `deploy-web-customer.yml` | push `main` 且 `web-customer/**` 變更 + 手動 | **SWA deployment token**（GitHub Secret） | `ng build --configuration production` → `Azure/static-web-apps-deploy@v1`（`skip_app_build: true`，我們自己先建置） |
| `deploy-web-admin.yml` | push `main` 且 `web-admin/**` 變更 + 手動 | 同上 | 同上 |
| `deploy-api.yml` | push `main` 且 `api/**` 變更 + 手動 | **OIDC federated credential**（`azure/login@v2`，無長期密鑰） | `dotnet publish` → `Azure/functions-action@v1`（沿用 `azure/login` 的 OIDC session，不提供 `publish-profile`） |
| `deploy-infra.yml` | **僅手動**（`workflow_dispatch`，`mode: whatif｜apply`） | OIDC | `az deployment group validate/what-if`，選 `apply` 才真的套用 Bicep |

**為何 SWA 用 deployment token、API/infra 用 OIDC**：官方文件明載 `Azure/static-web-apps-deploy` 目前
唯一支援的認證方式是**該 SWA 專屬的部署權杖**（非通用 Azure 憑證，也不是 OIDC 相容的資源），風險
範圍僅限單一 SWA（可用 `az staticwebapp secrets reset-api-key` 單獨輪替，不影響其他資源）；而
Functions 部署與 Bicep 套用是一般 ARM 操作，可以、也應該走 OIDC federated credential，避免任何
長期存活的 Service Principal 密碼。

`deploy-infra.yml` 刻意只用 `workflow_dispatch`（不掛 push 觸發）：基礎設施變更（Key Vault/RBAC/
防火牆/CORS）影響面比單純程式碼部署大，需要人主動決定何時套用，且預設 `whatif` 只顯示差異。

## 觀測

Application Insights（workspace-based，`APPLICATIONINSIGHTS_CONNECTION_STRING` App Setting）+
Serilog 結構化 log + traceId，取代舊「IIS log + Event Log、無集中 log」。查詢入口：Azure Portal →
`appi-20skin-prod` → Logs / Live Metrics / Failures。

## 部署實測記錄（2026-07-04，真實 Azure 訂閱）

首次套用 Bicep 到真實訂閱時，陸續發現以下平台限制，皆已修正並重新套用成功（17 項資源全數建立）：

| 問題 | 原因 | 修正 |
|---|---|---|
| Key Vault 建立失敗：`enablePurgeProtection cannot be set to false` | 訂閱層級 Azure Policy 強制要求 Key Vault 開啟 purge protection | `infra/modules/key-vault.bicep` 改 `enablePurgeProtection: true`。**不可逆**：之後即使刪除此 Vault，90 天內仍會保留在「已刪除」狀態並佔用名稱/配額 |
| 客戶前台 SWA 建立失敗：`too many static sites with SKU: Free` | 訂閱已有 9 個其他專案的 Free tier SWA，加上本專案後台已滿 10 個上限 | 客戶前台改用 Standard tier（使用者決定，見上方「客戶前台改用 Standard tier」） |
| Function App 部署失敗：`FUNCTIONS_WORKER_RUNTIME ... is invalid` | Flex Consumption 的 worker runtime 由 `functionAppConfig.runtime` 決定，appsettings 內不可重複設定 | 移除該 app setting（僅傳統 Consumption/Premium 方案才需要） |
| Function App 部署失敗：`AppSetting with name 'ConnectionStrings:SkinDatabase' is not allowed` | Flex Consumption 的 ARM 驗證**拒絕所有含冒號的 appsetting 名稱**（不只 "ConnectionStrings:" 這個保留字首，`Jwt:SigningKey` 等一般巢狀鍵也一併被拒，皆已實測） | 所有巢狀設定鍵名改用雙底線（`Jwt__SigningKey` 等）——.NET 設定系統的標準寫法，執行期 `config["Jwt:SigningKey"]` 讀取結果不變，零程式碼改動 |
| Function App 部署失敗：`AppSetting with name 'Periods__BranchIdByAlias__<GUID>' is not allowed` | GUID 含連字號，Flex Consumption 的 appsetting 名稱驗證**不接受連字號**，逐分院攤平成個別 App Setting（`Periods__BranchIdByAlias__<GUID>`）必定命中 | 改成單一 JSON 字串 App Setting（`Booking__DuplicateWindowDaysByBranchJson`/`Periods__BranchIdByAliasJson`），**需要程式碼配合**：`api/20Skin.Api/Program.cs` 新增 `ReadBranchAliasMap`/`ReadBookingWindowMap` 兩個 helper，本機 `local.settings.json` 巢狀 key 優先（行為不變），查無資料時才 fallback 解析這條 JSON |
| GitHub Actions 首次部署：兩個 SPA 皆失敗 `Failed to find a default file in the app artifacts folder` | `Azure/static-web-apps-deploy@v1` 搭配 `skip_app_build: true` 時**完全不使用 `output_location`**，只把 `app_location` 當成「已建置好的靜態檔案目錄」直接找 `index.html`（實測兩輪才確認：先誤以為是 monorepo app_location 相對路徑問題，改成 `app_location: '/'` + `output_location` 完整路徑仍失敗，才確認 output_location 在此模式下完全不生效） | `app_location` 直接指向 Angular build 產物目錄（`web-customer/dist/web-customer/browser`），不再設定 `output_location`；`staticwebapp.config.json` 放在 `web-customer/public/`，Angular `assets` 設定會複製到 build 產物根目錄，路徑與新 `app_location` 一致；API 部署（`deploy-api.yml` 不用這個 action）不受影響，首次即部署成功 |

以上除「客戶前台改 Standard tier」需使用者決策外，其餘皆為受平台限制驅動的必要修正，已同步反映在
`infra/modules/*.bicep`、`.github/workflows/deploy-web-*.yml` 與 `api/20Skin.Api/Program.cs`
（`dotnet build` 已驗證 0 error）。

## 一次性手動步驟（無法或不適合寫進 Bicep/workflow，需人工在 Azure Portal/CLI 執行一次）

**執行進度（2026-07-04）**：1–5 已完成；6（SWA 部署權杖）已取得但尚未寫入 GitHub Secrets；
7（GitHub Environment + secrets）待 `gh auth login` 後續完成；8（reCAPTCHA 網域註冊）待辦。

### 1. 建立 Resource Group

```bash
az group create --name rg-20skin-prod --location westus2
```

✅ 已完成。

### 2. 建立 GitHub OIDC 用的 User-Assigned Managed Identity + federated credential

```bash
az identity create --name id-20skin-ci-prod --resource-group rg-20skin-prod

# 取得 clientId/principalId 供後續步驟使用
az identity show --name id-20skin-ci-prod --resource-group rg-20skin-prod \
  --query "{clientId:clientId, principalId:principalId}" -o json

# federated credential：綁定 GitHub Environment "production"（非單純 branch），
# 可搭配 GitHub Environment 的必要審核者設定，作為 prod 部署的人工把關。
az identity federated-credential create \
  --name gh-actions-production \
  --identity-name id-20skin-ci-prod \
  --resource-group rg-20skin-prod \
  --issuer "https://token.actions.githubusercontent.com" \
  --subject "repo:<GitHub org>/<repo>:environment:production" \
  --audiences "api://AzureADTokenExchange"

# 授權：資源群組層級 Contributor（涵蓋 infra 套用 + Functions 程式碼部署）
az role assignment create \
  --assignee-object-id <上面查到的 principalId> \
  --assignee-principal-type ServicePrincipal \
  --role Contributor \
  --scope /subscriptions/<訂閱ID>/resourceGroups/rg-20skin-prod
```

於 GitHub repo 設定 Environment `production`，並加入 secrets：
`AZURE_CLIENT_ID`（上面的 clientId）、`AZURE_TENANT_ID`、`AZURE_SUBSCRIPTION_ID`；
以及 variable `AZURE_RESOURCE_GROUP=rg-20skin-prod`（`deploy-infra.yml` 用）。

✅ Azure 端已完成（2026-07-04）：`id-20skin-ci-prod` 身分 + federated credential（subject
`repo:waiting0201/20Skin:environment:production`）+ Contributor role assignment 皆已建立。
**未完成**：GitHub repo 尚未設定 Environment `production` 與上述 secrets/variable（需 `gh auth login`
或手動於 GitHub 網頁設定，見下方「GitHub 端待辦」）。

### 3. 套用 Bicep（首次，建議先本機執行而非直接跑 CI）

```bash
az deployment group validate --resource-group rg-20skin-prod \
  --template-file infra/main.bicep --parameters @infra/main.parameters.json

az deployment group what-if --resource-group rg-20skin-prod \
  --template-file infra/main.bicep --parameters @infra/main.parameters.json

az deployment group create --resource-group rg-20skin-prod \
  --template-file infra/main.bicep --parameters @infra/main.parameters.json
```

`infra/main.parameters.json` 已於 2026-07-04 填入真實值：`existingSqlServerName=weyprous`、
`existingSqlServerResourceGroup=WeyproUS`、`location=westus2`（以 `az sql server show` 查證）；
`bookingDuplicateWindowDaysByBranch`/`periodsBranchIdByAlias` 沿用 `api/20Skin.Api/local.settings.json`
既有的 `Branchs.BranchID` 值（本機開發已用同一份 reused DB 資料驗證過）。
**執行 `validate`/`what-if`/`create` 前建議再次核對這些 GUID 與正式 `weyprous` 資料庫的 `Branchs`
表一致**（`SELECT BranchID, Title FROM Branchs`），以防 local 開發環境與正式資源之間存在資料落差。

✅ 已完成（2026-07-04，使用者確認 `Branchs` 表資料無誤）：`validate`/`what-if`/`create` 皆已對真實
訂閱執行成功，17 項資源全數建立。過程中發現並修正 4 個平台限制，見上方「部署實測記錄」。

### 4. 既有 Azure SQL：Microsoft Entra 系統管理員 + Managed Identity contained user

```bash
# 若既有 Server 尚未設定 AAD admin（需 SQL Server Contributor 或更高權限）
az sql server ad-admin create \
  --resource-group WeyproUS \
  --server-name weyprous \
  --display-name <某 Entra 使用者或群組> \
  --object-id <該使用者/群組的 objectId>
```

以該 Entra 帳號登入 Azure Data Studio / SSMS（Authentication: Azure Active Directory），對 `20Skin`
資料庫執行：

```sql
CREATE USER [func-20skin-api-prod] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [func-20skin-api-prod];
ALTER ROLE db_datawriter ADD MEMBER [func-20skin-api-prod];
-- 若有需要 EXECUTE 預存程序權限，視實際使用情況再補 GRANT EXECUTE。
```

若決定改走 fallback（SQL 帳密），改為請 DBA 建立最小權限 SQL 登入，並跳過本步驟。

✅ 已完成（2026-07-04）：AAD 系統管理員設為 `Weypro`（`waiting61@hotmail.com`）；透過 `pyodbc` +
`az account get-access-token --resource https://database.windows.net` 取得的存取權杖連線 `20Skin`
資料庫，已建立 contained user `func-20skin-api-prod` 並加入 `db_datareader`/`db_datawriter`。

### 5. 寫入 Key Vault 機密實際值

```bash
az keyvault secret set --vault-name kv-20skin-prod-lnjm --name Storage-ConnectionString --value "<用 az storage account show-connection-string 取得>"
az keyvault secret set --vault-name kv-20skin-prod-lnjm --name Jwt-SigningKey --value "<產生一組高強度隨機字串，例如 openssl rand -base64 64>"
az keyvault secret set --vault-name kv-20skin-prod-lnjm --name Recaptcha-SecretKey --value "<Google reCAPTCHA 後台取得>"
az keyvault secret set --vault-name kv-20skin-prod-lnjm --name SuperAdmin-Username --value "<自訂>"
az keyvault secret set --vault-name kv-20skin-prod-lnjm --name SuperAdmin-Password --value "<自訂高強度密碼>"
```

✅ 已完成（2026-07-04）：5 項機密皆已寫入 `kv-20skin-prod-lnjm`。`Recaptcha-SecretKey` 沿用
`local.settings.json` 既有值（與前後台共用同一組 reCAPTCHA site key 配對）；`Jwt-SigningKey`/
`SuperAdmin-Password` 為新產生的高強度隨機值（未落地任何 commit 或對話紀錄，僅存在 Key Vault）；
`SuperAdmin-Username` 沿用 local 開發的 `weypro`。寫入前另需先把自己的帳號加上 **Key Vault Secrets
Officer** 角色（Bicep 只授權 Function App 的 Managed Identity 讀取，未授權操作者本人寫入）：

```bash
az role assignment create --assignee-object-id <你的 objectId> --assignee-principal-type User \
  --role "Key Vault Secrets Officer" \
  --scope /subscriptions/<訂閱ID>/resourceGroups/rg-20skin-prod/providers/Microsoft.KeyVault/vaults/kv-20skin-prod-lnjm
```

（RBAC 角色指派生效有數十秒延遲，指派後若遇 `Forbidden`/`ForbiddenByRbac` 稍候重試即可。）

### 6. 建立兩個 Static Web Apps 的部署權杖 → GitHub Secrets

```bash
az staticwebapp secrets list --name swa-20skin-customer-prod --query "properties.apiKey" -o tsv
az staticwebapp secrets list --name swa-20skin-admin-prod --query "properties.apiKey" -o tsv
```

分別存為 GitHub Environment `production` 的 secret：`SWA_DEPLOYMENT_TOKEN_CUSTOMER`、
`SWA_DEPLOYMENT_TOKEN_ADMIN`。輪替時用 `az staticwebapp secrets reset-api-key`。

✅ 權杖已取得（2026-07-04，暫存於操作者本機，未落地 commit）。**未完成**：尚未寫入 GitHub
Secrets（需 GitHub 端存取，見下方「GitHub 端待辦」）。

### 7. 確認/更新 `environment.prod.ts` 的絕對網址

若 Function App 或 Storage 帳戶命名與本文表格不同（例如 `st20skinprod` 已被佔用而改名），
需同步更新 `web-customer` 與 `web-admin` 各自的 `environment.prod.ts`（`apiBase`/`uploadBase`）
並重新觸發對應 workflow 部署。

✅ 已確認（2026-07-04）：實際部署的 Function App/Storage 帳戶名稱與規劃一致，`environment.prod.ts`
不需再改。

### 8. reCAPTCHA 後台網域註冊（後台 SPA 首次上線前）

**決策（2026-07-04）**：後台**沿用客戶前台同一組 site key**（`6LdrNI8cAAAAACrQIIxITCP1K3ZGMWyFrMYRPQkB`，
已填入 `web-admin/src/environments/environment.prod.ts`），不另開新 key。上線前務必到 Google
reCAPTCHA 後台，把該 key 的允許網域清單加入後台 SWA 的**實際**預設網域
`red-pebble-00ef32a1e.7.azurestaticapps.net`（部署後才知道的隨機網域，非資源名稱），否則
`grecaptcha.execute` 會因 domain mismatch 被擋下（見 [security.md](security.md) §reCAPTCHA 前端）。
**尚未完成**，待使用者操作。

### 9. GitHub 端待辦（使用者決定親自於 GitHub 網頁手動設定，2026-07-04）

1. 於 repo `waiting0201/20Skin` 建立 Environment `production`（建議加審核者，作為 prod 部署的人工把關）
2. Secrets：`AZURE_CLIENT_ID`（`id-20skin-ci-prod` 的 clientId）、`AZURE_TENANT_ID`、
   `AZURE_SUBSCRIPTION_ID`、`SWA_DEPLOYMENT_TOKEN_CUSTOMER`、`SWA_DEPLOYMENT_TOKEN_ADMIN`
   （實際值已於對話中提供給使用者，未落地本檔/commit）
3. Variable：`AZURE_RESOURCE_GROUP=rg-20skin-prod`
4. 完成後即可觸發 `.github/workflows/deploy-*.yml`，兩個 SPA + API 才會第一次真正部署程式碼
   （目前只有 Azure 資源本身建好，尚未跑過任何 workflow）

**狀態**：待使用者手動完成，完成後這是啟動 CI/CD 唯一剩下的手動步驟（連同 §8 reCAPTCHA 網域註冊）。

## 已知限制 / 後續事項

- Bicep 尚未於真實 Azure 訂閱驗證，Flex Consumption 的 ARM schema 相對新、變動較快，`validate`/
  `what-if` 發現的任何屬性名稱落差請直接修正 `infra/modules/function-app.bicep`。
- Blob/Storage 目前用連線字串（非 Managed Identity），待 backend-engineer 調整 `BlobFileStorage`
  改用 `TokenCredential` 後可移除 `Storage-ConnectionString` 這個機密。
- refresh token 的 Table 已建立但程式碼未實作寫入邏輯（P1 backlog，見 [status.md](../status.md)）。
- 智邦 SMS 尚未實作（`DevNoOpSmsSender` 佔位），對應 Key Vault 密鑰/App Setting 已預留但未掛載。
- 自訂網域、CDN/Front Door、rate-limit（登入端點）皆非本次範圍，待流量/需求明確後再規劃。

## 對應舊系統

[old/design/infrastructure.md](../old/design/infrastructure.md)、`reference/old/CheckSms/`。
