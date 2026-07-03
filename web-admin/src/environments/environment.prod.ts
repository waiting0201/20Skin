export const environment = {
  production: true,
  apiBase: '/api',
  // 正式部署前必填：後台為獨立網域（見 docs/design/infrastructure.md），沿用客戶前台的 site key
  // 前須先到 Google reCAPTCHA 後台把後台正式網域加入該 key 的允許網域清單，否則 grecaptcha.execute 會擋下（domain mismatch）。
  recaptchaSiteKey: '',
  uploadBase: '', // 正式部署填 Blob 儲存體公開容器 URL（如 https://<acct>.blob.core.windows.net/upload）
};
