---
title: 後台會員管理
purpose: 會員查詢/編輯/刪除、黑名單、問卷答案檢視與維護
status: shipped
applicable_when: 要實作或修改後台會員資料維護、黑名單、會員問卷檢視時
related_agents:
  - software-architect-blueprint
  - backend-engineer
  - frontend-architect
related_docs:
  - ../design/frontend-backend.md
  - ../design/frontend-coding-style.md
  - ../design/api-design.md
  - ../design/database-design.md
  - ../gotchas.md
  - questionnaire.md
keywords: [admin, member, blacklist, member-questions, edit]
last_updated: 2026-07-03
---

## 背景與動機
員工維護病患資料與黑名單、檢視問卷。舊 `MemberMsController`：會員可查詢/編輯/刪除（`DeleteMembers`），問卷答案 CRUD（含掃描檔上傳）。

## 範圍
### 做什麼
- 會員列表（篩選：分院/身分證號/生日）+ 分頁 20 筆；含初診判斷與曾就診分院顯示。
- 編輯會員（手機/生日/姓名/性別/血型/email/地址城市區連動/緊急聯絡人/過敏史+其他/病史+其他/黑名單）。
- **刪除會員**（比照舊 `DeleteMembers`，**加前置檢查**擋下有預約/問卷紀錄者，見「設計決策」）。
- 會員問卷維護（**完整比照舊系統**，使用者拍板）：
  - 已上傳掃描檔清單（可新增/編輯/刪除，含檔案）
  - 已數位作答問卷清單（唯讀連結，重用客戶前台問卷表單資料顯示打勾清單）
### 不做什麼
- 不新增會員本體（舊系統 `MemberMsController` 本無此功能，僅 `JoinUsController` 前台初診註冊會建檔）。
- 不改 schema（過敏史/病史沿用 CSV 字串欄位）。
- 問卷檔案題型（`OptionType=3`）：真實資料不存在，不實作（見 [questionnaire.md](questionnaire.md)）。

> **文件更正記錄（2026-07-03）**：本檔前一版曾錯誤記載「不新增/刪除會員（沿用舊範圍）」，實際上舊 `MemberMsController` 有 `DeleteMembers` action（無任何前置檢查即硬刪）。此為撰寫初版時的疏漏，非刻意決策；已於本次會員管理實作時，經使用者提出「會員沒有做到刪除」的回饋後發現並補齊，詳見下方設計決策。

## 使用者流程
```
/member → 篩選列表 → 編輯會員(含黑名單切換) / 刪除會員
/member/{id}/questionnaires → 已上傳掃描檔(編輯/刪除) + 已數位作答問卷(唯讀檢視)
/member/{id}/questionnaires/new|{linkId}/edit → 新增/編輯掃描檔上傳
/member/{id}/questionnaires/{questionTypeId}/view → 唯讀檢視數位作答打勾清單
```

## 設計決策
- **過敏史/病史**：DB 為 CSV 字串（沿用）；前端以陣列 ↔ CSV 轉換，選項常數與 `web-customer/join-us.ts` 一致（各自獨立一份，不共用跨專案程式碼）。
- **黑名單** `IsBlackList`：後台可切換；登入端據此擋（見 [member-auth.md](member-auth.md)）。
- **刪除會員加前置檢查（不同於舊系統）**：已對真實 DB 查證 `Appointments.MemberID`/`MemberQuestions.MemberID` 對 `Members` 皆為 **CASCADE**（見 [old/design/database-design.md](../old/design/database-design.md) §2/§7）。舊 `DeleteMembers` 無任何檢查即呼叫 `Delete`，等同一鍵靜默刪光該會員的全部預約與問卷史。比照本系統其餘 CASCADE 風險實體（Branch/Category/Period/Doctor，見 [admin-basic-data.md](admin-basic-data.md)）的既有慣例，`MemberAdminService.DeleteAsync` 加前置檢查：`COUNT(Appointments)+COUNT(MemberQuestions) > 0` 即擋下（`MEMBER_IN_USE`），僅允許刪除從未有任何預約/問卷紀錄的乾淨會員（如誤建檔案例）。此為**刻意的安全強化**，非沿用舊系統原始行為。
- **`MemberQuestions` 一表兩用（掃描檔 vs 數位作答）決策**：`Filename` 欄位是舊系統遺留機制——`Filename IS NOT NULL` 代表整份問卷以掃描影像上傳（`QuestionID` 為 NULL）；`Filename IS NULL` 代表逐題數位作答（`QuestionID` 有值，見 [questionnaire.md](questionnaire.md)）。新系統 `QuestionService.SubmitAsync` 原本完全不寫入 `Filename`（永遠 NULL），故掃描檔這條路徑在新系統原本沒有任何寫入端點；本次新增 `MemberAdminService.CreateQuestionUploadAsync`/`UpdateQuestionUploadAsync`/`DeleteQuestionUploadAsync` 補上此缺口。查重邏輯（同會員同 `QuestionTypeID` 只能存在一筆，不論是掃描檔或數位作答）沿用舊 `mq != null` 檢查。
- **`IFileStorage` 新增 `DeleteAsync`**：舊系統掃描檔「換檔先刪舊檔」「刪除連同刪檔」在新系統原本無法做到（`IFileStorage` 僅有 `SaveAsync`）。已擴充介面 + `BlobFileStorage` 實作（`BlobClient.DeleteIfExistsAsync`），純新增方法不影響既有呼叫方（分院/科別/預約照片上傳）。
- **`IQuestionService.GetFormAsync` 新增 `includeDisabled` 參數**：客戶前台唯讀行為不變（預設 `false`，問卷/題目須 `IsEnabled=1` 才可查）；後台唯讀檢視改傳 `true`，讓「問卷類型後續被停用」不影響查看會員歷史數位作答（忠於舊 `ViewMemberQAs.cshtml` 不過濾 `IsEnabled` 的行為）。**此為真實 DB 測試中發現並修正的缺陷**：初版重用 `GetFormAsync` 時，對已停用問卷類型的歷史作答一律回 `NOT_FOUND`，與舊系統行為不符。
- **列表分院篩選下拉只列已啟用分院（使用者回饋補正）**：舊 `MemberMsController.Members` 用 `branchsService.Get().Where(b => b.IsEnabled).OrderBy(b => b.Sort)`。初版誤用既有分頁端點 `listBranches(1)`（含停用分院），已對真實 DB 查證「二林．齒科」`IsEnabled=false`——會被舊系統排除但初版會顯示。修正：`BranchesAdminController.List` 新增 `enabledOnly` 查詢參數（沿用同一路由避免路徑段與 `GET admin/branches/{id}` 衝突，見下方「路由衝突」風險），`IBranchAdminService.ListEnabledAsync` 回全量已啟用分院。
- **問卷掃描檔上傳表單的問卷下拉排序（使用者回饋補正）**：舊 `AddMemberQAs`/`EditMemberQAs` 用 `.OrderBy(o => o.CategoryID).ThenBy(o => o.Sort)`（先依科別分組，組內再依排序）。初版直接用 `listQuestionTypes()` 既有端點（全域 `ORDER BY qt.Sort`，跨科別會依單一排序欄交錯，非依科別分組），已在 `member-questionnaire-form.ts` 前端以 `.sort((a,b) => a.categoryId.localeCompare(b.categoryId) || a.sort - b.sort)` 補做分組排序，未改動共用後端 `QuestionTypeAdminService`（該端點也被既有 `basic/question-types-list` 頁面使用，不宜變更其既定行為）。
- **編輯頁地址（城市/區）下拉未帶入既有值（使用者回饋補正）**：`member-form` 編輯既有會員時，城市/區 `<select>` 顯示空白，即使 API 資料與下游 `areas()` computed 皆已證實訊號值正確。根因是 Angular 樣板指令「先套用元素自身屬性繫結、才建立子節點」的既定順序，撞上本頁「表單第一次掛載（`@if(loaded())`）恰好同一輪就把 `selectedCity`/`zipcodeId` 設成非空值」——賦值當下對應 `<option>` 尚不存在，瀏覽器靜默失敗且之後不會自我修正（非 race condition，是決定性的渲染順序問題，已用 Playwright 逐時間點輪詢確認放 3 秒仍不會恢復）。修法：把「表單掛載」與「回填既有城市/區值」拆到不同輪 render（`setTimeout`，區因巢狀連動 `areas()` 需再多延一層）。**已記錄為通用踩雷**，見 [gotchas.md](../gotchas.md) §動態選項 `<select>` 首次渲染即帶入既有值、[design/frontend-coding-style.md](../design/frontend-coding-style.md)（任何「原生 `[value]` 綁定 + async 選項 + 需預帶入既有值」的下拉都要假設有此問題，改用 Reactive Forms 也不能倖免）。
- **`member-form` 版面改為多欄 grid（使用者回饋「表單設計不要太浪費空間，不然會一直往下延伸」）**：初版每個欄位獨占一整列（`space-y-4` 單欄堆疊），12 個欄位造成表單過長需捲動。改為短欄位（身分證號/手機號碼/生日、姓名/性別/血型、Email/緊急聯絡人/緊急聯絡電話）用 `grid grid-cols-1 sm:grid-cols-3 gap-4` 每列塞 3 欄，過敏史/病史改 2 欄並排；地址（含城市/區下拉+文字）維持獨占一列（本來就需要較寬）。已用 Playwright 截圖驗證：整頁表單高度從需捲動縮短為 535px（單一 1280×900 螢幕可完整顯示，無需捲動）。**已記錄為通用規範**，見 [design/frontend-coding-style.md](../design/frontend-coding-style.md) §Tailwind（欄位多的表單一律比照此 grid 密度，不逐欄堆疊）。
- 列表初/複診判斷用子查詢 `COUNT(Appointments WHERE Status=1)`，分院清單另用 `IN` 批次查詢組裝，避免 N+1。
- 授權 Resource 固定字串 `"Members"`（沿用舊系統 action-name 特殊映射 `MemberQAs→Members`，見 [old/blueprints/backend-admin.md](../old/blueprints/backend-admin.md) §功能層級授權對應），列表/編輯/問卷維護共用同一資源鍵。

## 跨層影響
| 層級 | 影響 | 摘要 |
|---|---|---|
| 前端 | 是 | `pages/member/`：members-list、member-form、member-questionnaires、member-questionnaire-form、member-questionnaire-view |
| 後端 | 是 | `MembersAdminController` + `Skin.Services.Member.MemberAdminService`；`IFileStorage` 新增 `DeleteAsync`；`IQuestionService.GetFormAsync` 新增 `includeDisabled` 參數；`IBranchAdminService` 新增 `ListEnabledAsync`（`BranchesAdminController.List` 加 `enabledOnly` 參數） |
| API | 是 | `GET/PUT/DELETE admin/members/{id}`、`GET/POST/PUT/DELETE admin/members/{id}/questionnaires...`（見下方對應舊系統） |
| 資料庫 | 否 | 讀寫既有 `Members`/`MemberQuestions`，無 schema 變更 |
| 安全 | 是 | 依 perms 授權（Resource="Members"）；PII 處理；掃描檔容器沿用既有 public-blob 慣例（與分院/科別圖片一致） |

## 驗收標準（真實 DB 端對端已驗證，2026-07-03）
- [x] 列表篩選（分院/身分證號/生日）+ 分頁 + 初診判斷（真實 DB 53,610 筆會員驗證篩選/分頁正確）
- [x] 編輯（含過敏史/病史 CSV 讀寫、黑名單切換、地址城市區連動）——測試會員 `B121583140` 端對端驗證，還原零殘留
- [x] 刪除會員——① 有預約/問卷紀錄之會員（`B121583140`）刪除請求正確擋下 `MEMBER_IN_USE`；② 新建無任何紀錄的拋棄式測試會員可正常刪除、刪除後查無殘留、重複刪除回 `NOT_FOUND`
- [x] 問卷掃描檔上傳 CRUD（含檔案）——新增/查重擋下/編輯換檔（驗證舊 Blob 確實刪除、新 Blob 可讀）/刪除（DB 列 + Blob 皆清除）全通過
- [x] 唯讀檢視數位作答問卷（含已停用問卷類型的歷史作答，`includeDisabled=true`）
- [x] 依 perms 授權（測試管理員 `Members` 僅 `read+add`：GET/POST 200，PUT/DELETE 403；`Members` 僅 `read+update`：DELETE 403）
- [x] 分院篩選下拉只列已啟用分院（真實 DB 驗證：3 分院中「二林．齒科」`IsEnabled=false`，`enabledOnly=true` 正確排除，回 2 筆）
- [x] 問卷掃描檔上傳表單的問卷下拉依科別分組（前端排序後驗證同科別項目相鄰）
- [x] **列表篩選載入狀態回饋（Playwright 瀏覽器端對端驗證，本模組首次）**：`ng serve --port 4300` + `func start` 實際跑 Chromium，登入 → 進列表 → 輸入身分證號 → 點篩選 → 確認 50ms 內按鈕顯示 disabled+「篩選中…」、~150ms 後結果正確過濾為 1 筆、全程無 console 錯誤，並截圖存證。見 [design/frontend-backend.md](../design/frontend-backend.md) §篩選/操作載入狀態規範。

## 風險與未解問題
- PII（身分證/病史）顯示與 log 需遵循 [security.md](../design/security.md)（不記敏感資料）。
- 掃描檔 Blob 容器為 public-blob（與既有分院/科別圖片上傳一致），檔名為 GUID，非嚴格存取控制；如需加強隱私保護（私有容器 + SAS token）需另行評估，本次沿用既有基礎設施慣例未變更。
- `MemberQuestions` 無時間戳記欄位，同會員同問卷類型如有 legacy 髒資料（多筆或孤兒列）僅能盡力處理，非本次範圍。
- **自訂 router 無 literal-vs-`{param}` 優先權**：`Routing/RouteTable.cs` 的 `Match` 純粹依註冊順序找第一個「method + 段數 + 逐段比對」相符的路由；同段數的 literal 路徑（如 `admin/branches/enabled`）與 `{param}` 路徑（如 `admin/branches/{id}`）若同時註冊，先註冊者會搶先命中，行為不可預期。本次刻意選擇「沿用同一路由 + 加 query 參數」（`enabledOnly=true`）而非新增路徑段以迴避此風險；未來任何新增 admin 端點若考慮走新路徑段，都需注意此限制（考慮改用 query 參數，或未來替 router 補上 literal 優先排序）。

## 對應舊系統
- [old/blueprints/backend-admin.md](../old/blueprints/backend-admin.md) §MemberMs
- `reference/old/20SkinBackend/Controllers/MemberMsController.cs`、`Models/ViewModels/`、`Views/MemberMs/*.cshtml`
