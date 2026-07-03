---
title: 後台前端設計（Angular SPA）
purpose: 規範後台重寫：Angular standalone + signals + Tailwind + 品牌 design token（企業識別，取代初版 SmartAdmin 通用重現），六模組路由/元件、依 JWT claims 動態權限選單、clinic 參數化取代變體頁、匯出策略、列表頁 Grid 欄位/寬度/對齊/分頁規範（所有後台列表頁必須遵循）
applicable_when: 要實作或修改後台頁面、權限選單、主檔/班表/預約/會員/權限模組、匯出功能、或任何後台列表頁（table/grid）欄位、順序、內容文字、寬度、對齊（置中/靠左）、分頁時
related_agents:
  - frontend-architect
related_docs:
  - frontend-coding-style.md
  - visual-design.md
  - api-design.md
  - security.md
  - ../blueprints/admin-basic-data.md
  - ../blueprints/admin-roster.md
  - ../blueprints/admin-auth-authority.md
  - ../blueprints/admin-member.md
  - ../old/design/frontend-backend.md
  - ../old/blueprints/backend-admin.md
keywords: [frontend, backend-admin, angular, signals, tailwind, smartadmin, permission-menu, export, grid, table, 列表頁, 欄位, 欄位順序, 欄位寬度, column-width, 分頁, pagination, paged-list, 對齊, 置中, 靠左, text-align, text-center]
last_updated: 2026-07-03T22:00+08:00
status: draft
---

> **列表頁 Grid 規範必讀**：新增或修改任何後台列表頁（欄位、順序、顯示內容、寬度、對齊、分頁）前，**必須先讀**下方「列表頁 Grid 欄位規範」「欄位對齊規範」與「分頁規範」章節，並比對對應舊系統 `reference/old/20SkinBackend/Views/{BasicMs,AuthorityMs,ShiftMs}/*.cshtml`——不可自訂樣式、不可新增舊系統沒有的欄位、置中或靠左需與舊系統該欄一致、是否分頁需與舊系統一致。此規範適用於全部既有 8 個後台列表頁，以及未來任何新增列表頁；`related_docs` 已在對應 blueprint（basic-data／roster／auth-authority）互相連結，供日後開發時追溯。

> 舊後台（MVC5 + SmartAdmin + Bootstrap3）完整盤點見 [old/design/frontend-backend.md](../old/design/frontend-backend.md) 與 [old/blueprints/backend-admin.md](../old/blueprints/backend-admin.md)。新後台為**獨立 Angular 專案**、純 SPA；版面結構沿用 SmartAdmin（側欄+頂欄+Ribbon+內容+頁尾），但配色已改採承接客戶前台的企業識別品牌 token，不再是通用 SmartAdmin 配色（2026-07-03 決策，見 [visual-design.md](visual-design.md) §後台視覺策略）。

## 技術
Angular standalone + **signals** + Tailwind；Reactive Forms；`HttpInterceptor`（Bearer）；權限 route guard。慣例見 [frontend-coding-style.md](frontend-coding-style.md)。

## 版型（結構沿用 SmartAdmin，配色為品牌識別）
`AdminLayoutComponent`：左側欄（品牌深藍，權限選單，`lg` 以下收合為可開關的 off-canvas 抽屜）+ 頂欄（漢堡選單/使用者/登出）+ Ribbon（麵包屑）+ 內容 `router-outlet` + 頁尾。Tailwind + 品牌 token 對應見 [visual-design.md](visual-design.md)。

### RWD（**已定案並實作 2026-07-03**）
後台支援 RWD（響應式），取代舊系統 SmartAdmin 固定桌面版面的假設。**範圍**：登入、`AdminLayoutComponent` 側欄/頂欄、8 個列表頁 Grid、各表單頁，皆可在手機/平板寬度正常操作。**做法**：延續 Tailwind 既有慣例，用 `sm:`/`lg:` 斷點漸進調整，不引入額外 RWD 專屬框架：
- **側欄**：`lg` 以下改為 `fixed` off-canvas 抽屜（`-translate-x-full`/`translate-x-0` 切換 + transition），頂欄加漢堡按鈕（`lg:hidden`）開關、半透明遮罩點擊收合、路由切換自動收合；`lg` 以上維持原本固定顯示（`lg:static lg:translate-x-0`）。主內容/頂欄/Ribbon/頁尾內距改 `px-4 sm:px-6`／`p-4 sm:p-6`。
- **Grid 表格**：全部 `<table>`（8 個列表頁 + `roster-form` 容量表 + `admin-form` 權限樹 + `member-questionnaires`/`member-questionnaire-view`）外層加 `<div class="overflow-x-auto">`，橫向捲動限制在表格自身容器內，不撐開整頁版面。列表頁標題列/分頁頁腳加 `flex-wrap gap-2`；5 頁籤切換列（`periods-list`/`categories-list`/`rosters-list`）加 `overflow-x-auto`（頁籤為底線樣式不適合換行）。
- **表單**：延續既有 `grid-cols-1 sm:grid-cols-3`／`grid-cols-1 md:grid-cols-3` 密度慣例（見下方「篩選/操作載入狀態規範」旁的表單 grid 慣例）；本次順手修正 `category-form.ts` 唯一一處遺漏響應式前綴的 `grid-cols-3`。
- **現況**：`ng build` 0 error，編譯後 CSS 已含全部新用到的響應式 class。**未做**：瀏覽器實機/DevTools 響應式斷點視覺驗證（本次會話無 Playwright/chrome-devtools 工具可用），見 [status.md](../status.md) Recently Done 條目。

## 六模組路由 / 元件（對應舊六 Controller）

| 模組 | 路由 | 對應舊 | 功能 |
|---|---|---|---|
| 登入/首頁 | `/login`、`/` | MainController | 帳號+密碼+reCAPTCHA 登入；儀表板 |
| 權限 | `/authority/admins...` | AuthorityMsController | 管理員 CRUD + 權限樹（Lims）勾選 |
| 基礎資料 | `/basic/{branches\|doctors\|periods\|categories\|question-types\|questions}` | BasicMsController | 主檔 CRUD + 排序，**clinic 參數化** |
| 班表 | `/roster?clinic=&branch=` | ShiftMsController | 排班 CRUD + 重複展開 + RosterPeriods 容量 |
| 預約 | `/reserve?clinic=&branch=` | ReserveMsController | 查詢/詳情/取消 + 匯出 Excel/PDF + 容量批次更新 |
| 會員 | `/member...` | MemberMsController | 會員查詢/編輯/黑名單 + 問卷答案 |

> **參數化取代變體**：舊 Ta/Ch/ChDentist(+Cosmetic) 的 ~70 頁 → 單一元件吃 `clinic`/`branch` 參數，大幅消除重複（對應 [old/modernization.md](../old/modernization.md) A5）。

## 列表頁 Grid 欄位規範（**已定案 2026-07-03**，所有後台列表頁必須參照）

> 適用範圍：`authority/admins-list`、`basic/{branches,doctors,categories,periods,question-types,questions}-list`、`roster/rosters-list`、`member/members-list` 共 9 頁，及未來任何新增的後台列表頁。新增/修改欄位前**必須先讀本節**，不可各頁自訂樣式。

### 欄位順序、顯示欄位與內容文字（**忠於舊系統**，2026-07-03 修正——原版自訂順序/欄位不成立，改回實際比對 `reference/old/20SkinBackend/Views/{BasicMs,AuthorityMs,ShiftMs}/*.cshtml` 的欄位、順序與顯示文字）

- **排序欄位優先於業務欄位**：舊系統凡支援手動排序（`Sort`）的清單，`排序` 一律是**第一欄**，不是放在操作前一欄。因為排序輸入框需要在掃視清單時最先看到、方便重新編號。
- **不新增舊系統沒有的欄位**（**2026-07-03 追加定案，取代先前「縮圖/選項可新增」的例外**）：舊系統清單沒顯示的欄位，新系統一律不顯示——即使資料模型/API 已有該欄位也不可加。已移除的兩個先前新增欄位：
  - 分院/科別項目清單原加的「圖片」縮圖欄（舊 `Branchs.cshtml`/`Skins.cshtml` 皆無縮圖，只在編輯表單才有上傳）。
  - 問卷題目清單原加的「選項」欄（顯示答案文字清單；舊 `Questions.cshtml` 的「選項」欄實際是題型單選/多選，新系統已用「題型」欄承接，多出的答案文字清單欄無舊系統依據，已移除）。
- **顯示欄位需與舊系統一致（且僅能與舊系統一致）**：舊系統該清單有顯示的欄位（含布林旗標），新系統一律補齊顯示，不可因為「目前資料模型有欄位但沒用到」而省略（如分院「自動編號」、科別三個「每次一人」旗標）；反之舊系統沒有的欄位也不可加（見上一點）。
- **內容文字（是/否用詞）需與舊系統一致**：舊系統各清單的布林狀態用詞不統一（有的用「是/不啟用」、有的用「開啟/關閉」、有的用「需要/不需要」），新系統**逐頁沿用該頁舊文字**，不可統一套用單一「啟用/停用」樣板。顏色（`text-green-600`/`text-muted`）沿用既有語意色慣例（見 [visual-design.md](visual-design.md)），只有文字本身需對齊舊系統。
- **其餘業務欄位依舊系統實際順序**，不可自行重新排列。各頁對照如下（欄位名稱／顯示文字均為實際落地版本）：

| 頁面 | 對應舊 View | 欄位順序（左到右，操作皆為最後一欄） | 布林/列舉欄位顯示文字 |
|---|---|---|---|
| `basic/branches-list` | `BasicMs/Branchs.cshtml` | 排序、類型、名稱、自動編號、啟用、操作 | 類型：`BranchType===1` → 皮膚／否則 齒科；自動編號：是／否；啟用：是／不啟用 |
| `basic/doctors-list` | `BasicMs/Doctors.cshtml` | 姓名、操作 | （無） |
| `basic/categories-list` | `BasicMs/Skins.cshtml`／`Cosmetics.cshtml` | 排序、名稱、需填問卷、台中每次一人、二林每次一人、齒科每次一人、操作 | 需填問卷：需要／不需要；三個「每次一人」（`IsOnly`/`ChIsOnly`/`ChDentistIsOnly`）：是／不是 |
| `basic/periods-list` | `BasicMs/TaPeriods.cshtml` 等 5 變體 | 排序、門診時段、名稱、起始號碼、容量、操作 | （無布林欄位） |
| `basic/question-types-list` | `BasicMs/QuestionTypes.cshtml` | 排序、科別項目、問卷名稱（可點擊進題目頁，取代舊獨立「題目」icon 欄）、狀態、操作 | 狀態：開啟／關閉（**非**「啟用/停用」） |
| `basic/questions-list` | `BasicMs/Questions.cshtml` | 排序、題目、題型、狀態、操作 | 狀態：開啟／關閉；題型：`OptionType===1` → 單選／否則 **複選**（舊系統原文字為「多選」，新系統統一沿用 [gotchas.md](gotchas.md) 已定案的 `OptionType` 術語「複選」，與 `question-form.ts`／客戶前台問卷用詞一致，此欄位為刻意例外不改回舊字，其餘欄位仍忠於舊系統） |
| `authority/admins-list` | `AuthorityMs/Admins.cshtml` | 姓名、帳號、操作 | （無） |
| `roster/rosters-list` | `ShiftMs/TaRosters.cshtml` 等 5 變體 | 醫師、日期、班別、開放指定預約、操作（舊系統另有「分院」欄，新系統以頁籤篩選取代，不需獨立欄位） | 開放指定預約：是／否 |
| `member/members-list` | `MemberMs/Members.cshtml` | 初診、分院、身分證號、手機號碼、生日、姓名、黑名單、操作（問卷/編輯/刪除 3 icon，取代舊獨立「問卷」「編輯」「刪除」3 欄） | 初診：是／否；分院：無資料顯示「尚未預約」（沿用舊字串，多筆用逐行顯示取代舊 `<br>` 拼接 HTML）；黑名單：是／不是 |

- **操作欄固定最後一欄**（樣式見下）。

### 欄位寬度規範（**已定案 2026-07-03**，每欄皆須明確指定寬度）

- **每個 `<th>` 一律加寬度 class，不可留白讓瀏覽器自行分配**：短欄位（排序/狀態/是否類）用固定 `w-*`，唯一「主要辨識文字欄」（名稱/標題/題目/姓名/帳號/班別等內容長度不定的欄位）用 `w-auto` 明確標示為彈性欄，吸收剩餘寬度。
- **寬度分級**（依內容長度選用，避免每頁各自發明數值）：
  - `w-20`：排序、容量、操作（icon-only）
  - `w-24`：類型、狀態、起始號碼、題型（2–4 字內容）
  - `w-28`：自動編號、需填問卷、日期（yyyy-mm-dd）
  - `w-32`：科別項目以外的中等長度欄（台中/二林/齒科每次一人、門診時段、開放指定預約、醫師、姓名）
  - `w-40`：科別項目（分院/科別標題可能較長）
  - `w-auto`：名稱、標題、題目、帳號、班別、問卷名稱（唯一彈性欄，通常每列只有一欄）
- 各頁實際寬度對照：

| 頁面 | 欄位寬度（依序對應上方欄位順序） |
|---|---|
| `basic/branches-list` | `w-20` `w-24` `w-auto` `w-28` `w-24` `w-20` |
| `basic/doctors-list` | `w-auto` `w-20` |
| `basic/categories-list` | `w-20` `w-auto` `w-28` `w-32` `w-32` `w-32` `w-20` |
| `basic/periods-list` | `w-20` `w-32` `w-auto` `w-24` `w-20` `w-20` |
| `basic/question-types-list` | `w-20` `w-40` `w-auto` `w-24` `w-20` |
| `basic/questions-list` | `w-20` `w-auto` `w-24` `w-24` `w-20` |
| `authority/admins-list` | `w-32` `w-auto` `w-20` |
| `roster/rosters-list` | `w-32` `w-28` `w-auto` `w-32` `w-20` |
| `member/members-list` | `w-20` `w-32` `w-32` `w-32` `w-28` `w-auto` `w-24` `w-28`（操作欄 3 icon，比其餘頁面 2 icon 的 `w-20` 略寬） |

### 欄位對齊規範（**已定案 2026-07-03**，忠於舊系統逐欄比對，非統一規則）

- **主要辨識文字欄位一律靠左**（`text-left`，即不加 class，沿用 `<tr>` 預設）：名稱/標題/題目/姓名/帳號/科別項目/問卷名稱/醫師/日期/班別。
- **其餘欄位（排序、列舉、布林狀態、數值、操作）一律置中**（`text-center`，`th`/`td` 都要加）：即使內容是短日期或分類文字，只要不是上述「主要辨識欄位」就置中——**這不是「短內容置中」的通則**，而是逐欄比對舊系統實際 class 得出的結果（例：排班的「日期」欄雖短，舊系統仍是靠左，故新系統也維持靠左；時段的「門診時段」欄雖是短分類文字，舊系統是置中，新系統也置中）。判斷標準只有一個：**該欄在對應舊 View 是否有 `class="text-center"`**，不可用長度、型別等其他啟發式規則自行決定。
- **排序欄的輸入框**：`td` 本身也加 `text-center`（讓 `w-16` 的 number input 置中於欄寬內），不是只置中文字。
- 各頁對齊對照（`L`=靠左 `text-left`／不加 class，`C`=置中 `text-center`；依序對應上方欄位順序，操作欄一律 `C`）：

| 頁面 | 欄位對齊 |
|---|---|
| `basic/branches-list` | 排序C 類型C 名稱L 自動編號C 啟用C 操作C |
| `basic/doctors-list` | 姓名L 操作C |
| `basic/categories-list` | 排序C 名稱L 需填問卷C 台中每次一人C 二林每次一人C 齒科每次一人C 操作C |
| `basic/periods-list` | 排序C 門診時段C 名稱L 起始號碼C 容量C 操作C |
| `basic/question-types-list` | 排序C 科別項目L 問卷名稱L 狀態C 操作C |
| `basic/questions-list` | 排序C 題目L 題型C 狀態C 操作C |
| `authority/admins-list` | 姓名L 帳號L 操作C |
| `roster/rosters-list` | 醫師L 日期L 班別L 開放指定預約C 操作C |
| `member/members-list` | 初診C 分院C 身分證號C 手機號碼C 生日C 姓名L 黑名單C 操作C |

### 操作欄規範（取代原「icon + 文字、靠右對齊」）

- `th`/`td` 一律**置中對齊**（`text-center`），`th` 加 `w-20`；取代舊 `text-right`。
- 欄內**只顯示 icon，不顯示文字**（取代舊「`<i class="fa fa-pencil"></i> 編輯`」等 icon+文字寫法）。
- 每個 icon 加 `title` 屬性提供 tooltip／無障礙標籤（因移除了文字說明）。
- 圖示與語意色沿用原規則：編輯 `fa-pencil` + `text-brand hover:text-brand-deep`；刪除／停用 `fa-trash` + `text-red-500 hover:text-red-700`。
- 多個操作用 `<span class="inline-flex items-center gap-3">` 包裹置中排列，取代舊 `space-x-2` 純文字排列。
- 顯示與否仍依 `auth.can(resource, op)` 判斷，授權真相在 API，前端僅體驗層（不變）。

```html
<th class="px-5 py-2.5 font-medium text-center w-20">操作</th>
...
<td class="px-5 py-2.5 text-center">
  <span class="inline-flex items-center gap-3">
    @if (auth.can('Branchs', 'update')) {
      <a [routerLink]="['/basic/branches', b.branchId, 'edit']"
         class="text-brand hover:text-brand-deep" title="編輯"><i class="fa fa-pencil"></i></a>
    }
    @if (auth.can('Branchs', 'delete')) {
      <button (click)="remove(b)" class="text-red-500 hover:text-red-700" title="刪除"><i class="fa fa-trash"></i></button>
    }
  </span>
</td>
```

**理由**：8 個列表頁操作欄原本「icon+文字」造成欄寬不一、視覺雜訊；圖示已足以傳達動作語意，統一置中亦與排序等其他欄位的置中風格一致。此決策取代所有頁面原本的「icon+文字、靠右對齊」寫法，2026-07-03 已同步套用到全部 8 個既有列表頁。

### 分頁規範（**已定案 2026-07-03**，忠於舊系統 `IPagedList` + `Html.PagedListPager`）

- **是否分頁需與舊系統一致**：舊系統該清單有分頁（`ToPagedList(pageNumber, pageSize: 20)`）才分頁，沒有分頁的清單新系統也不分頁，不可自行決定加減。

| 頁面 | 對應舊 View | 是否分頁 |
|---|---|---|
| `basic/branches-list` | `BasicMs/Branchs.cshtml` | ✅ 分頁 |
| `basic/doctors-list` | `BasicMs/Doctors.cshtml` | ❌ 不分頁（舊系統 `IEnumerable`，無 `ToPagedList`） |
| `basic/categories-list` | `BasicMs/Skins.cshtml`／`Cosmetics.cshtml` | ✅ 分頁 |
| `basic/periods-list` | `BasicMs/TaPeriods.cshtml` 等 5 變體 | ❌ 不分頁 |
| `basic/question-types-list` | `BasicMs/QuestionTypes.cshtml` | ❌ 不分頁（舊系統 `IList`） |
| `basic/questions-list` | `BasicMs/Questions.cshtml` | ❌ 不分頁（舊系統 `IQueryable`，View 無 pager） |
| `authority/admins-list` | `AuthorityMs/Admins.cshtml` | ✅ 分頁 |
| `roster/rosters-list` | `ShiftMs/TaRosters.cshtml` 等 5 變體 | ✅ 分頁（已於 2026-07-02 完成，本節之前唯一已分頁頁面） |
| `member/members-list` | `MemberMs/Members.cshtml` | ✅ 分頁（`ToPagedList(pageSize: 20)`） |

- **pageSize 固定 20**：對照舊系統 `ToPagedList(pageNumber: p, pageSize: 20)` 與既有 Roster 分頁（`RostersAdminController` 寫死 20），三個新分頁頁面（Branches/Categories/Admins）比照辦理，**前端不開放調整 pageSize**，後端 `Math.Clamp(pageSize, 1, 100)` 僅為防禦，不代表可調整。
- **API 回應信封**：分頁端點回傳 `{ items, total, page, pageSize }`（包在標準 `ApiResponse` 內，即 `res.data.items`/`res.data.total`），對應前端共用型別 `PagedResult<T>`（`core/models.ts`）；後端 Service 回傳 `(IReadOnlyList<T> Items, int Total)` tuple，Controller 用 `page`（query 參數，預設 1）組出上述信封，SQL 用 `COUNT(*)` + `OFFSET/FETCH` 兩段查詢（範本見 `RosterAdminService.ListAsync`）。
- **UI 樣式**：分頁頁面在表格下方加同一組頁腳（`total() > pageSize` 才顯示）：`共 {total} 筆` + 上一頁/第 N 頁/下一頁按鈕，樣式與 `roster/rosters-list.ts` 完全一致，不可各頁自訂分頁 UI。
- **翻頁不觸發重新整理排序狀態以外的副作用**：`branches-list`/`categories-list` 的「儲存排序」按鈕只送出**當頁**資料（`sorts` 由當頁 `items` 建立），這與舊系統行為一致（舊 `SortBranchs`/`SortSkins` 表單同樣只包含當頁列的 `EntityLists`），非新系統遺漏。
- **有其他表單需要「全部清單」（非分頁）時，不可重用分頁端點**：例如科別項目在「排班表單」「問卷類型表單」的下拉/多選需要全部科別，若直接呼叫分頁後的 `GET admin/categories/{clinic}` 只會拿到第一頁 20 筆。此類需求改呼叫獨立的全量端點 `GET admin/categories/{clinic}/all`（`ICategoryAdminService.ListAllAsync`，前端 `listAllCategories()`），不循分頁路徑撈全部（不可把 pageSize 開超大當作繞過分頁的手段）。

### 篩選/操作載入狀態規範（**已定案 2026-07-03**，源自會員列表使用者回饋「點篩選沒反應」）

- **問題**：純資料重整（如篩選、翻頁）若 API 回應夠快（本機實測 ~150ms），使用者可能完全看不到任何過渡效果，誤以為點擊沒有反應——尤其原本表格資料在請求期間維持不變（無 loading 狀態），只有結果無聲無息地替換掉。
- **規則**：任何觸發資料重新查詢的按鈕（篩選、翻頁、重新整理）都必須讓使用者「感覺到」點擊生效：
  - 按鈕本身 `[disabled]="loading()"` + 文字切換（如「篩選」→「篩選中…」，沿用既有存檔按鈕「儲存中…」的文字慣例）
  - 觸發載入的按鈕加 spinner 圖示（`fa fa-spinner fa-spin`，取代原靜態 icon）
  - 資料表格套 `[class.opacity-50]="loading()"`，讓載入中有視覺上可辨識的變暗，即使舊資料仍暫時顯示
  - 分頁按鈕（上一頁/下一頁）於 `loading()` 期間一併 disable，避免連續點擊造成競態（多個請求交錯回應，最終顯示錯誤頁次的資料）
- **範例**：`pages/member/members-list.ts` 篩選按鈕。已用 Playwright 端對端驗證（見 [blueprints/admin-member.md](../blueprints/admin-member.md)）：點擊後 50ms 內即顯示 disabled + 「篩選中…」，回應後正確更新結果。
- 適用範圍：本規則為**新增規範**，僅套用於本次修正的 `members-list`；既有其他列表頁（branches/categories/periods/…）尚未回溯套用，非本次範圍，日後若有類似回饋再個別補上。

## 權限選單（依 JWT claims）

- 登入後 JWT 帶 `perms`（攤平的 Lims+AdminLims，JSON 字串 claim）與 `is_super_admin`（字串 `true`/`false`）。前端 `auth.service` 解析：`perms` `JSON.parse`、`is_super_admin` 容錯 `true`/`'true'`。
- 權限 route guard（`perm.guard`）：`route.data.perm={key,op}`；進頁前比對；不足導 `/forbidden`。授權真相仍在 API。

### 選單資料驅動（**已定案 2026-07-01，忠於舊做法**）
- **不硬編碼選單**：`admin-layout` 呼叫 `GET /api/admin/menu`，後端讀 `Lims`(二層) 依當前管理員 `AdminLims` 過濾（模組層任一子項有權即顯示），回傳 `{key,label,icon,sort,children}` 樹。等同舊 `SiteMenuAsUnorderedList`。
- **Key→路由轉譯**：舊 href=`/{模組Key}/{子Key}`；新路由不同名，故前端 `core/menu-route-map.ts`（`LIMS_ROUTE_MAP` + `resolveMenuRoute`）把 `Lims.Key` 轉新 Angular 路由。舊 Ta/Ch/Cosmetic/Dentist 變體 key 對到同一 **clinic/branch 參數化** 路由。
- **未建模組**：`BUILT_KEYS` 控制；未建者導 `/coming-soon`（選單仍完整顯示，像舊系統）。逐一補模組時把 key 加入 `BUILT_KEYS` 並確保路由存在。
- **視覺**：`admin-layout` 以 Tailwind + 品牌 design token 重現版型：品牌深藍側欄（`bg-brand-deep`/`bg-brand-deeper`，見 [visual-design.md](visual-design.md) §後台視覺策略）+ 可展開模組（fa 圖示）+ 頂欄（使用者/超管標記/登出）+ Ribbon 麵包屑（`border-l-4 border-l-brand`）+ 頁尾。Font Awesome 4 由 `index.html` CDN 載入還原 `fa-*`。2026-07-03 起全站頁面（含 authority/basic/roster 各 CRUD 頁）已從初版通用 SmartAdmin 配色（teal/blue/gray）改套品牌 token（`bg-brand`/`text-ink`/`text-muted`/`border-hairline`/`bg-surface` 等）。
- **模組展開行為（已定案 2026-07-03）**：側欄模組預設**全部收起**；僅當前路由所屬模組自動展開一個。點擊模組標題採**手風琴（accordion）**：展開一個會自動收合其他已展開模組，同時只會有一個模組是開著的。
- 取代舊 `_Aside.cshtml` + `CheckSession` 字串比對。詳見 [security.md](security.md)、[../blueprints/admin-auth-authority.md](../blueprints/admin-auth-authority.md)。

> **本機埠**：客戶前台 `ng serve` 用 :4200、後台用 **:4300**（`ng serve --port 4300`）；API `local.settings` Host.CORS 已加 :4300。

## 匯出策略（取代 NPOI / iTextSharp）

| 舊 | 新 |
|---|---|
| 簽到單 Excel（NPOI HSSF .xls，65536 列上限） | 後端 `ClosedXML`/OpenXML 產 `.xlsx`，API 回檔；或前端 `xlsx` 庫由 JSON 生成 |
| 問卷 PDF（iTextSharp） | 前端 `pdfmake`/`html2pdf`（後端僅回 JSON）；或後端產 PDF。先採前端方案降後端負擔 |

匯出端點見 [api-design.md](api-design.md)（`/api/appointments/export/{checkin|questionnaire}`）。

## 不做
SSR/SEO；不共用客戶前台程式碼；不引入 SmartAdmin/Bootstrap（版面結構以 Tailwind 重現，配色改為品牌 token，見上）。

## 對應舊系統
- 模組/頁面/權限：[old/design/frontend-backend.md](../old/design/frontend-backend.md)、[old/blueprints/backend-admin.md](../old/blueprints/backend-admin.md)、`reference/old/20SkinBackend/`
- 各功能規格：[blueprints/admin-auth-authority.md](../blueprints/admin-auth-authority.md) 等 admin-* 藍圖
