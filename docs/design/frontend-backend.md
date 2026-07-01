---
title: 後台前端設計（Angular SPA）
purpose: 規範後台重寫：Angular standalone + signals + Tailwind 重現 SmartAdmin 外觀，六模組路由/元件、依 JWT claims 動態權限選單、clinic 參數化取代變體頁、匯出策略
applicable_when: 要實作或修改後台頁面、權限選單、主檔/班表/預約/會員/權限模組、或匯出功能時
related_agents:
  - frontend-architect
related_docs:
  - frontend-coding-style.md
  - visual-design.md
  - api-design.md
  - security.md
  - ../old/design/frontend-backend.md
  - ../old/blueprints/backend-admin.md
keywords: [frontend, backend-admin, angular, signals, tailwind, smartadmin, permission-menu, export]
last_updated: 2026-07-01
status: draft
---

> 舊後台（MVC5 + SmartAdmin + Bootstrap3）完整盤點見 [old/design/frontend-backend.md](../old/design/frontend-backend.md) 與 [old/blueprints/backend-admin.md](../old/blueprints/backend-admin.md)。新後台為**獨立 Angular 專案**、純 SPA、視覺重現 SmartAdmin（[visual-design.md](visual-design.md)）。

## 技術
Angular standalone + **signals** + Tailwind；Reactive Forms；`HttpInterceptor`（Bearer）；權限 route guard。慣例見 [frontend-coding-style.md](frontend-coding-style.md)。

## 版型（重現 SmartAdmin）
`AdminLayoutComponent`：固定左側欄（深色，權限選單）+ 頂欄（使用者/登出）+ Ribbon（麵包屑）+ 內容 `router-outlet` + 頁尾。Tailwind 對應見 [visual-design.md](visual-design.md)。

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

## 權限選單（依 JWT claims）

- 登入後 JWT 帶 `perms`（攤平的 Lims+AdminLims，JSON 字串 claim）與 `is_super_admin`（字串 `true`/`false`）。前端 `auth.service` 解析：`perms` `JSON.parse`、`is_super_admin` 容錯 `true`/`'true'`。
- 權限 route guard（`perm.guard`）：`route.data.perm={key,op}`；進頁前比對；不足導 `/forbidden`。授權真相仍在 API。

### 選單資料驅動（**已定案 2026-07-01，忠於舊做法**）
- **不硬編碼選單**：`admin-layout` 呼叫 `GET /api/admin/menu`，後端讀 `Lims`(二層) 依當前管理員 `AdminLims` 過濾（模組層任一子項有權即顯示），回傳 `{key,label,icon,sort,children}` 樹。等同舊 `SiteMenuAsUnorderedList`。
- **Key→路由轉譯**：舊 href=`/{模組Key}/{子Key}`；新路由不同名，故前端 `core/menu-route-map.ts`（`LIMS_ROUTE_MAP` + `resolveMenuRoute`）把 `Lims.Key` 轉新 Angular 路由。舊 Ta/Ch/Cosmetic/Dentist 變體 key 對到同一 **clinic/branch 參數化** 路由。
- **未建模組**：`BUILT_KEYS` 控制；未建者導 `/coming-soon`（選單仍完整顯示，像舊系統）。逐一補模組時把 key 加入 `BUILT_KEYS` 並確保路由存在。
- **視覺**：`admin-layout` 以 Tailwind 重現 SmartAdmin：深色側欄（`#31353d`）+ 可展開模組（fa 圖示）+ 頂欄（使用者/超管標記/登出）+ Ribbon 麵包屑 + 頁尾。Font Awesome 4 由 `index.html` CDN 載入還原 `fa-*`。
- 取代舊 `_Aside.cshtml` + `CheckSession` 字串比對。詳見 [security.md](security.md)、[../blueprints/admin-auth-authority.md](../blueprints/admin-auth-authority.md)。

> **本機埠**：客戶前台 `ng serve` 用 :4200、後台用 **:4300**（`ng serve --port 4300`）；API `local.settings` Host.CORS 已加 :4300。

## 匯出策略（取代 NPOI / iTextSharp）

| 舊 | 新 |
|---|---|
| 簽到單 Excel（NPOI HSSF .xls，65536 列上限） | 後端 `ClosedXML`/OpenXML 產 `.xlsx`，API 回檔；或前端 `xlsx` 庫由 JSON 生成 |
| 問卷 PDF（iTextSharp） | 前端 `pdfmake`/`html2pdf`（後端僅回 JSON）；或後端產 PDF。先採前端方案降後端負擔 |

匯出端點見 [api-design.md](api-design.md)（`/api/appointments/export/{checkin|questionnaire}`）。

## 不做
SSR/SEO；不共用客戶前台程式碼；不引入 SmartAdmin/Bootstrap（改 Tailwind 重現）。

## 對應舊系統
- 模組/頁面/權限：[old/design/frontend-backend.md](../old/design/frontend-backend.md)、[old/blueprints/backend-admin.md](../old/blueprints/backend-admin.md)、`reference/old/20SkinBackend/`
- 各功能規格：[blueprints/admin-auth-authority.md](../blueprints/admin-auth-authority.md) 等 admin-* 藍圖
