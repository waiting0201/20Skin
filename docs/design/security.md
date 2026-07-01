---
title: 安全機制（JWT 認證授權）
purpose: 規範新系統的 JWT 認證（會員/管理員）、claims 設計、授權取代 Lims/AdminLims 字串比對、以及 schema 不可改造成的密碼/refresh-token 限制與緩解
applicable_when: 要實作登入/授權、設計 JWT claims、寫 route guard 或 API 授權、處理權限或安全議題時
related_agents:
  - backend-engineer
  - code-review-optimizer
related_docs:
  - api-design.md
  - backend-design.md
  - database-design.md
  - ../old/design/security.md
  - ../old/modernization.md
keywords: [security, jwt, auth, authorization, claims, lims, recaptcha, refresh-token]
last_updated: 2026-07-01
status: draft
---

> 舊 Session + CheckSession 授權演算法見 [old/design/security.md](../old/design/security.md)。新系統改 JWT。

## 認證總覽

| 端 | 憑證 | 簽發 | 對應舊系統 |
|---|---|---|---|
| 客戶（會員） | **身分證字號 + 生日**（沿用，需求 7）+ reCAPTCHA v3 | 驗證 `Members.Number + Birthday` 成功 → JWT（role=member） | `MainMsController.Login`（無密碼） |
| 後台（管理員） | **帳號 + 密碼** + reCAPTCHA v3（新增） | 驗證 `Admins.Username + Password` 成功 → JWT（role=admin，帶權限） | `MainController.Login` |

- 全面 **HTTPS**；登入加 **rate-limit** 與帳號鎖定。
- reCAPTCHA：**後端確實驗證** token（score > 0.5），修正舊系統「載入卻未驗」。

## JWT 設計

### 會員 token（claims）
```jsonc
{ "sub": "<MemberID>", "role": "member", "name": "...", "is_first_visit": false,
  "iat": ..., "exp": ...(短效, e.g. 1h), "iss": "20skin", "aud": "20skin-client" }
```

### 管理員 token（claims）
```jsonc
{ "sub": "<AdminID>", "role": "admin", "username": "...", "name": "...",
  "is_super_admin": false,            // 對應舊 weypro，過渡用
  "perms": [                           // 由 Lims+AdminLims 攤平
    { "key": "TaAppointments", "module": "Reserve", "add": true, "update": true, "delete": false },
    ...
  ],
  "iat": ..., "exp": ..., "iss": "20skin", "aud": "20skin-admin" }
```

- `perms` 由 `AuthorizationDomain.Flatten`（`Skin.Services/Admin/`）在登入時把 `Lims`(樹) + `AdminLims`(IsAdd/IsUpdate/IsDelete) 攤平寫入。
- token 過大時可只放權限摘要，細項由 `/api/auth/me` 補；視 claims 大小決定。

> **實作細節（Done 2026-07-01）**：JWT claim 值皆為字串，故 `is_super_admin` 存 `"true"`/`"false"`、`perms` 存 **JSON 字串**（`JsonSerializer.Serialize`）。前端 `auth.service` 對 `perms` 做 `JSON.parse`、`is_super_admin` 容錯 `true`/`'true'`（避開 JWT 陣列 claim 序列化陷阱）。`ClaimTypes.Name` 在 payload 為長 URI，前端以該 key 讀取。

## 授權（取代 CheckSession 字串比對）

| 層 | 機制 |
|---|---|
| API（後台功能） | 自訂 router 依 `perms` 比對「資源 key + 操作(add/update/delete/read)」；`is_super_admin` 直接放行；取代舊 `Lims.Key.Contains` 脆弱比對。**實作**：`[Authorize(Roles.Admin, Resource="Admins", Op="update")]`（`Routing/Attributes.cs`）+ `ApiRouterFunction.HasPermission`（讀 JWT `perms` claim）。read 只需該資源有列即可（對應舊「有 AdminLims 列即可見/可讀」）。 |
| API（會員資源） | 一律加**歸屬檢查**（`Appointment.MemberID == sub`），**修正舊 IDOR** |
| 前端 route guard | 客戶：有無有效 token；後台：依 `perms` 控制可見選單與可進頁面（見 [frontend-backend.md](frontend-backend.md)） |

> 授權的**真相在 API**；前端 guard 只是體驗，不能當安全邊界。

## schema 不可改造成的限制與緩解（重要）

| 項目 | 限制 | 現階段做法 | 待核准後續項 |
|---|---|---|---|
| 管理員密碼雜湊 | `Admins.Password` nvarchar(20) 放不下 bcrypt（60+） | 沿用既有密碼比對（與舊系統相容）；以 HTTPS + rate-limit + reCAPTCHA + 帳號鎖定 緩解 | 加長欄位或加 `PasswordHash` 欄位後改 bcrypt/Argon2 |
| refresh token | 不可在 20Skin DB 加表 | refresh 狀態存**reused DB 之外**（Functions Storage account / Azure Table / Redis）；或短效 access token + 重新登入的無狀態策略 | 若要 DB 持久化需加表 |
| 會員認證強度 | 身分證+生日即憑證（弱），但需求要沿用 | 保留；以 reCAPTCHA + rate-limit 緩解暴力枚舉 | 未來可加 OTP（需流程/簡訊成本評估） |
| 補 FK / audit | `MemberQuestionAnswers` 無 FK、缺稽核欄位 | 應用層 join 與記錄 | schema 變更 |

## 機密管理

DB 連線字串、SMS API key/帳密、reCAPTCHA secret、JWT 簽章金鑰、Blob 連線 → **Azure Key Vault / App Settings**，移除舊硬編碼（`SmsHandler`/`Definition.cs`/Web.config）。見 [infrastructure.md](infrastructure.md)。

## 超管處理（weypro）

舊硬編碼 `weypro/weypro12ab`。新系統（**Done 2026-07-01**）：移除原始碼硬編碼，改**設定驅動** `SuperAdmin:Username` / `SuperAdmin:Password`（`Auth/SuperAdminOptions`，來源 local.settings / 正式經 Key Vault；未設定則停用超管登入），命中則 `is_super_admin=true` 全放行。過渡後可改為純 DB 全權限帳號 + `perms` 判定並廢棄旗標。

## 安全檢查清單（新系統）
- [ ] HTTPS-only、HSTS
- [ ] 登入 rate-limit + 帳號鎖定 + reCAPTCHA 後端驗證
- [ ] 所有會員資源端點加歸屬檢查（IDOR）
- [ ] CORS 明確白名單（兩 SPA 來源）
- [ ] 機密全進 Key Vault，原始碼/設定無明文
- [ ] prod 關閉詳細錯誤（ProblemDetails）
- [ ] log 不含敏感資料
