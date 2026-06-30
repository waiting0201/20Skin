---
title: 20Skin 系統簡介
purpose: 一頁式 20Skin 系統定位介紹；對外與新人入門用
applicable_when: 第一次接觸 20Skin、想三分鐘理解這是什麼、要寫對外文件
related_agents: []
related_docs:
  - project-overview.md
  - architecture.md
  - status.md
keywords: [overview, 20Skin, 醫美, 預約, booking, intro]
last_updated: 2026-05-26
---

## 是什麼

20Skin 是**醫美診所線上預約系統**，正式部署於 `booking.20skin.tw`，涵蓋客戶線上預約、診所後台管理、預約簡訊提醒三大功能。

## 為什麼

電話預約耗人力、容易聽錯資料、無法 24 小時受理；20Skin 提供：

- **客戶 24 小時自助預約**：身分證 + 生日登入即可，免記密碼
- **問卷數位化**：術前資料線上填寫，醫師看診前即可審視
- **班表 / 預約自動串接**：診所端管理班表、客戶端可預約該班表
- **未報到管制**：3 次未報到自動列入黑名單

## 系統組成

由 6 個 .NET 子專案組成（詳見 [project-overview.md](project-overview.md) 與 [architecture.md](architecture.md)）：

- **20Skin**：客戶前台（IIS / 公網）
- **20SkinBackend**：診所後台（IIS / 內網或子網域）
- **20Skin.Models** / **20Skin.Service** / **20Skin.Libs**：分層共用程式庫
- **CheckSms**：簡訊提醒排程器（Windows Task Scheduler）

## 適用對象

- 醫美 / 整形外科 / 牙醫 / 中醫等需預約制的診所
- 多分支、多醫師、多時段的營運模式

## 不適用

- 即時掛號（不依排程，秒級回應）
- 跨機構整合（單診所範圍）
- 多語系（目前僅繁中）

## 設計理念

- **務實大於潮**：用 ASP.NET MVC 5 + EF6 等穩定組合，不追新框架
- **server-rendered 優先**：客戶端 jQuery 輕度互動，不上 SPA
- **資料層真相在 DB**：Database-First，schema 由 DBA 主導

## 下一步

- 開發者：先讀 [project-overview.md](project-overview.md) → [architecture.md](architecture.md) → 各 [design/](design/) doc
- 想了解功能：看 [blueprints/](blueprints/)
- 看目前進度：[status.md](../status.md)
- 已知陷阱：[gotchas.md](gotchas.md)
