// Key Vault：啟用 RBAC 授權模式（非舊式 Access Policy），機密存取一律透過角色指派。
// 本模組只建立「空的」Key Vault；實際機密值一律由人工事後以 az keyvault secret set 寫入
// （見 docs/design/infrastructure.md §一次性手動步驟），不可寫入 Bicep 參數或原始碼。
param name string
param location string
param tenantId string
param tags object = {}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    // 訂閱層級的 Azure Policy 強制要求 Key Vault 開啟 purge protection（部署時實測
    // BadRequest：「enablePurgeProtection cannot be set to false」），故改為 true。
    // 這是不可逆設定：之後即使刪除此 Vault，90 天內仍會保留在「已刪除」狀態且名稱/配額
    // 持續被佔用，需 az keyvault purge 才能真正釋放（且 purge protection 開啟後這個
    // purge 動作本身也會被拒絕，需等 90 天到期自動清除）。
    enablePurgeProtection: true
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

output id string = keyVault.id
output name string = keyVault.name
output uri string = keyVault.properties.vaultUri
