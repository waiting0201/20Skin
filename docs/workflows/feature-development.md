---
title: Feature Development Workflow
purpose: 規範新功能從需求到上線的標準流程
applicable_when: 收到新功能需求、要開始開發新功能、要決定如何拆分任務
related_agents:
  - software-architect-blueprint
  - system-analyst
  - backend-engineer
  - frontend-architect
  - mobile-app-engineer
  - qa-test-engineer
  - code-review-optimizer
related_docs:
  - ../blueprints/_template.md
  - ../design/
  - code-review.md
  - qa-testing.md
keywords: [feature, 新功能, 開發, workflow, 流程]
last_updated: 2026-05-07
---

> 本檔是通用 [Research → Plan → Execute → Verify](research-plan-execute-verify.md) 框架的**新功能特化版**。

## 階段總覽

```
需求 → 藍圖 → 設計 → 實作 → 審查 → QA → 上線
   ↑R     ↑P     ↑P     ↑E     ↑V     ↑V    ↑V
```

## 0. 起手式：更新 status.md

- 先讀 [../status.md](../status.md) 了解全局
- 把新功能加入 **🔄 In Progress** 或 **📋 Backlog**
- 詳細規則見 [../../CLAUDE.md](../../CLAUDE.md) 「狀態追蹤規則」

## 1. 需求釐清

- **agent**：software-architect-blueprint
- **產出**：使用者流程、利害關係人、成功指標
- **澄清**：用 AskUserQuestion 而非假設

## 2. 建立 Blueprint

- **agent**：software-architect-blueprint
- **動作**：複製 [../blueprints/_template.md](../blueprints/_template.md) 為 `<feature>.md`
- **必填**：背景、範圍、跨層影響、驗收標準
- **更新**：[../blueprints/README.md](../blueprints/README.md) 索引表

## 3. 技術設計

- **agent**：system-analyst（總體規劃）+ 各層級 agent（細節）
- **動作**：依 blueprint「跨層影響」表，更新對應 design/ doc
  - 視覺改動 → [../design/visual-design.md](../design/visual-design.md)
  - 客戶前台改動 → [../design/frontend-customer.md](../design/frontend-customer.md)
  - 後台改動 → [../design/frontend-backend.md](../design/frontend-backend.md)
  - 後端 / API / DB 改動 → 對應 design/ doc
  - 安全相關 → [../design/security.md](../design/security.md)

## 4. 實作

- **agent**：依層級選 backend-engineer / frontend-architect / mobile-app-engineer
- **依據**：blueprint + design/ doc
- **同步**：實作中發現設計需調整 → **立即**回頭更新 blueprint 與 design/

## 5. 程式碼審查

- 依 [code-review.md](code-review.md) 流程
- **agent**：code-review-optimizer

## 6. QA / 測試

- 依 [qa-testing.md](qa-testing.md) 流程
- **agent**：qa-test-engineer
- 前端應用必跑 chrome-devtools-mcp 的 runtime 審查

## 7. 上線

- 部署遵循 [../design/infrastructure.md](../design/infrastructure.md)
- 更新 blueprint 的 `status: shipped` 與 `last_updated`
- 把功能從 [../status.md](../status.md) 的 In Progress 搬到 **✅ Recently Done**

## Definition of Done

- [ ] Blueprint 完整且 status=shipped
- [ ] 所有受影響的 design/ doc 已同步
- [ ] 通過 code review
- [ ] 通過 QA（含 runtime 審查）
- [ ] 通過 [security 檢核清單](../design/security.md)
- [ ] 監控 / 警報已配置
