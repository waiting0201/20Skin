---
title: 前端編碼風格（Angular）
purpose: 規範兩個 Angular SPA 的編碼慣例：standalone、signals、Reactive Forms、HttpInterceptor、route guard、Tailwind 用法
applicable_when: 寫或審查 Angular 程式碼、建立元件/服務/狀態、設定 lint 時
related_agents:
  - frontend-architect
  - code-review-optimizer
related_docs:
  - frontend-customer.md
  - frontend-backend.md
  - visual-design.md
keywords: [coding-style, angular, signals, standalone, reactive-forms, interceptor, tailwind, lint]
last_updated: 2026-07-03
status: draft
---

> 適用客戶前台與後台兩個獨立 Angular 專案。

## 核心慣例

- **Standalone components**（無 NgModule）；`app.config.ts` 註冊 providers。
- **Signals 優先**：元件狀態用 `signal()`/`computed()`/`effect()`；跨頁共享狀態用 `signalStore`（`providedIn: 'root'`）。避免在新程式碼用 Subject/BehaviorSubject 管 UI 狀態（HTTP 仍可用 Observable）。
- **Reactive Forms**（非 template-driven）；驗證集中於 form group，自訂 validator 放 `shared/validators`。
- **Control flow**：用 `@if`/`@for`/`@switch`（新語法），`@for` 必帶 `track`。
- **動態選項的 `<select>` 預帶入既有值**：選項來自 async 資料（如 API 查回的城市/區清單）且需要預選一個既有值（編輯頁常見）時，**不可與「表單第一次掛載」同一輪 render 就設值**——會有 Angular 樣板指令依宣告順序執行（先設父元素屬性、才建子節點 `<option>`）導致的賦值失敗且不會自我修正的問題，詳見 [gotchas.md](../gotchas.md) §動態選項 `<select>` 首次渲染即帶入既有值。務必用瀏覽器（Playwright）實際檢查 `<select>.value`/`<option selected>`，光看訊號值或型別檢查看不出來。
- **HTTP**：service 封裝呼叫，回 `Observable`；`authInterceptor` 統一加 Bearer，`errorInterceptor` 統一處理 401/錯誤。
- **Route guard**：`CanActivateFn`（function guard）；客戶端驗 token，後台驗 `perms`。
- **DI**：`inject()` 函式注入優先。
- **型別**：嚴格 `strict: true`；API DTO 定義 interface（對應 [api-design.md](api-design.md)）。

## 結構（每個 SPA）

```
src/app/
  core/        guards/ interceptors/ services/
  shared/      components/ validators/ pipes/
  pages/ 或 features/   各頁面/模組
  store/       signal stores
  app.routes.ts  app.config.ts  app.component.ts
src/assets/    靜態圖
src/styles/    Tailwind entry + 少量自訂
environments/  environment(.prod).ts（API base、reCAPTCHA site key）
```

## Tailwind
- utility-first；重複樣式抽 `@apply` 或共用 component class（見 [visual-design.md](visual-design.md) 對應表）。
- 不引入 Bootstrap/SmartAdmin。
- **欄位多的編輯表單不可每欄獨占一整列**（使用者回饋「表單設計不要太浪費空間，不然會一直往下延伸」，2026-07-03 定案）：短欄位（手機/生日/姓名/性別/血型/Email/緊急聯絡人等，非長文字/多選）用 `grid grid-cols-1 sm:grid-cols-3 gap-4` 每列塞 2–3 欄；只有本來就需要較寬的欄位（地址、多選 checkbox 群組、textarea）才獨占一列。範例：`pages/member/member-form.ts`（12 個欄位從單欄堆疊改成 3 欄 grid 後，表單高度從需捲動大幅縮短為單一螢幕可見，已用 Playwright 截圖驗證）。此規則適用於**未來新增/修改的多欄位表單**；既有欄位少（3–4 個）的表單（branch-form/category-form/period-form/admin-form/roster-form）本來就短，非本次範圍，暫不回溯調整。

## 安全
- token 存取集中於 `AuthService`；不在多處讀 localStorage。
- 不在前端放業務規則（容量/重複/編號/權限真相皆由 API 決定）；guard/`perms` 僅體驗層。

## Lint / 格式
ESLint（angular-eslint）+ Prettier；CI 阻擋未過 lint。
