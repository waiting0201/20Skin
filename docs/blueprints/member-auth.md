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
keywords: [member, auth, login, register, jwt, recaptcha, blacklist]
last_updated: 2026-06-30
---

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
- `is_first_visit` 由登入回傳供前端流程使用。

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
