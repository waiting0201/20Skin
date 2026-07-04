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
  - ../blueprints/admin-reserve.md
  - ../old/design/frontend-backend.md
  - ../old/blueprints/backend-admin.md
keywords: [frontend, backend-admin, angular, signals, tailwind, smartadmin, permission-menu, export, grid, table, 列表頁, 欄位, 欄位順序, 欄位寬度, column-width, 分頁, pagination, paged-list, 對齊, 置中, 靠左, text-align, text-center]
last_updated: 2026-07-04T23:00+08:00
status: draft
---

> **列表頁 Grid 規範必讀**：新增或修改任何後台列表頁（欄位、順序、顯示內容、寬度、對齊、分頁）前，**必須先讀**下方「列表頁 Grid 欄位規範」「欄位對齊規範」與「分頁規範」章節，並比對對應舊系統 `reference/old/20SkinBackend/Views/{BasicMs,AuthorityMs,ShiftMs,ReserveMs}/*.cshtml`——不可自訂樣式、不可新增舊系統沒有的欄位、置中或靠左需與舊系統該欄一致、是否分頁需與舊系統一致。此規範適用於全部既有 10 個後台列表頁，以及未來任何新增列表頁；`related_docs` 已在對應 blueprint（basic-data／roster／auth-authority／member／reserve）互相連結，供日後開發時追溯。

> 舊後台（MVC5 + SmartAdmin + Bootstrap3）完整盤點見 [old/design/frontend-backend.md](../old/design/frontend-backend.md) 與 [old/blueprints/backend-admin.md](../old/blueprints/backend-admin.md)。新後台為**獨立 Angular 專案**、純 SPA；版面結構沿用 SmartAdmin（側欄+頂欄+Ribbon+內容+頁尾），但配色已改採承接客戶前台的企業識別品牌 token，不再是通用 SmartAdmin 配色（2026-07-03 決策，見 [visual-design.md](visual-design.md) §後台視覺策略）。

## 技術
Angular standalone + **signals** + Tailwind；Reactive Forms；`HttpInterceptor`（Bearer）；權限 route guard。慣例見 [frontend-coding-style.md](frontend-coding-style.md)。

## 版型（結構沿用 SmartAdmin，配色為品牌識別）
`AdminLayoutComponent`：左側欄（品牌深藍，權限選單，`lg` 以下收合為可開關的 off-canvas 抽屜）+ 頂欄（漢堡選單/使用者/登出）+ Ribbon（麵包屑）+ 內容 `router-outlet` + 頁尾。Tailwind + 品牌 token 對應見 [visual-design.md](visual-design.md)。側欄頂部品牌 logo 為連結（`routerLink="/"`），點擊回儀表板（2026-07-04 使用者需求；手機側欄由既有 NavigationEnd 訂閱自動收合）。

### RWD（**已定案並實作 2026-07-03**）
後台支援 RWD（響應式），取代舊系統 SmartAdmin 固定桌面版面的假設。**範圍**：登入、`AdminLayoutComponent` 側欄/頂欄、8 個列表頁 Grid、各表單頁，皆可在手機/平板寬度正常操作。**做法**：延續 Tailwind 既有慣例，用 `sm:`/`lg:` 斷點漸進調整，不引入額外 RWD 專屬框架：
- **側欄**：`lg` 以下改為 `fixed` off-canvas 抽屜（`-translate-x-full`/`translate-x-0` 切換 + transition），頂欄加漢堡按鈕（`lg:hidden`）開關、半透明遮罩點擊收合、路由切換自動收合；`lg` 以上維持原本固定顯示（`lg:static lg:translate-x-0`）。主內容/頂欄/Ribbon/頁尾內距改 `px-4 sm:px-6`／`p-4 sm:p-6`。
- **Grid 表格**：全部 `<table>`（8 個列表頁 + `roster-form` 容量表 + `admin-form` 權限樹 + `member-questionnaires`/`member-questionnaire-view`）外層加 `<div class="overflow-x-auto">`，橫向捲動限制在表格自身容器內，不撐開整頁版面。列表頁標題列/分頁頁腳加 `flex-wrap gap-2`。`periods-list`/`categories-list`/`rosters-list` 三頁原本各有頁籤切換列，已於 2026-07-03 全數移除（見下方「periods-list 不設頁籤」「categories-list 不設頁籤」「rosters-list 不設頁籤」），故本專案後台列表頁目前**沒有任何頁籤 UI**。
- **表單**：延續既有 `grid-cols-1 sm:grid-cols-3`／`grid-cols-1 md:grid-cols-3` 密度慣例（見下方「篩選/操作載入狀態規範」旁的表單 grid 慣例）；本次順手修正 `category-form.ts` 唯一一處遺漏響應式前綴的 `grid-cols-3`。
- **現況**：`ng build` 0 error，編譯後 CSS 已含全部新用到的響應式 class。**未做**：瀏覽器實機/DevTools 響應式斷點視覺驗證（本次會話無 Playwright/chrome-devtools 工具可用），見 [status.md](../status.md) Recently Done 條目。

## 六模組路由 / 元件（對應舊六 Controller）

| 模組 | 路由 | 對應舊 | 功能 |
|---|---|---|---|
| 登入/首頁 | `/login`、`/` | MainController | 帳號+密碼+reCAPTCHA 登入；儀表板 |
| 權限 | `/authority/admins...` | AuthorityMsController | 管理員 CRUD + 權限樹（Lims）勾選 |
| 基礎資料 | `/basic/{branches\|doctors\|periods\|categories\|question-types\|questions}` | BasicMsController | 主檔 CRUD + 排序，**clinic 參數化** |
| 班表 | `/roster?clinic=&branch=` | ShiftMsController | 排班 CRUD + 重複展開 + RosterPeriods 容量 |
| 預約 | `/reserve?clinic=&branch=`、`/reserve/:id`、`/reserve/print/questionnaire` | ReserveMsController | 查詢/詳情/取消 + 匯出簽到單 Excel + 問卷列印頁（瀏覽器原生 `window.print()`）+ 時段容量批次更新 |
| 會員 | `/member...` | MemberMsController | 會員查詢/編輯/黑名單 + 問卷答案 |

> **參數化取代變體**：舊 Ta/Ch/ChDentist(+Cosmetic) 的 ~70 頁 → 單一元件吃 `clinic`/`branch` 參數，大幅消除重複（對應 [old/modernization.md](../old/modernization.md) A5）。

### 儀表板（`/` 首頁，**已實作 2026-07-04**，取代舊空殼 Main/Index）

- 版面（上而下）：會員統計 4 卡（`grid-cols-2 lg:grid-cols-4`）→ 分院當日卡 3 張（`md:grid-cols-3`；今日有效預約大字 + 診別 chips + 初診/已取消 + 「預約維護」連結帶 queryParams 直達 `/reserve`）→ 未來 7 天趨勢（水平堆疊長條，純 Tailwind div，不引入圖表函式庫）。
- 區塊由後端依可讀權限過濾（`GET admin/dashboard`，見 [api-design.md](api-design.md)）；前端只渲染有出現的區塊，全空時顯示引導文字。
- 系列色固定順序不依資料重排：ta=`#00538d`（品牌藍）/ ch=`#d97706` / chDentist=`#059669`，已通過 dataviz 調色盤驗證（CVD/對比）；數字/標籤一律 `text-ink`/`text-muted` 不著系列色；堆疊分段間留 2px 縫隙、`min-w-[3px]` 保零星量可見；≥2 系列時顯示 legend。
- 詳見 [blueprints/admin-dashboard.md](../blueprints/admin-dashboard.md)（統計口徑、權限過濾、設計決策）。

## 列表頁 Grid 欄位規範（**已定案 2026-07-03**，所有後台列表頁必須參照）

> 適用範圍：`authority/admins-list`、`basic/{branches,doctors,categories,periods,question-types,questions}-list`、`roster/rosters-list`、`member/members-list`、`reserve/reserve-list` 共 10 頁，及未來任何新增的後台列表頁。新增/修改欄位前**必須先讀本節**，不可各頁自訂樣式。

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
| `basic/categories-list` | `BasicMs/Skins.cshtml`／`Cosmetics.cshtml` | 排序、標題、需填問卷、台中每次一人、二林每次一人、齒科每次一人、操作 | 需填問卷：需要／不需要；三個「每次一人」（`IsOnly`/`ChIsOnly`/`ChDentistIsOnly`）：是／不是；欄名 2026-07-03 修正「名稱」為舊系統原詞「標題」，見下方「categories-list 不設頁籤」 |
| `basic/periods-list` | `BasicMs/TaPeriods.cshtml` 等 5 變體 | 排序、時間、時段、起始編號、人數、操作 | （無布林欄位；欄名 2026-07-03 修正為忠於舊系統用詞，原「門診時段/名稱/起始號碼/容量」為誤植改寫，見下方「periods-list 不設頁籤」） |
| `basic/question-types-list` | `BasicMs/QuestionTypes.cshtml` | 排序、科別項目、問卷名稱（可點擊進題目頁，取代舊獨立「題目」icon 欄）、狀態、操作 | 狀態：開啟／關閉（**非**「啟用/停用」） |
| `basic/questions-list` | `BasicMs/Questions.cshtml` | 排序、題目、題型、狀態、操作 | 狀態：開啟／關閉；題型：`OptionType===1` → 單選／否則 **複選**（舊系統原文字為「多選」，新系統統一沿用 [gotchas.md](gotchas.md) 已定案的 `OptionType` 術語「複選」，與 `question-form.ts`／客戶前台問卷用詞一致，此欄位為刻意例外不改回舊字，其餘欄位仍忠於舊系統） |
| `authority/admins-list` | `AuthorityMs/Admins.cshtml` | 姓名、帳號、操作 | （無） |
| `roster/rosters-list` | `ShiftMs/TaRosters.cshtml` 等 5 變體 | 醫師、日期、項目、需預約、操作（舊系統另有「分院」欄，2026-07-03 改為每個變體是獨立頁面、標題已標示分院/診別，不需要獨立欄位） | 需預約：是／否；欄名 2026-07-03 修正——「項目」（開放科別項目標題逗號串接，取代原本誤植的「班別」欄）、「需預約」（取代原「開放指定預約」），見下方「rosters-list 不設頁籤」 |
| `member/members-list` | `MemberMs/Members.cshtml` | 初診、分院、身分證號、手機號碼、生日、姓名、黑名單、操作（問卷/編輯/刪除 3 icon，取代舊獨立「問卷」「編輯」「刪除」3 欄） | 初診：是／否；分院：無資料顯示「尚未預約」（沿用舊字串，多筆用逐行顯示取代舊 `<br>` 拼接 HTML）；黑名單：是／不是 |
| `reserve/reserve-list` | `ReserveMs/ViewTaAppointments.cshtml` 等 3 變體（含 `ChAppointments`/`ChDentistAppointments`，結構幾乎相同） | 初診、醫師、預約日期、時間、時段、類型、項目、姓名、生日、手機號碼、編號（僅 `branchIsAutoRowNumber` 為 true 時顯示）、狀態、操作（瀏覽+取消 2 icon） | 初診：是／否；類型：`Clinic==='Skin'`→健保門診／`'Cosmetic'`→醫學美容／否則 齒科；狀態：`status===1`→成功（`text-green-600`）／否則 取消（`text-red-500`，非布林但沿用既有語意色慣例列入本欄位對照）；操作欄取消 icon 於 `status!==1` 時 `[disabled]` 並降低透明度（見 [blueprints/admin-reserve.md](../blueprints/admin-reserve.md)） |

- **操作欄固定最後一欄**（樣式見下）。
- **例外：`reserve/reserve-list` 左側另有一張「時段容量表」**（對應舊系統左窄欄，欄位「預約時段/設定人數/預約人數/剩餘人數」），該表結構與本規範管轄的清單頁 grid 不同（非分頁清單、無操作欄），不列入上方三個對照表，僅列表頁主 grid（右側「預約列表」）適用本規範。

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
| `basic/periods-list` | `w-20` `w-32` `w-auto` `w-24` `w-20` `w-20`（欄位依序：排序/時間/時段/起始編號/人數/操作） |
| `basic/question-types-list` | `w-20` `w-40` `w-auto` `w-24` `w-20` |
| `basic/questions-list` | `w-20` `w-auto` `w-24` `w-24` `w-20` |
| `authority/admins-list` | `w-32` `w-auto` `w-20` |
| `roster/rosters-list` | `w-32` `w-28` `w-auto` `w-24` `w-20`（欄位依序：醫師/日期/項目/需預約/操作） |
| `member/members-list` | `w-20` `w-32` `w-32` `w-32` `w-28` `w-auto` `w-24` `w-28`（操作欄 3 icon，比其餘頁面 2 icon 的 `w-20` 略寬） |
| `reserve/reserve-list` | `w-20` `w-32` `w-28` `w-24` `w-28` `w-24` `w-auto` `w-32` `w-28` `w-32` `w-20`（編號，可選）`w-24` `w-20` |

### 欄位對齊規範（**已定案 2026-07-03**，忠於舊系統逐欄比對，非統一規則）

- **主要辨識文字欄位一律靠左**（`text-left`，即不加 class，沿用 `<tr>` 預設）：名稱/標題/題目/姓名/帳號/科別項目/問卷名稱/醫師/日期/班別。
- **其餘欄位（排序、列舉、布林狀態、數值、操作）一律置中**（`text-center`，`th`/`td` 都要加）：即使內容是短日期或分類文字，只要不是上述「主要辨識欄位」就置中——**這不是「短內容置中」的通則**，而是逐欄比對舊系統實際 class 得出的結果（例：排班的「日期」欄雖短，舊系統仍是靠左，故新系統也維持靠左；時段的「門診時段」欄雖是短分類文字，舊系統是置中，新系統也置中）。判斷標準只有一個：**該欄在對應舊 View 是否有 `class="text-center"`**，不可用長度、型別等其他啟發式規則自行決定。
- **排序欄的輸入框**：`td` 本身也加 `text-center`（讓 `w-16` 的 number input 置中於欄寬內），不是只置中文字。
- 各頁對齊對照（`L`=靠左 `text-left`／不加 class，`C`=置中 `text-center`；依序對應上方欄位順序，操作欄一律 `C`）：

| 頁面 | 欄位對齊 |
|---|---|
| `basic/branches-list` | 排序C 類型C 名稱L 自動編號C 啟用C 操作C |
| `basic/doctors-list` | 姓名L 操作C |
| `basic/categories-list` | 排序C 標題L 需填問卷C 台中每次一人C 二林每次一人C 齒科每次一人C 操作C |
| `basic/periods-list` | 排序C 時間C 時段L 起始編號C 人數C 操作C |
| `basic/question-types-list` | 排序C 科別項目L 問卷名稱L 狀態C 操作C |
| `basic/questions-list` | 排序C 題目L 題型C 狀態C 操作C |
| `authority/admins-list` | 姓名L 帳號L 操作C |
| `roster/rosters-list` | 醫師L 日期L 項目L 需預約C 操作C |
| `member/members-list` | 初診C 分院C 身分證號C 手機號碼C 生日C 姓名L 黑名單C 操作C |
| `reserve/reserve-list` | 初診C 醫師L 預約日期C 時間C 時段C 類型C 項目C 姓名L 生日C 手機號碼C 編號C 狀態C 操作C |

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

### periods-list 不設頁籤 + 表單忠於舊系統（**已定案 2026-07-03**，取代前一版頁籤設計）

**背景**：`periods-list.ts` 原實作把時段 5 變體（台中健保/台中美容/二林健保/二林美容/二林齒科）收在同一頁面內用頁籤切換，是本專案自行發明的 UI，**舊系統 5 個變體是各自獨立的 `.cshtml` 頁面，彼此間完全沒有切換頁籤**（只能各自從選單分別進入）。使用者要求「頁面不需要有 tab，表單要完全參照舊程式」後，改為忠於舊系統：

- **移除頁籤 UI**：`periods-list.ts` 拿掉原本的 5 個頁籤切換列；`branch`/`clinic` 仍透過 query params 決定（元件維持參數化，未拆成 5 個獨立元件——舊系統雖是 5 個獨立頁面，但欄位/邏輯 100% 相同，維持單一元件符合 [old/modernization.md](../old/modernization.md) A5「參數化消除重複」原則，只是拿掉頁籤這個舊系統沒有的導覽層），變體間的切換完全交給選單（每個 Lims key 各自的選單項），不在頁面內提供切換入口。
- **台中健保時段（`branch=ta&clinic=Skin`）「新增時段」按鈕**：原比照舊 `BasicMs/TaPeriods.cshtml` 第 30 行隱藏（該連結被 Razor 註解，其餘 4 變體正常顯示）。**2026-07-04 使用者拍板解除隱藏**（業務性偏離：台中要能自行新增「比照二林」的細時段，起始編號留空＋逐時段人數），`periods-list.ts` 已移除 `isTaSkin` 條件，權限檢查保留；後端 `TaSkinCreate` 端點本已存在不變。見 [blueprints/customer-booking.md](../blueprints/customer-booking.md) §台中特定診療項目二林模式。
- **表單欄位/用詞改為完全比照舊 View**（`period-form.ts`）：
  - 「時間」（`OutpatientTimeID` 下拉，原新系統誤標為「門診時段」）
  - 「時段」（`Title`）**不是自由輸入文字**，舊系統是兩個 `<select>`（時 08–21、分 00/05/…/55）由前端 JS 組成 `"HH:MM"` 字串存入 `Title`（原新系統誤做成「名稱」自由文字輸入框，已修正為忠實復刻兩個下拉）
  - 「起始編號」提示文字：2026-07-03 曾改回舊系統文案「若沒填寫，起始編號預設為 2」（當時後端為 `ctx.StartNumber ?? 2`）；**2026-07-04 隨「配號時段」規則再改**——起始編號成為配號開關（有值才配號、留空不配號），提示文字改為說明此語意，`?? 2` 預設值已移除（真實資料台中時段皆有 StartNumber=12，無行為回歸；此為使用者拍板的業務性偏離，見 [blueprints/customer-booking.md](../blueprints/customer-booking.md)）
  - 「人數」（`Patients`，原新系統誤標為「容量」）
- 對應列表頁欄名（時間/時段/起始編號/人數）同步修正，見上方「欄位順序」「欄位對齊」表格。
- `ng build` 0 error。**未做**：瀏覽器互動實測（本次會話無 Playwright/chrome-devtools 工具可用）。

### categories-list 不設頁籤 + 表單忠於舊系統（**已定案 2026-07-03**，取代前一版頁籤設計）

**背景**：與 periods-list 同樣的問題——`categories-list.ts` 原把「皮膚主治」（`Skin`）「美容醫學」（`Cosmetic`）2 變體收在同一頁用頁籤切換，但**舊系統 `Skins.cshtml`／`Cosmetics.cshtml` 是各自獨立頁面，彼此沒有切換頁籤**。使用者要求「皮膚主治跟美容醫學不要有 tab，表單也要完全參照舊系統」後，比照 periods-list 的修法：

- **移除頁籤 UI**：`categories-list.ts` 拿掉原本的 2 個頁籤切換列；`clinic` 仍透過 query params 決定（元件維持參數化，理由同 periods-list），變體切換交給選單。
- **表單欄位/用詞/顯示邏輯改為完全比照舊 View**（`category-form.ts`，逐行比對 `AddSkins`/`EditSkins`/`AddCosmetics`/`EditCosmetics.cshtml`，4 個 View 結構完全相同，僅標題/URL 不同）：
  - 欄名「名稱」→「**標題**」（列表頁與表單皆同步）
  - 「簡介」原是多行 `<textarea>` 且選填，舊系統是**單行文字輸入且必填**（`TextBoxFor` + `data-bv-notempty`），已改為單行 `<input>` + `Validators.required`，後端 `CategoryAdminService.Validate` 同步加上非空檢查
  - 「代表圖」（`Photo`）**新增時必填、編輯時選填**（已有既有圖可不換），舊系統的 `data-bv-notempty` 只出現在 `AddSkins`/`AddCosmetics`，`EditSkins`/`EditCosmetics` 沒有此限制；已於 `submit()` 依 `isEdit()` 判斷手動擋下並補上舊系統的提示文字「建議尺寸 : 411 x 298」
  - 三個「每次一人」checkbox 標籤原寫「台中院限定」/「二林院限定」/「二林齒科限定」，改回舊系統原詞「**台中每次一人**」/「**二林每次一人**」/「**齒科每次一人**」（與列表頁欄名一致）
  - 「需填問卷」（`IsQuestion`）**只在編輯頁顯示，新增表單完全沒有此欄位**——查證舊 `AddSkins`/`AddCosmetics` 的 `TryUpdateModel` 白名單本來就不含 `IsQuestion`（只有 `Title`/`Intro`/`IsOnly`/`ChIsOnly`/`ChDentistIsOnly`），新建項目一律 `IsQuestion=false`，只能之後在 `EditSkins`/`EditCosmetics` 開啟。前端已改為 `@if (isEdit())` 才顯示此欄位、新增時固定送 `isQuestion:false`；後端 `CategoryAdminService.CreateAsync` 同步修正為**忽略前端傳入值、一律強制寫入 `false`**（原本會照單全收，屬於初版遺漏的業務規則）。
  - **新發現的業務規則**（`BasicMsController.EditSkins`/`EditCosmetics` 第 951–961 行）：`IsQuestion` 從 `false` 改為 `true` 時，該科別項目**必須已有至少一筆 `QuestionTypes`**，否則擋下並顯示「尚未編輯問卷」。原新系統完全沒有這條規則（後端 `UpdateAsync` 照單全收）。已在 `CategoryAdminService.UpdateAsync` 補上：先查目前 `IsQuestion` 是否為 `false`、送入值是否為 `true`，是則檢查 `COUNT(*) FROM QuestionTypes WHERE CategoryID=@id`，為 0 則拋 `BusinessException("尚未編輯問卷", "QUESTION_NOT_EDITED")`。
- `dotnet build`（0 warning）與 `ng build`（0 error）皆通過。**未做**：瀏覽器互動實測（本次會話無 Playwright/chrome-devtools 工具可用），建議下次驗證「新增皮膚主治不填代表圖擋下」「編輯時 IsQuestion 開啟但無 QuestionTypes 擋下尚未編輯問卷」兩個新增的業務規則。

### rosters-list 不設頁籤 + 表單忠於舊系統（**已定案 2026-07-03**，取代前一版頁籤設計）

**背景**：使用者接著指出「門診管理裡都有同樣的問題」，`rosters-list.ts`/`roster-form.ts` 確實與 periods/categories 同一類問題，且排班表單本身還多出 3 處欄位/邏輯落差（逐行比對 `TaRosters`/`AddTaRosters`/`EditTaRosters.cshtml`，5 變體 254/233/184 行完全一致，僅標題/URL 不同）：

- **移除頁籤 UI**：`rosters-list.ts` 拿掉原本的 5 個頁籤切換列（舊系統 5 變體是各自獨立頁面）；`branch`/`clinic` 仍走 query params，變體切換交給選單；篩選欄「日期」改回舊系統用詞「**門診日期**」。
- **列表「項目」欄取代「班別」欄**：舊 `TaRosters.cshtml` 的欄位是分院/醫師/日期/**項目**（`RosterCategorys` 依 `Categorys.Sort` 排序後的標題逗號串接）/需預約/編輯/刪除，**完全沒有「班別」欄**；初版新系統誤植成顯示 `OutpatientTimeTitle`（班別），漏掉了「項目」這個舊系統實際呈現的欄位。已修正：後端 `RosterListItemDto` 新增 `CategoryTitles`（`RosterAdminService.ListAsync` 用 `STRING_AGG(...) WITHIN GROUP (ORDER BY c.Sort)` 子查詢取得），前端欄名「項目」/「需預約」（原「開放指定預約」）。
- **表單欄位/邏輯改為完全比照舊 View**（`roster-form.ts`）：
  - 「需預約」（`IsAppointment`）**只在有選醫師時顯示**，清空醫師會自動取消勾選——查證舊 `AddTaRosters`/`EditTaRosters.cshtml` 的 `$("#DoctorID").change` 行為：`divAppointments` 預設 `hide`，選了醫師才 `removeClass('hide')`，清空醫師則強制 `$("#IsAppointment").prop("checked", false)` 並重新隱藏。初版新系統該 checkbox 不論是否選醫師都常駐顯示，已修正為 `@if (form.controls.doctorId.value)` + `onDoctorChange()` 重置。
  - 「門診日期」（`RosterDate`）**新增與編輯皆可填寫**——查證舊 `EditTaRosters` POST 的 `TryUpdateModel` 白名單明確包含 `"RosterDate"`，並非不可改；初版新系統誤判為「編輯僅含單一天、不含 RosterDate」，把日期欄整個藏在 `@if (!isEdit())` 底下。已修正：`RosterUpdateRequest` 補上 `RosterDate` 欄位（`RosterAdminService.UpdateAsync` 一併 `UPDATE Rosters SET RosterDate=...`），表單日期欄兩種模式皆顯示。舊系統編輯時對新日期**不會**重新檢查衝突（純欄位覆寫），新系統維持同樣寬鬆行為，不額外加驗證。
  - 「起始號碼」欄改為**唯讀顯示**（純文字，非 `<input>`）——查證舊系統該值一律是 `<input type="hidden">`，直接複製自 `Periods.StartNumber` 模板值，**未提供任何編輯介面**；初版新系統誤做成可編輯的數字輸入框。修正後只有「人數」（`Patients`）可編輯，欄名「開放科別項目」→「**項目**」、「容量」→「**人數**」對齊舊系統用詞。
  - 分院欄位（`BranchID`）維持不在表單顯示（舊系統雖有一個停用的 `<select>` + JS 在送出前才重新啟用的技巧性寫法，純屬 ASP.NET MVC disabled-select 不會 POST 值的技術繞道，無實質使用者互動價值，新系統以 query params 隱含帶入分院，不新增無意義的停用下拉）。
  - **「班別」（`OutpatientTimeID`）欄位整個移除**（追加修正，使用者回饋「門診表單要參照舊系統」後再次逐行核對發現）：查證 `AddTaRosters`/`EditTaRosters.cshtml` 第 107–113 行，該下拉整段被 Razor 註解包住（`@*<div class="form-group">...OutpatientTimeID...</div>*@`），**從未實際渲染過**，屬死碼；`Rosters.OutpatientTimeID` 因此在真實資料中一律維持建立時的預設值不變，且新系統 `BookingService` 真正拿時段時間是 join `Periods.OutpatientTimeID`（透過 `Periods`→`OutpatientTimes`），**與 `Rosters.OutpatientTimeID` 完全無關**，故拿掉此欄位不影響客戶預約流程。初版誤將此死碼欄位做成可互動下拉。已移除 UI（`<select>` 連同 `outpatientTimes` 下拉資料一併移除，改為不必要的 API 呼叫也一併拿掉），表單 `outpatientTimeId` 欄位保留但不渲染：新增固定送 `null`（比照舊系統新建一律未設定），編輯原樣回傳既有值不覆寫（比照舊系統白名單含此欄位、但表單從未提交對應輸入時 model binder 不會清空既有值的行為）。
  - **「重複」用詞與順序改回舊系統**：舊 `<select id="Repeat">` 選項依序是「每天」(1)／「每周」(2)／「永不」(3)；初版新系統用 3 個 radio 且文字/順序皆不同（「不重複」／「每日」／「每週」）。已改為單選鈕文字「每天」/「每周」/「永不」、順序與舊系統一致（僅內部數值仍用 0/1/2，屬實作細節不影響行為）；「截止日」欄名改回舊系統 placeholder「**重複結束日期**」。
- `dotnet build`（0 warning）與 `ng build`（0 error）皆通過。**未做**：瀏覽器互動實測（本次會話無 Playwright/chrome-devtools 工具可用），建議下次驗證「清空醫師『需預約』自動取消勾選」「編輯排班改門診日期成功寫回」「編輯既有排班的班別欄位值維持不變」三個修正後的行為。

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
| `reserve/reserve-list` | `ReserveMs/TaAppointments.cshtml` 等 3 變體 | ✅ 分頁（舊系統 `ToPagedList(pageNumber: p, pageSize: 50)`，**pageSize 固定 50，非本規範其餘頁面的 20**，後端 `AppointmentAdminService` 已寫死不對外開放調整，見 [blueprints/admin-reserve.md](../blueprints/admin-reserve.md)） |

- **pageSize 固定 20（`reserve/reserve-list` 例外固定 50）**：對照舊系統 `ToPagedList(pageNumber: p, pageSize: 20)` 與既有 Roster 分頁（`RostersAdminController` 寫死 20），三個新分頁頁面（Branches/Categories/Admins）比照辦理，**前端不開放調整 pageSize**，後端 `Math.Clamp(pageSize, 1, 100)` 僅為防禦，不代表可調整。`reserve/reserve-list` 沿用舊 `ReserveMsController` 原本就寫死的 50，非本次新系統自行決定的例外。
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
| 問卷 PDF（iTextSharp） | **已定案 2026-07-03**：後端僅回結構化 JSON（`QuestionnaireExportDto`），前端 `pages/reserve/questionnaire-print.ts` 用瀏覽器原生 `window.print()` 產生 PDF，**不引入 `pdfmake`/`html2pdf`**——刻意選擇原生列印以避免新增 npm 依賴與 CJK（中文）字型嵌入問題，取代先前「先採前端方案降後端負擔」的暫定敘述 |

匯出端點見 [api-design.md](api-design.md)（`/api/appointments/export/{checkin|questionnaire}`）；問卷列印頁列印時隱藏 `AdminLayoutComponent` 版型元素（側欄/頂欄/Ribbon/頁尾），見 `styles.css` 的 `@media print` 規則。

## 不做
SSR/SEO；不共用客戶前台程式碼；不引入 SmartAdmin/Bootstrap（版面結構以 Tailwind 重現，配色改為品牌 token，見上）。

## 對應舊系統
- 模組/頁面/權限：[old/design/frontend-backend.md](../old/design/frontend-backend.md)、[old/blueprints/backend-admin.md](../old/blueprints/backend-admin.md)、`reference/old/20SkinBackend/`
- 各功能規格：[blueprints/admin-auth-authority.md](../blueprints/admin-auth-authority.md) 等 admin-* 藍圖
