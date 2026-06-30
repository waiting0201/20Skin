---
title: 後台前端設計
purpose: 描述 20SkinBackend 後台的前端架構：SmartAdmin + Bootstrap 3 + jQuery、Controller 對應 View 結構、長 Controller 的 View 切割慣例
applicable_when: 要修後台 UI、要新增管理頁、要對接後台 AJAX、要修班表 / 預約查詢的視覺
related_agents:
  - frontend-architect
  - visual-design-architect
related_docs:
  - frontend-customer.md
  - visual-design.md
  - api-design.md
  - ../blueprints/backend-admin.md
  - frontend-coding-style.md
keywords: [frontend, backend, b-end, admin, smartadmin, bootstrap, jquery, dashboard]
last_updated: 2026-05-26
---

## 技術選型

| 面向 | 選擇 |
|---|---|
| 模板引擎 | Razor（`.cshtml`） |
| UI 主題 | **SmartAdmin**（dashboard 商業主題） |
| CSS 框架 | **Bootstrap 3**（`bootstrap.min.css`） |
| 圖標 | **Font Awesome**（`fa fa-*`） |
| Script | jQuery + SmartAdmin plugins（responsive widgets、jqGrid 等） |
| 表單驗證 | jQuery Validate + ASP.NET MVC Unobtrusive |
| 多皮膚支援 | `smartadmin-skins.min.css`（`config:CurrentTheme=fixed-navigation`） |
| 表格 | DataTables / jqGrid（依頁面） |

## 目錄結構

```
20SkinBackend/
├── Views/
│   ├── Shared/
│   │   ├── _Layout.cshtml          # SmartAdmin 主版型
│   │   ├── _Menu.cshtml            # 左側選單（依 Lims / AdminLims 動態渲染）
│   │   └── _LoginLayout.cshtml
│   ├── Main/
│   │   ├── Login.cshtml
│   │   └── Index.cshtml            # 儀表板首頁
│   ├── BasicMs/                    # 基礎資料 CRUD
│   │   ├── Branchs.cshtml
│   │   ├── AddBranchs.cshtml
│   │   ├── EditBranchs.cshtml
│   │   ├── Doctors.cshtml
│   │   └── ... (Periods / OutpatientTimes / Categorys / Questions / QuestionAnswers)
│   ├── ShiftMs/                    # 班表
│   │   ├── TaRosters.cshtml
│   │   ├── AddTaRosters.cshtml
│   │   └── EditTaRosters.cshtml
│   ├── ReserveMs/                  # 預約管理
│   │   ├── TaAppointments.cshtml
│   │   ├── ViewTaAppointments.cshtml
│   │   └── ... (QuestionTa/Ch/ChDentistAppointments 等)
│   ├── MemberMs/                   # 會員管理
│   │   ├── Members.cshtml
│   │   ├── EditMembers.cshtml
│   │   └── MemberQAs.cshtml
│   └── AuthorityMs/                # 權限管理
│       ├── Admins.cshtml
│       ├── AddAdmins.cshtml
│       └── EditAdmins.cshtml
├── Content/
│   ├── css/
│   │   ├── bootstrap.min.css
│   │   ├── smartadmin-production-plugins.min.css
│   │   ├── smartadmin-production.min.css
│   │   └── smartadmin-skins.min.css
│   └── img/
└── Scripts/
    ├── jquery-*.js
    ├── bootstrap.min.js
    └── app.config.js               # SmartAdmin 配置
```

## Controller → View 對照

| Controller | 大小 | 對應 Views/{Name}/ | 主要頁面 |
|---|---|---|---|
| `BasicMsController` | 中 | `BasicMs/` | Branchs / Doctors / Periods / OutpatientTimes / Categorys / Questions / QuestionAnswers |
| `ShiftMsController` | **~92KB** | `ShiftMs/` | TaRosters（列表）、AddTaRosters（新增 + 重複展開）、EditTaRosters |
| `ReserveMsController` | **~57KB** | `ReserveMs/` | TaAppointments（列表 + 篩選）、ViewTaAppointments（詳情）、Export（匯出簽到單） |
| `MemberMsController` | ~14KB | `MemberMs/` | Members（列表）、EditMembers、MemberQAs（問卷答案查詢）、SMS 狀態 |
| `AuthorityMsController` | 中 | `AuthorityMs/` | Admins、AddAdmins、EditAdmins（含權限樹勾選 UI） |
| `AjaxController` | 小 | （無 View，回 JSON） | CheckUsername、CheckMobile、GetPeriods |

長 Controller 對應 View 也偏多偏大（特別是 `ShiftMs` 與 `ReserveMs`），修改時先用 grep 找 Action 對應的 View，**勿整檔讀**。

## 共用版型

### `_Layout.cshtml`（後台主版型）

- SmartAdmin 預設結構：header / left sidebar / content / footer
- 動態渲染左側選單（呼叫 `_Menu.cshtml` partial）

### `_Menu.cshtml`（左側選單）

- 從 `Session["AdminLims"]` 取得當前管理員權限
- 渲染對應 `Lims` 階層樹（依 `ParentID` 二層）
- 子選單 active 狀態靠當前 RouteData 比對

### `_LoginLayout.cshtml`

- 給 `Login.cshtml` 用的簡化版型（無 sidebar）

## 表格 / 列表慣例

- 後台列表多用 `PagedList` MVC HTML helper 產生分頁元件
- URL `?p={page}` 為標準
- 篩選 form 用 GET，篩選欄位前綴 `s`（`sClinic`、`sMemberMobile` 等）
- 排序：列表預設由 Controller 端 OrderBy，不在前端做 client-side sort

## AJAX 對接慣例

```javascript
// 驗證帳號唯一性
$.ajax({
  url: '/Ajax/CheckUsername',
  data: { username: $('#username').val() },
  success: function(res) {
    if (res.exists) showError('帳號已存在');
  }
});

// 依門診時段帶出時段範本
$.ajax({
  url: '/Ajax/GetPeriods',
  data: { outpatientTimeID: 1 },
  success: function(res) {
    // 動態渲染 RosterPeriodList 表單欄位
  }
});
```

## 權限對應 UI

`AuthorityMs/EditAdmins.cshtml` 是後台最複雜的 UI：

- 顯示「模組 → 子功能」二層樹
- 每個子功能 3 個 checkbox：`IsAdd` / `IsUpdate` / `IsDelete`
- 儲存時批次送出 `AdminLims` 集合
- 詳細邏輯見 [security.md](security.md) 與 [../blueprints/backend-admin.md](../blueprints/backend-admin.md)

## 檔案上傳 UI

- 用標準 HTML `<input type="file">` + Razor `BeginForm(enctype="multipart/form-data")`
- 後端走「本機暫存 → 上傳前台 CDN → 刪本機」三段式（見 [backend-design.md](backend-design.md)）

## 響應式

- 依 Bootstrap 3 grid（`col-xs-* col-sm-* col-md-* col-lg-*`）
- 後台主用桌機 / 平板，手機適配為次要

## 程式碼風格

詳見 [frontend-coding-style.md](frontend-coding-style.md)。
