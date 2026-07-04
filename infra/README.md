# infra/（Bicep IaC，prod-only）

完整方案說明、一次性手動步驟、機密清單見
[docs/design/infrastructure.md](../docs/design/infrastructure.md)。本檔只放檔案結構速查。

```
infra/
├── main.bicep                    # 入口（resourceGroup scope）
├── main.parameters.json          # 範例參數（含待填佔位符，不含任何機密）
└── modules/
    ├── log-analytics.bicep       # Application Insights 底層 workspace
    ├── app-insights.bicep
    ├── key-vault.bicep           # RBAC 授權模式，僅建空 Vault
    ├── storage.bicep             # 單一 Storage：AzureWebJobsStorage + upload blob + RefreshTokens table + Flex 部署容器
    ├── static-web-app.bicep      # 可重用，客戶前台/後台各呼叫一次
    ├── function-app.bicep        # Flex Consumption + CORS + App Settings（含 KV reference）
    └── sql-firewall.bicep        # 既有 Azure SQL 的防火牆規則（不動既有伺服器/DB 本身）
```

首次套用前必須先跑 `validate` + `what-if`（本檔案尚未在真實 Azure 訂閱驗證過）：

```bash
az deployment group validate --resource-group rg-20skin-prod \
  --template-file infra/main.bicep --parameters @infra/main.parameters.json

az deployment group what-if --resource-group rg-20skin-prod \
  --template-file infra/main.bicep --parameters @infra/main.parameters.json
```
