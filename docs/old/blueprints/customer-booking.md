---
title: 客戶線上預約
purpose: 描述客戶端從登入到完成預約的完整流程，包含問卷、SMS 雙寫、容量檢查、自動編號等業務規則
status: shipped
applicable_when: 要修改前台預約流程、要加新分支 / 診別 / 項目、要調整容量檢查或編號邏輯、要對接新通知通路
related_agents:
  - software-architect-blueprint
  - backend-engineer
  - frontend-architect
related_docs:
  - ../design/frontend-customer.md
  - ../design/backend-design.md
  - ../design/api-design.md
  - ../design/database-design.md
  - ../design/security.md
  - sms-reminder.md
keywords: [booking, appointment, customer, 預約, 客戶, 問卷, 簡訊]
last_updated: 2026-05-26
---

## 背景與動機

20Skin 醫美診所提供線上預約服務（`booking.20skin.tw`），讓客戶免電話即可完成：選分支 / 診別 / 項目 / 日期 / 時段 / 醫師，並依需要填寫術前問卷。預約成功後即時收到確認簡訊，預約前一日再收到提醒簡訊。

## 範圍

### 做什麼

- 客戶以身分證字號 + 出生日期 + reCAPTCHA 登入
- 新客戶引導註冊（同表單收個資、過敏、病史、緊急聯絡人）
- 多步驟選擇：Branch → Clinic → Category → (Question) → Roster → Period → Doctor (可選)
- 寫入 `Appointments` 與兩筆 `SmsStatus`（即時確認 + 排程提醒）
- 即時發送預約成功簡訊
- 預約取消（限預約時間前 1 小時）

### 不做什麼

- 線上付費（金流未整合）
- 行事曆同步（iCal / Google Calendar）
- 多語系（僅繁體中文）
- 客戶端密碼登入（以身分證字號替代）

## 使用者流程

```
┌── 客戶 ──┐                          ┌── 系統 ──┐
│         │                          │          │
│ 開啟首頁 │ ───────────────────────► │ Login    │
│         │ ◄─── 顯示登入表單 ─────── │          │
│         │                          │          │
│ 填身分證 │ ─── POST /MainMs/Login ► │ 驗證     │
│ + 生日   │                          │ ┌──────┐ │
│ + recap. │                          │ │三分支│ │
│         │                          │ │ 1 OK │ │
│         │                          │ │ 2 NEW│ │
│         │                          │ │ 3 BAN│ │
│         │                          │ └──────┘ │
│         │ ◄── 1: redirect 預約 ──── │          │
│         │ ◄── 2: redirect JoinUs ── │          │
│         │ ◄── 3: 黑名單訊息 ─────── │          │
│         │                          │          │
│ 選分支   │ ─── AJAX SelectBranch ─► │ Session 更新 │
│ 選診別   │ ─── AJAX SelectClinic ─► │              │
│ 選項目   │ ─── AJAX SelectCategory─► │ 檢查 IsQuestion │
│         │                          │              │
│ (若需要) │                          │              │
│ 填問卷   │ ─── POST /MainMs/Questions ──► 寫 MemberQuestions │
│         │                          │              │
│ 選日期   │ ─── GET /Ajax/GetRosters ─► 回班次 JSON │
│ 選時段   │ ─── GET /Ajax/GetRosterDoctors ─► 回醫師 │
│ 選醫師   │                          │              │
│         │                          │              │
│ 確認預約 │ ─── POST /MainMs/AppointmentForm ──┐    │
│         │                                   ▼     │
│         │                  ┌────────────────────┐ │
│         │                  │ 容量檢查           │ │
│         │                  │  ↓                 │ │
│         │                  │ (Auto 編號)        │ │
│         │                  │  ↓                 │ │
│         │                  │ 寫 Appointments    │ │
│         │                  │  ↓                 │ │
│         │                  │ 寫 SmsStatus x2    │ │
│         │                  │  ↓                 │ │
│         │                  │ 即時送 SMS         │ │
│         │                  └─────────┬──────────┘ │
│         │ ◄── redirect Complete ────┘             │
│         │                                          │
│ 收到 SMS │ ◄────────── 智邦通訊 Gateway ────────── │
└─────────┘                                          │
                  (隔日)                              │
                  CheckSms 排程 → 發送提醒簡訊        │
                                                      │
└─ 客戶 ─┘                                            │
   收到提醒 SMS ◄────── 智邦通訊 Gateway ─────────────┘
```

## 設計決策

### 關鍵選擇

- **以身分證字號 + 生日代替密碼**：醫療場域用戶不熟記密碼；身分證為法定身分驗證依據。代價是需要 reCAPTCHA + 黑名單機制避免被自動化掃描
- **預約步驟暫存在 Session 而非 hidden form**：避免大量隱藏欄位污染 URL / form；代價是**重新整理 / 跨 tab 操作會打斷流程**
- **SMS 雙寫（即時 + 排程）**：預約建立的同一交易內就建立提醒簡訊紀錄，避免後續 cron 找不到要發誰；提醒簡訊 `Status=NULL` 待 CheckSms 處理
- **容量檢查無 lock**：以 `COUNT(Appointments WHERE Status=1) >= RosterPeriod.Patients` 為唯一閘門。極端並發下理論可超賣（見「風險」段）
- **自動編號**：`Branchs.IsAutoRowNumber=true` 的分支採從 `Period.StartNumber` 開始以 2 號遞增找最小空號，避免叫號衝突；非自動編號分支則 `OutpatientNum=NULL`

### 取捨

- **取**：流程順手、無密碼學習成本、SMS 即時 / 排程兩種訊息確保到達率
- **捨**：跨 tab / 重新整理友善度、嚴格防超賣、行事曆同步

## 跨層影響

| 層級 | 是否影響 | 變動摘要 |
|---|---|---|
| 視覺 | 是 | 客戶端自訂 CSS（`main.css`）、繁中字體、mobile-first |
| 前端 | 是 | `MainMs/*` Views + jQuery AJAX 多步驟導航 |
| 後端 | 是 | `MainMsController`（前台主 Controller）+ `AjaxController` + `AppointmentsService` / `MembersService` / `SmsStatusService` |
| API | 是 | `/MainMs/Login` / `JoinUs` / `AppointmentForm` / `Complete` / `Questions`、`/Ajax/Select*` / `Get*` / `PostCancel` |
| 資料庫 | 是 | `Members` / `Appointments` / `MemberQuestions` / `MemberQuestionAnswers` / `SmsStatus`；讀 `Branchs` / `Doctors` / `Periods` / `Categorys` / `Rosters` / `RosterPeriods` / `RosterCategorys` / `QuestionTypes` / `Questions` / `QuestionAnswers` |
| 基礎建設 | 是 | 前台 IIS 站台、Session InProc、智邦通訊 SMS Gateway |
| 安全 | 是 | `CheckSessionAttribute`（前台版）、`Session["IsLogin"]` / `Session["MemberID"]`、reCAPTCHA、黑名單機制 |

## 關鍵業務邏輯

### Login 三分支

```
MembersService.GetMemberByNumberAndBirthday(Number, Birthday)
  ├── null → 回 2 → redirect JoinUs（帶入 Number, Birthday）
  ├── IsBlackList=true → 回 3 → 顯示「未報到超過 3 次封鎖」訊息
  └── 正常 → 回 1
            ├── Session["IsLogin"] = true
            ├── Session["MemberID"] = member.MemberID
            └── Session["myReserve"].IsFirstVisit = (type=="A" ? "Y" : "N")
```

`type` 來自 Login form：`"A"` = 初診預約 → redirect `AppointmentForm`；其他 → `Index`。

### JoinUs 註冊

- 若 `Number + Birthday` 已在 `Members` 表 → 不重複建檔、改走複診流程
- 否則新建 `Members`：`MemberID = Guid.NewGuid()`、`Createdate = now`、`IsBlackList = false`
- `Allergy[]` / `MedicalHistory[]` 多選用 `string.Join(",", arr)` 寫入單欄

### 預約建立（`AppointmentForm` POST）

```
1. 驗證輸入：AppointmentDate / PeriodID / DoctorID(opt) / IsAppointment / Amount / Photo(opt)

2. 查班次：
   IF IsAppointment=true:
     Rosters WHERE BranchID + DoctorID + Clinic + RosterDate + IsAppointment=true
       AND PeriodID + CategoryID 對應
   ELSE:
     Rosters WHERE 上述（除 DoctorID）AND IsAppointment=false
     ORDER BY (預約人數 ASC) → 取第一筆

3. 容量檢查：
   Amount = COUNT(Appointments WHERE Status=1 AND RosterID=? AND PeriodID=?)
   IF Amount >= RosterPeriod.Patients (或 Period.Patients):
     return "已超過預約人數"

4. 自動編號：
   IF Branch.IsAutoRowNumber=true:
     OutpatientNum = MIN(StartNumber + 2k) WHERE not occupied
   ELSE:
     OutpatientNum = NULL

5. 寫 Appointments：
   AppointmentID = Guid.NewGuid()
   MemberID = Session["MemberID"]
   BranchID, RosterID, DoctorID, AppointmentDate, PeriodID, Clinic, CategoryID
   IsFirstVisit = Session["myReserve"].IsFirstVisit
   Status = 1
   OutpatientNum, Photo, QuestionTypeID
   Createdate = now (UTC+8)

6. 寫兩筆 SmsStatus：
   ├── 即時：SendDate=now, SmsBody=「預約成功…」
   │   → SmsHandler.SendNow(Mobile, SmsBody)
   │   → 寫回 Status / Message / UniqID
   └── 提醒：SendDate=AppointmentDate-1d, SmsBody=「明日預約…」, Status=NULL

7. redirect Complete(AppointmentID)
```

### 預約取消（`/Ajax/PostCancel`）

```
時限檢查：
  預約時間 = parse(AppointmentDate + Period.Title)
  現在時間 = now + 9h（時區補正）
  IF 現在時間 < 預約時間 - 1h: 允許
  ELSE: 回 { code: "202" }

DB 更新：
  Appointments.Status = 0
  SmsStatus（該預約所有 Status IS NULL 的紀錄）:
    Status = "CANCEL"
    Message = "取消預約"
    UpdateDate = now
```

### 問卷填寫

```
GET /MainMs/Questions?QuestionTypeID=xxx
  → 撈 Questions + QuestionAnswers

POST /MainMs/Questions
  FOR EACH MemberQuestions in form:
    IF MemberQuestionID == Guid.Empty:
      MemberQuestionID = Guid.NewGuid()
      QuestionTypeID = form.QuestionTypeID
      FOR EACH MemberQuestionAnswers:
        MemberQuestionAnswerID = Guid.NewGuid()
      member.MemberQuestions.Add(item)
  Session["myReserve"].QuestionTypeID = form.QuestionTypeID
  redirect AppointmentForm
```

`OptionType` 決定渲染：0=單選 / 1=複選 / 2=文字（寫 `Other`）/ 3=檔案（寫 `Filename`）。

## 資料關聯重點

| 寫入時序 | 表 | 關鍵欄位 |
|---|---|---|
| Login 成功 | （無寫入，僅 Session） | — |
| JoinUs 新會員 | `Members` | `MemberID`, `Number`, `Birthday`, `IsBlackList=false`, `Createdate` |
| 問卷提交 | `MemberQuestions` + `MemberQuestionAnswers` | `MemberID`, `QuestionTypeID`, `QuestionID?`, `Other`, `Filename` |
| 預約建立 | `Appointments` + `SmsStatus` x 2 | `Status=1`, `IsFirstVisit`, `OutpatientNum` |
| 預約取消 | `Appointments`(Status=0) + `SmsStatus`(Status=CANCEL) | — |

## 驗收標準

- [ ] 登入三分支（成功 / 不存在 / 黑名單）UI 行為正確
- [ ] 容量上限到達時拒絕預約並顯示訊息
- [ ] 自動編號分支不會跳號或重號
- [ ] 預約成功立即收到確認簡訊
- [ ] 預約日前一日收到提醒簡訊（依賴 CheckSms 排程）
- [ ] 預約前 1 小時內無法取消
- [ ] 問卷各 OptionType（單選 / 複選 / 文字 / 檔案）正確渲染與儲存
- [ ] 通過 [code-review](../../workflows/code-review.md) 與 [qa-testing](../../workflows/qa-testing.md)

## 風險與未解問題

- **並發容量超賣**：`COUNT + INSERT` 之間無 lock，極端並發下可超出 `Patients` 上限。短期可接受（人工後台處理），長期建議加 unique constraint 或 transaction isolation
- **重新整理打斷流程**：`Session["myReserve"]` 暫存，使用者 F5 或跨 tab 操作可能流失中間狀態
- **跨時區假設**：取消邏輯硬編碼 `now + 9h`；若 server 改 timezone 會出錯
- **重複預約**：未檢查同一會員同一時段是否已預約（業務目前接受）

## 參考資料

- 前端 UI：[../design/frontend-customer.md](../design/frontend-customer.md)
- 簡訊提醒：[sms-reminder.md](sms-reminder.md)
- 資料表完整欄位：[../design/database-design.md](../design/database-design.md)
- AJAX endpoint：[../design/api-design.md](../design/api-design.md)
