---
title: 視覺設計
purpose: 描述 20Skin 兩套設計語言（C 端自訂 / B 端 SmartAdmin）並存的現況，並列出共通的字體 / 色彩 / 語系約定
applicable_when: 要新增 UI 元素、要決定該套用哪套設計語言、要修共用樣式
related_agents:
  - visual-design-architect
related_docs:
  - frontend-customer.md
  - frontend-backend.md
  - ../blueprints/customer-booking.md
keywords: [visual, design, ui, theme, smartadmin, bootstrap, typography, branding]
last_updated: 2026-05-26
---

## 兩套設計語言並存

| 載體 | 設計風格 | 來源 |
|---|---|---|
| 客戶前台 `20Skin/` | **自訂 / 簡潔現代** | `Content/main.css`（單檔約 59KB） |
| 診所後台 `20SkinBackend/` | **企業級儀表板** | SmartAdmin theme + Bootstrap 3 |

兩端**不共用 CSS**、**不共用版型**。修一邊不會自動影響另一邊。

## 共通約定

### 語系與字體

- 全站繁體中文（`zh-Hant-TW`）
- ASP.NET MVC 5 內建繁中資源包：`Mvc.zh-Hant.resources.dll` 等
- 客戶端中文字體：`StdsungEG-Bold-Big5`、`ARStdSongB5-Light`（具體在 `main.css` 內）
- 後台中文字體：依 SmartAdmin 預設（系統字體 fallback）

### 圖標

- 客戶前台：以圖片為主，少量 inline SVG / icon font
- 後台：**Font Awesome**（`fa fa-*`）

### 圖片

- 上傳到前台靜態資源伺服器（透過 `Librarys.UploadFileToFrontend`）
- 圖片處理用 SixLabors.ImageSharp（縮圖 / 格式轉換）

## 細節分流

| 找什麼 | 看哪份 |
|---|---|
| 客戶前台色彩 / 元件 / 響應式 / 頁面結構 | [frontend-customer.md](frontend-customer.md) |
| 後台 SmartAdmin 主題、Bootstrap 3 元件、表格 / 表單規範 | [frontend-backend.md](frontend-backend.md) |
| 對接 jQuery / AJAX 慣例 | 同上兩份各自有對應段落 |

## 設計檢核清單

- [ ] 對比度通過 WCAG AA（一般文字 4.5:1、大字 3:1）
- [ ] 互動狀態完整（default / hover / focus / active / disabled）
- [ ] 中文字體 fallback 鏈完整（避免缺字時跳到系統預設）
- [ ] 圖片附 `alt` 文字（無障礙）
- [ ] 響應式斷點符合對應端的規範（見 frontend-customer / frontend-backend）

## 不在範圍

- **無** dark mode
- **無** Design Token / Design System 工具
- **無** 共用元件庫（兩端 UI 各自獨立維護）
