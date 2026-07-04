---
title: 後台儀表板（Dashboard）
purpose: 後台首頁提供當日營運總覽（各分院預約量/初診/取消、未來 7 天趨勢、會員統計），取代舊系統的空殼首頁
status: in-progress # 程式完成 + 本機真實 DB/瀏覽器驗證通過；隨下次 push 部署正式環境後轉 shipped
applicable_when: 要修改/擴充後台儀表板、要理解儀表板統計口徑或權限過濾邏輯時
related_agents:
  - software-architect-blueprint
  - backend-engineer
  - frontend-architect
related_docs:
  - ../design/frontend-backend.md
  - ../design/backend-design.md
  - ../design/api-design.md
  - ../design/security.md
keywords: [dashboard, 儀表板, 首頁, 統計, 今日預約, 趨勢, 會員統計]
last_updated: 2026-07-04
---

## 背景與動機

舊系統後台首頁（`20SkinBackend/Views/Main/Index.cshtml`）是**空殼**：只有一個標題為「20SKIN預約管理系統」的 jarviswidget，`widget-body` 完全空白，登入後看不到任何營運資訊。新系統依系統性質（診所預約管理）設計真正的儀表板：櫃檯/管理人員登入後第一眼即可掌握「今天各分院有多少預約、多少初診、未來一週忙不忙、會員量體」。使用者需求（2026-07-04）：「依照系統性質，設計 Dashboard」。

## 範圍

### 做什麼
- 會員統計 4 卡：會員總數 / 今日新增 / 本月新增 / 黑名單（依 `Members.Createdate`、`IsBlackList`）
- 各分院當日卡（3 組，粒度同預約管理 Lims 變體 ta/ch/chDentist）：今日有效預約數（大字）、診別分解 chips、初診數、今日已取消數、「預約維護」快速連結（帶 queryParams 直達該分院預約列表）
- 未來 7 天（含今日）預約量趨勢：水平堆疊長條（分院分段、固定系列色、legend、native title tooltip、右側總量直接標示）
- **權限過濾（後端為真相）**：單一端點任何管理員可呼叫，但回應區塊依可讀權限過濾——分院統計需對應 `TaAppointments`/`ChAppointments`/`ChDentistAppointments` read；會員統計需 `Members` read；全無權限回空殼，前端顯示引導文字

### 不做什麼
- 不做時段容量利用率明細（需 clinic+category 才能定位單日容量表，屬預約管理頁既有功能，儀表板不重複）
- 不做日期範圍自訂/歷史回溯（儀表板定位為「當下總覽」，歷史查詢走預約管理篩選）
- 不做自動輪詢刷新（進頁載入一次；需要新數據重新整理即可）

## 使用者流程

```
1. 管理員登入 → 導向後台首頁（/）
2. 系統呼叫 GET /api/admin/dashboard（JWT）
3. 後端依 perms claim 過濾區塊 → 回統計
4. 管理員瀏覽當日概況；點分院卡「預約維護」→ /reserve?branch=<key> 進該分院預約列表
```

## 設計決策

### 關鍵選擇
- **單一端點 + 後端區塊過濾**，而非逐分院 3 個端點：儀表板是「一眼總覽」，一次請求組完頁面；權限比對用新增的 `RequestContext.CanRead(resource)`（read 語意與 `ApiRouterFunction.HasPermission` 一致：perms claim 有列即可）。端點本身掛 `[Authorize(Roles.Admin)]`（會員 403、匿名 401）。
- **統計口徑沿用預約列表頁**：初診 = 該會員 `Status=1` 預約總數 ≤ 1（動態計算，不讀 `Appointments.IsFirstVisit` 欄位）；「今日有效預約」只計 `Status=1`；「今日已取消」計 `Status=0` 且 `AppointmentDate=今日`。刻意與 `AppointmentAdminService.ListAsync` 同口徑，避免兩頁數字對不上。
- **趨勢看未來 7 天而非過去 7 天**：診所營運關心「接下來的負載」（排班/備料/人力），歷史量體不是首頁要回答的問題。
- **分院別名解析防禦性略過**：別名未設定時該分院直接不出現（不像逐分院端點用 `Resolve` 丟 `BRANCH_ALIAS_NOT_CONFIGURED`）——儀表板缺一塊仍應能看其餘區塊。
- **系列色固定順序 ta=#00538d（品牌藍）/ch=#d97706（琥珀）/chDentist=#059669（綠）**，不依資料重排；已跑 dataviz 調色盤驗證器（亮度帶/彩度/CVD 相鄰對比/表面對比全 PASS）。文字一律 `text-ink`/`text-muted`，不著系列色。
- **趨勢圖不引入圖表函式庫**：純 Tailwind div 堆疊長條（分段間 2px 表面縫隙、4px 圓角、`min-w-[3px]` 保零星量可見），比照本專案「避免新增 npm 依賴」既有傾向（同問卷列印捨 pdfmake 的理由）。

### 取捨
- 取「單次彙總查詢、口徑一致」，捨「即時性/自訂區間」——首頁定位是快照不是報表。
- `SUM(初診旗標)` 需先在衍生表逐列算 CASE 再彙總：SQL Server 不允許彙總函式內含子查詢（Error 130，實測踩到後修正）。

## 跨層影響

| 層級 | 是否影響 | 變動摘要 |
|---|---|---|
| 視覺 | 是 | 新增 stat tile / 分院卡 / 水平堆疊長條圖樣式（沿用既有 token：bg-white/border-hairline/text-ink…） |
| 前端 | 是 | `web-admin/src/app/pages/dashboard.ts` 改寫（原佔位）；新增 `core/services/dashboard-api.service.ts`；`core/models.ts` 加 5 個介面 |
| 後端 | 是 | 新增 `Skin.Services.Dashboard.DashboardAdminService`（Dapper 彙總查詢）；`RequestContext.CanRead()` |
| API | 是 | 新增 `GET /api/admin/dashboard`（見 [api-design.md](../design/api-design.md)） |
| 資料庫 | 否 | 純讀取（Appointments/Branchs/Members），schema 不動 |
| 基礎建設 | 否 | 無新環境變數 |
| 安全 | 是 | 新增 `RequestContext.CanRead`（read 語意同 router；供單端點內分區塊授權），見 [security.md](../design/security.md) |

## 驗收標準

- [x] 超管看到 3 分院 + 會員統計 + 7 天趨勢（真實 DB 驗證：台中今日 29/初診 11/取消 8…）
- [x] 數字與預約管理列表同口徑（ta 今日列表 total 37 = 有效 29 + 已取消 8，交叉核對一致）
- [x] 僅 `TaAppointments` 權限的管理員：只見 ta 分院、無會員區塊、趨勢只含 ta（建拋棄式測試管理員驗證後刪除，零殘留）
- [x] 會員 token 呼叫回 403、匿名 401
- [x] Playwright 瀏覽器端對端：登入 → 首頁渲染（桌面 1280 + 手機 390 截圖）、無 console 錯誤
- [x] `dotnet build` / `ng build` 0 warning 0 error；新 Tailwind class 已比對編譯後 CSS 確認產生

## 風險與未解問題

- 會員統計是全表彙總（COUNT/SUM over ~5.4 萬列），目前 <100ms；若量級大增可考慮加索引或快取（暫不做）。
- 初診旗標的相關子查詢對「今日預約」逐列執行，量級 = 當日預約數（數十列），可接受。

## 參考資料

- 舊系統空殼首頁：`reference/old/20SkinBackend/Views/Main/Index.cshtml`
- 統計口徑來源：`api/Skin.Services/Reserve/AppointmentAdminService.cs`（ListAsync 初診/狀態邏輯）
