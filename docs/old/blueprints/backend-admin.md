---
title: 診所後台管理
purpose: 描述後台五大模組（基礎資料 / 班表 / 預約 / 會員 / 權限）的功能流程與權限對應機制
status: shipped
applicable_when: 要新增後台 Controller / Action、要修班表展開規則、要調整預約查詢 / 匯出、要修改權限模型
related_agents:
  - software-architect-blueprint
  - backend-engineer
  - frontend-architect
related_docs:
  - ../design/frontend-backend.md
  - ../design/backend-design.md
  - ../design/api-design.md
  - ../design/database-design.md
  - ../design/security.md
  - customer-booking.md
keywords: [backend, admin, 後台, 班表, 預約, 權限, lims, adminlims, roster]
last_updated: 2026-05-26
---

## 背景與動機

診所工作人員透過後台管理日常營運：維護分支 / 醫師 / 時段資料、排定班表、審核 / 取消預約、查看會員病歷與問卷、配置員工權限。需求特點：

- 多分支、多醫師、多時段組合複雜
- 班表常需週期性建立（每日 / 每週重複）
- 預約查詢需多條件篩選 + Excel 匯出（醫師簽到單）
- 不同員工只看 / 只改自己負責的功能

## 範圍

### 做什麼

- **基礎資料 CRUD**：Branch / Doctor / Period / OutpatientTime / Category / Question / QuestionAnswer
- **班表管理**：Roster + RosterPeriod + RosterCategory；支援日 / 週重複展開
- **預約管理**：列表 + 篩選 + 詳情 + 取消 + Excel 匯出
- **會員管理**：基本資料編輯 + 黑名單切換 + 問卷答案查詢 + SMS 狀態
- **權限管理**：管理員 CRUD + 二層權限樹（模組 → 子功能）+ CRUD 三權獨立

### 不做什麼

- 跨診所合併報表（單診所範圍）
- 醫師端獨立 App
- 自動化排班演算法（手動排）
- 角色 / 群組 / 模板（每個管理員權限獨立配置）

## 使用者流程

```
登入 → /Main/Login (Username + Password)
       │
       ▼ Session["AdminID"]、Session["AdminLims"]
       │
   依 CheckSession(IsAuth=true) 攔截每個 Action
       │
       ▼
┌──────────────────────────────────────────────────┐
│ 左側選單（依 Lims / AdminLims 動態渲染）          │
│                                                  │
│  Basic        ──► Branchs / Doctors / Periods …  │
│  Shift        ──► TaRosters (新增/編輯/重複展開) │
│  Reserve      ──► TaAppointments (篩選/檢視/取消/匯出) │
│  Member       ──► Members / MemberQAs            │
│  Authority    ──► Admins (含權限樹勾選 UI)       │
└──────────────────────────────────────────────────┘
```

## 設計決策

### 關鍵選擇

- **二層 Lims 樹**：模組（`ParentID IS NULL`）與子功能（`ParentID = 模組 LimID`）的扁平階層；夠用且簡單，但無法表達深層分組
- **每子功能 3 旗標 IsAdd / IsUpdate / IsDelete**：細粒度 CRUD 控制；代價是 UI 欄位多
- **Action 字串對應而非 attribute 標記**：依 Controller + Action 命名規律自動推導所需權限，新增 Action 不必改 attribute；代價是命名變動會破壞授權
- **班表重複展開**：`Repeat=0/1/2` + `ExpireDate` 在新增時一次性展開為多筆 `Rosters`；好維護但無「修改母班表自動 propagate 給子班表」能力
- **班表編輯採「清空再重建」**：`EditTaRosters` 刪光 `RosterCategorys` 與 `RosterPeriods` 再依新輸入插入；簡單但**無樂觀鎖**，並發編輯後寫者勝
- **預約預設 BranchID 硬編碼**：`ReserveMsController.TaAppointments` 預設 `WHERE BranchID = Guid("e65f4720…")`（台中），擴點需改 Controller
- **預約匯出走 NPOI Excel**：醫師簽到用，欄位固定

### 取捨

- **取**：權限機制細緻但無需角色配置學習成本；班表展開好用
- **捨**：權限模板化（每人獨立設）、班表事後 propagate、嚴格的硬編碼避免

## 跨層影響

| 層級 | 是否影響 | 變動摘要 |
|---|---|---|
| 視覺 | 是 | SmartAdmin theme、Bootstrap 3、Font Awesome |
| 前端 | 是 | `BasicMs/` / `ShiftMs/` / `ReserveMs/` / `MemberMs/` / `AuthorityMs/` Views |
| 後端 | 是 | 上述 5 個 Controller + Service 層；`CheckSessionAttribute`（後台版） |
| API | 是 | `/Main/Login`、各模組 CRUD Action、`/Ajax/CheckUsername` / `CheckMobile` / `GetPeriods` |
| 資料庫 | 是 | 全部 20 張表中除 `MemberQuestionAnswers`（讀取為主）皆有寫入 |
| 基礎建設 | 是 | 後台 IIS 站台、Session timeout 480 分鐘、前台靜態資源 CDN（圖檔上傳） |
| 安全 | 是 | `Admins` / `Lims` / `AdminLims` + 功能層級授權演算法 |

## 關鍵業務邏輯

### 模組 1：基礎資料 CRUD（`BasicMsController`）

代表 entity：Branch（其他 Doctor / Period / OutpatientTime / Category / Question / QuestionAnswer 邏輯類似）

```
AddBranchs (POST):
  1. 接收 Title / IsAutoRowNumber / BranchType / IsEnabled / Photo
  2. 檔案上傳三段式：
     ├── Server.MapPath("~/Upload/" + BranchID) 暫存
     ├── Librarys.UploadFileToFrontend(filepath, fileName, BranchDir)
     └── 刪除本機暫存
  3. db.Branchs.Add(...) → SaveChanges
  4. redirect Branchs（列表）

EditBranchs (POST):
  1. 取既有 Branch
  2. 若有新 Photo：先 DeleteFileFromFrontend(舊檔) → 上傳新檔
  3. TryUpdateModel + SaveChanges

DeleteBranchs (POST):
  IF entity.Rosters.Any():  # 有班表關聯
    return redirect Branchs（靜默忽略）
  ELSE:
    DeleteFileFromFrontend(Photo)
    db.Branchs.Remove → SaveChanges
```

### 模組 2：班表管理（`ShiftMsController`）

**新增 `AddTaRosters`**：

```
輸入：
  BranchID, DoctorID, RosterDate, OutpatientTimeID, IsAppointment, Clinic
  CategoryList[]      (Guid 陣列)
  RosterPeriodList[]  (PeriodID + Patients + StartNumber + Sort)
  Repeat              (0=單次 / 1=每日 / 2=每週)
  ExpireDate          (重複截止日)

去重檢查（單次與重複展開都做）：
  既有班次 = Rosters WHERE BranchID + DoctorID + Clinic + 該日期
  FOR EACH CategoryList[i]:
    IF 既有班次.RosterCategorys.Any(CategoryID == CategoryList[i]):
      標記為 duplicate, 不新增

重複展開：
  IF Repeat=1: FOR dt = RosterDate+1 TO ExpireDate STEP 1d
  IF Repeat=2: FOR dt = RosterDate+7 TO ExpireDate STEP 7d
    複製建立新 Roster（過去重檢查）

DB 寫入：
  Rosters: 1 筆 + (重複展開數) 筆
    每筆配套：
      RosterCategorys: N 筆（每個 CategoryID 一筆）
      RosterPeriods:   N 筆（每個時段設定一筆）
  SaveChanges 一次提交
```

**編輯 `EditTaRosters`**：

```
1. 取既有 Roster
2. db.RosterCategorys.RemoveRange(roster.RosterCategorys)
3. db.RosterPeriods.RemoveRange(roster.RosterPeriods)
4. 依新輸入重建 RosterCategorys + RosterPeriods
5. SaveChanges
```

無樂觀鎖。多人同時編輯同一 Roster，後寫者完全覆蓋前寫者。

**刪除 `DeleteTaRosters`**：

```
db.Rosters.Remove(entity)  → CASCADE 連動刪除 RosterPeriods + RosterCategorys
SaveChanges
```

### 模組 3：預約管理（`ReserveMsController`）

**列表 `TaAppointments`**：

```
基底查詢：Appointments
  .Where(a => a.BranchID == Guid.Parse("e65f4720..."))  # 硬編碼
  .Where(篩選條件)

篩選欄位（皆 nullable）：
  sClinic / sCategoryID / sAppointmentDate
  sMemberNumber / sMemberMobile / sMemberName

排序：AppointmentDate DESC, Period.Sort ASC
分頁：PagedList(p, pageSize=15)
```

**檢視 `ViewTaAppointments`**：載入 `Appointments.Include(Categorys, Members.Zipcodes, Members.MemberQuestions)` 與對應 `QuestionTypes`。

**取消 `DeleteTaAppointments`**：與前台 `PostCancel` 相同邏輯（`Status=0` + `SmsStatus.Status=CANCEL`）。

**匯出 `ExportTaAppointments`**：

```
1. 依篩選條件取預約清單
2. NPOI 產生 .xlsx
   - 欄：日期 / 時段 / 編號 / 會員姓名 / 電話 / 醫師 / 項目 / 狀態
3. 設 Response Header: Content-Disposition: attachment
4. 串流回傳
```

### 模組 4：會員管理（`MemberMsController`）

```
EditMembers (POST):
  Members.Name, Mobile, Birthday, Gender, BloodType, Email, ZipcodeID, Address
  Allergy = string.Join(",", form.Allergy[])      # CSV 多選
  MedicalHistory = string.Join(",", form.MedicalHistory[])
  IsBlackList = form.IsBlackList
  SaveChanges → redirect Members

MemberQAs (GET):
  查 MemberQuestions WHERE MemberID
    Include MemberQuestionAnswers.Include(QuestionAnswers.Include(Questions))
  View 顯示該會員所有問卷答案

SMS 狀態查詢：
  SmsStatus WHERE Appointments.MemberID = ?
  顯示發送結果 / UniqID / Message
```

### 模組 5：權限管理（`AuthorityMsController`）

```
Admins (GET):
  列出所有 Admins.Include(AdminLims)

AddAdmins / EditAdmins (POST):
  1. 取 Lims（全部）依 ParentID 組成「模組 → 子功能」樹
  2. 顯示 UI: 每子功能 3 個 checkbox (IsAdd / IsUpdate / IsDelete)
  3. 儲存：
     - 篩 LimID != 0 的紀錄
     - 對既有 AdminLims：依勾選狀態 Update
     - 新勾選且無紀錄：Add AdminLims
     - 取消勾選且有紀錄：Delete AdminLims
  4. db.SaveChanges
```

### 功能層級授權對應（每個受保護 Action）

```
[CheckSession(IsAuth = true)]
public ActionResult EditAdmins(...) { ... }

  ↓ 進入 OnActionExecuting

從 RouteData 取 controller="AuthorityMs" / action="EditAdmins"

清理 action：
  移除後綴 Add/Edit/Delete/Sort/Import/Export/Cogs/View/Upload/Modify
  → "EditAdmins" → "Admins"

特殊映射：
  Questions → QuestionTypes
  MemberQAs → Members
  Question{Ta|Ch|ChDentist}Appointments → 對應 Appointment 類

查 LimID：
  模組: Lims WHERE Key.Contains("Authority") AND ParentID IS NULL
  子功能: Lims WHERE Key.Contains("Admins") AND ParentID = 模組.LimID

查授權：
  adminlim = AdminLims WHERE AdminID = Session["AdminID"] AND LimID = 子功能.LimID

判斷：
  IF adminlim == null: redirect /Error/Validation
  IF action.Contains("Add") AND !adminlim.IsAdd: redirect /Error/Validation
  IF action.Contains("Edit") AND !adminlim.IsUpdate: redirect /Error/Validation
  IF action.Contains("Delete") AND !adminlim.IsDelete: redirect /Error/Validation
```

## 資料關聯重點

| 主表 | 直接寫入 | 連動（CASCADE） |
|---|---|---|
| `Branchs` | 基礎資料 | `Periods` |
| `Rosters` | 班表新增 / 編輯 | `RosterPeriods` / `RosterCategorys` |
| `Appointments` | 取消（Status=0） | `SmsStatus` |
| `Members` | 編輯 / 黑名單 | `Appointments` / `MemberQuestions` |
| `Admins` | 權限管理 | `AdminLims` |

## 驗收標準

- [ ] 每個受保護 Action 在無對應 `AdminLims` 時都被擋下
- [ ] 班表日 / 週重複展開正確（含跨月、不含已存在日）
- [ ] 班表編輯後預約查詢仍正常（CASCADE 不誤刪 Appointments）
- [ ] 預約 Excel 匯出格式正確（醫師可直接列印簽到）
- [ ] Branch 有班表時刪除被擋下
- [ ] 會員多選欄位（Allergy / MedicalHistory）儲存與顯示一致
- [ ] 通過 [code-review](../../workflows/code-review.md) 與 [qa-testing](../../workflows/qa-testing.md)

## 風險與未解問題

- **班表編輯無樂觀鎖**：多人並發編輯會吃覆蓋
- **預約 BranchID 硬編碼**：擴點到第二家診所需改 Controller，建議改為從 Session 或 URL 取
- **權限對應依賴字串 Contains**：Controller / Action 改名容易破壞授權；無單元測試覆蓋
- **超管帳號**：登入流程內含特例分支，需評估是否要遷移到 `AdminLims` 全勾選的一般帳號
- **無稽核 log**：管理員操作（誰刪了哪筆預約）僅靠 IIS log 推測

## 參考資料

- 後台 UI：[../design/frontend-backend.md](../design/frontend-backend.md)
- 權限機制：[../design/security.md](../design/security.md)
- 資料表完整欄位：[../design/database-design.md](../design/database-design.md)
- 客戶端視角：[customer-booking.md](customer-booking.md)
