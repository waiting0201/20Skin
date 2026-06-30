---
title: 視覺設計（視覺不改，客戶前台直接套用舊 main.css）
purpose: 規範「視覺不改」原則下，客戶前台直接載入舊 main.css 原檔、後台以 Tailwind 重現 SmartAdmin 外觀的策略與決策紀錄
applicable_when: 要修改客戶前台視覺策略、或建立後台 SPA design token 時
related_agents:
  - visual-design-architect
  - frontend-architect
related_docs:
  - frontend-customer.md
  - frontend-backend.md
  - ../old/design/visual-design.md
keywords: [visual, design, tailwind, smartadmin, main.css, 視覺不改]
last_updated: 2026-06-30
status: draft
---

> 原則：**視覺不改**——重寫只換實作（jQuery/Bootstrap/SmartAdmin → Angular），外觀完全維持。舊視覺資產見 [old/design/visual-design.md](../old/design/visual-design.md)。

## 兩套並存的視覺語言

| SPA | 既有外觀來源 | 重現方式 |
|---|---|---|
| 客戶前台 | `reference/old/20Skin/Content/styles/main.css`（129KB，class-based，含書法字體宣告） | **直接載入原檔**（`public/content/main.css` + `index.html <link>`）；template 還原舊 markup class |
| 後台 | SmartAdmin + Bootstrap 3（深色側欄、卡片、表格） | Tailwind 重現側欄/卡片/表格/按鈕 |

## 客戶前台視覺策略（2026-06-30 決策）

**策略：直接套用舊 `main.css` 原檔，移除 Tailwind**

- **理由**：Tailwind 重建版仍有細微視覺差異（色階精度、間距、hover 行為），改用原檔求像素一致，不另維護 token 重建。
- **做法**：
  1. `public/content/main.css` = 舊 `reference/old/20Skin/Content/styles/main.css`，內容不改動
  2. `index.html` 加入 `<link rel="stylesheet" href="content/main.css">`
  3. `src/styles.css` 移除 `@import "tailwindcss"` 及所有 `@theme`/`@layer components`，改為近空檔
  4. 各頁 template 還原舊 `.cshtml` 的 HTML 結構與 class（`.block-online`/`.block-item`/`.block-title`/`.block-stitle`/`.btn`/`.stitle-choose`/`.block-con.white-bg`/`.form-block`/`.from-title`/`.form-box`/`.time-btn`/`.js-active`/`.online-list-tb table`/`.online-item`/`.online-in-item`/`.field-text` 等）
- **時段選取**：舊版 jQuery click 加 `.js-active`；Angular 改為 signal `periodId()` + `[class.js-active]`
- **字型**：`main.css` 內 `@font-face` 格式為 `embedded-opentype`（.ttf 誤標格式），現代瀏覽器不載入，沿用系統 fallback——與舊站行為相同
- **圖片/字型路徑**：main.css 內 `url(../images/...)` 解析到 `public/images`（已存在預約所需圖）；`url(../fonts/...)` 404 無害（字型不載入）
| `.pic .name` | **`.pic-name`**（圖片底部黑底半透明白字遮罩） | 卡片名稱遮罩 |
| `.time-btn` / `.js-active` | **`.time-btn` / `.time-btn.is-active`**（`border #7c8796` → hover/選取反白） | 時段可選 / 已選 / `:disabled` 不可選 |
| `.online-list-tb table` / `.blue-line` | **`.skin-table`**（thead 藍底白字、列 hover `#dcf1ff`） | 預約清單表 |

> 行銷外框（`_Header` 導覽 + `_Sidebar` 手機滑出 + `_Footer`）實作於 `app.html` / `app.ts`，連結指向 `www.20skin.tw`；手機漢堡開合右側滑出選單（`專業服務`/`臻美分享` 可展開）。

## 後台：SmartAdmin → Tailwind

| 元素 | Bootstrap3/SmartAdmin | Tailwind |
|---|---|---|
| 側欄 | `.left-panel` | `fixed h-screen w-64 bg-gray-900 text-white overflow-y-auto` |
| 主內容 | `#main` | `flex-1 ml-64 p-6` |
| 頂欄 | `.navbar` | `fixed top-0 right-0 h-16 bg-white border-b` |
| 卡片 | `.jarviswidget` | `bg-white rounded-lg shadow p-4` |
| 表格 | `.table-bordered` | `w-full border-collapse border` |
| 按鈕 | `.btn-primary` | `px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700` |
| 禁用 | — | `opacity-50 cursor-not-allowed` |

## 共用 design token（客戶前台，已落地）

> 定義於 `web-customer/src/styles.css` `@theme`（Tailwind v4），實際取自舊 main.css 量測值。

| token | 值（舊 main.css 實際值） | Tailwind 用法 |
|---|---|---|
| 主色（標題/連結/強調） | **`#00538d`** | `text-skin-blue` / `bg-skin-blue` |
| 中性灰（按鈕/次文字） | **`#7c8796`**（hover `#7a8593`） | `text-skin-gray` / `border-skin-gray` |
| 分隔線 | **`#798593`** | `border-skin-line` |
| 淺邊框 | **`#e5e5e5`** | `border-skin-border` |
| 文字 | **`#333`** | `text-skin-ink` |
| 背景 | `white` | — |
| 錯誤 | `red`（舊 `#ff0000`） | `text-red-500` |
| 字體 | 沿用舊 `font-family` fallback 堆疊（書法字體 `StdsungEG-Bold-Big5` 等 ttf 各約 8–10MB，**不內嵌**，僅保留同組 fallback：Times New Roman / 微軟正黑體…）；`line-height:1.6` | `font-skin` |

> **決策：書法字體不內嵌**——三個 ttf 共 ~27MB，對純預約 SPA 過重；首屏本來就走 fallback，故僅保留原 `font-family` 堆疊，視覺差異僅在裝飾標題、預約表單影響極小。若日後要還原書法字體，改用 woff2 subset。

## 斷點
Tailwind 預設（sm640/md768/lg1024/xl1280）≈ 舊自訂斷點，幾乎無需調整。

## 圖片資產
舊 `~/Upload/{Branchs|Categorys|Questions}` 與 `~/Content/images` → 動態圖改走 Blob URL（[infrastructure.md](infrastructure.md)）；靜態裝飾圖放各 SPA `public/`。
- **已複製到 `web-customer/public/`**（全部取自舊 `Content/images/`）：`favicon.ico`、`images/logo.jpg`(+2x)、`images/online/*`（含登入 `in-pro.jpg`、科別卡 `*-clinic-*.jpg` 等全套）、`images/sprite/*`（Line/看診進度/關閉/側欄箭頭等 icon）、`images/sprite.png`(+2x)、`images/arrow_select.png`。
- 側欄 Line/看診進度/關閉鈕/展開箭頭改用 `images/sprite/icon_*.png`（對應舊 sprite background）。
- 分院/項目卡圖（`Branch.photo` / `Category.photo`）舊系統為 `~/Upload/` **動態上傳檔，不在 repo**；前端以 `[src]="photo"` 綁定，Blob URL 串接後即顯示，未提供時卡片以名稱遮罩呈現。

## 對應舊系統
[old/design/visual-design.md](../old/design/visual-design.md)、`reference/old/20Skin/Content/`、`reference/old/20SkinBackend/Content/`。
