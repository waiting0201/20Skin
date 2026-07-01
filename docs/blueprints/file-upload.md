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
last_updated: 2026-07-01
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
- **未做**：後台分院/項目圖上傳（admin 模組）、問卷檔案題型（真實資料無 OptionType 3）、刪除端點（目前只上傳）、歷史 4275 張照片＋分院/項目圖從舊主機搬進 `upload` 容器（部署時 azcopy）。

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
