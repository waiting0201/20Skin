---
title: 簡訊提醒（雙寫 + 排程）
purpose: 預約即時確認 + 前一天提醒的簡訊雙寫、Azure Functions Timer trigger 排程發送、取消標記 CANCEL
status: in-progress
applicable_when: 要實作或修改簡訊發送、排程、取消標記、或智邦 API 整合、或簡訊文案時
related_agents:
  - software-architect-blueprint
  - backend-engineer
  - deployment-engineer
related_docs:
  - ../design/backend-design.md
  - ../design/infrastructure.md
  - ../design/api-design.md
  - customer-booking.md
keywords: [sms, reminder, timer-trigger, smsstatus, dual-write, cancel, 智邦, 文案, sms-content]
last_updated: 2026-07-24
---

## 實作紀錄（2026-07-24）

真發引擎 + Timer 排程 + 逐字文案已實作並通過真實 DB 端對端驗證；**正式環境真發總開關預設停用**，待智邦帳號驗證後開啟。

### 新增/修改檔案
- `api/Skin.Services/Sms/SmsDomain.cs`（新）— 內容組裝純邏輯，6 種逐字模板（見下）。
- `api/Skin.Services/Sms/ChiefTelSmsSender.cs`（新）— 智邦 client（HttpClient；HTTPS + 憑證驗證，不照抄舊系統停用 SSL）。
- `api/Skin.Services/Sms/SmsService.cs` + `ISmsService.cs`（新）— 撈當日待發（`CAST(SendDate AS DATE)=今日 AND Status IS NULL`）→ 送 → 回寫，供 Timer 用。
- `api/Skin.Services/Sms/SmsOptions.cs`（新）— `Enabled`（總開關）/`ApiUrl`/`ApiKey`/`Username`/`Password`。
- `api/Skin.Services/Sms/ISmsSender.cs`（改）— `SmsSendResult` 加 `RawStatus`（回寫 `SmsStatus.Status` 貼近舊系統的 `response["status"]`）。
- `api/20Skin.Api/Functions/SmsReminderTimerFunction.cs`（新）— `[TimerTrigger("0 0 8 * * *")]`＝**每日 08:00**，依 App Setting `WEBSITE_TIME_ZONE=Asia/Taipei`（function-app.bicep 已設）以台灣時間解讀；委派 `ISmsService`。
- `api/Skin.Services/Booking/AppointmentService.cs`（改）— `RosterCtx` 補撈 `Branchs.Title`/`Periods.Title`、member 查詢補 `Members.Name`；即時/前一天雙寫 body 改由 `SmsDomain.Compose` 產生（取代精簡版佔位字串）。
- `api/20Skin.Api/Program.cs`（改）— `SmsOptions` singleton；`Enabled` 為真註冊 `ChiefTelSmsSender`（`AddHttpClient`），否則 `DevNoOpSmsSender`；註冊 `ISmsService`。
- `api/20Skin.Api/_20Skin_Api.csproj`（改）— 加 `Microsoft.Azure.Functions.Worker.Extensions.Timer`。
- `api/Skin.Tests/`（新專案）— `SmsDomainTests`：6 模板逐字守門（xUnit）。
- `infra/modules/function-app.bicep`（改）— `Sms__Enabled='false'`/`Sms__ApiUrl` app setting + `Sms-ApiKey`/`Sms-Username`/`Sms-Password` KV reference。
- `api/20Skin.Api/local.settings.json`（改）— `Sms:Enabled=false` + 空帳密。

### 簡訊文案（逐字，一字不差照舊系統，客戶已定稿）
來源：`reference/old/20Skin/Controllers/MainMsController.cs:273-304`。判別：外層診別（`Skin`/`Cosmetic`/其餘=齒科），內層「配號與否」。動態欄位：`Branchs.Title`（DB 原值）/`OutpatientNum`/`AppointmentDate`（皮膚科·醫美用西元 `yyyy-MM-dd`；齒科用「N月N日」半形無前導零、無年份）/`Periods.Title`/`Members.Name`（僅齒科）。完整 6 則模板見 `SmsDomain.cs` 與 `SmsDomainTests.cs`（含 3 個易漏細節：健保配號「即時」用半形冒號 `:`＋圈碼①②③④且不含日期時段；醫美現場取號「提醒」在「】」後多一個半形空格；健保/醫美配號「即時」與「提醒」句型刻意不對稱）。

### 設計決策
- **配號判別改用 `outpatientNum is not null`**（舊系統用 branch 層 `IsAutoRowNumber`）：新系統有「台中配號／二林現場取號／台中現場取號細時段（2026-07-04 新增）」三態，用「是否配到門診號」判別對所有舊情境等價，且能安全處理台中現場取號細時段——不會誤發含空號碼的配號文案。模板文字仍逐字照舊。取代舊「台中細時段簡訊＝『請至現場取號』精簡版」，改為舊系統現場取號的完整文案。
- **Timer trigger 取代對外 CheckSms 端點**：修舊系統「公開無保護觸發端點」安全問題。台灣 08:00（開診前）。
- **真發總開關 `Sms:Enabled` + 正式先停用**：真發有成本且送真實客戶手機；正式部署後保持 no-op，智邦帳號驗證後手動開 `true`。`false` 時 Timer 早退不動任何列（待發列保持 null，日後開啟只撈當日、無 backlog 洪水）。
- **HTTPS + 憑證驗證**：不照抄舊系統 `ServerCertificateValidationCallback => true`。

### 驗證（真實本機 DB 端對端）
以真正的 `AppointmentService.CreateAsync`（非 HTTP mock）＋拋棄式排班鏈（台中健保配號，蟎蟲檢測/09:00 時段/測試會員 Tim）：建約門診號=12 → 讀回 SmsStatus 兩筆 `SmsBody` **逐字相符**、即時列回寫 SENT、前一天列 `Status=null` 待發；Timer 總開關 OFF→早退不動列、ON→處理並回寫 SENT；測試資料硬刪零殘留。`dotnet build` 0/0、`SmsDomainTests` 6/6 通過。

### 待辦（正式環境開啟前）
- **智邦帳號需洽客服**：2026-07-24 以正式帳密試發至 `0955549767`，智邦回 `Array('status' => 'NO', 'message' => '簡訊發送錯誤，請洽客服人員。')`——參數/端點/格式皆正確，是**智邦端拒絕**（最可能為帳號餘額不足/未儲值/帳號狀態）。需持 `20skin` 帳號洽智邦客服/登入後台確認可用後才能真發。
- 智邦 API **成功 token** 仍未知（本次為失敗回應，無 `uniqid`）。`ChiefTelSmsSender.Success` 目前以「有回傳 uniqid」判定（本次失敗已正確判為 false）；待帳號可用、看到成功回應後校正（成功時 `status` 值與是否帶 `uniqid`）。
- ~~確認 HTTPS~~：**已確認 `https://pp.url.com.tw/api/msg` 可用（HTTP 200）**，回應格式 `'key' => 'value'` 與解析器相容。
- Key Vault 寫入 3 個新機密：`Sms-ApiKey`/`Sms-Username`/`Sms-Password`（沿用同一智邦帳戶；值見舊系統 `reference/old/20Skin/Controllers/MainMsController.cs:306-308`）。**已於 2026-07-24 寫入正式 KV `kv-20skin-prod-lnjm`**。
- 開關切 `Sms__Enabled='true'` 前先於 staging 送測試門號驗證。
---

## 背景與動機
預約成功即時通知 + 預約前一日提醒。舊系統用 console(`CheckSms.exe`) + 外部排程 + 公開 HTTP 端點觸發（無保護）。重寫改 Azure Functions Timer trigger（內部、安全）。

## 範圍
### 做什麼
- 建立預約時**雙寫** `SmsStatus`：即時（`SendDate=now`）+ 前一天（`SendDate=預約日-1`，`Status=null` 待發）。
- 即時簡訊立即送並回寫狀態。
- Timer trigger（每日）撈當日 `Status IS NULL` → 呼叫智邦 API → 回寫 `Status/Message/UpdateDate`。
- 取消預約：未發送的標記 `Status="CANCEL"`。
- 簡訊內容依診別(健保/醫美/齒科)與分院差異組裝。
### 不做什麼
- 不改 `SmsStatus` schema（含沿用 `ntext` SmsBody）。
- 不對外開放觸發端點。

## 使用者流程（系統）
```
建立預約 → SmsDomain 組內容 → 寫 SmsStatus×2(即時+前一天) → 即時送智邦 → 回寫狀態
每日 Timer → 撈 SendDate=today & Status null → 送智邦 → 回寫
取消預約 → 該預約未發 SmsStatus → Status=CANCEL
```

## 設計決策
- **Timer trigger 取代 console**：無公開端點（修舊安全問題）；台灣時間每日固定時刻（注意 UTC+8）。
- **智邦 API**：HTTPS、憑證驗證開啟（修舊停用 SSL）；api_key/帳密進 Key Vault（修舊硬編碼）。
- **內容組裝**放 `SmsDomain`（純邏輯、可測），含號碼/時段/報到說明的診別差異。
- 失敗：回寫錯誤碼；可加重試（舊系統下次排程再試）。

## 跨層影響
| 層級 | 影響 | 摘要 |
|---|---|---|
| 後端 | 是 | SmsDomain + SmsService + 智邦 client；Timer trigger |
| API | 否 | 不對外（內部排程）；取消端點觸發標記 |
| 資料庫 | 否 | 讀寫既有 `SmsStatus` |
| 基礎建設 | 是 | Timer trigger、Key Vault、HTTPS |
| 安全 | 是 | 移除公開觸發、機密入 KV、SSL 驗證 |

## 驗收標準
- [x] 建立預約雙寫兩筆 SmsStatus（真實 DB 驗證）
- [x] 即時簡訊送出並回寫（dev/停用為 no-op；回寫 Status/UniqID/Message）
- [x] Timer 每日發當日待發並回寫（真實 DB 驗證；含總開關 ON/OFF）
- [x] 取消標記未發者 CANCEL（既有雙寫邏輯，本次未動）
- [x] 內容依診別/配號正確（6 模板逐字，單元測試 + 端對端驗證）
- [x] 無對外觸發端點（改內部 Timer）、機密不硬編碼（KV reference）
- [ ] 正式環境真發實測（待智邦帳號驗證後開啟總開關，見上方待辦）

## 風險與未解問題
- 智邦 API 回應格式脆弱（舊 Regex 解析）→ 新增容錯與告警。
- Timer 與即時送的重複/競態需確認。

## 對應舊系統
- [old/blueprints/sms-reminder.md](../old/blueprints/sms-reminder.md)、[old/architecture.md](../old/architecture.md) §CheckSms
- `reference/old/20Skin/Commons/SmsHandler.cs`、`reference/old/CheckSms/Program.cs`、`MainMsController`（CheckSms/建立）
