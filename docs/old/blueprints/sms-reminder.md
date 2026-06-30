---
title: 簡訊提醒
purpose: 描述預約確認簡訊（即時）與預約前一日提醒簡訊的雙寫機制與 CheckSms 排程觸發流程
status: shipped
applicable_when: 要修改簡訊內容、要換 SMS 供應商、要調整提醒時機、要排查未發送的簡訊
related_agents:
  - software-architect-blueprint
  - backend-engineer
related_docs:
  - ../design/backend-design.md
  - ../design/database-design.md
  - ../design/infrastructure.md
  - customer-booking.md
keywords: [sms, reminder, 簡訊, checksms, smsstatus, 智邦, scheduler]
last_updated: 2026-05-26
---

## 背景與動機

醫美診所需在客戶預約成功時立即確認，並在預約前一日提醒避免未報到（no-show）。20Skin 採「預約建立時即寫入兩筆簡訊紀錄」的設計：

- **即時簡訊**：預約建立同一交易內呼叫智邦通訊 API 發送
- **提醒簡訊**：先寫入 `SmsStatus` 但 `Status=NULL`，由獨立 `CheckSms` Console App 排程觸發後端 endpoint 統一發送

未報到滿 3 次的會員會被標記為 `Members.IsBlackList=true`，禁止再線上預約。

## 範圍

### 做什麼

- 預約建立時寫入兩筆 `SmsStatus`（即時 + 提醒）
- 即時簡訊立即透過智邦通訊 API 發送
- 提醒簡訊由 `CheckSms.exe` 排程觸發 `MainMsController.CheckSms` 批次發送
- 寫回發送結果（`Status` / `Message` / `UniqID` / `UpdateDate`）
- 取消預約時把該預約的所有未發送簡訊標記為 `CANCEL`

### 不做什麼

- 自訂模板編輯器（簡訊文案硬編碼於 Controller）
- 失敗重試（單次失敗就停在該 Status，無排程重打）
- 多通路（無 Email / LINE / Push 備援）
- 統計分析（無發送成功率儀表板）

## 使用者流程

```
[預約建立時]
客戶 POST /MainMs/AppointmentForm
    ↓
寫 Appointments
    ↓
寫 SmsStatus #1 (即時)
  SendDate = now
  SmsBody = "預約成功…"（依 Clinic + IsAutoRowNumber 分類）
  Status = NULL
    ↓
SmsHandler.SendNow(Mobile, SmsBody)
    ↓
智邦通訊 API (pp.url.com.tw/api/msg)
    ↓ 回傳 status / message / uniqid
寫回 SmsStatus #1: Status / Message / UniqID
    ↓
寫 SmsStatus #2 (提醒)
  SendDate = AppointmentDate - 1 day
  SmsBody = "明日預約提醒…"
  Status = NULL  ← 待 CheckSms 處理
    ↓
SaveChanges 一次提交


[排程觸發時]
Windows Task Scheduler
    ↓
CheckSms.exe
    ↓
HTTP GET http://booking.20skin.tw/MainMs/CheckSms
    ↓
查 SmsStatus WHERE SendDate (year/month/day) = today AND Status IS NULL
    ↓
FOR EACH 待發 SmsStatus:
    SmsHandler.SendNow(Mobile, SmsBody)
    ↓ 回傳 status / message / uniqid
    寫回 Status / Message / UniqID / UpdateDate = now
    ↓
db.SaveChanges() 一次批次提交
    ↓
回 JSON: { code: "200", message: "已送出 N 封" / "無簡訊發送" }


[預約取消時]
客戶 / 後台 觸發取消
    ↓
Appointments.Status = 0
    ↓
SmsStatus（該預約 + Status IS NULL）:
    Status = "CANCEL"
    Message = "取消預約"
    UpdateDate = now
```

## 設計決策

### 關鍵選擇

- **預約時雙寫 vs 排程時動態組裝**：選雙寫。優點：取消預約只需更新 `Status=CANCEL` 就過濾掉，邏輯簡單；缺點：簡訊文案改了**不會反映在已建立的提醒紀錄**
- **HTTP pull 觸發 vs Service 內 Timer**：選 HTTP pull（外部 cron 拉觸）。優點：IIS 站台不必常駐執行緒、與 web request 共用 DB 連線；缺點：endpoint 暴露公網，需考慮防濫用
- **`SmsStatus.Status=NULL` 表示「待發」**：簡單，但失去「重試中」「失敗」等中間狀態
- **SMS 失敗不重試**：CheckSms 跑完該筆就更新 Status 為 API 回應（即使失敗）；下次排程不會重打
- **時區補正硬編碼 `now + 9h`**：避開 server timezone 設定不一致；但 server 切換 timezone 會錯亂

### 取捨

- **取**：實作簡單、取消邏輯一致、無常駐 process
- **捨**：失敗重試、文案動態化、多通路備援

## 跨層影響

| 層級 | 是否影響 | 變動摘要 |
|---|---|---|
| 視覺 | 否 | — |
| 前端 | 否 | — |
| 後端 | 是 | `MainMsController.CheckSms` / `AppointmentForm`、`SmsHandler`、`SmsStatusService`、`AppointmentsService` |
| API | 是 | `/MainMs/CheckSms`（給 cron 用）、預約建立 / 取消會連動 |
| 資料庫 | 是 | `SmsStatus` 表（讀寫）、`Appointments` 取消時觸發 SmsStatus 更新 |
| 基礎建設 | 是 | Windows Task Scheduler + `CheckSms.exe`、智邦通訊 SMS Gateway |
| 安全 | 是 | `/MainMs/CheckSms` 無 IP 白名單 / token 保護 |

## 關鍵業務邏輯

### `MainMsController.CheckSms()`

```csharp
// 查當日待發
var pending = db.SmsStatus
    .Where(s => s.SendDate.Year == today.Year
             && s.SendDate.Month == today.Month
             && s.SendDate.Day == today.Day
             && s.Status == null)
    .ToList();

foreach (var sms in pending)
{
    var resp = SmsHandler.SendNow(sms.Mobile, sms.SmsBody);
    sms.Status = resp["status"];
    sms.Message = resp["message"];
    sms.UniqID = resp["uniqid"];
    sms.UpdateDate = DateTime.Now;
}

db.SaveChanges();
return Json(new {
    code = "200",
    message = pending.Count > 0
        ? $"已送出 {pending.Count} 封簡訊"
        : "無簡訊發送"
}, JsonRequestBehavior.AllowGet);
```

### `SmsHandler.SendNow(mobile, body)`

```
POST http://pp.url.com.tw/api/msg
  Form data:
    api_key  = (from Web.config)
    username = (from Web.config)
    password = (from Web.config)
    mobile   = ${mobile}
    msg      = ${body}

回應 JSON:
  { status: "...", message: "...", uniqid: "..." }
```

### 預約建立的雙寫（重點）

文案來源：依 `Clinic`（皮膚 / 醫美 / 牙醫）與 `Branchs.IsAutoRowNumber` 分類，組合預約日期 + 時段 + 醫師等資訊。**文案邏輯目前散在 Controller，未抽出 helper / template**。

### 預約取消的副作用

```
Appointments.Status = 0
SmsStatus WHERE AppointmentID = ? AND Status IS NULL:
    Status = "CANCEL"
    Message = "取消預約"
    UpdateDate = now
```

`Status=CANCEL` 在 CheckSms 查詢條件中自然被過濾（`WHERE Status IS NULL` 排除）。

## 資料關聯重點

| 觸發點 | SmsStatus 動作 |
|---|---|
| `AppointmentForm` POST 成功 | INSERT × 2（即時 + 提醒） |
| `SmsHandler.SendNow` 回應 | UPDATE 對應紀錄 Status/Message/UniqID |
| `CheckSms` 排程觸發 | UPDATE Status IS NULL 的紀錄 |
| `PostCancel` / `DeleteTaAppointments` | UPDATE Status=CANCEL |

`SmsStatus.AppointmentID` FK 為 CASCADE Delete，預約被實體刪除時連動清掉（業務上預約走「軟取消」`Status=0`，少實際 DELETE，故 CASCADE 較少觸發）。

## 驗收標準

- [ ] 預約成功立即發送即時簡訊
- [ ] 預約建立同時寫入兩筆 `SmsStatus`
- [ ] CheckSms 排程觸發後當日 `Status IS NULL` 變為 API 回應狀態
- [ ] 取消預約後該預約所有未發簡訊變 `CANCEL`，CheckSms 下次不會重發
- [ ] 智邦通訊 API key 從 Web.config 讀取，未硬編碼在 source
- [ ] 通過 [code-review](../../workflows/code-review.md) 與 [qa-testing](../../workflows/qa-testing.md)

## 風險與未解問題

- **失敗不重試**：API 暫時故障導致該批簡訊 `Status` 寫入失敗值後不會再嘗試；建議加重試或人工介入流程
- **endpoint 對外公開**：`/MainMs/CheckSms` 無 IP 白名單 / token，理論上任何人都能觸發；建議加保護
- **時區硬編碼**：`now + 9h` 假設 server 為 UTC，遷雲時需檢查
- **文案改動不溯及既往**：已寫入的提醒簡訊文案不會被新文案覆蓋
- **CheckSms 單點**：排程器若停擺，提醒簡訊全部失效，無告警

## 參考資料

- 預約流程：[customer-booking.md](customer-booking.md)
- 後台預約管理：[backend-admin.md](backend-admin.md)
- 基礎建設：[../design/infrastructure.md](../design/infrastructure.md)
- 資料表欄位：[../design/database-design.md](../design/database-design.md)
