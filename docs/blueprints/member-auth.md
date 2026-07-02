---
title: 會員認證（登入 / 加入會員）
purpose: 會員以身分證+生日登入並簽發 JWT、新會員建檔、黑名單與 reCAPTCHA 防護
status: draft
applicable_when: 要實作或修改會員登入、註冊、JWT 簽發、黑名單檢查時
related_agents:
  - software-architect-blueprint
  - backend-engineer
  - frontend-architect
related_docs:
  - ../design/security.md
  - ../design/frontend-customer.md
  - ../design/api-design.md
  - ../design/database-design.md
keywords: [member, auth, login, register, jwt, recaptcha, blacklist, joinus, zipcode]
last_updated: 2026-07-02
---

## 實作狀態

- **登入**（2026-06-30 完成）：`POST /api/auth/member/login`（身分證+生日→ 1/2/3 分支 → 簽 JWT）。
- **初診註冊 JoinUs**（2026-07-01 完成，真實 DB 端對端驗證）：
  - 後端 `POST /api/auth/member/register`（reCAPTCHA→ 驗證身分證/手機/生日格式 → `MemberService.RegisterAsync` → 簽 JWT 直接登入態）；`GET /api/zipcodes`（城市→區→ZipcodeID，公開）。
  - `RegisterAsync`：**身分證+生日已存在 → 回既有會員不重複建檔**（沿用舊 JoinUs）；否則 INSERT `Members`。身分證轉大寫；`Allergy`/`MedicalHistory` 多選存 **CSV**（`string.Join(",")`）；`Createdate` 台灣時間；`IsBlackList=false`。
  - 前端 `JoinUsComponent`（`/join-us`，公開路由）：Reactive Forms（姓名/身分證/手機/民國年生日/性別/血型/email/緊急聯絡人）＋ signals（城市→區連動、過敏史/病史多選＋「其他」自填）。登入查無時帶入身分證+生日（query）。成功即登入態 → 導 `/`。舊 `/MainMs/JoinUs` redirect 到 `/join-us`。
  - 選項值（沿用舊）：血型 O/A/B/AB/NO(不清楚)；性別 1男/2女；過敏史 無/磺胺劑/青黴素/Pyrine匹林類/其他；病史 無/糖尿病/高血壓/其他。
  - **實測**（測試身分證建檔 → 驗欄位/CSV/大寫 → `/me` → 同證登入 status 1 → 重複註冊不產生 dup → 格式負向 → 硬刪零殘留）全通過；`dotnet build` 0 warn、`ng build` 通過。
- **reCAPTCHA v3 前端（2026-07-01 完成）**：`RecaptchaService` 動態載入 script，登入/註冊 `execute('login')` 取 token 附於請求；dev（site key 空）→ 空 token + 後端 secret 空放行。以 mock grecaptcha 驗證 token 確實流入登入/註冊請求。
- **初診/複診麵包屑（2026-07-02 完成）**：`LoginResult.IsFirstVisit`（登入固定 `false`＝複診；註冊依 `MemberService.RegisterAsync` 的 `IsNew` 判斷，沿用舊 `Reserve.UpdateVisit`）。前端 `AuthService` 存 `localStorage`（`skin_first_visit`，隨 `logout()` 一併清除）並暴露 `visitTitle()` computed（'初診'/'複診'/空字串）；`ClinicComponent`/`CategoryComponent`/`AppointmentFormComponent` 的 `.stitle-choose` 麵包屑補回前綴（對應舊 `Clinic.cshtml`/`Category.cshtml`/`AppointmentForm.cshtml` 的 `@ViewBag.VisitTitle`）。
- **未做**：登入 rate-limit；refresh token 持久化（待 schema 核准）。

## 背景與動機
客戶端預約的入口。沿用舊系統「身分證+生日」無密碼登入（需求 7），但改以 JWT 取代 Session。

## 範圍
### 做什麼
- 會員登入：身分證+生日+reCAPTCHA → 驗證 `Members` → 簽發 JWT（role=member）。
- 三分支：成功(1) / 查無→導註冊(2) / 黑名單(3)。
- 新會員建檔（初診表單）→ 建 `Members` → 簽發 JWT。
### 不做什麼
- 不加密碼/OTP（保留舊行為；OTP 列未來選項，見 [security.md](../design/security.md)）。
- 不改 `Members` schema。

## 使用者流程
```
/login → 身分證+生日(民國年三選單)+reCAPTCHA → POST /api/auth/member/login
  ├ 成功 → 存 JWT → 導預約首頁(或預約查詢)
  ├ 查無 → 導 /join-us(帶身分證+生日) → 填表 → POST /api/auth/member/register → JWT
  └ IsBlackList → 顯示封鎖訊息
```

## 設計決策
- **憑證沿用身分證+生日**：相容營運中 DB 與既有病患習慣；以 reCAPTCHA(後端驗 score>0.5) + 登入 rate-limit 緩解枚舉。
- **JWT 短效**（如 1h）+ refresh（狀態存 reused DB 之外，見 [security.md](../design/security.md)）。
- `IsFirstVisit` 由登入/註冊回傳供前端流程使用（見「初診/複診麵包屑」）。

## 跨層影響
| 層級 | 影響 | 摘要 |
|---|---|---|
| 視覺 | 否 | 沿用登入/註冊外觀（Tailwind 重現） |
| 前端 | 是 | LoginComponent / JoinUsComponent + AuthService + interceptor + guard |
| 後端 | 是 | AuthController + MemberService；reCAPTCHA 驗證 |
| API | 是 | `/api/auth/member/login`、`/register`、`/refresh`、`/me` |
| 資料庫 | 否 | 讀寫既有 `Members`（不改 schema） |
| 安全 | 是 | JWT、rate-limit、reCAPTCHA、黑名單 |

## 驗收標準
- [ ] 三分支正確（成功/新客/黑名單）
- [ ] reCAPTCHA 後端確實驗證
- [ ] JWT 內含 `sub=MemberID`、`role=member`、過期
- [ ] 註冊後直接登入態
- [ ] 通過 [code-review](../workflows/code-review.md) / [qa-testing](../workflows/qa-testing.md)

## 風險與未解問題
- 身分證+生日強度低（已知，需求要求保留）。
- refresh token 儲存方案需定（Table/Redis/無狀態）。

## 對應舊系統
- [old/design/security.md](../old/design/security.md) 登入流程；[old/design/frontend-customer.md](../old/design/frontend-customer.md)
- `reference/old/20Skin/Controllers/MainMsController.cs`（Login/JoinUs）、`Commons/Reservation.cs`
