---
title: Conventions
purpose: 定義命名、commit、分支、程式碼風格的團隊約定
applicable_when: 要寫 commit、要建分支、要決定命名、要設定 linter
related_agents:
  - code-review-optimizer
related_docs:
  - architecture.md
  - workflows/code-review.md
keywords: [conventions, 命名, commit, 分支, lint, 風格]
last_updated: 2026-05-07
---

## Commit Message

採 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**type**：`feat` / `fix` / `docs` / `style` / `refactor` / `test` / `chore` / `perf` / `ci`

**範例**：
```
feat(auth): 加入 Google OAuth 登入

- 支援 Google ID token 驗證
- 新增 /auth/google endpoint

Refs: #123
```

## 分支命名

- `feature/<short-desc>` — 新功能
- `fix/<short-desc>` — bug 修復
- `refactor/<short-desc>` — 重構
- `docs/<short-desc>` — 文件
- `chore/<short-desc>` — 雜項

## 程式碼命名

| 類型 | 命名 | 範例 |
|---|---|---|
| 變數 / 函式 | camelCase | `getUserProfile` |
| 類別 / 型別 | PascalCase | `UserProfile` |
| 常數 | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| 檔名（程式碼） | kebab-case 或依語言慣例 | `user-service.ts` |
| 檔名（doc） | kebab-case | `user-flow.md` |

## 檔案組織

- 一個檔案一個主要 export
- 測試檔同層放置（`foo.ts` + `foo.test.ts`）或鏡像於 `__tests__/`
- 工具函式放 `utils/` 或 `lib/`，不重複實作

## Lint / Format

- 由各專案 `package.json` / `pyproject.toml` 等設定檔定義
- PR 前必須通過：lint + type-check + test
- 由 [code-review-optimizer](agents-catalog.md) 把關

詳細的程式碼內部風格見：
- [design/frontend-coding-style.md](design/frontend-coding-style.md) — TS / JS / Dart / HTML / CSS
- [design/backend-coding-style.md](design/backend-coding-style.md) — C# / Python / PHP / SQL

## 工具基礎設施

跨檔案層級的工程基礎設施規範（與 lint 規則互補）：

| 項目 | 用途 / 政策 |
|---|---|
| **EditorConfig** | 跨 IDE 縮排 / 換行 / 編碼統一；必 commit `.editorconfig` |
| **Auto-formatter** | Prettier / Black / dotnet format / php-cs-fixer 等；format = 機械、lint = 邏輯，分工明確 |
| **Pre-commit hook** | husky / lint-staged / pre-commit；push 前先擋 lint + format + 部分 test |
| **CI 規則** | format + lint + type-check + test 全綠才能 merge |
| **PR size 軟上限** | 單 PR ≤ 400 行；超過要拆或在 PR 描述說明原因 |
| **Dependency 政策** | lock file 必 commit；定期更新；訂閱 advisory（dependabot / renovate） |
