---
title: 資料庫設計
purpose: 描述 20Skin SQL Server schema：20 張表完整欄位、FK 關聯、ER 主軸、列舉值約定、Database-First 遷移流程
applicable_when: 要新增 / 修改資料表、要查欄位、要寫跨表查詢、要追外鍵約束、要修改 EDMX
related_agents:
  - backend-engineer
  - system-analyst
related_docs:
  - backend-design.md
  - ../blueprints/customer-booking.md
  - ../blueprints/backend-admin.md
  - ../gotchas.md
keywords: [database, schema, sql-server, ef6, edmx, table, entity, fk, association]
last_updated: 2026-05-26
---

## 技術選型

| 面向 | 選擇 | 備註 |
|---|---|---|
| RDBMS | SQL Server | `data source=(local)`，DB 名 `20Skin` |
| ORM | EF6 4.4.4 | **Database-First** |
| 模型來源 | `20Skin.Models/Model1.edmx` | XML：SSDL（DB 真相）+ CSDL（概念模型）+ MSL（mapping） |
| 程式碼產生 | `Model1.tt` / `Model1.Context.tt` T4 範本 | 改 EDMX 後須**手動執行 T4** 重新生成 |
| DbContext | `SkinEntities` | 在 `20Skin.Models` namespace |
| Migration | **無**（手動 SQL）| schema 真相在 SQL Server，code 由 DB 反向產生 |

## 修改 schema 的標準流程

```
1. 在 SQL Server 上 ALTER / CREATE / DROP（DBA 操作）
2. 在 Visual Studio 打開 Model1.edmx → 右鍵 Update Model from Database
3. 對 Model1.tt 與 Model1.Context.tt 各執行一次 "Run Custom Tool"
4. 確認 partial class 重新生成、SkinEntities 反映新欄位
5. 同步更新對應 Service / Controller
6. 更新本檔對應段落 + 「last_updated」
```

## 命名約定（EF Database-First 預設）

| 物件 | 命名 | 範例 |
|---|---|---|
| 資料表 | PascalCase，複數 | `Appointments`、`Members`、`Branchs`（注意：`Branchs` 非標準英文複數，但全專案沿用） |
| 欄位 | PascalCase | `AppointmentDate`、`IsBlackList` |
| 主鍵 | `{Entity}ID`（單數 + ID）| `AppointmentID`、`MemberID` |
| 外鍵 | 同上 | `MemberID`、`BranchID` |
| 時間戳記 | **不一致**（陷阱）| `Createdate`（小寫 d）vs `CreateDate / UpdateDate`（大寫 D）— 見 [../gotchas.md](../gotchas.md) |

**無**索引命名前綴（依 SQL Server 自動命名 PK / FK 約束）。

## 軟刪除策略

- **無** `IsDeleted` / `DeletedAt` 欄位
- 全部以 **CASCADE Delete** 為主（FK 約束）
- 唯一邏輯刪除：`Appointments.Status = 0` 視為取消

## ER 主軸

### 預約主軸
```
Members ─1:N─ Appointments ─N:1─ Branchs
                  ├── Doctors  (optional)
                  ├── Periods  (required)
                  ├── Categorys (required)
                  ├── QuestionTypes (optional)
                  └── Rosters (optional)
                              ├── RosterPeriods (N:1 Periods)
                              └── RosterCategorys (N:1 Categorys)
```

### 問卷
```
Categorys ─1:N─ QuestionTypes ─1:N─ Questions ─1:N─ QuestionAnswers
Members  ─1:N─ MemberQuestions ─N:1─ QuestionTypes
                       ├── (opt) ─N:1─ Questions
                       └── 1:N ─ MemberQuestionAnswers ─N:1─ QuestionAnswers
```

### 權限
```
Admins ─1:N─ AdminLims ─N:1─ Lims (self-ref ParentID 形成二層樹)
                            ├── IsAdd / IsUpdate / IsDelete (CRUD 旗標)
```

### 簡訊
```
Appointments ─1:N─ SmsStatus  (CASCADE Delete)
```

### 地址
```
Zipcodes ─1:N─ Members  (optional)
```

## 20 張表完整欄位

### 1. Appointments（預約主表）
| 欄位 | 型別 | PK/FK | NULL | 說明 |
|---|---|---|---|---|
| AppointmentID | uniqueidentifier | PK | NO | |
| MemberID | uniqueidentifier | FK → Members.MemberID (CASCADE) | NO | |
| BranchID | uniqueidentifier | FK → Branchs.BranchID | YES | |
| DoctorID | uniqueidentifier | FK → Doctors.DoctorID | YES | |
| PeriodID | uniqueidentifier | FK → Periods.PeriodID | NO | |
| CategoryID | uniqueidentifier | FK → Categorys.CategoryID | NO | |
| RosterID | uniqueidentifier | FK → Rosters.RosterID | YES | |
| QuestionTypeID | uniqueidentifier | FK → QuestionTypes.QuestionTypeID | YES | |
| AppointmentDate | datetime | | NO | 預約日 |
| Clinic | nvarchar(10) | | NO | 診別代碼 |
| Status | int | | NO | 1=已預約 / 0=取消（其他值意義查 `Definition.cs`） |
| OutpatientNum | int | | YES | 自動編號（依 `Branchs.IsAutoRowNumber`） |
| Amount | int | | NO | 預約金額 |
| Photo | nvarchar(50) | | YES | 上傳圖檔名 |
| IsFirstVisit | bit | | NO | 是否初診 |
| Createdate | datetime | | YES | 小寫 d |

### 2. Members（會員）
| 欄位 | 型別 | PK/FK | NULL | 說明 |
|---|---|---|---|---|
| MemberID | uniqueidentifier | PK | NO | |
| ZipcodeID | int | FK → Zipcodes.ZipcodeID | YES | |
| Number | nvarchar(15) | (唯一) | NO | 身分證字號，登入用 |
| Birthday | datetime | | NO | 登入驗證用 |
| Mobile | nvarchar(15) | | NO | |
| Name | nvarchar(20) | | YES | |
| Gender | int | | YES | 0=未知 / 1=男 / 2=女 |
| BloodType | nvarchar(5) | | YES | O / A / B / AB |
| Email | nvarchar(150) | | YES | |
| Address | nvarchar(250) | | YES | |
| EmergencyName | nvarchar(20) | | YES | |
| EmergencyPhone | nvarchar(15) | | YES | |
| Allergy | nvarchar(150) | | YES | CSV 多選 |
| AllergyOther | nvarchar(50) | | YES | |
| MedicalHistory | nvarchar(150) | | YES | CSV 多選 |
| MedicalHistoryOther | nvarchar(50) | | YES | |
| IsBlackList | bit | | NO | 未報到 3 次封鎖 |
| Createdate | datetime | | NO | |

### 3. Branchs（診所分支）
| 欄位 | 型別 | PK/FK | NULL | 說明 |
|---|---|---|---|---|
| BranchID | uniqueidentifier | PK | NO | |
| Title | nvarchar(50) | | NO | |
| BranchType | int | | NO | 列舉值見 `Definition.cs` |
| Photo | nvarchar(50) | | NO | |
| IsAutoRowNumber | bit | | NO | 是否自動編號預約 |
| Sort | int | | NO | |
| IsEnabled | bit | | NO | |

### 4. Doctors（醫師）
| 欄位 | 型別 | PK/FK | NULL | 說明 |
|---|---|---|---|---|
| DoctorID | uniqueidentifier | PK | NO | |
| Name | nvarchar(15) | | NO | |

### 5. Periods（時段）
| 欄位 | 型別 | PK/FK | NULL | 說明 |
|---|---|---|---|---|
| PeriodID | uniqueidentifier | PK | NO | |
| BranchID | uniqueidentifier | FK → Branchs.BranchID (CASCADE) | NO | |
| OutpatientTimeID | int | FK → OutpatientTimes.OutpatientTimeID | NO | |
| Clinic | nvarchar(10) | | NO | |
| Title | nvarchar(50) | | NO | e.g. "9:00~9:30" |
| StartNumber | int | | YES | |
| Patients | int | | NO | 上限 |
| Sort | int | | NO | |

### 6. OutpatientTimes（門診時間字典表）
| 欄位 | 型別 | PK/FK | NULL | 說明 |
|---|---|---|---|---|
| OutpatientTimeID | int identity | PK | NO | |
| Title | nvarchar(10) | | NO | e.g. "上午" / "下午" |

### 7. Rosters（班表）
| 欄位 | 型別 | PK/FK | NULL | 說明 |
|---|---|---|---|---|
| RosterID | uniqueidentifier | PK | NO | |
| BranchID | uniqueidentifier | FK → Branchs.BranchID | NO | |
| DoctorID | uniqueidentifier | FK → Doctors.DoctorID | YES | |
| OutpatientTimeID | int | FK → OutpatientTimes | YES | |
| RosterDate | datetime | | NO | |
| Clinic | nvarchar(10) | | NO | |
| IsAppointment | bit | | NO | 是否開放預約 |

### 8. RosterPeriods（班表時段）
| 欄位 | 型別 | PK/FK | NULL | 說明 |
|---|---|---|---|---|
| RosterPeriodID | uniqueidentifier | PK | NO | |
| RosterID | uniqueidentifier | FK → Rosters (CASCADE) | NO | |
| PeriodID | uniqueidentifier | FK → Periods (CASCADE) | NO | |
| StartNumber | int | | YES | |
| Patients | int | | NO | |
| Sort | int | | NO | |

### 9. RosterCategorys（班表診療項目）
| 欄位 | 型別 | PK/FK | NULL |
|---|---|---|---|
| RosterCategoryID | uniqueidentifier | PK | NO |
| RosterID | uniqueidentifier | FK → Rosters (CASCADE) | NO |
| CategoryID | uniqueidentifier | FK → Categorys (CASCADE) | NO |

### 10. Categorys（診療項目）
| 欄位 | 型別 | PK/FK | NULL | 說明 |
|---|---|---|---|---|
| CategoryID | uniqueidentifier | PK | NO | |
| Clinic | nvarchar(10) | | NO | |
| Title | nvarchar(50) | | NO | |
| Intro | nvarchar(250) | | YES | |
| Photo | nvarchar(50) | | NO | |
| IsQuestion | bit | | NO | 是否需要術前問卷 |
| IsOnly | bit | | NO | （業務旗標） |
| ChIsOnly | bit | | NO | 中文限定旗標 |
| ChDentistIsOnly | bit | | NO | 中醫牙醫限定 |
| Sort | int | | NO | |

### 11. QuestionTypes（問卷類型）
| 欄位 | 型別 | PK/FK | NULL |
|---|---|---|---|
| QuestionTypeID | uniqueidentifier | PK | NO |
| CategoryID | uniqueidentifier | FK → Categorys (CASCADE) | NO |
| Title | nvarchar(50) | | NO |
| Sort | int | | NO |
| IsEnabled | bit | | NO |

### 12. Questions（問題）
| 欄位 | 型別 | PK/FK | NULL | 說明 |
|---|---|---|---|---|
| QuestionID | uniqueidentifier | PK | NO | |
| QuestionTypeID | uniqueidentifier | FK → QuestionTypes (CASCADE) | NO | |
| Title | nvarchar(250) | | NO | |
| OptionType | int | | NO | **0=單選 / 1=複選 / 2=文字 / 3=檔案** |
| IsOther | bit | | NO | 是否有「其他」選項 |
| OtherTitle | nvarchar(50) | | YES | |
| Sort | int | | NO | |
| IsEnabled | bit | | NO | |

### 13. QuestionAnswers（預設答案選項）
| 欄位 | 型別 | PK/FK | NULL |
|---|---|---|---|
| QuestionAnswerID | uniqueidentifier | PK | NO |
| QuestionID | uniqueidentifier | FK → Questions (CASCADE) | NO |
| Title | nvarchar(50) | | NO |
| Sort | int | | NO |

### 14. MemberQuestions（會員填答容器）
| 欄位 | 型別 | PK/FK | NULL | 說明 |
|---|---|---|---|---|
| MemberQuestionID | uniqueidentifier | PK | NO | |
| MemberID | uniqueidentifier | FK → Members (CASCADE) | NO | |
| QuestionTypeID | uniqueidentifier | FK → QuestionTypes | NO | |
| QuestionID | uniqueidentifier | FK → Questions (CASCADE) | YES | **可空**：null = 整類容器；非 null = 具體題目應答 |
| Other | nvarchar(50) | | YES | 「其他」自填內容 |
| Filename | nvarchar(50) | | YES | 上傳檔案 |

### 15. MemberQuestionAnswers（會員具體答案）
| 欄位 | 型別 | PK/FK | NULL |
|---|---|---|---|
| MemberQuestionAnswerID | uniqueidentifier | PK | NO |
| MemberQuestionID | uniqueidentifier | FK → MemberQuestions (CASCADE) | NO |
| QuestionAnswerID | uniqueidentifier | FK → QuestionAnswers | YES |

### 16. SmsStatus（簡訊狀態）
| 欄位 | 型別 | PK/FK | NULL | 說明 |
|---|---|---|---|---|
| SmsStatusID | uniqueidentifier | PK | NO | |
| AppointmentID | uniqueidentifier | FK → Appointments (CASCADE) | NO | |
| Mobile | nvarchar(15) | | NO | |
| SmsBody | ntext | | NO | 訊息內容 |
| SendDate | datetime | | NO | 預定 / 實際發送日 |
| Status | nvarchar(10) | | YES | null=待發 / 由 SMS API 回填 / `CANCEL`=取消預約後標記 |
| Message | nvarchar(250) | | YES | API 回應或人工備註 |
| UniqID | nvarchar(50) | | YES | 第三方 API 訊息識別 |
| CreateDate | datetime | | NO | **大寫 D** |
| UpdateDate | datetime | | YES | **大寫 D** |

### 17. Admins（後台管理員）
| 欄位 | 型別 | PK/FK | NULL | 說明 |
|---|---|---|---|---|
| AdminID | uniqueidentifier | PK | NO | |
| Username | nvarchar(150) | (唯一) | NO | |
| Password | nvarchar(20) | | NO | |
| Name | nvarchar(20) | | NO | |

### 18. AdminLims（管理員權限）
| 欄位 | 型別 | PK/FK | NULL |
|---|---|---|---|
| AdminLimID | uniqueidentifier | PK | NO |
| AdminID | uniqueidentifier | FK → Admins (CASCADE) | NO |
| LimID | int | FK → Lims (CASCADE) | NO |
| IsAdd | bit | | NO |
| IsUpdate | bit | | NO |
| IsDelete | bit | | NO |

### 19. Lims（權限項目）
| 欄位 | 型別 | PK/FK | NULL | 說明 |
|---|---|---|---|---|
| LimID | int identity | PK | NO | |
| ParentID | int | FK → Lims.LimID (self) | YES | null=模組級 / 非 null=子功能 |
| Key | nvarchar(255) | | YES | 用於 Controller / Action 字串比對 |
| Value | nvarchar(50) | | YES | UI 顯示名稱 |
| Icon | nvarchar(50) | | YES | |
| Sort | int | | NO | |

### 20. Zipcodes（郵遞區號字典表）
| 欄位 | 型別 | PK/FK | NULL |
|---|---|---|---|
| ZipcodeID | int identity | PK | NO |
| CountryID | int | | NO |
| City | nvarchar(10) | | NO |
| Area | nvarchar(10) | | NO |
| Zipcode | nvarchar(10) | | NO |
| IsDisplay | int | | NO |

## 列舉值對照

| 欄位 | 值 | 意義 |
|---|---|---|
| `Members.Gender` | 0 / 1 / 2 | 未知 / 男 / 女 |
| `Questions.OptionType` | 0 / 1 / 2 / 3 | 單選 / 複選 / 文字 / 檔案 |
| `Appointments.Status` | 1 / 0 | 已預約 / 取消（其他值意義待查 `Definition.cs`） |
| `SmsStatus.Status` | null / `CANCEL` / API 回填 | 待發 / 預約取消 / 各種發送狀態 |
| `Branchs.BranchType` | int | 意義在 `Definition.cs` |

## 唯一索引

| 表 | 欄位 | 約束 |
|---|---|---|
| Members | Number | 業務唯一（身分證字號） |
| Admins | Username | 業務唯一 |

EDMX 未顯式定義唯一索引；建議在 DB 層手動加 unique index。

## 共用欄位現況

不同於慣例的「每表必含 created_at / updated_at」，本專案：

- `Members.Createdate` / `Appointments.Createdate`：小寫 d
- `SmsStatus.CreateDate` / `SmsStatus.UpdateDate`：大寫 D
- 多數其他表（如 `Branchs`、`Doctors`、`Rosters`）**無時間戳記欄位**
- 無 `updated_at` 統一規範

## 重要陷阱

詳見 [../gotchas.md](../gotchas.md) 「資料庫」章節。

- 時間戳記命名不一致（大小寫 D）
- 無軟刪除，全 CASCADE
- 列舉值不在 DB
- `MemberQuestions.QuestionID` 可空 → 同表混用「容器」與「具體題目」兩種語意
- 後台預約查詢硬編碼 BranchID（`e65f4720…` 台中固定）
