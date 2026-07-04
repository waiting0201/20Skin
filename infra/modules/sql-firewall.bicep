// 既有 Azure SQL Server 的連線設定（防火牆規則）。
// 刻意不建立/修改 Microsoft.Sql/servers 或 Microsoft.Sql/servers/databases 資源本身——
// `existing` 只是取得參照，`AllowAzureServices` 是新增一條子資源（防火牆規則），
// 不影響既有伺服器/資料庫的其他設定，符合「schema 與既有資源不可動」的限制。
//
// 注意：Azure SQL Managed Identity 驗證另需在既有伺服器上設定 Microsoft Entra 系統管理員 +
// 於資料庫內建立 contained user（T-SQL DDL），這兩步無法用 Bicep 完成，見
// docs/design/infrastructure.md §一次性手動步驟。
param existingSqlServerName string

resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' existing = {
  name: existingSqlServerName
}

resource allowAzureServices 'Microsoft.Sql/servers/firewallRules@2023-08-01-preview' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    // 特殊值 0.0.0.0-0.0.0.0：Azure 平台保留語意，允許任何 Azure 內部出口 IP（含本專案的
    // Flex Consumption Function App）連線；Consumption/Flex 方案的 outbound IP 非固定，
    // 無法用具體 IP 白名單，這是官方建議的標準做法。
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
