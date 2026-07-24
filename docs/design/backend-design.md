---
title: 後端設計（Azure Functions .NET 10）
purpose: 規範 API 的專案結構、自訂 router 實作、Controller/Service/Domain 分層、Dapper 資料層與必保留業務邏輯的落點
applicable_when: 要實作或修改 API 後端、決定邏輯放哪一層、設計 Service、處理交易與例外時
related_agents:
  - backend-engineer
related_docs:
  - api-design.md
  - database-design.md
  - security.md
  - ../old/architecture.md
  - ../old/modernization.md
keywords: [backend, azure-functions, dotnet10, custom-router, service, domain, ef-core, di]
last_updated: 2026-07-24
status: draft
---

> 舊服務層（BaseService/GenericRepository/IResult）見 [old/architecture.md](../old/architecture.md) §服務層。新系統不沿用其反模式（見 [old/modernization.md](../old/modernization.md)）。

## 技術棧

.NET 10 · Azure Functions isolated worker · **Dapper** + `Microsoft.Data.SqlClient`（資料存取）· `Microsoft.Extensions.DependencyInjection` · JWT（`Microsoft.IdentityModel.*`）· FluentValidation · Serilog · Azure SDK（Blob / Key Vault）。

## 專案結構

```
20Skin.Api/                  # Azure Functions host
  Program.cs                 # DI、router、middleware 註冊
  HttpRouterTrigger.cs       # 單一 catch-all HttpTrigger
  Functions/SmsReminderTimerFunction.cs  # 每日 08:00 簡訊排程（取代舊 CheckSms console/公開端點）
  Router/                    # 路由表建構、model binding、middleware
  Controllers/               # 各功能 controller（attribute routing）
20Skin.Core/                 # DTO（Requests/Responses）、Constants（移自 Definition.cs）、列舉
20Skin.Services/             # 業務服務 + Domain services（容量/編號/重複/簡訊）
20Skin.Data/                 # IDbConnectionFactory + Entities/（POCO，Dapper 對應）
20Skin.Auth/                 # JwtTokenProvider、權限判定
20Skin.Infrastructure/       # Blob、SMS client、reCAPTCHA、Key Vault
20Skin.Tests/                # 單元/整合測試
```

## 分層職責

| 層 | 規則 |
|---|---|
| Controller | 薄；只做 DTO 進出、呼叫 Service；不放業務規則；不直接碰連線/SQL |
| Service | 跨表業務、交易邊界（`BeginTransaction`/`SaveChanges`）、呼叫 Domain service |
| Domain service | 純業務規則、可單元測試、無 I/O（容量計算、自動編號、重複規則、簡訊內容組裝） |
| Data | `IDbConnectionFactory` 開連線；Dapper 參數化 SQL（POCO 對應）；交易用 `IDbTransaction` |
| Infrastructure | 外部整合封裝（介面化以利測試/替換） |

## 自訂 router 實作要點

- 啟動時反射掃描 `Controllers/` 建路由表（method + path template → MethodInfo），快取。
- catch-all HttpTrigger 取 `req.Method` + path → 比對 → model binding → middleware → invoke。
- middleware 順序：CORS → JWT 驗證 → Authorization → Validation → Action → 回應/例外。
- 回應統一 `ApiResponse<T>`；例外經全域 handler → `ProblemDetails`（見 [api-design.md](api-design.md)）。
- DI：所有 Service/連線工廠/Infra 介面在 `Program.cs` 註冊；Controller 建構子注入（取代舊 `new`）。

## 必保留業務邏輯落點（Domain services）

| Domain service | 邏輯 | 規格 |
|---|---|---|
| `AppointmentDomain` | 容量檢查（`RosterPeriods.Patients ?? Periods.Patients` vs `COUNT(Status=1)`）、自動門診號（+2 偶數）、重複限制（依 Branch 規則，移除硬編碼 GUID 改設定/DB 驅動） | [blueprints/customer-booking.md](../blueprints/customer-booking.md) |
| `SmsDomain` | 簡訊內容組裝（純邏輯、可測；6 種逐字模板：診別 Skin/Cosmetic/Dentist × 配號 by `outpatientNum is not null`，一字不差照舊系統）。發送由 `ISmsSender`（`ChiefTelSmsSender` 智邦／`DevNoOpSmsSender`）＋ `SmsService`（Timer 撈當日待發）協調；雙寫/取消 CANCEL 在 `AppointmentService` | [blueprints/sms-reminder.md](../blueprints/sms-reminder.md) |
| `AuthorizationDomain` | Lims/AdminLims → 權限判定（給 JWT claims 與 API 授權用） | [security.md](security.md) |
| `RosterDomain` | 重複排班展開（每日/每週 + ExpireDate）、RosterPeriods 容量覆蓋 | [blueprints/admin-roster.md](../blueprints/admin-roster.md) |

## 交易與並發

- 預約建立：在 Service 內以 transaction 包「容量檢查 + INSERT + SmsStatus 雙寫」；以適當 isolation 或重試降低超賣（不可加 unique constraint）。
- 取消：transaction 包「Status=0 + 未發 SMS 標記 CANCEL」。

## 錯誤處理與 log

- 全域例外 middleware → `ProblemDetails`；不再用舊的「Service 吞例外回 IResult」。
- Serilog 結構化 log + Application Insights；敏感資料（密碼/金鑰/token）不記。

## 時區

統一以 `TimeZoneInfo`（`Taipei Standard Time`）或一律存 UTC、顯示轉 +8；移除舊散落的 `AddHours(8/9)`（見 [old/gotchas.md](../old/gotchas.md) 時區段）。

## 待 schema 核准的後續項
- 移除 `BaseService.Dispose()` 遞迴 bug：新系統不沿用該類別，自然消除。
- 密碼雜湊、refresh token 表、補 FK、audit 欄位：見 [security.md](security.md) / [database-design.md](database-design.md)。
