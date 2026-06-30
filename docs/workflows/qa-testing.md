---
title: QA Testing Workflow
purpose: 規範 QA 品質審查的執行步驟，含靜態 + runtime 雙層次
applicable_when: 要做品質審查、PR 進 QA 階段、上線前驗收
related_agents:
  - qa-test-engineer
related_docs:
  - code-review.md
  - ../design/security.md
keywords: [qa, test, 測試, 品質, 審查, runtime, lighthouse]
last_updated: 2026-05-07
---

## 兩層審查

### 靜態審查（必跑）
- **agent**：qa-test-engineer
- **內容**：邏輯、邊界、錯誤處理、安全、效能、可測試性、可讀性
- **工具**：依專案技術棧自動偵測對應 linter（read-only）

### Runtime 審查（前端專案必跑）
- **agent**：qa-test-engineer（含 chrome-devtools-mcp）
- **內容**：
  - Console 錯誤與警告
  - Network 請求審查（4xx/5xx、CORS、慢請求）
  - Performance / Web Vitals（LCP / CLS / INP）
  - 可訪問性與 DOM 檢查

## 審查報告格式

由 qa-test-engineer 產出，含：

- 🔴 嚴重問題（Critical）
- 🟡 警告（Warning）
- 🔵 建議（Suggestion）
- ❓ 疑問（Questions）
- ✅ 優點（Positives）
- 🧪 Linter / 靜態分析結果
- 🌐 瀏覽器執行期檢查結果（前端適用）

## QA 不通過的處理

- 🔴 必修
- 🟡 由開發者判斷是否修，未修須有理由
- 🔵 / ❓ 視情況討論

## 與 code-review 的差別

- code-review：**主動**提改善建議，可改 code
- qa-testing：**只**找問題與提問，不改 code
- 兩者並行不衝突；複雜功能建議都跑

## 上線前 sanity check

- [ ] 所有 🔴 已修
- [ ] 通過 [security 檢核](../design/security.md)
- [ ] runtime 審查（若前端）四面向至少 ⚠️ 以上
- [ ] 對應 design/ doc 已同步
- [ ] blueprint 驗收標準全打勾

## 對應 RPEV

本流程對應 [research-plan-execute-verify.md](research-plan-execute-verify.md) 的 **V (Verify)** 階段：系統化驗收（含 runtime 觀察）。
