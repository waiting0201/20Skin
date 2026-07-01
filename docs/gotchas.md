---
title: 已知陷阱（新系統）
purpose: 紀錄新系統（Angular SPA + Azure Functions + reused DB）開發中發現的踩雷、反模式、跨層約定，避免重複犯錯
applicable_when: 實作前 sanity check、遇到奇怪現象、code review 時
related_agents:
  - qa-test-engineer
  - code-review-optimizer
related_docs:
  - conventions.md
  - design/database-design.md
  - design/security.md
  - old/gotchas.md
keywords: [gotchas, 陷阱, 踩雷, 反模式, 新系統]
last_updated: 2026-07-01
---

> 新系統陷阱。**舊系統**陷阱見 [old/gotchas.md](old/gotchas.md)（含 reused DB 既有怪癖：時間戳命名不一致、無 FK、列舉值散落等，沿用時務必先讀）。

## reused DB（schema 不可改）衍生

### 不可加索引/欄位/約束
- 密碼雜湊、refresh token 表、unique constraint、補 FK 都**不可做**（會動 schema）→ 一律應用層處理或列待核准項。見 [design/database-design.md](design/database-design.md)。

### 與舊系統並行寫同一 DB
- 新舊系統可能同時讀寫 `20Skin`；欄位語意、列舉值、CASCADE 行為須與舊系統完全相容。Dapper 依「POCO 屬性名＝欄位名」對應，**勿自行「修正」既有怪欄位名**（`Createdate` 小寫 vs `CreateDate`），否則對應不到。

## 問卷（Questions）

### `OptionType` 實際值與文件不符（重要）
- **症狀**：舊文件與程式 enum 記為 `0=單選/1=複選/2=文字/3=檔案`，但真實 `20Skin` DB `Questions.OptionType` **只有 `1`（單選 radio，180 題）與 `2`（複選 checkbox，4 題）**，無 0、無 3（無文字/檔案題型）。舊 View 的 `if(OptionType==1)→radio else→checkbox` 才是對的。
- **影響**：問卷渲染只需 radio(1)/checkbox(2)；**不依賴檔案上傳/Blob**（本以為要等 file-upload 才能做，實際不用）。
- **預防**：`QuestionOptionType` enum 已更正為 `Single=1/Multiple=2`（[Enums.cs](../api/Skin.Core/Constants/Enums.cs)）；前後端一律以「1→radio、2→checkbox」處理。「其他」自填由 `Questions.IsOther`＋`MemberQuestions.Other` 表達，與 OptionType 無關。

### 問卷目前全數停用
- **症狀**：14 個 `QuestionTypes` 全 `IsEnabled=false`，且**沒有任何 `Categorys.IsQuestion=true`**（歷史用過，`MemberQuestions` 有 5 萬筆，但後台已關）。
- **影響**：預約流程的 `IsQuestion` 分支現在不會觸發；問卷清單也為空。功能正確、但要等後台把某問卷/項目啟用才會出現。驗證時須自行以交易暫啟用再還原。
- **預防**：後端誠實遵守 `IsEnabled`／`IsQuestion` 過濾，不硬塞。

### `MemberQuestionAnswers.QuestionAnswerID` 為 NOT NULL
- 每筆答案列必須有合法 `QuestionAnswerID`（該表**無 FK** 到 `QuestionAnswers`）→ 寫入前於應用層過濾非法/偽造的 answerID（`QuestionService.SubmitAsync`）。「其他」自填不佔答案列，存 `MemberQuestions.Other`。

### 手動簽的 JWT role claim 對不上（測試用）
- **症狀**：以 HS256 手簽 member token 時，`ClaimTypes.Role`（URI）與短名 `role` 皆無法被 `RequestContext.Role` 讀到（`/auth/me` role=null、`[Authorize(Roles.Member)]` 回 403）；但 `nameidentifier`/`name` 正常。
- **預防**：測試需要 member token 時，直接打 `POST /api/auth/member/login`（dev reCAPTCHA 空 secret 自動放行），用回傳的真 token，別手簽。

## 自訂 router

### async action 拋 BusinessException → 曾誤回 500（已修 2026-07-01）
- **症狀**：controller 的 **async** action 內 `throw new BusinessException(...)`（如預約 FULL/DUPLICATE/NO_ROSTER、問卷 NOT_FOUND）原本回 HTTP 500，而非預期的 `200 {success:false, code}`。
- **原因**：router 以反射 `action.Invoke` 取得 `Task` 再 `await`；**async 例外直接以原型別拋出**，但 catch 只攔 `TargetInvocationException`（僅 sync Invoke 才會包裝）→ 落到通用 catch 回 500。
- **修法**：`ApiRouterFunction` 於通用 catch **之前**加 `catch (BusinessException be)` 直接回 `ApiResponse.Fail`；保留 `TargetInvocationException` 分支處理 sync 情形。
- **預防**：新增會拋 BusinessException 的端點時，記得業務錯誤應回 200 Fail 信封；若又見 500，先查此 catch 順序。

## 客戶前台（Angular）

### `[ngModel]` 置於 `<form>` 內未加 `standalone` → NG01352（已修 2026-07-01）
- **症狀**：`appointment-form` 的預約人數/日期 `<input [ngModel]="...">` 包在 `<form>` 內、且無 `name` 也無 `[ngModelOptions]="{standalone:true}"` → 執行時瀏覽器丟 `NG01352`，**日期輸入失效 → 無法載入時段 → 無法預約**。`ng build` 不會報錯（僅執行期才炸），故只有實際跑起前端才會發現。
- **修法**：所有 `<form>` 內的 `[ngModel]` 一律加 `[ngModelOptions]="{ standalone: true }"`（本專案表單狀態走 signals，不需 Angular form control 註冊）。
- **預防**：新頁面若在 `<form>` 內用 `[ngModel]`，務必加 `standalone`；**每個前端頁面至少用瀏覽器（Playwright headless）跑過一次**，別只信 `ng build`。可用 scratchpad 的 Playwright E2E（登入→分院→診別→項目→日期/時段/指定醫師→送出→查詢/詳情→JoinUs 城市區連動）當回歸。

## 檔案上傳 / Blob

### Azurite 不支援新 SDK 的 service 版本 → 釘版（2026-07-01）
- **症狀**：`Azure.Storage.Blobs 12.29.1` 預設 service 版本 `2026-06-06`，本機 Azurite 3.35 回 `400 InvalidHeaderValue: The API version ... is not supported`；上傳一律 500。Azurite 的 `--skipApiVersionCheck` **在此版無效**（試過仍擋）。
- **修法**：`BlobFileStorage` 以 `new BlobClientOptions(BlobClientOptions.ServiceVersion.V2025_11_05)` **釘住 service 版本**（正式 Azure 支援所有較舊版本，對正式安全）。→ 本機 Azurite **不需**任何特殊旗標。
- **預防**：升 `Azure.Storage.*` 後若上傳 500，先看是否又超出本機 Azurite 支援版本；升 Azurite 或調整釘版。

### 上傳走 multipart：router 需注入 HttpRequest
- 自訂 router 預設把複雜型別當 JSON body 綁定；檔案上傳要讀 multipart → 已讓 action 可宣告 `HttpRequest` 參數（router 直接傳 `req`），controller 用 `req.ReadFormAsync().Files`。

### Blob 公開容器：GET 可、DELETE 需授權
- 容器建為 `PublicAccessType.Blob`（`<img>` 直接讀）。**匿名只能讀**；刪除要用帳戶金鑰/SAS（測試清理時用 SDK 帶金鑰，別用匿名 DELETE，會 403）。

## 待補充

（開發開始後，把新系統實際踩到的雷紀錄於此；格式：症狀 / 影響 / 預防）
