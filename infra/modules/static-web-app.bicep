// Azure Static Web Apps（Free tier）。刻意「裸建」：不設定 properties.repositoryUrl/branch，
// 因為部署走獨立的 GitHub Actions workflow + 部署權杖（見 .github/workflows/），
// 不使用 SWA 入口的「GitHub 整合」自動建立 workflow 機制。
//
// 重要決策（詳見 docs/design/infrastructure.md）：本專案兩個 SWA 皆不使用 SWA 的
// 「Bring your own API」/ Managed Functions API linking 功能——一來該功能兩個 SWA 要共用
// 同一支 API 並不適用（linking 是 1:1），二來 Free tier 本來就不支援 Bring your own API
// （官方文件明載僅 Standard tier 可用）。API 改為完全獨立部署的 Azure Functions，
// 兩個 SWA 純粹以瀏覽器 fetch + CORS 呼叫，見 modules/function-app.bicep 的 corsAllowedOrigins。
param name string
param location string
param sku string = 'Free'
param tags object = {}

resource swa 'Microsoft.Web/staticSites@2024-04-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: sku
    tier: sku
  }
  properties: {
    stagingEnvironmentPolicy: 'Enabled' // Free tier 上限 3 個 preview environment，見 quotas
    allowConfigFileUpdates: true
    provider: 'None'
  }
}

output name string = swa.name
output defaultHostname string = swa.properties.defaultHostname
output id string = swa.id
