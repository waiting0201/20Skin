import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

declare global {
  interface Window {
    grecaptcha?: {
      ready(cb: () => void): void;
      execute(siteKey: string, opts: { action: string }): Promise<string>;
    };
  }
}

/**
 * reCAPTCHA v3（見 docs/design/security.md）。
 * 動態載入 Google script（避免把 site key 編進 index.html）。
 * dev：environment.recaptchaSiteKey 為空 → execute 回 ''（後端未設 secret 時放行）。
 * 後端各端點 expectedAction 皆為 "login"（含註冊），故 action 一律 'login'。
 */
@Injectable({ providedIn: 'root' })
export class RecaptchaService {
  private readonly siteKey = environment.recaptchaSiteKey;
  private loading: Promise<void> | null = null;

  private load(): Promise<void> {
    if (!this.siteKey) return Promise.resolve();
    if (window.grecaptcha) return Promise.resolve();
    if (this.loading) return this.loading;
    this.loading = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `https://www.google.com/recaptcha/api.js?render=${this.siteKey}`;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('reCAPTCHA 載入失敗'));
      document.head.appendChild(s);
    });
    return this.loading;
  }

  /** 取得 token；無 site key（dev）或失敗時回 ''（後端據 secret 決定是否放行）。 */
  async execute(action = 'login'): Promise<string> {
    if (!this.siteKey) return '';
    try {
      await this.load();
      const grecaptcha = window.grecaptcha;
      if (!grecaptcha) return '';
      return await new Promise<string>((resolve) => {
        grecaptcha.ready(() => {
          grecaptcha.execute(this.siteKey, { action }).then(
            (token) => resolve(token),
            () => resolve(''),
          );
        });
      });
    } catch {
      return '';
    }
  }
}
