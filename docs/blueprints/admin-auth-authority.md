---
title: 後台認證與權限管理
purpose: 管理員帳號+密碼登入發 JWT、Lims/AdminLims 樹狀權限攤平成 claims、權限管理 CRUD、超管過渡
status: shipped
applicable_when: 要實作或修改後台登入、權限授權、管理員/權限樹維護時
related_agents:
  - software-architect-blueprint
  - backend-engineer
  - frontend-architect
related_docs:
  - ../design/security.md
  - ../design/frontend-backend.md
  - ../design/api-design.md
  - ../design/database-design.md
keywords: [admin, auth, authority, jwt, lims, adminlims, permission, super-admin]
last_updated: 2026-07-01
---

## 背景與動機
後台所有功能的入口與授權基礎。舊系統用 Session + `CheckSession` 字串比對（脆弱）。重寫改 JWT claims + route guard + API 授權。

## 範圍
### 做什麼
- 管理員登入：帳號+密碼(+reCAPTCHA) → 驗證 `Admins` → JWT（含攤平權限 `perms`）。
- 權限管理：管理員 CRUD、權限樹（`Lims`）勾選 IsAdd/IsUpdate/IsDelete（`AdminLims`）。
- 授權：API + 前端依 `perms` 控管；超管 `is_super_admin` 過渡。
### 不做什麼
- 不改 schema（密碼沿用既有比對，雜湊為延後項，見 [security.md](../design/security.md)）。

## 使用者流程
```
/login(帳號+密碼+reCAPTCHA) → /api/auth/admin/login → JWT(perms) → 後台首頁
管理權限：/authority/admins → 列表/新增/編輯(權限樹勾選)/刪除
```

## 設計決策
- **權限攤平**：登入時 `AuthorizationDomain` 把 `Lims`(樹) + `AdminLims`(三旗標) 攤平成 `perms[]` 寫入 JWT；API 與前端據此判定，取代 `Lims.Key.Contains` 字串比對。
- **授權真相在 API**；前端 guard 僅控制選單/進頁體驗（見 [frontend-backend.md](../design/frontend-backend.md)）。
- **超管**：移除硬編碼 `weypro`；改用 DB 中全權限帳號，登入帶 `is_super_admin=true`，過渡後廢旗標。
- **密碼**：沿用既有比對 + HTTPS/rate-limit/reCAPTCHA/鎖定緩解；雜湊待 schema 核准。

## 跨層影響
| 層級 | 影響 | 摘要 |
|---|---|---|
| 前端 | 是 | Login + Authority 模組 + 權限樹元件 + 權限 guard |
| 後端 | 是 | AuthController + AdminService + AuthorizationDomain |
| API | 是 | `/api/auth/admin/login`、`/api/admins`、`/api/lims` |
| 資料庫 | 否 | 讀寫既有 `Admins/Lims/AdminLims` |
| 安全 | 是 | JWT claims 授權、超管過渡、密碼緩解 |

## 驗收標準
- [x] 登入發含 `perms` 的 JWT（`perms` 以 JSON 字串 claim 承載 + `is_super_admin`）
- [x] API 依操作(add/update/delete/read)正確授權（實測 `GET 200 / PUT 403 / DELETE 403`）
- [x] 前端選單/進頁依 perms 過濾（限權管理員登入僅見「權限管理/Admins」）
- [x] 超管全放行且非硬編碼（`SuperAdmin:*` 設定驅動）
- [x] 權限樹 CRUD 正確寫 AdminLims（清空重建；只寫有旗標列，零殘留刪除驗證）

## 實作紀錄（Done 2026-07-01）

- **程式位置**：
  - API：`AuthController.AdminLogin`、`AdminController`（menu/admins CRUD/lims/check-username）、`Skin.Services/Admin/{AdminService,AuthorizationDomain}`、POCO `Skin.Data/Entities/{Admins,Lims,AdminLims}`；授權擴充於 `Routing/Attributes.cs`(`Authorize.Resource/Op`) + `ApiRouterFunction.HasPermission`；`Auth/SuperAdminOptions`。
  - 前端：`layout/admin-layout`（資料驅動選單 + SmartAdmin Tailwind 重現）、`core/services/admin-api.service`、`core/menu-route-map`、`pages/authority/{admins-list,admin-form}`、`pages/{coming-soon,forbidden}`。
- **選單忠於舊做法**：`GET /api/admin/menu` = `Lims`(二層) 依 `AdminLims` 過濾（模組層任一子項有權即顯示）；`menu-route-map` 把 `Lims.Key` 轉新路由。
- **真實 `Lims` 內容**（對真實 DB 確認，供後續模組參考）：
  - `AuthorityMs`(權限管理,fa-key) → `Admins`
  - `BasicMs`(預約設定管理,fa-cogs) → `Branchs`/`Doctors`/`QuestionTypes`/`Skins`/`Cosmetics`/`TaPeriods`/`ChPeriods`/`TaCosmeticPeriods`/`ChCosmeticPeriods`/`ChDentistPeriods`
  - `ShiftMs`(門診管理,fa-calendar) → `TaRosters`/`ChRosters`/`TaCosmeticRosters`/`ChCosmeticRosters`/`ChDentistRosters`
  - `ReserveMs`(預約管理,fa-hospital-o) → `TaAppointments`/`ChAppointments`/`ChDentistAppointments`
  - `MemberMs`(會員管理,fa-list) → `Members`
  - 註：舊系統子功能仍是 Ta/Ch/Cosmetic/Dentist **變體**；新系統以 clinic/branch **參數化** 收斂（`menu-route-map` 已把變體 key 對到同一參數化路由）。
- **讀取權語意**：`AdminLims` 無「全 false」列（新增時 all-false 略過、編輯時 all-false 刪除），故「可見/可讀」等同「至少有一個 add/update/delete」——與舊系統一致。

## 風險與未解問題
- JWT 帶完整 perms 可能過大 → 必要時改 `/me` 補細項。
- 密碼雜湊受限於 schema 不可改。

## 對應舊系統
- [old/design/security.md](../old/design/security.md)（CheckSession 演算法）、[old/blueprints/backend-admin.md](../old/blueprints/backend-admin.md)
- `reference/old/20SkinBackend/Filters/CheckSessionAttribute.cs`、`Controllers/AuthorityMsController.cs`、`MainController.cs`
