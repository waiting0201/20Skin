export const environment = {
  production: true,
  // 不使用 SWA 的 Bring-your-own-API linking（Free tier 不支援此功能，見
  // docs/design/infrastructure.md §不使用 SWA API linking 決策），API 為完全獨立部署的
  // Azure Functions，故此處必須是絕對網址（非 '/api' 相對路徑），由 Function App CORS
  // 白名單放行本站網域。網域需與 infra/main.bicep 的 functionApp 命名一致，若命名調整需同步修改。
  apiBase: 'https://func-20skin-api-prod.azurewebsites.net/api',
  recaptchaSiteKey: '6LdrNI8cAAAAACrQIIxITCP1K3ZGMWyFrMYRPQkB', // reCAPTCHA v3 site key（公開；沿用舊站）
  // Storage 帳戶名稱需與 infra/modules/storage.bicep 的命名一致（見 infrastructure.md 命名表）。
  uploadBase: 'https://st20skinprod.blob.core.windows.net/upload',
};
