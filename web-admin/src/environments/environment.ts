export const environment = {
  production: false,
  apiBase: 'http://localhost:7071/api',
  recaptchaSiteKey: '',
  // Blob 公開容器 base（顯示既有照片用）；本機 = Azurite。正式改為儲存體帳號 URL + /upload。
  uploadBase: 'http://127.0.0.1:10000/devstoreaccount1/upload',
};
