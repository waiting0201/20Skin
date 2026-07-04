// Azure Functions .NET 10 isolated worker，Flex Consumption plan（Linux）。
// 取捨（詳見 docs/design/infrastructure.md §Function App 方案選擇）：
//   - 用 Flex Consumption 而非傳統 Consumption（Y1）：.NET 10 isolated 官方已支援 Flex Consumption，
//     傳統 Consumption 在 Linux 上即將於 2028 年淘汰（見文件內引用來源），新專案直接上 Flex 較不用之後再遷移；
//     代價是 Flex 只能跑 Linux（本專案無 Windows-only 依賴，可接受）。
//   - 部署套件走 Flex Consumption 的 identity-based deployment storage（見 storageDeploymentContainerUrl 參數），
//     不落地任何 Storage 金鑰；業務用的 AzureWebJobsStorage 仍走連線字串（見 modules/storage.bicep 註解）。
param name string
param location string
param planName string
param tags object = {}

param storageDeploymentContainerUrl string
param storageAccountName string
param appInsightsConnectionString string
param keyVaultName string

param sqlServerFqdn string
param sqlDatabaseName string

@description('允許呼叫此 API 的來源網域（兩個 SWA 的 defaultHostname，加上未來的自訂網域）')
param corsAllowedOrigins array

@description('Flex Consumption 執行個體規格：2048 = 2GB，可選 512/2048/4096')
param instanceMemoryMB int = 2048
param maximumInstanceCount int = 40

@description('''
重複預約視窗天數，key 為既有 Branchs.BranchID（GUID，非機密但為既有 DB 資料，須由操作者查詢
正式 20Skin DB 後填入，見 infrastructure.md §一次性手動步驟）。範例：{ "e65f4720-82a3-498a-9447-fb5dc910999e": 2 }
''')
param bookingDuplicateWindowDaysByBranch object = {}

@description('客戶前台預約流程用的分院別名 → Branchs.BranchID 對照（同上，須查真實 DB 填入）')
param periodsBranchIdByAlias object = {
  Ta: ''
  Ch: ''
  ChDentist: ''
}

// 分院設定改用單一 JSON 字串 App Setting（`Booking__DuplicateWindowDaysByBranchJson` /
// `Periods__BranchIdByAliasJson`），而非逐分院攤平成個別 App Setting。
// 原因（實測部署時發現）：Flex Consumption 的 ARM 驗證會拒絕任何「名稱含連字號」的 App Setting，
// 但 Branchs.BranchID 是 GUID、必定含連字號，若攤平成 `Periods__BranchIdByAlias__<GUID>` 這種
// 每個 GUID 各自一條 App Setting 的寫法，部署一定失敗（"AppSetting with name '...' is not allowed"）。
// App Setting 的「值」不受這個名稱限制，因此改成一條 JSON 字串設定，並同步修改
// `api/20Skin.Api/Program.cs`（`ReadBranchAliasMap`/`ReadBookingWindowMap`）：本機
// `local.settings.json` 仍可用巢狀 key（`config.GetSection(...).GetChildren()` 優先，行為不變），
// 只有在巢排 key 查無資料時才 fallback 解析這條 JSON 字串。
var bookingWindowJson = string(bookingDuplicateWindowDaysByBranch)
var periodsAliasJson = string(periodsBranchIdByAlias)

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  tags: tags
  sku: {
    name: 'FC1'
    tier: 'FlexConsumption'
  }
  properties: {
    reserved: true // Linux
  }
}

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: name
  location: location
  tags: tags
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: storageDeploymentContainerUrl
          authentication: {
            type: 'SystemAssignedIdentity'
          }
        }
      }
      scaleAndConcurrency: {
        maximumInstanceCount: maximumInstanceCount
        instanceMemoryMB: instanceMemoryMB
      }
      runtime: {
        name: 'dotnet-isolated'
        version: '10.0'
      }
    }
    siteConfig: {
      cors: {
        allowedOrigins: corsAllowedOrigins
        supportCredentials: false // 認證走 JWT Bearer，非 cookie，見 security.md
      }
    }
  }

  resource appSettings 'config' = {
    name: 'appsettings'
    properties: {
        // ---- Functions/Worker 執行期 ----
        // 注意：Flex Consumption 的 worker runtime 由上面 functionAppConfig.runtime 決定，
        // 若在 appsettings 額外設定 FUNCTIONS_WORKER_RUNTIME 會被 ARM 拒絕（BadRequest，
        // 實測部署時發現），故不重複設定，僅傳統 Consumption/Premium 方案才需要這個 app setting。
        APPLICATIONINSIGHTS_CONNECTION_STRING: appInsightsConnectionString
        WEBSITE_TIME_ZONE: 'Asia/Taipei' // Timer trigger（簡訊排程）尚未實作，先備妥時區設定

        // ---- AzureWebJobsStorage：連線字串走 Key Vault reference（見 storage.bicep 註解） ----
        AzureWebJobsStorage: '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/Storage-ConnectionString/)'

        // ---- 既有 DB 連線：Managed Identity 免密碼（見 infrastructure.md §DB 連線方式決策） ----
        // 若改走 SQL 帳密 fallback，改成 Key Vault reference 指向 Sql-ConnectionString-Fallback。
        //
        // 注意（下方所有巢狀設定鍵名一律改用雙底線 `__` 而非冒號 `:`）：實測部署 Flex Consumption
        // 時，ARM 對 Microsoft.Web/sites/config 'appsettings' 的名稱驗證會拒絕任何含冒號的鍵
        // （不只 "ConnectionStrings:" 這個保留字首，`Jwt:SigningKey` 等一般巢狀鍵同樣被拒）。
        // 雙底線是 .NET 設定系統的標準巢狀鍵表示法（Linux App Service 本來就會把含冒號的設定名稱
        // 轉成雙底線環境變數），執行期 `config["ConnectionStrings:SkinDatabase"]`／
        // `config["Jwt:SigningKey"]` 等既有程式碼讀取結果與寫成冒號完全相同，零程式碼改動。
        ConnectionStrings__SkinDatabase: 'Server=tcp:${sqlServerFqdn},1433;Initial Catalog=${sqlDatabaseName};Authentication=Active Directory Managed Identity;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;'

        // ---- 機密：一律 Key Vault reference，實際值由人工一次性寫入（見 infrastructure.md）----
        Jwt__SigningKey: '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/Jwt-SigningKey/)'
        Recaptcha__SecretKey: '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/Recaptcha-SecretKey/)'
        SuperAdmin__Username: '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/SuperAdmin-Username/)'
        SuperAdmin__Password: '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/SuperAdmin-Password/)'

        // ---- 非機密設定（比照 local.settings.json，正式環境視需要覆寫）----
        Jwt__Issuer: '20skin'
        Jwt__Audience: '20skin-client'
        Jwt__AccessTokenMinutes: '60'
        Jwt__AdminAccessTokenMinutes: '600' // 後台管理員 10 小時（櫃檯整天作業免頻繁重登，決策 2026-07-04）
        Recaptcha__MinScore: '0.5' // 正式環境維持舊系統門檻，見 security.md §MinScore 門檻決策

        // ---- 智邦 SMS（尚未實作，DevNoOpSmsSender 佔位；串接完成後改用下列 KV reference）----
        // Sms__ApiUrl: '...'
        // Sms__ApiKey: '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}${environment().suffixes.keyvaultDns}/secrets/Sms-ApiKey/)'

        // ---- 分院設定：單一 JSON 字串（見上方 var 宣告的說明，取代逐分院攤平 App Setting）----
        Booking__DuplicateWindowDaysByBranchJson: bookingWindowJson
        Periods__BranchIdByAliasJson: periodsAliasJson
    }
  }
}

// ---- RBAC：Function App 的 System-Assigned Identity 取用 Key Vault 機密 + Storage 部署容器 ----
// 刻意寫在同一個 module 內（引用 functionApp.identity.principalId 屬性），而非在 main.bicep
// 用跨 module 的 output 組 guid() 當資源名稱——後者會被 Bicep 擋下（BCP120：roleAssignment 的
// name 需為部署開始時就能算出的值，跨 module output 不符合）。
var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'
var storageBlobDataOwnerRoleId = 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'

resource keyVaultRef 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource storageRef 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

resource functionAppKeyVaultAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVaultRef.id, functionApp.id, keyVaultSecretsUserRoleId)
  scope: keyVaultRef
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource functionAppStorageAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageRef.id, functionApp.id, storageBlobDataOwnerRoleId)
  scope: storageRef
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataOwnerRoleId)
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output principalId string = functionApp.identity.principalId
output name string = functionApp.name
output defaultHostname string = functionApp.properties.defaultHostName
output id string = functionApp.id
