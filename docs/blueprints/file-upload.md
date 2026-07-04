---
title: 檔案上傳（Blob Storage）
purpose: 圖片（預約照片、分院/項目/問卷圖）與問卷檔案上傳改用 Azure Blob Storage，取代舊本機 ~/Upload + Web API 三段式
status: done
applicable_when: 要實作或修改檔案上傳/刪除、Blob 整合、或處理上傳安全時
related_agents:
  - software-architect-blueprint
  - backend-engineer
  - deployment-engineer
related_docs:
  - ../design/infrastructure.md
  - ../design/api-design.md
  - ../design/backend-design.md
keywords: [upload, blob-storage, file, image, questionnaire-file]
last_updated: 2026-07-04
---

## 實作狀態（2026-07-01 完成，客戶預約照片；真實 Blob/DB 驗證）

- **後端**：`Skin.Services/Storage`（`IFileStorage`/`BlobFileStorage`/`StorageOptions`）+ `POST /api/uploads`（`UploadsController`，需會員登入，multipart）。
  - **連線字串統一**用 `AzureWebJobsStorage`（本機 = Azurite；與 Functions 執行階段同一個，不另設）。
  - **容器 `upload`**，子路徑用**舊系統資料夾名**（`appointments`/`branchs`/`categorys`/`memberquestions`）→ 舊 `~/Upload` 可整包搬進容器（路徑 1:1）。
  - 驗證：目錄白名單（擋路徑穿越）、型別白名單（jpg/png/webp/gif）、大小上限（8 MB）；檔名 GUID（避免覆蓋）；容器 public-blob（`<img>` 直接讀）。
  - `Appointments.Photo` 沿用「只存檔名」（相容舊資料）；`AppointmentDetailDto` 加回 `Photo`。
  - **router 擴充**：action 可注入原始 `HttpRequest` 讀 multipart。
- **前端**：`UploadService`（FormData → `/api/uploads`；`photoUrl(filename)` 依 `environment.uploadBase` 組 URL）；`appointment-form` 加檔案選擇+預覽+移除；`complete`/`appointment-detail` 顯示照片。
- **驗證**：API 端（上傳→blob 公開 GET image/png→INVALID_TYPE/INVALID_FOLDER/401→建立預約帶 photo→詳情回 photo→硬刪+刪 blob 零殘留）＋ 前端 Playwright（選檔→預覽→送出→完成頁顯示圖）全通過。
- **未做**：後台分院/項目圖上傳（admin 模組）、問卷檔案題型（真實資料無 OptionType 3）、刪除端點（目前只上傳）。

## 歷史檔案搬遷與正式機驗證（2026-07-04）

- **搬遷（已完成，使用者確認 2026-07-04）**：舊主機 `~/Upload/{appointments,branchs,categorys,memberquestions}` 已整包搬進正式站 Storage `st20skinprod` 的 `upload` 容器（子路徑 1:1 對應舊資料夾名；因新舊 DB 皆只存檔名，DB 無需改動）。搬遷方式為 azcopy `--recursive`。舊命名為時間戳（`yyyyMMddHHmmss.ext`），與新上傳的 GUID 檔名於同容器共存，不衝突。
- **正式機已驗（無瀏覽器 session 可驗的部分）**：`GET /api/health` → 200；受保護端點（`/api/uploads`、`/api/branches`）→ 401＝符合設計（`BookingController` 為 class 層級 `[Authorize(Roles.Member)]`，`branches` 需登入非 bug）；兩前台 `environment.prod.ts` 確認 `uploadBase=https://st20skinprod.blob.core.windows.net/upload`、`apiBase=https://func-20skin-api-prod.azurewebsites.net/api`，且部署後 JS chunk 已不含 localhost。
- **尚待實跑（需瀏覽器＋真會員帳號）**：① 正式站 login→上傳一張→完成頁/詳情頁顯示的 click-path（人工瀏覽器操作，非本次腳本範圍）；② 隨機抽一個既有 `Categorys.Photo`/`Appointments.Photo` 檔名，GET `uploadBase/{folder}/{filename}` 確認 200 + `image/*`（驗證搬遷檔可顯示、既有記錄不再破圖）。此兩項非互動 session（無 Playwright/chrome-devtools、無 prod 憑證）無法完成，待互動環境或 deployment-engineer 執行。

## Smoke-test 腳本（2026-07-04，deployment-engineer 產出，尚未對正式站實跑）

- **產出**：`scripts/smoke/`（`check_migrated_files.py` 驗收①搬遷檔可顯示、`check_new_upload.py` 驗收②新上傳可用、`common.py` 共用工具、`README.md` runbook）。皆為 Python，僅依賴標準函式庫 + `pyodbc`（DB 存取無法避免）；HTTP 一律走 `urllib`，不加 `requests` 依賴。驗收①全程唯讀（只 `SELECT`）；驗收②上傳測試圖後**必刪**（`az storage blob delete`，`try/finally` 保證即使顯示驗證失敗也會清理），且絕不呼叫 `POST /api/appointments`。
- **重大發現：驗收②的腳本自動登入在正式環境不可行**——查證 `RecaptchaVerifier.VerifyAsync`（`api/Skin.Services/Recaptcha/RecaptchaVerifier.cs`）與 `infra/modules/function-app.bicep` 確認正式環境 `Recaptcha:SecretKey` 已由 Key Vault 設定為非空值，dev bypass（`SecretKey` 空才放行）因此不生效；空 token 會被立即拒絕（連 Google siteverify 都不會呼叫）。**結論**：curl/requests 類腳本無法產生瀏覽器端 `grecaptcha.execute()` 產生的真實 v3 token，`POST /api/auth/member/login` 在正式環境必定回 `RECAPTCHA_FAILED`。`check_new_upload.py` 因此改為**優先接受外部傳入的 JWT**（`--jwt`/`MEMBER_JWT` 環境變數，經瀏覽器手動登入後由 DevTools 複製），腳本登入嘗試（`--login-*` 參數）保留作為未來政策調整時的免改碼備援路徑，非本次驗收的主要手段。此發現與既有 `docs/design/security.md` §MinScore 門檻決策一致（正式環境維持嚴格驗證），非新決策，僅是本次任務對「腳本能否登入」的具體查證記錄。
- **未做**：實際在有 prod 憑證的機器上執行（本次產出環境無 prod DB/Storage 存取權，僅完成腳本撰寫+單元層級自我測試，如 argparse/1x1 PNG CRC/multipart 編碼/HTTP 200-404 分支）；待使用者或下一輪 deployment-engineer 在有權限的機器上實跑並回報結果。

## 背景與動機
舊系統檔案存 IIS 本機 `~/Upload/{Entity}`，後台經 Web API 三段式（暫存→上傳前台→刪）、金鑰極弱(`!@#qwe`)、無副檔名驗證、未進版控無備份。重寫改 Azure Blob Storage。

## 範圍
### 做什麼
- 上傳端點：multipart → 寫入 Blob 容器（依用途分 folder：appointments/branchs/categorys/questions）→ 回 URL。
- 刪除端點：依 folder+filename 刪 Blob。
- 副檔名/大小/型別驗證。
### 不做什麼
- 不在 DB 存二進位（仍存檔名/URL 於既有欄位，如 `Appointments.Photo`、`MemberQuestions.Filename`）。

## 使用者流程
```
前端選檔 → POST /api/uploads (multipart: file, folder) → 回 {url}
  → 前端把檔名/URL 附在後續表單(預約/問卷/主檔)
刪除 → DELETE /api/uploads?folder=&filename=
```

## 設計決策
- **Blob 取代本機**：可備份、可擴展、與無狀態 Functions 相容。
- **授權**：上傳需有效 JWT（取代舊弱金鑰）。
- **驗證**：白名單副檔名（jpg/png/pdf…）、大小上限、MIME 檢查（修舊任意上傳風險）。
- **命名**：folder + GUID/原檔名，避免覆蓋與路徑穿越。
- 既有欄位仍存檔名（相容營運中 DB）；URL 由 folder+檔名組出或存完整 URL（視欄位長度）。

## 跨層影響
| 層級 | 影響 | 摘要 |
|---|---|---|
| 後端 | 是 | UploadController + IBlobStorageService |
| API | 是 | `POST /api/uploads`、`DELETE /api/uploads` |
| 資料庫 | 否 | 沿用既有檔名欄位 |
| 基礎建設 | 是 | Blob 容器、連線字串入 Key Vault |
| 安全 | 是 | JWT、副檔名/大小驗證 |

## 驗收標準
- [ ] 上傳回有效 URL 並可讀取
- [ ] 刪除有效
- [ ] 副檔名/大小/MIME 驗證
- [ ] 需 JWT
- [ ] 既有欄位（Photo/Filename）相容

## 風險與未解問題
- 既有檔名欄位長度（nvarchar(50)）可能放不下完整 URL → 存檔名、URL 由 folder 組出。

## 對應舊系統
- [old/design/infrastructure.md](../old/design/infrastructure.md) §檔案上傳、[old/design/api-design.md](../old/design/api-design.md)
- `reference/old/20Skin/Controllers/UploadsController.cs`、`Commons/ApiKeyHandler.cs`、`20SkinBackend/Commons/Librarys.cs`
