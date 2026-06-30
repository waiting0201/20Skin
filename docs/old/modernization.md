---
title: 舊系統重建必修清單（給新系統規劃）
purpose: 彙整舊系統的安全 / 架構 / 資料 / 維運技術債與對應的現代化建議，作為新系統規劃時的「必修 / 必避」清單
applicable_when: 規劃新系統架構、技術選型、資料遷移、或排定重建優先序時
related_agents:
  - software-architect-blueprint
  - system-analyst
  - backend-engineer
related_docs:
  - README.md
  - architecture.md
  - gotchas.md
  - design/security.md
  - ../status.md
keywords: [modernization, migration, tech-debt, rebuild, 重建, 遷移, 現代化, 優先序]
last_updated: 2026-06-30
status: reference-only
---

# 舊系統重建必修清單（給新系統規劃）

> 從 [gotchas.md](gotchas.md)、[architecture.md](architecture.md)、[design/security.md](design/security.md) 彙整，按優先序排列。新系統規劃時逐項對照：哪些是必修（不可帶進新系統）、哪些是必須保留的業務行為。

## P0 — 安全（重建前必解，絕不可帶進新系統）

| # | 舊系統問題 | 新系統做法 |
|---|---|---|
| S1 | 後台 `Admins.Password` 明文（nvarchar(20)）、`ValidateUser` 明文比對 | bcrypt / Argon2 雜湊，欄位 ≥ 60 |
| S2 | 超管帳密硬編碼於原始碼（`weypro`/`weypro12ab`） | 移除硬編碼；改 seed + 雜湊 + 強制改密 |
| S3 | 會員無密碼（身分證+生日即憑證） | OTP / 密碼 / 第三方登入；個資不可當唯一憑證 |
| S4 | DB 連線用 `sa` + 明文密碼於 Web.config | 最小權限帳號（datareader/datawriter）；機密進 Key Vault / Secrets |
| S5 | SMS / reCAPTCHA / Web API 金鑰硬編碼（Controller / Libs） | 全部移至設定中心 / 環境變數 |
| S6 | SMS 走 HTTP 且 `ServerCertificateValidationCallback` 停用憑證驗證 | 全面 HTTPS、啟用 TLS 憑證驗證 |
| S7 | `/MainMs/CheckSms` 端點無認證，任何人可觸發批次簡訊 | 內部排程 / 簽章 token / IP 白名單 |
| S8 | IDOR：預約詳情 / 取消未驗證歸屬 | 所有資源查詢綁定當前使用者 |
| S9 | reCAPTCHA 後台載入卻未驗證、`customErrors=Off` 洩漏堆疊 | 確實驗證 token；prod 關閉詳細錯誤 |

## P1 — 架構

| # | 舊系統問題 | 新系統做法 |
|---|---|---|
| A1 | .NET Framework 4.8（停止功能更新） | .NET 8/9 + ASP.NET Core |
| A2 | EF6 Database-First edmx（不支援 .NET Core） | EF Core Code-First + Migrations |
| A3 | 無 DI 容器，Controller 直接 `new` Service | 內建 DI，註冊生命週期 |
| A4 | 業務邏輯散在 Controller（容量檢查 / 自動編號） | 下沉 Service / Domain 層 |
| A5 | 後台 5 組排班 / 3 組預約 / 5 套時段大量重複（差異僅 BranchID/Clinic） | 參數化通用 Controller / 路由（`/shift/{branch}/{clinic}`） |
| A6 | 分院 BranchID GUID + Clinic 字串硬編碼散落各處 | 設定 / 資料驅動，移除硬編碼 |
| A7 | 無 Unit of Work（靠共用 DbContext 建構子）、`BaseService.Dispose()` 遞迴 bug | EF Core DbContext + Transaction / UoW |
| A8 | 授權靠 `Lims.Key.Contains` 字串比對（改名即破） | 宣告式 `[Authorize(Policy)]` + 明確權限映射 |

## P1 — 資料完整性

| # | 舊系統問題 | 新系統做法 |
|---|---|---|
| D1 | 缺 FK：`MemberQuestionAnswers→QuestionAnswers`、`Zipcodes` 無縣市表 | 補齊 FK / 參照表 |
| D2 | `Members.Allergy/MedicalHistory` 以 CSV 字串存多選 | 正規化成關聯表 |
| D3 | 重複預約防護只在應用層，DB 無唯一約束 | DB 唯一約束 + 交易隔離防超賣 |
| D4 | 全系統無 soft delete（問卷除外）、多數表無 audit 欄位 | soft delete + CreatedAt/UpdatedAt 稽核 |
| D5 | 列舉值散在 code（Status/BranchType/Gender/OptionType） | 強型別 enum + DB 對照或 check constraint |
| D6 | `SmsStatus.SmsBody` 用 ntext、時間戳命名大小寫不一致 | nvarchar(max)；統一 `CreatedAt`/`UpdatedAt` |

## P2 — 效能 / 維運

| # | 舊系統問題 | 新系統做法 |
|---|---|---|
| O1 | 後台每請求呼叫 `GetLims()`（自關聯 Eager Load）無快取 | 權限選單快取 |
| O2 | 唯讀查詢未用 `AsNoTracking()`、Service 全同步 | `AsNoTracking` + async/await |
| O3 | 前台選日期用 `$.ajaxSetup({async:false})` 阻塞 UI | 非同步 + 載入狀態 |
| O4 | Session 當預約狀態機，無法水平擴展 | 無狀態 API / 前端狀態 / 分散式 Session |
| O5 | 排程靠 Console + 外部觸發 HTTP，無重試告警 | Hosted Service / Hangfire / Function + 重試 |
| O6 | 匯出用 NPOI `.xls`（65536 列上限） | `.xlsx`（XSSF）或 ClosedXML |
| O7 | 無結構化 log / 監控 / traceId、無 CI/CD、無環境分離 | Serilog + APM；CI/CD；dev/staging/prod |
| O8 | 時區硬編碼 `AddHours(8/9)`（且不一致） | `TimeZoneInfo` 或統一存 UTC |

## 必須保留的業務行為（不要在重建時弄丟）

- 多分院 × 多診別（健保 / 醫美 / 牙科）矩陣與各院差異化規則
- 台中院皮膚科「自動門診號碼」（從 StartNumber 起每次 +2 取偶數）
- 預約日前一天的提醒簡訊；取消時同步標記未發簡訊為 CANCEL
- 重複預約限制（台中：前後 2 天內同科不可重複；其他：當天不可重複）
- 排班 → 號碼段 → 容量（`RosterPeriods.Patients` 覆蓋 `Periods.Patients`）的計算邏輯
- 科別問卷（`IsQuestion`）在預約前強制填寫
- 未報到 3 次列入黑名單（`IsBlackList`）
- 生日三段下拉（民國年顯示）以服務年長使用者、相容 Line/FB in-app browser
