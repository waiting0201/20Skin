export const environment = {
  production: false,
  apiBase: 'http://localhost:7071/api',
  recaptchaSiteKey: '6LdrNI8cAAAAACrQIIxITCP1K3ZGMWyFrMYRPQkB', // reCAPTCHA v3 site key（公開；沿用客戶前台同一把，見 docs/design/security.md）
  // Blob 公開容器 base（顯示既有照片用）；本機 = Azurite。正式改為儲存體帳號 URL + /upload。
  uploadBase: 'http://127.0.0.1:10000/devstoreaccount1/upload',
};
