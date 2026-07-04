// Application Insights（workspace-based）：Function App 的 Serilog + Functions Worker 皆已串接
// Microsoft.ApplicationInsights.WorkerService，僅需提供 APPLICATIONINSIGHTS_CONNECTION_STRING。
param name string
param location string
param logAnalyticsWorkspaceId string
param tags object = {}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: name
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspaceId
    IngestionMode: 'LogAnalytics'
  }
}

output connectionString string = appInsights.properties.ConnectionString
output id string = appInsights.id
