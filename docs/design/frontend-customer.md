---
title: 客戶前台設計（Angular SPA）
purpose: 規範客戶前台重寫：Angular standalone + signals 純 SPA，路由/元件對照、reservation signal store 取代舊 Session、reCAPTCHA/上傳整合
applicable_when: 要實作或修改客戶前台頁面、預約流程狀態、表單驗證、或對接客戶 API 時
related_agents:
  - frontend-architect
related_docs:
  - frontend-coding-style.md
  - visual-design.md
  - api-design.md
  - security.md
  - ../old/design/frontend-customer.md
  - ../blueprints/customer-booking.md
keywords: [frontend, customer, angular, signals, spa, main.css, reservation-store, recaptcha]
last_updated: 2026-07-01
status: draft
---

> 舊前台（MVC5 + Razor + jQuery）完整盤點見 [old/design/frontend-customer.md](../old/design/frontend-customer.md)。新前台為**獨立 Angular 專案**、純 SPA（無 SEO/SSR）、視覺不改（見 [visual-design.md](visual-design.md)）。

## 技術

Angular standalone components · **signals**（state/computed/effect）· Reactive Forms · **直接載入舊 `main.css`**（置於 `public/content/main.css`，由 `index.html <link>` 引入）· `HttpInterceptor`（Bearer）· route guard · reCAPTCHA v3。慣例見 [frontend-coding-style.md](frontend-coding-style.md)。

## 樣式策略（2026-06-30 決策：移除 Tailwind，直接套用舊 main.css）

- **`src/styles.css`**：已移除 `@import "tailwindcss"` 及所有 `@theme`/`@layer` 自訂 class。現為近空檔（僅保留注解）。
- **`index.html`**：加入 `<link rel="stylesheet" href="content/main.css">` 直接引用舊原檔（129KB）。`public/content/main.css` 為不改動的舊版原始 CSS。
- **原因**：Tailwind 重建版仍有細微視覺差異；改用原檔求像素一致，不另維護 token 重建。
- **字型**：`main.css` 內 `@font-face` 格式為 `embedded-opentype`（舊 .ttf 以此宣告），現代瀏覽器不載入，沿用系統 fallback——與舊站行為相同（舊站字型本就不穩定），不複製 27MB .ttf。
- **圖片路徑**：`main.css` 內 `url(../images/...)` → 相對解析到 `public/images`（已存在），最多 404 無害警告。

## 外殼 / 視覺（已實作）

- **外框**：`app.ts` + `app.html` 重現舊 `_Layout`/`_Header`/`_Sidebar`/`_Footer`——`<div id="wrapper">` 包含 `<header class="scroll" id="header">` + `<router-outlet>` + `<footer id="footer">`，外接 `<div id="sideBar">`。
- **導覽列**：原封不動照搬 `_Header.cshtml` markup（`#header > .header_inner > .head_logo + .head_nav + #btn_menu`）；外站連結保持絕對 URL；唯**預約聯繫**頂層改為 `routerLink="/"`。
- **側欄開關**：`#sideBar` 預設 `display:none`（main.css 規則），用 signal `sidebarOpen()` 控制 `[style.display]`（舊版純 jQuery `.show()/.hide()`，無對應 CSS class）。`#btn_menu (click)` 觸發 `toggleSidebar()`；`.btn_close (click)` 觸發 `closeSidebar()`。子選單展開狀態沿用 `expanded()` signal + `[style.display]` 控制 `.second-list`。
- **Templates**：各頁 template 還原舊 `.cshtml` 的 HTML 結構與 class，Razor 語法換成 Angular 綁定，完全無 Tailwind utility class。
- **登入雙鈕**：`Login` 保留舊「預約查詢 / 進入預約」兩鈕，`submit(dest)` 控制登入後導向（`/appointments` vs `/`）。
- **登出（舊系統無，新增）**：`app.ts` 注入 `AuthService`，以 `isLoggedIn()` signal 於 `#header .head_nav` 尾端與手機 `#sideBar` 選單各掛一個「登出」連結，**僅登入後顯示**；`logout()` 關側欄後呼叫 `AuthService.logout()`（清 token → 導 `/login`）。

## 路由 / 元件對照（對應舊 Views/MainMs）

| 路由 | Component | 舊頁面 | 資料/互動 |
|---|---|---|---|
| `/login` | LoginComponent | Login.cshtml | 身分證+生日(民國年三選單)+reCAPTCHA → `/api/auth/member/login`（1/2/3：成功/新客→join/黑名單） |
| `/join-us` | JoinUsComponent | JoinUs.cshtml | 初診表單（姓名/身分證/手機/生日/血型/性別/email/地址城市→區/緊急聯絡人/過敏史/病史）→ `/api/auth/member/register` |
| `/` | IndexComponent | Index.cshtml | 分院卡片 → 設 store；BranchType=2(齒科) 直接跳預約表單，否則進診別 |
| `/booking/clinic` | ClinicComponent | Clinic.cshtml | 健保/醫美選項（台中隱藏醫美）→ store |
| `/booking/category` | CategoryComponent | Category.cshtml | 項目卡片 → store；`IsQuestion` 則先跳問卷 |
| `/booking/questionnaire` | QuestionnaireComponent | Questions.cshtml | 動態問卷（OptionType 0/1/2/3）→ `/api/member-questions` |
| `/questionnaire` | QuestionnaireListComponent | QuestionTypes.cshtml | 含問卷項目入口 |
| `/booking/appointment-form` | AppointmentFormComponent | AppointmentForm.cshtml | 人數/日期/指定醫師/時段(JSON 渲染)/上傳 → `/api/appointments` |
| `/booking/complete/:id` | CompleteComponent | Complete.cshtml | 預約成功詳情（含 outpatientNum） |
| `/appointments` | AppointmentListComponent | Appointment.cshtml + Visit.cshtml | 個人預約分頁清單 |
| `/appointments/:id` | AppointmentDetailComponent | AppointmentDetail.cshtml | 詳情（API 端做歸屬檢查） |
| `/appointments/:id/cancel` | AppointmentCancelComponent | AppointmentCancel.cshtml | 取消確認（>1 小時才可）→ `/api/appointments/:id/cancel` |

> 舊 `Visit`（初/複診）流程舊系統已停用 → 不重建（併入清單）。`QuestionComplete` 為中間狀態 → 省略。

### 舊 URL 後方相容（2026-07-01 決策）

舊系統為 MVC 標準路由（`{controller}/{action}/{id}`，預設 `controller=MainMs`），實際網址是 `/MainMs/{Action}`。**使用者可能有舊書籤**（最關鍵是登入頁 `/MainMs/Login`），若直接連到新 SPA 會 404。因此在 `app.routes.ts` 新增 `legacyRoutes` 區塊，把所有舊 `/MainMs/*` 路徑 redirect 到新對應路由：

| 舊 URL | 新路由 |
|---|---|
| `/MainMs/Login` | `/login` |
| `/MainMs`、`/MainMs/Index` | `/` |
| `/MainMs/Clinic` | `/booking/clinic` |
| `/MainMs/Category` | `/booking/category` |
| `/MainMs/AppointmentForm` | `/booking/appointment-form` |
| `/MainMs/Appointment` | `/appointments` |
| `/MainMs/Complete?AppointmentID=` | `/booking/complete/:id`（函式型 redirect 轉 query→path，無 id 退 `/appointments`） |
| `/MainMs/AppointmentDetail?AppointmentID=` | `/appointments/:id`（同上） |
| `/MainMs/AppointmentCancel?AppointmentID=` | `/appointments/:id`（cancel 頁未獨立重建，先導詳情） |
| `/MainMs/JoinUs` | `/join-us`（初診註冊頁已重建） |
| `/MainMs/QuestionTypes`、`Questions`、`QuestionComplete` | `/questionnaire`（問卷已重建，見 [blueprints/questionnaire.md](../blueprints/questionnaire.md)） |

> **⚠️ 正式部署必辦**：Static Web Apps 需在 `staticwebapp.config.json` 設 `navigationFallback` → `/index.html`（並排除 assets），伺服器才會把 `/MainMs/*` 這類深層路徑交給 SPA 由前端路由處理；否則 SWA 會回 404，前端 redirect 根本不會執行。本機 `ng serve` 已自動 fallback，無此問題。此設定屬 P2 CI/CD（見 [infrastructure.md](infrastructure.md)）。

## 問卷流程（2026-07-01 實作，見 [blueprints/questionnaire.md](../blueprints/questionnaire.md)）

- **兩頁**：`QuestionnaireListComponent`（`/questionnaire`，對應舊 QuestionTypes.cshtml）＋ `QuestionnaireComponent`（`/booking/questionnaire`，對應舊 Questions.cshtml）。以 `QuestionnaireService` 呼叫 `/question-types`（清單/單份）與 `/member-questions`（作答）。
- **題型渲染**：`optionType===2` → checkbox（複選）、否則 radio（單選）；`isOther` 時額外顯示「其他」自填 text（存 `MemberQuestions.Other`）。真實 DB 無文字/檔案題型（見 [gotchas.md](../gotchas.md)）。
- **預約分支**：`category` 頁 `IsQuestion` → `navigate(['/questionnaire'],{queryParams:{categoryId, return:'booking'}})`；清單頁在**所有問卷作答完**才顯示「完成，回預約表單」，點擊回填 `store.setQuestionTypeId(第一份)` 並導 `/booking/appointment-form`（預約以此帶 `QuestionTypeID`）。
- **獨立入口**：`/questionnaire`（無參數）列出所有有啟用問卷的項目；作答後回清單。
- **pre-fill**：表單載入時以會員既有作答預選；submit 為「重填」語義（後端交易內先刪再寫）。
- **F5 防失**：`store.questionTypeId` 已同步 `sessionStorage`（`rsv_questionTypeId`），換項目時自動清除。

## Reservation signal store（取代舊 Session `myReserve`）

舊 `Reservation` 存於 server Session。新系統用**前端 signal store**（`providedIn: root`）保存多步驟狀態：

```
selectedBranch / selectedClinic+title / selectedCategory(+id,title) / questionTypeID
appointmentDate / selectedPeriodID / selectedDoctorID / isAppointment / amount / photo
memberID(來自 JWT)
```

- `setBranch()`：BranchType=2 自動設 clinic=Dentist。
- **F5/換頁防失**：關鍵步驟同步寫 `sessionStorage`（或 route query），避免重新整理中斷預約。
- `memberID` 一律由 JWT 取，不信任前端輸入。

## 認證 / 攔截

- 登入後 JWT 存瀏覽器；`authInterceptor` 加 `Authorization: Bearer`；401 → 登出導回 `/login`。
- route guard：未登入導 `/login`（`/login`、`/join-us` 公開）。

## 第三方 / 特殊邏輯（前端側）

| 項目 | 前端做法 | 對應舊 |
|---|---|---|
| reCAPTCHA v3 | 載入頁取 token 附在登入/註冊請求；**後端驗證** | Login/JoinUs |
| 圖片上傳 | `multipart` → `/api/uploads` 取回 URL，附在預約 | UploadsController |
| 自動門診號 | 前端只顯示 API 回傳 `outpatientNum` | Complete |
| 生日民國年三選單 | 保留（服務年長者 + Line/FB in-app browser 相容），修舊閏年 bug | [old/gotchas.md](../old/gotchas.md) 前端段 |
| 簡訊 | 前端不處理；建立預約後由 API 雙寫 | — |

## 表單驗證（Reactive Forms）
身分證 `^[A-Z]\d{9}$`、手機 `^09\d{8}$`、生日合理性、必填項；對應舊 jQuery validate + DataAnnotation 規則。

## 不做
SSR / SEO / 預渲染；不共用後台程式碼；不在前端放業務規則（容量/重複/編號一律 API 決定）。

## 對應舊系統
- 頁面/流程/腳本：[old/design/frontend-customer.md](../old/design/frontend-customer.md)、`reference/old/20Skin/Views/MainMs/`
- 預約規格：[blueprints/customer-booking.md](../blueprints/customer-booking.md)
