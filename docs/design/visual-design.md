---
title: 視覺設計（客戶前台視覺不改 + 後台企業識別品牌 token）
purpose: 規範「視覺不改」原則下，客戶前台直接載入舊 main.css 原檔；後台改採承接客戶前台的企業識別品牌 token（取代初版 SmartAdmin 通用重現）的策略與決策紀錄
applicable_when: 要修改客戶前台視覺策略、或修改後台 design token / 頁面配色時
related_agents:
  - visual-design-architect
  - frontend-architect
related_docs:
  - frontend-customer.md
  - frontend-backend.md
  - ../old/design/visual-design.md
keywords: [visual, design, tailwind, smartadmin, main.css, 視覺不改, 品牌識別, brand token]
last_updated: 2026-07-03
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

## 後台視覺策略（2026-07-03 決策，取代舊「SmartAdmin → Tailwind」通用重現）

**策略：後台改採企業識別（承接客戶前台品牌色），不再重現 SmartAdmin 通用樣板配色**

- **理由**：初版後台以 Tailwind 重現 SmartAdmin 外觀（深灰側欄 `#31353d`、teal-600 按鈕、blue-600 連結），視覺與品牌無關、與客戶前台（`web-customer`，品牌深藍 `#00538d`）不一致。使用者裁示：後台應與客戶前台共用同一套企業識別（品牌深藍 emblem「20 SKIN」logo），而非通用管理後台配色。
- **做法**：`web-admin/src/styles.css` 新增 `@theme` design token（見下表），取代所有 `teal-*`/`blue-600`/`gray-{300,400,500,600,700,800,900}` 等通用色 class；全站頁面（layout、login、dashboard、authority/basic/roster 各 CRUD 頁）逐一替換。
- **範圍**：`admin-layout.ts`（側欄/Ribbon 麵包屑）、`login.html`、`dashboard.ts`、`forbidden.ts`、`coming-soon.ts`、`authority/*`、`basic/*`（branches/categories/doctors/periods/question-types/questions）、`roster/*` 全數套用，已於 2026-07-03 完成（`ng build` 0 error）。
- **保留不換**：功能語意色維持原樣——刪除/錯誤 `text-red-500`/`text-red-400`、啟用狀態 `text-green-600`、超級管理員徽章 `bg-amber-100 text-amber-700`、排班「已跳過日期」提示 `text-amber-600`。

### 後台 design token（`web-admin/src/styles.css` `@theme`，已落地）

| token | 值 | 用途 | Tailwind 用法 |
|---|---|---|---|
| `--color-brand` | `#00538d` | 品牌主色（同客戶前台），按鈕/連結/active 狀態 | `bg-brand` / `text-brand` / `border-brand` |
| `--color-brand-deep` | `#013f6b` | 側欄底色 / 主要按鈕 hover 深色 | `bg-brand-deep` / `hover:bg-brand-deep` |
| `--color-brand-deeper` | `#012b4a` | 側欄品牌列底色 / 登入頁背景 | `bg-brand-deeper` |
| `--color-brand-tint` | `#eaf2f8` | 選中/hover 淺色底（保留給未來用途） | `bg-brand-tint` |
| `--color-ink` | `#333333` | 主要內文/標題（取代 `text-gray-700`/`800`） | `text-ink` |
| `--color-muted` | `#7c8796` | 次要文字/圖示/table 表頭（取代 `text-gray-400/500/600`，含淡色 `text-gray-300` 裝飾圖示） | `text-muted` |
| `--color-line` | `#798593` | 次要分隔線（保留給未來用途） | `border-line` |
| `--color-hairline` | `#e5e5e5` | 表格列/卡片/input 邊框（取代 `border-gray-{50,100,200,300}`） | `border-hairline` |
| `--color-surface` | `#f5f7f9` | 表頭/次要底色（取代 `bg-gray-50`/`bg-gray-100`） | `bg-surface` |

- 次要深色按鈕（如各列表頁「儲存排序」）改 `bg-ink hover:bg-black`（取代舊 `bg-gray-700 hover:bg-gray-800`）。
- 所有可編輯 input/select/textarea 統一補 `focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand`（比照 `login.html`），取代無 focus 樣式的舊版本。
- 值同步取自 `web-customer` 量測色（`--color-brand`/`--color-ink`/`--color-muted`/`--color-hairline` 分別對應客戶前台 `skin-blue`/`skin-ink`/`skin-gray`/`skin-border`），確保兩 SPA 企業識別一致。

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
