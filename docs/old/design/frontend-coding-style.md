---
title: 前端程式碼風格（Razor / jQuery / HTML / CSS）
purpose: 20Skin 前端 Razor View、jQuery script、HTML、CSS 撰寫風格指南；作為 code review 客觀依據
applicable_when: 撰寫 / review 前端 Razor / JS / CSS、設定 lint rule、新人 onboarding
related_agents:
  - frontend-architect
  - code-review-optimizer
related_docs:
  - frontend-customer.md
  - frontend-backend.md
  - visual-design.md
  - ../conventions.md
  - security.md
keywords: [coding-style, frontend, razor, jquery, javascript, html, css, style-guide]
last_updated: 2026-05-26
---

## 0. 元規則

四條原則優先於後續所有具體規則：

1. **可驗證 > 願望**：每條規則應對應到 lint rule、review checklist；無法自動驗證的標 `[guideline]`
2. **一致 > 個人偏好**：要改就改規則本身（PR 改本檔）
3. **清楚 > 簡短**：除非簡短就清楚
4. **入口驗證、內部信任**：邊界檢查集中在 form / AJAX 邊界，內部不重複防禦

## 1. 通則

### 結構

- **Early return** 勝過多層 nesting
- 函式單一職責；超過 ~50 行考慮拆分
- 檔案 ≥ 300 行考慮拆分

### 命名

- 表達意圖；避免無意義縮寫
- Boolean：`is` / `has` / `can` 前綴；避免雙重否定
- jQuery 變數常以 `$` 開頭：`var $btn = $('#submit');`

### 註解

- 預設**不寫**；只寫 **why**，不寫 what
- TODO / FIXME 必含 owner 或 issue 連結

### Magic numbers / 字串

- 抽常數
- UI 文案：客戶端 / 後台目前以 Razor 內嵌中文為主（無 i18n 框架）

### 日期 / 時區

- Server 端寫到 DOM 的時間值用 ISO 8601 字串
- 客戶端解析時注意 timezone（瀏覽器預設為 local）
- 顯示格式用統一 helper（如 `moment.js`，若已引入）

### Logging

- 開發階段：`console.log` / `console.warn`；上 production 前移除
- **不**在客戶端 log PII / token

### Defensive programming 邊界

- AJAX 請求 / form 提交時做完整驗證
- DOM 操作 trust 自家 server-rendered 結構，不對固定 markup 重複 null check

## 2. Razor View（`.cshtml`）

### 基礎

- 模型強型別 `@model TypeName`，避免 `dynamic`
- 共用版型透過 `_Layout` / `_Menu` 等 partial
- **不**在 View 內寫商業邏輯：View 只負責呈現；計算 / 篩選放 Controller 或 ViewModel
- HTML helper 偏好 `Html.LabelFor` / `EditorFor` 等強型別輔助

### 安全

- 預設 Razor `@` 會 HTML-encode，避免 XSS
- 顯示原始 HTML 用 `@Html.Raw`，**僅限**確定來源安全（如自家後台編輯的 markup）
- 表單 POST 應加 `@Html.AntiForgeryToken()`（既有現況：尚未全面導入，新功能務必加）

### 注入 ViewBag

- 偏好 ViewModel 強型別；ViewBag / TempData 用於少量臨時資料

## 3. JavaScript / jQuery

### 基礎

- 目標：相容 IE11+ / 各主流瀏覽器（依專案實際需求；無 transpile pipeline）
- 偏好 ES5/ES6 折衷寫法（`var` / `function` 為主，少量 `let` / `const` / 箭頭函式視瀏覽器支援度）
- **無** TypeScript / 打包工具；script 直接由 IIS 提供

### Naming

- 變數 / 函式：`camelCase`
- jQuery DOM 變數：`$xxx` 前綴
- 事件 handler：`onXxx` 或 `handleXxx`

### jQuery 慣例

- 選擇器盡量用 `#id` 或語意化 class（如 `.btn-submit`）
- 同元素多次操作用 chaining 或快取選擇器（`var $form = $('#main-form'); $form.find(...);`）
- **不**在迴圈內反覆查 DOM
- 避免 `$('*')` / 過寬選擇器

### AJAX

- 統一用 `$.ajax` 而非 `$.get / $.post`（後者較難設 error handler）
- 必設 `success` 與 `error` callback
- 不吞錯：error 顯示給使用者或寫 log

```javascript
$.ajax({
  url: '/Ajax/GetRosters',
  data: { branchID: '...', date: '...' },
  success: function(data) { /* render */ },
  error: function(xhr) {
    alert('系統忙線中，請稍後再試');
  }
});
```

### 表單驗證

- jQuery Validate + ASP.NET unobtrusive validation
- 自訂規則用 `$.validator.addMethod`
- 客戶端驗證**僅為使用者體驗**；伺服端 ModelState 為唯一信任點

### 全域污染

- 避免 `window.xxx`；用 IIFE 或物件命名空間包起來

```javascript
var App = App || {};
App.Booking = (function() {
  function init() { /* ... */ }
  return { init: init };
})();
```

## 4. HTML / CSS

> 視覺決策（色彩、字體、間距）見 [visual-design.md](visual-design.md)。本段只談**結構規則**。

### HTML

- 語意化標籤（`<header>` / `<main>` / `<nav>` / `<button>` 而非全部 `<div>`）
- `alt` 必填於 `<img>`
- form 內 `<label for>` 對應 input `id`
- 對外連結加 `rel="noopener noreferrer"`（若有 `target="_blank"`）

### CSS

- **客戶前台**：自訂 `Content/styles/main.css`，**不**用 CSS framework；模組化分段（用註解區分區塊）
- **後台**：以 SmartAdmin + Bootstrap 3 為基礎；自訂樣式覆蓋寫在最後
- 命名：客戶端慣用語意化 class（如 `.appointment-form`）；後台沿用 Bootstrap utility（`.col-md-6`、`.btn-primary`）
- **避免** `!important`（除非覆寫第三方）
- **避免** inline style（動態值除外）
- 響應式：客戶端 mobile-first；後台主桌機 + Bootstrap 3 響應式
- 對比度通過 WCAG AA（一般 4.5:1、大字 3:1）

### 中文字體

- 客戶端：`StdsungEG-Bold-Big5` / `ARStdSongB5-Light` 為主，fallback 到系統字體
- 後台：依 SmartAdmin 預設，fallback 到系統字體
- 缺字 fallback 鏈完整

## 5. 與其他文件的關係

- **架構**：[frontend-customer.md](frontend-customer.md) / [frontend-backend.md](frontend-backend.md)
- **流程約定**（commit、branch、檔名）：[../conventions.md](../../conventions.md)
- **視覺系統**（色彩、字體）：[visual-design.md](visual-design.md)
- **安全相關**（XSS、CSP、Anti-Forgery）：[security.md](security.md)
- **常見踩雷**：[../gotchas.md](../gotchas.md)
