# 檔案上傳／顯示 Smoke-Test（正式環境）

驗證兩件事：
- **驗收①**：舊系統歷史檔案已成功搬進 Azure Blob（`st20skinprod`/`upload` 容器）且能顯示。
- **驗收②**：新上傳流程（`POST /api/uploads`）在正式機可用。

兩支腳本可獨立執行，皆為 Python 3（僅用標準函式庫 + `pyodbc`，不依賴 Playwright/瀏覽器）。
詳細背景見 [../../docs/blueprints/file-upload.md](../../docs/blueprints/file-upload.md) §歷史檔案搬遷與正式機驗證。

**本文件只能在有正式環境權限的機器上實際執行**（本次產出腳本的環境無 prod 憑證、無法連 prod DB，
未曾對正式站實跑）。

---

## 前置需求

| 項目 | 用途 | 取得方式 |
|---|---|---|
| Python 3.9+ | 執行腳本 | 系統套件管理員 / pyenv |
| `pip install -r requirements.txt`（僅 `pyodbc`） | 驗收①連 DB | `pip install -r scripts/smoke/requirements.txt` |
| **ODBC Driver 18 for SQL Server** | `pyodbc` 的底層驅動（pip 套件本身不含） | [微軟官方安裝說明](https://learn.microsoft.com/sql/connect/odbc/linux-mac/installing-the-microsoft-odbc-driver-for-sql-server) |
| `az` CLI，且已 `az login` | 驗收① Managed Identity 取 token；驗收②清理 blob | `az login`（需能存取 `rg-20skin-prod`） |
| 對 `20Skin` DB 的讀取權限 | 驗收① | 見下方「DB 認證」 |
| Storage 清理權限（帳戶金鑰 / SAS / 或 RBAC） | 驗收②清理殘留 blob | 見下方「Storage 清理認證」 |
| 會員（或後台管理員）JWT | 驗收② | 見下方「取得 JWT」 |

---

## 驗收①：搬遷檔可顯示

```bash
cd scripts/smoke
pip install -r requirements.txt

# 用你自己的 Entra 身分（需已對 20Skin DB 有 db_datareader，或用下方 fallback）
az login

python3 check_migrated_files.py --auth managed-identity --sample-size 20
```

### DB 認證（二擇一）

1. **Managed Identity / 你自己的 Entra 帳號（預設，建議）**
   - 腳本用 `az account get-access-token --resource https://database.windows.net` 取得存取權杖，
     以 AAD 驗證連線 `weyprous.database.windows.net` 的 `20Skin` 資料庫。
   - 前提：你登入的 Entra 帳號需已被加入 `20Skin` DB 的 contained user 且有 `db_datareader`
     （或直接沿用系統管理員 `Weypro` 帳號登入，見
     [infrastructure.md](../../docs/design/infrastructure.md) §4）。
   - 用法：`--auth managed-identity`（預設值，可省略）。

2. **SQL 帳密 fallback**
   - 若 AAD 路徑不可行（例如你的帳號不在 DB 允許清單），改用既有 SQL 帳密：
     ```bash
     python3 check_migrated_files.py --auth sql --sql-user <帳號> --sql-password <密碼>
     ```
   - 亦可用環境變數 `SQL_USER`/`SQL_PASSWORD`（避免密碼留在 shell history）：
     ```bash
     export SQL_USER=... SQL_PASSWORD=...
     python3 check_migrated_files.py --auth sql
     ```
   - **絕不**要用 `sa`（見 infrastructure.md 決策：需另建最小權限帳號）。

### 常用參數

```bash
# 只查特定 folder
python3 check_migrated_files.py --folders categorys,appointments

# 加大抽樣、把完整結果存成 JSON 供留存
python3 check_migrated_files.py --sample-size 50 --output report-$(date +%Y%m%d).json

# 若 DB server/database 名稱與預設不同（一般不需要）
python3 check_migrated_files.py --sql-server weyprous.database.windows.net --sql-database 20Skin
```

### 判讀輸出

- 每個 folder 印出：抽樣筆數、200/206 OK 筆數與比例。
- **`✗ 404/異常破圖清單`**：列出每個破圖的檔名與完整 URL —— 這是本次驗收要交付使用者的核心結果，
  代表該筆舊資料在搬遷後仍讀不到，需要人工複查（是否搬漏、檔名大小寫、路徑拼字）。
- **`⚠ 非 image content-type 警告`**：HTTP 200 但 Blob 回傳的 `Content-Type` 不是 `image/*`
  （例如被誤存成 `application/octet-stream`），瀏覽器 `<img>` 可能無法正確顯示，建議複查。
- **`⚠ 網路層錯誤`**：DNS/逾時/連線被拒等非 HTTP 狀態碼的錯誤，與「真的 404 破圖」分開列，
  代表這次執行環境或當下網路有問題，建議重跑一次而非直接判定為破圖。
- **exit code**：`0`=全數正常、`1`=有破圖（可接進 CI 判斷失敗）、`2`=參數/DB 連線錯誤、
  `3`=只有網路層錯誤、無真正破圖。

此驗收**全程唯讀**（只執行 `SELECT`），跑再多次也不需要任何清理。

---

## 驗收②：新上傳可用

### reCAPTCHA 對本腳本的限制（先讀這段，避免白工）

正式環境 `AuthController.MemberLogin`（`POST /api/auth/member/login`）在呼叫
`recaptcha.VerifyAsync` 前**不會**因為 dev bypass 而放行——`Recaptcha:SecretKey`
在正式環境已由 Key Vault 設定（`infra/modules/function-app.bicep`），且
`RecaptchaVerifier.VerifyAsync` 只要 `SecretKey` 非空、token 為空字串就直接回傳
`false`（連 Google 都不用呼叫）。

**結論：本腳本無法自動完成正式環境登入取得 JWT**——真實 v3 token 必須由瀏覽器執行
`grecaptcha.execute()` 產生，且與網域綁定，curl/requests 類工具原理上做不到。

腳本仍提供 `--login-number/--login-yyyy/--login-mm/--login-dd` 參數嘗試腳本登入，
**但預期一定會收到 `RECAPTCHA_FAILED`**；保留這條路徑純粹是為了未來如果政策調整
（例如改用其他驗證方式），腳本不需要改程式碼即可受益。

**因此請一律走「手動取得 JWT」路徑：**

1. 用瀏覽器開正式客戶前台，正常登入一次（身分證+生日）。
2. 開啟瀏覽器開發者工具：
   - **Network 分頁**：找 `POST .../api/auth/member/login` 請求，看 Response 內的
     `data.token` 欄位；或
   - **Application/儲存 分頁**：找前端存放 JWT 的 localStorage/sessionStorage key
     （實際 key 名稱請查 `web-customer/src/app` 的 auth 相關 service，非本腳本負責範圍）。
3. 複製該 JWT 字串，帶入 `--jwt` 參數或 `MEMBER_JWT` 環境變數。

> `UploadsController` 只要求 `[Authorize]`（會員或後台管理員角色皆可），
> 若手邊只有後台管理員 JWT 也可以用來跑這個驗收。

### 執行

```bash
cd scripts/smoke

# 方式一：JWT 用參數傳入
python3 check_new_upload.py --jwt "eyJhbGciOi..."

# 方式二：JWT 用環境變數（建議，避免留在 shell history / process list）
export MEMBER_JWT="eyJhbGciOi..."
python3 check_new_upload.py
```

### Storage 清理認證（三擇一，`--cleanup-auth auto` 預設會依下列優先序自動選）

1. **帳戶金鑰**（`--account-key` 或環境變數 `AZURE_STORAGE_KEY`）
   ```bash
   export AZURE_STORAGE_KEY=$(az storage account keys list \
     --account-name st20skinprod --resource-group rg-20skin-prod \
     --query "[0].value" -o tsv)
   python3 check_new_upload.py --jwt "$MEMBER_JWT"
   ```
2. **SAS token**（`--sas-token` 或環境變數 `AZURE_STORAGE_SAS_TOKEN`）——若你只想給腳本
   一個有時效、範圍受限（僅該容器、僅 delete 權限）的憑證，比帳戶金鑰更小權限：
   ```bash
   export AZURE_STORAGE_SAS_TOKEN=$(az storage container generate-sas \
     --account-name st20skinprod --name upload --permissions d \
     --expiry $(date -u -d "+1 hour" +%Y-%m-%dT%H:%MZ) -o tsv)
   python3 check_new_upload.py --jwt "$MEMBER_JWT"
   ```
3. **你自己的 `az login` 身分（`--cleanup-auth login`，無帳戶金鑰時的預設 fallback）**——
   完全不碰帳戶金鑰，最小權限做法，但需要你的帳號預先被指派
   `Storage Blob Data Contributor`（範圍限定在 `st20skinprod` 這顆帳戶即可，不需訂閱層級）：
   ```bash
   az role assignment create --assignee-object-id <你的 objectId> \
     --assignee-principal-type User --role "Storage Blob Data Contributor" \
     --scope /subscriptions/<訂閱ID>/resourceGroups/rg-20skin-prod/providers/Microsoft.Storage/storageAccounts/st20skinprod
   python3 check_new_upload.py --jwt "$MEMBER_JWT" --cleanup-auth login
   ```

腳本**一定會執行清理**（即使顯示驗證那一步失敗，只要上傳成功拿到 filename 就會嘗試刪除，
`try/finally` 保證），並在刪除後重新 GET 一次確認 404，才回報「零殘留」。

**若清理失敗（exit code 3）**：腳本會印出完整的 `az storage blob delete` 指令與
`folder/filename`，代表可能有殘留測試檔案，**請立刻手動執行印出的指令或於 Portal 確認刪除**。

### 判讀輸出

- `[1/4]` 上傳：印出後端回傳的 `filename`/`folder`/`url`。
- `[2/4]` 顯示驗證：200 + `image/*` 才算通過；非 200 或非 image content-type 會印警告，
  但**不會中斷流程**（清理仍會執行，避免因為顯示驗證失敗而留下殘留檔案）。
- `[3/4]` 清理：呼叫 `az storage blob delete`，失敗會直接 exit 3 並印出手動補救指令。
- `[4/4]` 複驗：重新 GET 剛才的 URL，確認 404。
- **exit code**：`0`=上傳+顯示+清理全通過、`1`=清理已完成但顯示驗證未通過（需複查後端/Blob
  content-type 設定，非殘留問題）、`2`=拿不到 JWT（見上方 reCAPTCHA 段落）、
  `3`=清理失敗或複驗仍非 404（**需人工介入避免殘留**）。

**本驗收絕不會呼叫 `POST /api/appointments`**，不會在 `Appointments` 資料表留下任何紀錄。

---

## 疑難排解

| 現象 | 可能原因 | 處理 |
|---|---|---|
| `ImportError: pyodbc` | 未安裝套件 | `pip install -r requirements.txt` |
| `pyodbc.InterfaceError: ... Driver not found` | 系統未裝 ODBC Driver 18 | 見上方前置需求連結安裝 |
| `az account get-access-token` 失敗 | 未 `az login` 或 token 過期 | 重新 `az login` |
| DB 連線 `Login failed for user '<token>'` | 你的 Entra 帳號未加入 `20Skin` DB 的 contained user | 請具 AAD 系統管理員身分的人執行 infrastructure.md §4 的 `CREATE USER ... FROM EXTERNAL PROVIDER` |
| 驗收①大量 404 | 真的搬遷缺漏，或 folder/檔名大小寫不一致 | 用印出的 URL 直接瀏覽器開啟確認，並回頭核對 azcopy 搬遷紀錄 |
| 驗收②回 `RECAPTCHA_FAILED` | 正式環境本就無法腳本登入（見上方說明） | 改用瀏覽器手動取得 JWT，帶入 `--jwt` |
| 驗收② `401 Unauthorized` | JWT 過期或格式錯誤 | 重新從瀏覽器登入取得新 JWT（`Jwt:AccessTokenMinutes` 到期即失效） |
| 驗收②清理失敗 exit 3 | 帳戶金鑰/SAS 已過期，或 `az login` 身分無 `Storage Blob Data Contributor` | 依印出的指令手動執行，或重新產生金鑰/SAS/角色指派 |

## 觀測

- API 端錯誤（500）可查 Application Insights：Azure Portal → `appi-20skin-prod` →
  Logs / Live Metrics / Failures（見 [infrastructure.md](../../docs/design/infrastructure.md) §觀測）。
- Blob 存取記錄（如需追查誰刪了什麼）：Storage 帳戶 → 監視 → 記錄（需另外啟用診斷設定，
  目前 IaC 未預設開啟）。
