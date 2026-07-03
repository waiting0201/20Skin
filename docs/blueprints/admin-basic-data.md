---
title: 後台基礎資料管理
purpose: 分院/醫師/時段/科別項目/問卷 主檔 CRUD 與排序，clinic 參數化取代舊 Ta/Ch/ChDentist 變體
status: shipped
applicable_when: 要實作或修改後台主檔維護（分院/醫師/時段/科別/問卷）時
related_agents:
  - software-architect-blueprint
  - backend-engineer
  - frontend-architect
related_docs:
  - ../design/frontend-backend.md
  - ../design/api-design.md
  - ../design/database-design.md
  - questionnaire.md
keywords: [admin, basic-data, master-data, branch, doctor, period, category, question, crud]
last_updated: 2026-07-04T00:10+08:00
---

## 背景與動機
後台維護預約所需的主檔。舊系統 `BasicMsController`(~1,427 行) 把時段等拆成 Ta/Ch/ChDentist(+Cosmetic) 多套幾乎相同程式碼。重寫**參數化**消除重複。

## 範圍
### 做什麼
- 分院（含圖片）、醫師、時段（各院各診別）、科別項目（Skin/Cosmetic）、問卷類型/題目/選項 的 CRUD + 排序。
- 圖片上傳走 Blob（見 [file-upload.md](file-upload.md)）。
- 問卷類型/題目刪除＝軟刪除（`IsEnabled=false`，沿用）。
### 不做什麼
- 不改 schema；不重建變體頁（改參數化）。

## 使用者流程
```
/basic/periods?clinic=skin&branch={id} → 列表/新增/編輯/刪除/排序（單一元件吃參數）
科別啟用問卷(IsQuestion) → 驗證已有 QuestionType 才可存
```

## 設計決策
- **Service 完全參數化，Controller 保留變體 proxy**：`BranchID`/`Clinic` 由參數帶入 Service（[modernization.md](../old/modernization.md) A5），消除業務邏輯複製；但真實 `Lims` 權限仍是舊變體粒度（`TaPeriods`/`ChPeriods`/…/`Skins`/`Cosmetics`，見 [admin-auth-authority.md](admin-auth-authority.md)），而 router 的 `[Authorize(Resource,Op)]` 是啟動時綁死在單一 method 的靜態屬性、無法依 query 參數動態換 Resource key，因此 Controller 層保留對應數量的「瘦」proxy action（每個只是取別名解析 BranchID/Clinic 後轉呼叫共用 Service），不是走回頭路。
- **路由 `admin/` 前綴**：客戶前台已用 `Roles.Member` 鎖住 `/api/branches`、`/api/categories?clinic=`、`/api/question-types`，同 method+同段數路由不可重複註冊，後台新端點統一 `admin/` 前綴（見 [api-design.md](../design/api-design.md)）。
- **刪除前置檢查**：改為正確的 `COUNT(...)==0` 引用檢查（修正舊系統死碼 bug：`if (entity.Rosters==null)` 因 EF6 lazy-loading 集合永不為 null 而完全失效）。真實 DB 已查證 CASCADE 鏈：`Branchs→Periods`、`Periods→RosterPeriods`、`Categorys→QuestionTypes`/`RosterCategorys`、`QuestionTypes→Questions`、`Questions→QuestionAnswers`/`MemberQuestions` 皆為 `CASCADE`；`Appointments`/`Rosters` 對 `Branchs`/`Doctors`/`Categorys`/`Periods` 皆為 `NO_ACTION`（DB 會擋，但仍需應用層給出明確訊息，不能只靠 DB 丟例外）。Category 刪除需檢查 **QuestionTypes 全表 COUNT（含已軟刪 IsEnabled=false 的列）**，因為 QuestionTypes 從不硬刪，任何殘留列都代表 CASCADE 會波及到 Questions/QuestionAnswers/MemberQuestions（含會員歷史問卷記錄）。
- **問卷選項（QuestionAnswers）編輯**：純沿用舊系統行為——比對新舊 answerID 做增/改/**硬刪**，不查 `MemberQuestionAnswers` 引用（該表對 QuestionAnswers 無 FK 保護，已知孤兒資料風險，使用者已拍板接受以維持舊行為相容性）。
- **列表頁分頁（2026-07-03 追加）**：分院、科別項目兩個列表補回分頁（舊 `Branchs.cshtml`/`Skins.cshtml`/`Cosmetics.cshtml` 皆為 `ToPagedList(pageSize: 20)`，先前重寫時遺漏）；醫師/時段/問卷類型/問卷題目列表維持不分頁（對應舊 View 本來就沒有分頁）。詳細規範見 [design/frontend-backend.md](../design/frontend-backend.md) §分頁規範。因科別項目在排班表單/問卷類型表單的下拉還需要「全部清單」，另外加了不分頁的 `GET admin/categories/{clinic}/all` 端點供這些表單改呼叫，避免誤用分頁端點只拿到第一頁。
- **時段頁面改為忠於舊系統，取代前一版頁籤設計（2026-07-03 追加）**：初版 `periods-list.ts` 把 5 變體收在同一頁用頁籤切換，是本專案自創、舊系統沒有的 UI（舊系統 5 變體是各自獨立的 `.cshtml` 頁面，彼此不能互相切換，只能各自從選單進入）。使用者要求「頁面不需要有 tab，表單要完全參照舊程式」後已改正：① 移除頁籤 UI（Service/元件仍維持參數化，只是拿掉頁籤這層多餘導覽，變體切換交給選單）；② 忠實還原表單欄位——「時段」（`Title`）在舊系統是 HH(08–21)/MM(00,05,…,55) 兩個下拉由前端 JS 組成 `"HH:MM"`，不是自由文字輸入（初版誤做成「名稱」文字框）；欄位標籤改回舊系統用詞「時間」（`OutpatientTimeID`）/「時段」（`Title`）/「起始編號」/「人數」（初版誤用「門診時段」/「名稱」/「起始號碼」/「容量」）；③ 台中健保時段（`TaPeriods`）比照舊 `TaPeriods.cshtml` 隱藏「新增時段」按鈕（該連結在舊 View 被 Razor 註解整段隱藏，其餘 4 變體正常顯示），僅前端隱藏入口，後端 `TaSkinCreate` 端點不變。詳見 [design/frontend-backend.md](../design/frontend-backend.md) §periods-list 不設頁籤。
- **科別項目頁面比照同樣修正（2026-07-03 追加）**：使用者接著要求「皮膚主治跟美容醫學不要有 tab，表單也要完全參照舊系統」，`categories-list.ts`/`category-form.ts` 有一樣的頁籤問題與表單欄位落差，修法同上：① 移除頁籤；② 欄名「名稱」改回舊系統「標題」；「簡介」改為單行必填（原多行選填 textarea）；三個「每次一人」checkbox 標籤改回「台中每次一人」/「二林每次一人」/「齒科每次一人」（原「台中院限定」等自創詞）；「代表圖」新增時必填、編輯時選填（比照舊 `AddSkins`/`EditSkins` 的 `data-bv-notempty` 差異）。③ **新發現業務規則**：「需填問卷」（`IsQuestion`）在舊系統**只出現在編輯頁**，新增表單完全沒有此欄位（`AddSkins`/`AddCosmetics` 的 `TryUpdateModel` 白名單不含 `IsQuestion`，新建一律 `false`）；且從 `false` 改為 `true` 時，舊 `EditSkins`/`EditCosmetics`（第 951–961 行）要求該項目**必須已有至少一筆 `QuestionTypes`**，否則擋下「尚未編輯問卷」——這條規則原新系統完全沒有實作（`CategoryAdminService.CreateAsync`/`UpdateAsync` 原本照單全收前端傳入的 `IsQuestion`），已補上：`CreateAsync` 忽略前端值強制寫 `false`，`UpdateAsync` 在 `false→true` 時查 `QuestionTypes` 是否存在。詳見 [design/frontend-backend.md](../design/frontend-backend.md) §categories-list 不設頁籤。

## 跨層影響
| 層級 | 影響 | 摘要 |
|---|---|---|
| 前端 | 是 | Basic 模組各實體 list/form 元件（參數化） |
| 後端 | 是 | BasicData Controllers + Services |
| API | 是 | `admin/branches`、`admin/doctors`、`admin/periods/{ta-skin\|ta-cosmetic\|ch-skin\|ch-cosmetic\|ch-dentist}`、`admin/categories/{skin\|cosmetic}`、`admin/question-types`、`admin/questions`（見 [api-design.md](../design/api-design.md)） |
| 資料庫 | 否 | 讀寫既有主檔表 |
| 安全 | 是 | 依 perms 授權 |

## 驗收標準
- [x] 各主檔 CRUD + 排序
- [x] clinic/branch 參數化（無硬編碼 GUID，Periods 分院別名走設定驅動）
- [x] 刪除前置檢查（正確 COUNT，修正舊系統死碼 bug）
- [x] 問卷軟刪除、題目選項差異更新
- [x] 圖片走 Blob

## 實作紀錄（Done 2026-07-02，分 4 個 Phase）

- **程式位置**：
  - API：`Skin.Services/BasicData/{Branch,Doctor,Period,Category,QuestionType,Question}AdminService`（+ 對應 `I*` 介面）、`PeriodsOptions`（分院別名設定驅動）、`20Skin.Api/Controllers/{BranchesAdmin,DoctorsAdmin,PeriodsAdmin,CategoriesAdmin,QuestionTypesAdmin,QuestionsAdmin}Controller`、DTO 集中於 `Skin.Core/Dtos/BasicDataDtos.cs`。
  - 前端：`web-admin/src/app/core/services/{basic-data-api,basic-upload}.service.ts`、`pages/basic/{branches-list,branch-form,doctors-list,doctor-form,periods-list,period-form,categories-list,category-form,question-types-list,question-type-form,questions-list,question-form}.ts`。
- **Phase 0（前置查證）**：對真實 DB 查證 CASCADE 鏈（`Branchs→Periods→RosterPeriods`、`Categorys→QuestionTypes→Questions→QuestionAnswers/MemberQuestions`）與台中/二林四季/二林齒科三個真實 `BranchID`；修正 `api-design.md` 過時的端點路徑敘述。
- **Phase 1（Branchs+Doctors）**：無變體，先驗證整條技術棧（含 `UploadsController` 授權從 `[Authorize(Roles.Member)]` 開放為 `[Authorize]`，讓後台也能上傳圖片）。踩雷：`Doctors.Name` 真實只有 15 字，原本沒做長度驗證觸發 SQL truncation 500，已補長度驗證並回友善錯誤。
- **Phase 2（Periods，5 變體）**：**核心架構決策**——Service 完全參數化（`branchId`+`clinic`）消除業務邏輯複製，但真實 `Lims` 權限仍是變體粒度、router 授權是啟動時綁死在單一 method 的靜態屬性，故 Controller 保留 5 組「瘦」proxy action 各掛對應 Resource key。授權邊界測試（僅 `ChPeriods` 權限呼叫 `ta-skin` 端點）驗證正確回 403。過程中發現並修正 `menu-route-map.ts` 把「二林．齒科」誤當成「二林．四季分院的 Dentist 診別」（`branch=ch`）的既有 bug——兩者是不同 `BranchID`，已改用獨立別名 `chDentist`。
- **Phase 3（Categorys，2 變體）**：同 Periods 模式（2 組 proxy）。刪除前置檢查發現 Category→QuestionTypes 是 CASCADE 但 QuestionTypes 從不硬刪，故檢查邏輯查**全表**（含已軟刪列），避免刪除科別時 CASCADE 波及會員歷史問卷記錄。
- **Phase 4（QuestionTypes+Questions，最後一階段）**：QuestionTypes 軟刪；Questions 編輯採整組選項送出比對 diff（沿用舊系統：現有但未送出→硬刪除，**不查** `MemberQuestionAnswers` 引用——已知孤兒資料風險，使用者拍板接受以維持舊行為相容性）；偽造/不屬本題目的 `QuestionAnswerId` 視為新增（沿用問卷讀取面既有的「濾除偽造 ID」慣例）。
- **真實 DB 驗證**：全 4 Phase 皆對本機真實 `20Skin` DB 端對端測試（CRUD/排序/刪除守門/長度驗證/授權邊界），測試資料事後清除零殘留，未動用任何正式資料。`dotnet build`/`ng build` 全程 0 warning。

## 風險與未解問題
- QuestionAnswers 硬刪除不查歷史引用（使用者已拍板接受）：若未來要補救，需先讓 `MemberQuestionAnswers` 有 FK（待 schema 核准）。
- 前端瀏覽器互動點擊驗證未做（無 chrome-devtools/Playwright 可用），僅驗證 `ng build` + SPA 路由 200 回應 + 後端 API 完整端對端。

## 對應舊系統
- [old/blueprints/backend-admin.md](../old/blueprints/backend-admin.md) §BasicMs、[old/design/frontend-backend.md](../old/design/frontend-backend.md)
- `reference/old/20SkinBackend/Controllers/BasicMsController.cs`
