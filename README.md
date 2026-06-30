# 20Skin（重寫版）

多分院診所線上預約系統的重寫版。三個獨立可部署單元，共用一套既有的 SQL Server 資料庫 `20Skin`（schema 沿用、不可改）。

| 目錄 | 內容 | 技術 |
|---|---|---|
| `api/` | 後端 API | Azure Functions **.NET 10**（isolated）+ 自訂 router MVC + JWT + **Dapper** |
| `web-customer/` | 客戶前台 SPA | Angular（standalone + signals）+ Tailwind |
| `web-admin/` | 後台管理 SPA | Angular（standalone + signals）+ Tailwind |
| `docs/` | 新系統設計文件、進度（`docs/status.md`） | — |
| `docs/old/`、`reference/old/` | 舊系統（.NET Framework）分析與原始碼，**僅供參考** | — |

> 目前進度與接續點請先看 **[docs/status.md](docs/status.md)**。

---

## 先決條件

- **.NET SDK 10**（`dotnet --version` ≥ 10）
- **Azure Functions Core Tools v4**（`func --version`）
- **Node.js 20+** 與 **Angular CLI**（`npx ng version`）
- **Azurite**（Functions 本機 storage 模擬器；用 `npx azurite` 即可，免安裝）
- **SQL Server**，且本機可連線、已存在資料庫 `20Skin`

---

## 1. 後端 API（`api/`）

### 1-1. 建立 `api/20Skin.Api/local.settings.json`

此檔含機密、**已被 git 忽略**，需自行建立：

```jsonc
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "dotnet-isolated",

    "Jwt:SigningKey": "至少 32 字元的隨機字串（本機開發用，正式請改）",
    "Jwt:Issuer": "20skin",
    "Jwt:Audience": "20skin",
    "Jwt:AccessTokenMinutes": "60",

    "ConnectionStrings:SkinDatabase": "Server=(local);Database=20Skin;User Id=sa;Password=你的密碼;TrustServerCertificate=True;Encrypt=False",

    "Recaptcha:SecretKey": "",          // 留空＝本機略過 reCAPTCHA 驗證
    "Recaptcha:MinScore": "0.5",

    "Booking:DuplicateWindowDaysByBranch:e65f4720-82a3-498a-9447-fb5dc910999e": "2"
  },
  "Host": {
    "CORS": "http://localhost:4200",
    "CORSCredentials": false
  }
}
```

> 說明：`Booking:DuplicateWindowDaysByBranch:<分院GUID>` = 該分院「同診別不可重複預約」的前後天數（台中院＝2，其餘分院預設 0＝當日不可重複）。CORS 需列出前端來源（客戶 :4200、之後後台另一個 port）。

### 1-2. 啟動

開兩個終端機：

```bash
# 終端機 A：啟動 Azurite（storage 模擬器）
npx azurite --silent --location ./.azurite

# 終端機 B：啟動 API
cd api/20Skin.Api
func start            # 預設 http://localhost:7071
```

驗證：`curl http://localhost:7071/api/health` → `{"success":true,...}`

> 首次會自動 `dotnet build`。整個方案建置：`cd api && dotnet build 20Skin.slnx`。

---

## 2. 客戶前台 SPA（`web-customer/`）

```bash
cd web-customer
npm install           # 首次
npx ng serve          # http://localhost:4200
```

- API 位址設定於 `src/environments/environment.ts`（`apiBase: http://localhost:7071/api`）。
- 需先啟動後端 API；CORS 已允許 `http://localhost:4200`。

### 測試登入
- 會員登入：身分證 + 生日。測試帳號 **`B121583140` / `1978-02-01`**。
- 流程：登入 → 選分院 → 診別（健保/醫美）→ 項目 → 日期/時段 → 送出 → 完成；另有「預約查詢 / 取消」。

> ⚠️ **簡訊**：本機與測試一律使用 `DevNoOpSmsSender`——**不會真的發送簡訊**（避免誤發到客人手機），只記 log。正式環境才接智邦 API。

---

## 3. 後台管理 SPA（`web-admin/`）

```bash
cd web-admin
npm install
npx ng serve --port 4300    # 與客戶前台不同 port
```

> 後台登入/各模組尚在開發中（見 [docs/status.md](docs/status.md)）；若要讓後台呼叫 API，記得把 `http://localhost:4300` 加入後端 `local.settings.json` 的 `Host:CORS`。

---

## 常見問題

- **API 啟動後所有路由 404**：請確認用 `func start`（非 `--no-build`），且 Azurite 已啟動。
- **前端呼叫 API 出現 CORS 錯誤**：確認 `local.settings.json` 的 `Host:CORS` 含該前端來源，並重啟 `func`。
- **資料庫連不上**：確認 SQL Server 已啟動、`20Skin` 存在、連線字串的帳密與 `TrustServerCertificate=True` 正確。

---

## 文件

- 進度與接續點：[docs/status.md](docs/status.md)
- 系統總覽 / 架構：[docs/project-overview.md](docs/project-overview.md)、[docs/architecture.md](docs/architecture.md)
- 設計與功能藍圖：[docs/design/](docs/design/)、[docs/blueprints/](docs/blueprints/)
- 舊系統參考：[docs/old/](docs/old/)
