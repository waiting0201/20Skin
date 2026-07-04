// 20Skin 正式環境（prod-only）IaC 入口。
// 範圍：2x Static Web Apps（Free）+ 1x Azure Functions（.NET 10 isolated, Flex Consumption）
//      + Key Vault + Storage + Application Insights/Log Analytics + 既有 Azure SQL 的防火牆規則。
// 不處理：Resource Group 建立、既有 Azure SQL Server/Database 本身、Key Vault 機密實際值、
//        Microsoft Entra AAD 系統管理員設定、GitHub OIDC federated credential。
// 以上皆為一次性手動步驟，見 docs/design/infrastructure.md §一次性手動步驟。
//
// 部署方式（RG 需已存在，見上）：
//   az deployment group validate  --resource-group rg-20skin-prod --template-file main.bicep --parameters @main.parameters.json
//   az deployment group what-if   --resource-group rg-20skin-prod --template-file main.bicep --parameters @main.parameters.json
//   az deployment group create    --resource-group rg-20skin-prod --template-file main.bicep --parameters @main.parameters.json
//
// ⚠️ 本檔尚未在真實 Azure 訂閱跑過（任務範圍禁止對真實資源操作），Flex Consumption 的 ARM
// schema 變動較快，首次套用前務必先跑 validate + what-if，並視錯誤訊息微調 apiVersion/屬性名稱。

targetScope = 'resourceGroup'

@description('資源命名後綴，固定為 prod（本階段只做正式環境，不含 dev/staging）')
param envSuffix string = 'prod'

@description('部署區域，建議與既有 Azure SQL Server 同區以降低延遲與資料傳輸費用')
param location string = resourceGroup().location

@description('既有 Azure SQL Server 名稱（不含 .database.windows.net），例如 sql-20skin')
param existingSqlServerName string

@description('既有 Azure SQL Server 所在的 Resource Group（若與本次部署的 RG 不同，需明確指定）')
param existingSqlServerResourceGroup string = resourceGroup().name

@description('既有 Azure SQL Database 名稱（沿用，不可改 schema）')
param existingSqlDatabaseName string = '20Skin'

@description('重複預約視窗天數，key 為既有 Branchs.BranchID GUID，需查真實 prod DB 填入')
param bookingDuplicateWindowDaysByBranch object = {}

@description('分院別名 → Branchs.BranchID 對照，需查真實 prod DB 填入')
param periodsBranchIdByAlias object = {
  Ta: ''
  Ch: ''
  ChDentist: ''
}

@description('額外允許的 API CORS 來源（例如未來的自訂網域），SWA 預設網域已自動加入不需重複填')
param additionalCorsOrigins array = []

var tags = {
  project: '20skin'
  environment: envSuffix
  managedBy: 'bicep'
}

var uniqueSuffix = uniqueString(resourceGroup().id)

var names = {
  staticWebAppCustomer: 'swa-20skin-customer-${envSuffix}'
  staticWebAppAdmin: 'swa-20skin-admin-${envSuffix}'
  functionApp: 'func-20skin-api-${envSuffix}'
  functionPlan: 'plan-20skin-api-${envSuffix}'
  storage: 'st20skin${envSuffix}' // storage account 命名限制：僅小寫英數，需全球唯一
  keyVault: 'kv-20skin-${envSuffix}-${take(uniqueSuffix, 4)}' // Key Vault 名稱需全球唯一，加短後綴降低碰撞機率
  logAnalytics: 'log-20skin-${envSuffix}'
  appInsights: 'appi-20skin-${envSuffix}'
}

// ---- 觀測 ----
module logAnalytics 'modules/log-analytics.bicep' = {
  name: 'log-analytics'
  params: {
    name: names.logAnalytics
    location: location
    tags: tags
  }
}

module appInsights 'modules/app-insights.bicep' = {
  name: 'app-insights'
  params: {
    name: names.appInsights
    location: location
    logAnalyticsWorkspaceId: logAnalytics.outputs.id
    tags: tags
  }
}

// ---- 機密 ----
module keyVault 'modules/key-vault.bicep' = {
  name: 'key-vault'
  params: {
    name: names.keyVault
    location: location
    tenantId: subscription().tenantId
    tags: tags
  }
}

// ---- Storage（AzureWebJobsStorage + upload 容器 + RefreshTokens table + Flex 部署容器） ----
module storage 'modules/storage.bicep' = {
  name: 'storage'
  params: {
    name: names.storage
    location: location
    tags: tags
  }
}

// ---- 兩個 Static Web Apps（Free tier，各自獨立網站，不 link 任何 API） ----
module swaCustomer 'modules/static-web-app.bicep' = {
  name: 'swa-customer'
  params: {
    name: names.staticWebAppCustomer
    location: location
    // Standard tier（非 Free）：此 Azure 訂閱已有 10 個既有專案佔滿 Free tier 每訂閱上限，
    // 客戶前台改用 Standard 避免影響其他專案既有資源（使用者決定，2026-07-04）。
    // 後台 swaAdmin 維持 Free（已在額滿前成功建立，佔用最後一個 Free 名額）。
    sku: 'Standard'
    tags: union(tags, { unit: 'web-customer' })
  }
}

module swaAdmin 'modules/static-web-app.bicep' = {
  name: 'swa-admin'
  params: {
    name: names.staticWebAppAdmin
    location: location
    tags: union(tags, { unit: 'web-admin' })
  }
}

// ---- 既有 Azure SQL 的防火牆規則（不動既有伺服器/資料庫本身） ----
module sqlFirewall 'modules/sql-firewall.bicep' = {
  name: 'sql-firewall'
  scope: resourceGroup(existingSqlServerResourceGroup)
  params: {
    existingSqlServerName: existingSqlServerName
  }
}

// ---- Function App（Flex Consumption，CORS 允許兩個 SWA 的預設網域 + 額外自訂網域） ----
module functionApp 'modules/function-app.bicep' = {
  name: 'function-app'
  params: {
    name: names.functionApp
    location: location
    planName: names.functionPlan
    tags: union(tags, { unit: 'api' })
    storageDeploymentContainerUrl: storage.outputs.deploymentContainerUrl
    storageAccountName: names.storage
    appInsightsConnectionString: appInsights.outputs.connectionString
    keyVaultName: names.keyVault
    sqlServerFqdn: sqlFirewall.outputs.sqlServerFqdn
    sqlDatabaseName: existingSqlDatabaseName
    corsAllowedOrigins: concat(
      [
        'https://${swaCustomer.outputs.defaultHostname}'
        'https://${swaAdmin.outputs.defaultHostname}'
      ],
      additionalCorsOrigins
    )
    bookingDuplicateWindowDaysByBranch: bookingDuplicateWindowDaysByBranch
    periodsBranchIdByAlias: periodsBranchIdByAlias
  }
  // keyVaultName 只是字串參數（非 module output），Bicep 不會自動推導出對 keyVault module 的相依性，
  // 但 function-app.bicep 內部要對既有 Key Vault 做 RBAC 指派，故此處補明確 dependsOn。
  // storage 的相依性已透過 storageDeploymentContainerUrl 這個 output 隱含建立，不需重複宣告。
  dependsOn: [
    keyVault
  ]
}

// 注意：Function App 的 System-Assigned Identity 對 Key Vault / Storage 的 RBAC 角色指派
// 寫在 modules/function-app.bicep 內部（同檔引用 functionApp.identity.principalId），而非在此處
// 透過 module output 組 guid() 當資源名稱——Bicep 不允許把「跨 module 邊界的 output」用在
// roleAssignment 的 name 運算式（BCP120：name 需為部署開始時就能算出的值），寫在同一個 module
// 內直接引用資源屬性則不受此限制。

output resourceGroupName string = resourceGroup().name
output staticWebAppCustomerName string = swaCustomer.outputs.name
output staticWebAppCustomerDefaultHostname string = swaCustomer.outputs.defaultHostname
output staticWebAppAdminName string = swaAdmin.outputs.name
output staticWebAppAdminDefaultHostname string = swaAdmin.outputs.defaultHostname
output functionAppName string = functionApp.outputs.name
output functionAppDefaultHostname string = functionApp.outputs.defaultHostname
output keyVaultName string = names.keyVault
output storageAccountName string = names.storage
output sqlServerFqdn string = sqlFirewall.outputs.sqlServerFqdn
