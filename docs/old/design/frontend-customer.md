---
title: 客戶前台設計
purpose: 描述 20Skin 客戶前台 (20Skin/) 的前端架構：Razor + jQuery + 自訂 CSS、預約多步驟暫存、AJAX 對接慣例
applicable_when: 要修客戶端 UI、要新增前台 View、要對接 AjaxController、要調整客戶預約流程的視覺
related_agents:
  - frontend-architect
  - visual-design-architect
related_docs:
  - frontend-backend.md
  - visual-design.md
  - api-design.md
  - ../blueprints/customer-booking.md
  - frontend-coding-style.md
keywords: [frontend, customer, c-end, razor, jquery, main.css, appointment, booking-ui]
last_updated: 2026-05-26
---

## 技術選型

| 面向 | 選擇 |
|---|---|
| 模板引擎 | Razor（`.cshtml`） |
| Script | jQuery + plugins（`jquery.validate`、`jquery.blockUI`、`jquery.unobtrusive-ajax`） |
| 樣式 | **自訂** `Content/styles/main.css`（單檔約 59KB，無 SCSS/LESS） |
| 打包 | **無** Node.js / webpack / vite；靜態檔直接由 IIS 提供 |
| 字體 | `StdsungEG-Bold-Big5`、`ARStdSongB5-Light`（內嵌字體） |
| 表單驗證 | jQuery Validate + ASP.NET MVC Unobtrusive Validation |
| 動畫 / loading | jQuery BlockUI |
| 防機器人 | Google reCAPTCHA v3 |

## 目錄結構

```
20Skin/
├── Views/
│   ├── Shared/
│   │   └── _Layout.cshtml          # 共用版型
│   ├── MainMs/
│   │   ├── Login.cshtml
│   │   ├── JoinUs.cshtml
│   │   ├── Index.cshtml
│   │   ├── AppointmentForm.cshtml
│   │   ├── AppointmentDetail.cshtml
│   │   ├── Complete.cshtml
│   │   ├── Visit.cshtml
│   │   └── Questions.cshtml
│   └── Web.config                  # Views 專用設定
├── Content/
│   ├── styles/
│   │   ├── main.css                # 主樣式（~59KB）
│   │   └── normalize.css
│   └── images/
└── Scripts/
    ├── jquery-*.js
    ├── jquery.validate*.js
    └── jquery.blockUI.js
```

## 路由與頁面對照

| URL | View | 主要互動 |
|---|---|---|
| `/MainMs/Login` | `Login.cshtml` | 身分證 + 生日 + reCAPTCHA 表單 |
| `/MainMs/JoinUs` | `JoinUs.cshtml` | 新會員資料表單（個資 + 過敏 / 病史多選） |
| `/MainMs/Index` | `Index.cshtml` | 預約入口 / 分支選擇 |
| `/MainMs/AppointmentForm` | `AppointmentForm.cshtml` | 預約建立（最終提交） |
| `/MainMs/AppointmentDetail/{id}` | `AppointmentDetail.cshtml` | 預約詳情 |
| `/MainMs/Complete/{id}` | `Complete.cshtml` | 完成頁 |
| `/MainMs/Visit` | `Visit.cshtml` | 就診紀錄 |
| `/MainMs/Questions` | `Questions.cshtml` | 動態問卷（依 `OptionType` 渲染單選 / 複選 / 文字 / 檔案） |

## 預約多步驟暫存

預約流程是「多步驟 + Server-side Session 暫存」混合：

```
┌─ 客戶端 jQuery ──────────────────────────────┐
│                                              │
│  選 Branch → POST /Ajax/SelectBranch ────────┼──► Session["myReserve"].Branch
│  選 Clinic → POST /Ajax/SelectClinic ────────┼──► Session["myReserve"].Clinic
│  選 Category → POST /Ajax/SelectCategory ────┼──► Session["myReserve"].Category
│                                              │
│  (若 Category.IsQuestion = true)            │
│  填問卷 → POST /MainMs/Questions ────────────┼──► MemberQuestions + MemberQuestionAnswers
│                                              │
│  選日期 → GET /Ajax/GetRosters ──────────────┼──► 回 JSON: 可預約班次清單
│  選醫師(可選) → GET /Ajax/GetRosterDoctors ──┼──► 回 JSON: 醫師清單
│                                              │
│  最終提交 → POST /MainMs/AppointmentForm ────┼──► 寫 Appointments + SmsStatus
│                                              │
└──────────────────────────────────────────────┘
```

**注意**：步驟間沒有 hidden form fields 串接，全靠 Session。**重新整理 / 跨 tab 操作會打斷流程**。

## AJAX 對接慣例

```javascript
// 取得班表
$.ajax({
  url: '/Ajax/GetRosters',
  data: { date: '2026-05-26', branchID: '...' },
  success: function(data) {
    // data 為 JSON array，逐筆渲染
  }
});

// 取消預約
$.ajax({
  url: '/Ajax/PostCancel',
  type: 'POST',
  data: { appointmentID: '...' },
  success: function(res) {
    if (res.code === '200') { ... }
  }
});
```

JSON 回應格式不統一，見 [api-design.md](api-design.md)。

## 表單驗證

- Server 端：Razor `HtmlHelper` + Data Annotation（ViewModel 上 `[Required]` / `[StringLength]` 等）
- 客戶端：jQuery Validate（由 MVC unobtrusive validation 自動綁定）
- 自訂規則：在 `Scripts/` 加 inline script

## 生日輸入（Login / JoinUs）

兩頁的生日欄位使用**三個 `<select>`**（民國年顯示 / 西元年 value、月、日）：

- **為何不換 `<input type="date">` 或 flatpickr**：
  - 業務要求保留民國年顯示（服務習慣民國年的年長使用者）
  - `<input type="date">` 在 Line / FB / IG 內建瀏覽器（in-app WebView）支援不穩 — 部分版本點下去無反應 / change 事件不觸發 / 日曆被 navbar 蓋住
  - 醫美客戶大量流量走 Line 推播進來，這群人會直接卡住
- **資料流**：
  - HTML：`<select name="YYYY">` / `name="MM">` / `name="DD">`
  - 動態填 option：YYYY 為今年起前 100 年（民國年顯示，value 西元年）、MM 為 1-12、DD 依年月閏年計算 28/29/30/31
  - 後端 `Members.Birthday` 由 YYYY/MM/DD 三欄組合
- **關鍵實作要點**（避免被「優化」掉）：
  - 初始化掛在 `$(function () { YYYYMMDDstart(); })`，**不要**用 `window.addEventListener('load', ...)` — 弱網下 reCAPTCHA / 字體會延遲 `load` 事件，使用者看到空下拉
  - select 變動監聽用 jQuery `.on('change', ...)`，**不要**用 inline `onchange` 屬性 — Line WebView 舊版觸發不穩
  - 閏年判斷條件用「使用者選的月份」（`m == 2`），**不要**用「今天是 2 月」（`new Date().getMonth() == 1`）— 否則 1992/2/29 等生日無法選
  - `MonHead` 月份天數常數放 script 頂層用 `var` 宣告，避免隱式全域 / strict mode 問題
- **已知 bug 與修正紀錄**：見 [../gotchas.md](../gotchas.md) 前端段

## 響應式

- Mobile-first（客戶多用手機預約）
- 斷點與 grid 系統定義在 `main.css` 內（自訂，非 Bootstrap）
- 字體大小 / 點擊區域以手機操作優化

## 無障礙

- 圖片必含 `alt`
- 表單 label 對應 input
- 鍵盤可操作（避免純滑鼠 hover 觸發）

## 程式碼風格

詳見 [frontend-coding-style.md](frontend-coding-style.md)。
