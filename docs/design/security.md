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
last_updated: 2026-07-03T21:00+08:00
status: draft
---

> 舊 Session + CheckSession 授權演算法見 [old/design/security.md](../old/design/security.md)。新系統改 JWT。

## 認證總覽

| 端 | 憑證 | 簽發 | 對應舊系統 |
|---|---|---|---|
| 客戶（會員） | **身分證字號 + 生日**（沿用，需求 7）+ reCAPTCHA v3 | 驗證 `Members.Number + Birthday` 成功 → JWT（role=member） | `MainMsController.Login`（無密碼） |
| 後台（管理員） | **帳號 + 密碼** + reCAPTCHA v3（新增） | 驗證 `Admins.Username + Password` 成功 → JWT（role=admin，帶權限） | `MainController.Login` |

- 全面 **HTTPS**；登入加 **rate-limit** 與帳號鎖定。
- reCAPTCHA：**後端確實驗證** token（`success` + `score ≥ MinScore` + `action == "login"`），修正舊系統「載入卻未驗」。
- **reCAPTCHA v3 前端**：`RecaptchaService` 動態載入 `google/recaptcha/api.js?render={siteKey}`，登入/註冊送出前 `grecaptcha.execute(siteKey,{action:'login'})` 取 token 附於請求。客戶前台（2026-07-01）與**後台（2026-07-03 已補上）**皆已實作，兩端各自獨立一份 `RecaptchaService`（不共用程式碼，見 [frontend-backend.md](frontend-backend.md) §不做）。
  - `environment.recaptchaSiteKey` 為空（dev 未設）→ 前端回空 token；後端 `Recaptcha:SecretKey` 為空 → 放行。**若後端 secret 已設定（如目前 local.settings.json），dev bypass 即失效，前端必須真的送 token**，否則會後端一律回 `RECAPTCHA_FAILED`（2026-07-03 修正：後台登入原本寫死送空字串 token，導致 secret 設定後每次登入必敗，已補上真實 `RecaptchaService` 呼叫）。
  - **後台 site key 決策**：後台目前沿用客戶前台同一把 site key（`web-admin/src/environments/environment.ts`），因兩端本機/測試皆用 `localhost`，Google 對 localhost 不檢查註冊網域，dev 可正常運作。**正式環境待辦**：後台部署為獨立網域（見 [infrastructure.md](infrastructure.md)），需先把該網域加入此 site key 在 Google reCAPTCHA 後台的允許網域清單，`environment.prod.ts` 才可填入 key，否則 `grecaptcha.execute` 會因網域不符被拒。
  - **後台適用範圍決策（2026-07-03，使用者確認）**：後台 reCAPTCHA **只需要在登入頁**（`POST auth/admin/login`），不需擴及後台其餘頁面/表單（CRUD、匯出等一律僅靠既有 JWT + 權限檢查把關）。此為現況即已實作的行為（`AuthController` 僅 3 個 `login`/`register` 端點呼叫 `recaptcha.VerifyAsync`，後台只涵蓋 `AdminLogin` 一支），本次為明確定案避免日後誤加到其他後台端點。
  - **`MinScore` 門檻（2026-07-03 決策）**：後端驗證邏輯（`RecaptchaVerifier`）加上失敗診斷 log 後，實測發現 Firefox 開啟隱私/防指紋保護（`privacy.resistFingerprinting` 或嚴格追蹤保護）會讓 reCAPTCHA v3 拿到的裝置訊號被打亂，導致合法人類操作也只拿到 `score≈0.3`，低於沿用舊系統的門檻 `0.5`（[old/design/security.md](../old/design/security.md) `score > 0.5`）而被拒。**決策**：正式環境維持 `0.5`（與舊系統一致，不降低防護強度）；**本機 dev 環境的 `Recaptcha:MinScore` 調降為 `0.3`**（`local.settings.json`，gitignore 排除，不影響部署設定），方便使用隱私保護瀏覽器（Firefox 等）測試時不被誤擋。**Why**：這是瀏覽器隱私功能的已知副作用，非程式邏輯錯誤；正式環境的分數分佈預期與純 dev 測試不同，維持原門檻較安全。若之後正式環境也大量出現真實使用者被誤擋，需重新評估（見 [gotchas.md](../gotchas.md) §認證/reCAPTCHA）。

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
