---
title: 簡訊提醒（雙寫 + 排程）
purpose: 預約即時確認 + 前一天提醒的簡訊雙寫、Azure Functions Timer trigger 排程發送、取消標記 CANCEL
status: draft
applicable_when: 要實作或修改簡訊發送、排程、取消標記、或智邦 API 整合時
related_agents:
  - software-architect-blueprint
  - backend-engineer
  - deployment-engineer
related_docs:
  - ../design/backend-design.md
  - ../design/infrastructure.md
  - ../design/api-design.md
  - customer-booking.md
keywords: [sms, reminder, timer-trigger, smsstatus, dual-write, cancel, 智邦]
last_updated: 2026-06-30
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
- [ ] 建立預約雙寫兩筆 SmsStatus
- [ ] 即時簡訊送出並回寫
- [ ] Timer 每日發當日待發並回寫
- [ ] 取消標記未發者 CANCEL
- [ ] 內容依診別/分院正確
- [ ] 無對外觸發端點、機密不硬編碼

## 風險與未解問題
- 智邦 API 回應格式脆弱（舊 Regex 解析）→ 新增容錯與告警。
- Timer 與即時送的重複/競態需確認。

## 對應舊系統
- [old/blueprints/sms-reminder.md](../old/blueprints/sms-reminder.md)、[old/architecture.md](../old/architecture.md) §CheckSms
- `reference/old/20Skin/Commons/SmsHandler.cs`、`reference/old/CheckSms/Program.cs`、`MainMsController`（CheckSms/建立）
