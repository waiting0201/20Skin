// 單一 Storage Account，身兼三種用途（決策見 docs/design/infrastructure.md §Storage 帳戶設計）：
//   1. AzureWebJobsStorage（Functions host：Timer trigger 分散式鎖 / binding 用）— 連線字串走 Key Vault
//   2. Blob 容器 `upload`（取代舊 ~/Upload，圖片/問卷掃描檔；PublicAccessType.Blob，沿用既有程式碼
//      Skin.Services/Storage/BlobFileStorage.cs 的公開讀取假設）
//   3. Table `RefreshTokens`（refresh token 儲存位置，20Skin DB schema 不可改，見 security.md）
// 另外開一個獨立容器（非 Blob 公開）供 Azure Functions Flex Consumption 部署套件使用，
// 存取一律走 Function App 的 System-Assigned Identity（不落地任何金鑰），與上述業務用途金鑰式存取分離。
param name string
param location string
param deploymentContainerName string = 'app-package-deploy'
param uploadContainerName string = 'upload'
param tags object = {}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowSharedKeyAccess: true // AzureWebJobsStorage / BlobFileStorage 現況需要連線字串，見上方說明
    allowBlobPublicAccess: true // upload 容器需要 PublicAccessType.Blob（沿用舊系統公開靜態檔行為）
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

resource blobServices 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource uploadContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobServices
  name: uploadContainerName
  properties: {
    publicAccess: 'Blob'
  }
}

resource deploymentContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobServices
  name: deploymentContainerName
  properties: {
    publicAccess: 'None'
  }
}

resource tableServices 'Microsoft.Storage/storageAccounts/tableServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource refreshTokenTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableServices
  name: 'RefreshTokens'
}

output id string = storage.id
output name string = storage.name
output primaryBlobEndpoint string = storage.properties.primaryEndpoints.blob
output deploymentContainerUrl string = '${storage.properties.primaryEndpoints.blob}${deploymentContainerName}'
output uploadContainerUrl string = '${storage.properties.primaryEndpoints.blob}${uploadContainerName}'
