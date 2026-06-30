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
last_updated: 2026-06-30
status: draft
---

> 適用客戶前台與後台兩個獨立 Angular 專案。

## 核心慣例

- **Standalone components**（無 NgModule）；`app.config.ts` 註冊 providers。
- **Signals 優先**：元件狀態用 `signal()`/`computed()`/`effect()`；跨頁共享狀態用 `signalStore`（`providedIn: 'root'`）。避免在新程式碼用 Subject/BehaviorSubject 管 UI 狀態（HTTP 仍可用 Observable）。
- **Reactive Forms**（非 template-driven）；驗證集中於 form group，自訂 validator 放 `shared/validators`。
- **Control flow**：用 `@if`/`@for`/`@switch`（新語法），`@for` 必帶 `track`。
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

## 安全
- token 存取集中於 `AuthService`；不在多處讀 localStorage。
- 不在前端放業務規則（容量/重複/編號/權限真相皆由 API 決定）；guard/`perms` 僅體驗層。

## Lint / 格式
ESLint（angular-eslint）+ Prettier；CI 阻擋未過 lint。
