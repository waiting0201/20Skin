---
title: 系統架構
purpose: 描述 20Skin 6 個 .NET 子專案的分層、依賴方向、執行邊界，以及 harness 自身的文件結構與 frontmatter 規範
applicable_when: 要新增 / 移動程式碼時判斷該放哪一層、要修改 doc 結構、要寫 doc-lint、要理解 Web 站與 CheckSms 的執行邊界
related_agents:
  - software-architect-blueprint
  - system-analyst
related_docs:
  - project-overview.md
  - design/backend-design.md
  - design/database-design.md
  - conventions.md
keywords: [architecture, 架構, 分層, layer, dependency, schema, frontmatter, edmx, project-structure]
last_updated: 2026-05-26
---

## 解決方案結構

`20Skin.sln` 由 6 個 .NET 專案組成，全部目標 .NET Framework 4.8：

```
20Skin.sln
├── 20Skin/                  # 客戶前台 (ASP.NET MVC 5 + Web API)
│   ├── Controllers/         # MainMs / Ajax / Uploads
│   ├── Views/MainMs/        # Razor Views (Login, Appointment, Questions, Visit, ...)
│   ├── Content/             # 自訂 CSS (main.css 59KB)、靜態資源
│   ├── Scripts/             # jQuery + plugins
│   ├── Commons/             # SmsHandler、Reservation Session DTO
│   ├── Filters/             # CheckSessionAttribute (前台版)
│   └── Web.config
│
├── 20SkinBackend/           # 診所後台 (ASP.NET MVC 5)
│   ├── Controllers/         # BasicMs / ShiftMs / ReserveMs / MemberMs / AuthorityMs / Ajax
│   ├── Views/               # 對應每個 Controller
│   ├── Content/css/         # SmartAdmin theme + Bootstrap 3
│   ├── Scripts/             # SmartAdmin jQuery plugins
│   ├── Filters/             # CheckSessionAttribute (後台版，支援 IsAuth 功能授權)
│   └── Web.config           # sessionState timeout=480 分鐘
│
├── 20Skin.Models/           # 資料模型層 (Class Library)
│   ├── Model1.edmx          # EF6 Database-First 主檔
│   ├── Model1.tt            # T4 範本生成實體 partial class
│   ├── Model1.Context.tt    # T4 範本生成 SkinEntities DbContext
│   └── *.cs                 # 20 個實體 partial class (Appointments、Members、…)
│
├── 20Skin.Service/          # 業務邏輯層 (Class Library)
│   ├── BaseService.cs       # 泛型 CRUD 基類 + IResult
│   ├── IBaseService.cs
│   └── *Service.cs          # 21 個 (AppointmentsService、MembersService、…)
│
├── 20Skin.Libs/             # 共用工具 (Class Library)
│   └── Definition.cs        # 跨層常數與列舉
│
└── CheckSms/                # 簡訊提醒排程器 (Console App)
    └── Program.cs           # HTTP GET booking.20skin.tw/MainMs/CheckSms
```

## 依賴方向

```
        ┌────────────────────┐         ┌────────────────────┐
        │       20Skin       │         │   20SkinBackend    │
        │  (客戶前台 IIS)     │         │  (後台 IIS)         │
        └─────────┬──────────┘         └──────────┬─────────┘
                  │                                │
                  └───────────┬────────────────────┘
                              ▼
                  ┌────────────────────┐
                  │   20Skin.Service   │
                  └─────────┬──────────┘
                              ▼
                  ┌────────────────────┐
                  │   20Skin.Models    │  ◄── EDMX + T4
                  └─────────┬──────────┘
                              ▼
                  ┌────────────────────┐
                  │  SQL Server 20Skin │
                  └────────────────────┘

  ┌──────────┐
  │ CheckSms │ ─── HTTP GET ───► booking.20skin.tw/MainMs/CheckSms
  └──────────┘    (Windows Task Scheduler 排程)
```

- 上層只依賴下層，**不反向引用**
- `20Skin.Libs` 是水平共用工具，任何專案都可參考
- `CheckSms` 不參考其他專案，純當外部觸發器

## 執行邊界

| 進程 | 載體 | 啟動方式 | Session 存放 |
|---|---|---|---|
| 20Skin Web | IIS (port 80/443) | IIS Application Pool | InProc，cookie `ASP.NET_SessionId`，預設 20 分鐘 |
| 20SkinBackend Web | IIS (port 80/443，不同站台) | IIS Application Pool | InProc，cookie `ASP.NET_SessionId`，timeout=480 分鐘 |
| CheckSms | 獨立 EXE | Windows Task Scheduler | 無 Session（純 HTTP client） |

**注意**：前後台雖共用 cookie 名稱，但因為是不同 IIS Application，Session 儲存空間獨立、不互通。

## 模組職責一句話

| 層 | 職責 | 不負責 |
|---|---|---|
| Web (Controllers) | HTTP 入口、Session 操作、ViewModel 組裝、檔案上傳 | DB 細節、商業驗證以外的純邏輯 |
| Service | 跨表業務操作、Result 包裝、SaveChanges 邊界 | HTTP 細節、Session 操作 |
| Models | EF 實體與 DbContext、Partial class 擴充屬性 | 任何業務邏輯 |
| Libs | 跨層常數、列舉、靜態 helper | 任何狀態 |
| CheckSms | 觸發後端 endpoint | 任何 DB 操作 |

## 文件骨架（harness 自身結構）

```
<project>/
├── CLAUDE.md                # 入口：路由表 + 同步規則 + 索引
├── docs/
│   ├── project-overview.md  # 20Skin 業務 / 子專案總覽（先讀）
│   ├── architecture.md      # 本檔
│   ├── status.md            # 進度追蹤
│   ├── overview.md          # harness 自我介紹
│   ├── conventions.md       # 命名 / commit / 工具基礎設施
│   ├── agents-catalog.md    # agent 清單
│   ├── gotchas.md           # 已知陷阱
│   ├── design/              # 各層設計
│   ├── blueprints/          # 功能藍圖（customer-booking / backend-admin / sms-reminder）
│   └── workflows/           # 任務流程
└── .claude/
    ├── settings.json
    └── agent-memory/<agent-name>/MEMORY.md
```

## Frontmatter Schema

每份 `docs/**/*.md` 開頭必須有 YAML frontmatter：

```yaml
---
title: <人類可讀標題>                       # 必填
purpose: <一句話：這份文件解決什麼問題>      # 必填
applicable_when: <Claude 何時該讀這份文件>   # 必填
related_agents: []                           # 必填（可空陣列）
related_docs: []                             # 必填（可空陣列），相對路徑
keywords: [<關鍵字1>, <關鍵字2>]            # 必填，利於 grep
last_updated: YYYY-MM-DD                     # 必填，變更時更新
status: draft | active | deprecated          # 選填，預設 active
---
```

## 命名約定

- 檔名：`kebab-case.md`（如 `customer-booking.md`）
- 樣板檔：`_` 開頭（如 `_template.md`）— 不被視為實際 doc
- 索引檔：`README.md` 放在子目錄根
- 路徑：所有 `related_docs` 用相對路徑

## 三層索引設計

1. **CLAUDE.md 路由表**（逆向索引）：任務類型 → agent + doc
2. **Frontmatter `related_agents`**（正向索引）：doc → 適用 agent
3. **Frontmatter `keywords`**（搜尋索引）：grep 進入點

三者互補不冗餘：agent 名稱在 CLAUDE.md + frontmatter 維護，doc 內文不重複。
