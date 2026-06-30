---
title: 已知陷阱
purpose: 紀錄 20Skin 專案特有的踩雷、反模式、跨層約定不一致，避免重複犯錯
applicable_when: 開始實作前的 sanity check、遇到奇怪現象時、code review 時
related_agents:
  - qa-test-engineer
  - code-review-optimizer
related_docs:
  - conventions.md
  - design/database-design.md
  - design/backend-design.md
  - design/security.md
  - blueprints/customer-booking.md
keywords: [gotchas, 陷阱, 踩雷, 反模式, anti-pattern]
last_updated: 2026-05-26
---

## 資料庫

### 時間戳記命名不一致
- **症狀**：`Members.Createdate` / `Appointments.Createdate` 是小寫 d，但 `SmsStatus.CreateDate` / `UpdateDate` 是大寫 D
- **影響**：寫 LINQ / 動態 SQL 時容易拼錯欄位名
- **修正路徑**：grep 確認欄位名，未來新表統一用 `CreatedAt` / `UpdatedAt`（需配套整批改名）

### 無軟刪除欄位，全部 CASCADE
- **症狀**：刪一筆 `Members` 會連帶刪光該會員所有 `Appointments` 與 `MemberQuestions`
- **預防**：刪除前確認業務上是否真的要級聯；高風險刪除（如 `Branchs`）已加前置條件檢查（有 `Rosters` 則擋）
- **唯一邏輯刪除**：`Appointments.Status = 0` 代表取消

### 列舉值不在 DB
- **症狀**：`Appointments.Status` / `Branchs.BranchType` / `Members.Gender` / `Questions.OptionType` 都是 int / nvarchar，但值意義散在 code
- **預防**：寫新邏輯前先 grep `20Skin.Libs/Definition.cs` 與對應 Service 找常數
- **已知值速查**：
  - `Members.Gender`：0=未知 / 1=男 / 2=女
  - `Questions.OptionType`：0=單選 / 1=複選 / 2=文字 / 3=檔案
  - `Appointments.Status`：1=已預約 / 0=取消
  - `SmsStatus.Status`：null=待發 / "CANCEL"=取消預約 / 其他=API 回填

### `MemberQuestions.QuestionID` 可空
- **症狀**：同表混用「整類問卷容器」（QuestionID=null）與「具體題目應答」（QuestionID 有值）兩種語意
- **影響**：查詢時要明確區分 NULL 與 non-NULL，否則答案計數會錯
- **修正路徑**：未來重構考慮拆兩表

### 後台預約查詢硬編碼 BranchID
- **症狀**：`ReserveMsController.TaAppointments` 預設 `WHERE BranchID = Guid("e65f4720…")`（台中固定）
- **影響**：擴點到第二家診所需修 Controller
- **修正路徑**：改從 Session / URL / 使用者偏好取 BranchID

### Database-First：schema 真相在 SQL Server
- **症狀**：改 `Model1.edmx` 或對應 partial class **不會**自動 propagate 到 DB
- **流程**：1) DB 改 → 2) EDMX update from database → 3) 手動跑 `Model1.tt` / `Model1.Context.tt` 重生 → 4) 確認 partial class

## 前端

### Login / JoinUs 三 select 生日選擇器（Android / Line WebView）
- **既有設計**：三個 `<select>`（民國年顯示 / 西元年 value、月、日），保留以服務習慣民國年的年長使用者；後端 `Members.Birthday` 由 YYYY/MM/DD 三欄組合
- **為何不換 flatpickr / `<input type="date">`**：業務要求保留民國年顯示；且 `<input type="date">` 在 Line / FB / IG 內建瀏覽器表現不穩
- **已修 bug 清單**（[Login.cshtml](../../reference/old/20Skin/Views/MainMs/Login.cshtml) / [JoinUs.cshtml](../../reference/old/20Skin/Views/MainMs/JoinUs.cshtml)）：
  - `window.addEventListener('load', YYYYMMDDstart)` 等所有資源（含 reCAPTCHA / 字體 / 圖片）才觸發；Line 弱網下使用者看到空下拉很久 → 改放 `$(function(){})` ready 內
  - inline `onchange="YYYYDD(this.value)"` 在 Line Android 舊版 WebView 觸發不穩 → 移除屬性、改用 jQuery `.on('change', ...)` 綁定
  - JoinUs 閏年判斷條件**寫錯**：`new Date().getMonth() == 1`（=今天是 2 月）應為 `m == 2`（=使用者選的月份是 2 月）→ 否則 1992/2/29 等閏年生日無法選到 29
  - JoinUs 缺 `DD` placeholder option → 改月份後出現重複「1 日」
  - `MonHead` 無 `var` 為隱式全域 → 嚴格模式會 ReferenceError；改為頂層 `var MonHead = [...]`
  - JoinUs 開發殘留 `console.log(n)` → 移除
- **尚未修但需注意**：
  - `document.reg_testdate.XXX` DOM Level 0 命名空間：FB / IG 極舊版 in-app browser 偶爾拿到 undefined；可日後改 `getElementById`
  - `MM.options[selectedIndex].value`：若 select 還沒 render `selectedIndex` 可能為 -1，存取 `options[-1].value` → TypeError；極罕見

## 後端

### 並發預約容量無 lock
- **症狀**：`COUNT(Appointments) + INSERT` 之間無 transaction / unique constraint，極端並發下可超賣
- **預防**：高峰期人工後台稽核；長期方案考慮加 unique constraint 或 transaction isolation
- **詳見**：[blueprints/customer-booking.md](blueprints/customer-booking.md) 「風險與未解問題」段

### 班表編輯無樂觀鎖
- **症狀**：`EditTaRosters` 採「清空再重建」，多人同時編輯後寫者完全覆蓋前寫者
- **預防**：分配班表負責人；長期考慮加 `RowVersion` 欄位

### 長 Controller 修改前先 grep
- **症狀**：`ShiftMsController` ~92KB / `ReserveMsController` ~57KB
- **預防**：勿整檔讀；用 grep 定位 Action 後針對性 Read
- **修正方向**：新功能下沉到 Service；列在 [status.md](../status.md) Backlog

### Session 跨 tab / 重新整理打斷預約流程
- **症狀**：客戶預約用 `Session["myReserve"]` 暫存中間狀態，F5 或開新 tab 會打斷
- **預防**：UI 提示「請完成預約再離開」；長期考慮改用 hidden form fields 或前端 state

### 時區硬編碼 `now + 9h`
- **症狀**：`Ajax/PostCancel` 取消時限判斷用 `DateTime.Now.AddHours(9)`
- **影響**：假設 server 為 UTC + 9 對時；遷雲或改 timezone 設定會錯亂
- **修正路徑**：改為明確 `TimeZoneInfo.ConvertTime` 或統一存 UTC

### 兩個 `AjaxController` 命名相同但行為不同
- **症狀**：`20Skin/Controllers/AjaxController.cs`（前台）與 `20SkinBackend/Controllers/AjaxController.cs`（後台）同名
- **影響**：跨專案 grep / 跨檔複製貼上時容易混淆
- **預防**：明確標註所在專案

### 業務邏輯散在 Controller
- **症狀**：許多業務邏輯（如預約建立的容量檢查、自動編號）寫在 Controller 而非 Service
- **預防**：新功能優先寫在 Service；改既有功能可順手抽出

### 第三方上傳依賴自訂 Library
- **症狀**：`Librarys.UploadFileToFrontend` / `DeleteFileFromFrontend` 黑箱
- **預防**：理解三段式（本機暫存 → 上傳 → 刪除）；測試環境上傳需確認對應 CDN 設定

### `BaseService.Dispose()` 無限遞迴
- **症狀**：`20Skin.Service/BaseService.cs` 的 `Dispose()` 內呼叫 `this.Dispose()`（呼叫自身），若被呼叫會 StackOverflow
- **影響**：實務上 DbContext 釋放靠 GC，少有人呼叫此方法所以未爆，但屬潛在地雷
- **修正路徑**：應改為 `this.repository.Dispose()` 並 `GC.SuppressFinalize(this)`

## 安全 / 認證

### 前後台 Session 各自獨立
- **症狀**：前台與後台是兩個 IIS Application；同瀏覽器各有獨立 Session
- **影響**：「在前台登入過」與「在後台已登入」是兩件事，無法跨用
- **預防**：開發 / 測試時注意切換登入態

### 後台 Session timeout 480 分鐘
- **症狀**：`Web.config` 明設 `<sessionState timeout="480" />`
- **影響**：長期登入態，閒置 8 小時後才過期；遺忘登入的設備可能被誤用
- **預防**：教育使用者主動登出；考慮縮短 timeout（業務取捨）

### `CheckSession(IsAuth=true)` 依賴字串 Contains
- **症狀**：權限授權靠 `Lims.Key.Contains(controller)` + `Contains(action)`
- **影響**：Controller / Action 改名容易破壞授權；無單元測試
- **預防**：改名 Action 時同步檢查 `Lims` 表的 Key

### `/MainMs/CheckSms` 對外公開無保護
- **症狀**：給 cron 用的 endpoint 無 IP 白名單 / token，任何人都可觸發
- **影響**：被濫用可能讓 SMS 額度被燒
- **預防**：加 IP 白名單或共享 secret token

### IDOR：預約詳情 / 取消未驗證歸屬
- **症狀**：`MainMsController.AppointmentDetail` / `AppointmentCancel`（及 `Ajax/PostCancel`）僅以 `AppointmentID`（Guid）查詢，未驗證該預約是否屬於目前登入會員
- **影響**：登入後可枚舉 / 操作他人預約（資訊洩漏 + 越權取消）
- **預防**：所有依 ID 查單筆的 Action 須加 `WHERE MemberID = Session["MemberID"]` 條件

### SMS 憑證硬編碼於 Controller + 走 HTTP + 關閉 SSL 驗證
- **症狀**：智邦簡訊 `api_key` / `user_name` / `password` 直接寫死在 `MainMsController`（含 `CheckSms`）；API URL 為 `http://`（非 HTTPS）；`SmsHandler` 內 `ServicePointManager.ServerCertificateValidationCallback = delegate { return true; }` 完全停用憑證驗證
- **影響**：憑證隨原始碼外洩；明文傳輸 + 中間人風險
- **預防**：憑證移至 Web.config / Key Vault；改 HTTPS；移除停用憑證驗證的 callback。reCAPTCHA client/server key 同樣明文寫在 `20Skin.Libs/Definition.cs`，一併處理

## 基礎建設 / 部署

### `Upload/` 未進版控
- **症狀**：`.gitignore` 排除 `Upload/`，正式環境檔案無 git 備份
- **預防**：另行設置 IIS 主機備份 / 雲端同步策略

### CheckSms 獨立排程
- **症狀**：`CheckSms.exe` 不在 IIS 內，部署新版本須**獨立發布**到 Windows Task Scheduler 指向路徑
- **預防**：部署 checklist 包含 CheckSms 部署步驟

### 無 staging / dev / uat 環境
- **症狀**：只有 local 與 production
- **影響**：新功能直接上 production 風險高
- **預防**：謹慎部署、業務淡時段發布

### 無 CI/CD
- **症狀**：手動 build → 手動 publish 到 IIS
- **影響**：人為失誤可能跳過編譯錯誤、忘記更新某檔
- **預防**：部署 checklist；長期建 pipeline

## Harness / 文件

### 文件腐化
- **症狀**：doc 寫的設計與實際 code 不符
- **預防**：嚴格遵守 [CLAUDE.md](../../CLAUDE.md) 「文件同步規則」；變更 code 必檢視相關 doc
- **檢測**：定期 grep `<填入>` / `<例如>` 確認無樣板殘留

### Agent 錯置
- **症狀**：用 backend-engineer 改前端、用 qa-test-engineer 寫 code
- **預防**：先查 [CLAUDE.md](../../CLAUDE.md) 路由表
- **特例**：qa-test-engineer **絕不**修改 code，只審查

## 反模式速查

| 反模式 | 為什麼不好 | 替代做法 |
|---|---|---|
| 在 ShiftMs / ReserveMs Controller 加新邏輯 | 已過大難維護 | 下沉到 Service |
| 在 Service 用 `HttpContext.Current.Session` | 跨層耦合 | 由 Controller 取 Session 再傳入 |
| 改 EDMX 後忘記跑 T4 | DbContext 不同步 | 改 schema checklist 必含 T4 步驟 |
| 預約建立後**只**寫即時 SMS | 漏掉提醒 | 一律雙寫 |
| 後台預約查詢未檢查硬編碼 BranchID | 擴點失效 | 必須改 Controller |
| 在 doc 內寫「請呼叫 X agent」 | agent 改名要改一堆 | 只在 frontmatter `related_agents` 維護 |
