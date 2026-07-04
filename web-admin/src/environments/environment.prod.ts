export const environment = {
  production: true,
  // 不使用 SWA 的 Bring-your-own-API linking（Free tier 不支援此功能，見
  // docs/design/infrastructure.md §不使用 SWA API linking 決策），兩個 SPA 共用同一支
  // 完全獨立部署的 Azure Functions，故此處必須是絕對網址（非 '/api' 相對路徑）。
  apiBase: 'https://func-20skin-api-prod.azurewebsites.net/api',
  // 沿用客戶前台的 site key（使用者決定，2026-07-04）。部署前務必先到 Google reCAPTCHA
  // 後台把後台正式網域加入該 key 的允許網域清單，否則 grecaptcha.execute 會擋下（domain mismatch）。
  recaptchaSiteKey: '6LdrNI8cAAAAACrQIIxITCP1K3ZGMWyFrMYRPQkB',
  // Storage 帳戶名稱需與 infra/modules/storage.bicep 的命名一致（見 infrastructure.md 命名表）。
  uploadBase: 'https://st20skinprod.blob.core.windows.net/upload',
};
