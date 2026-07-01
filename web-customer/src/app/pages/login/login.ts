import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { RecaptchaService } from '../../core/services/recaptcha.service';

/**
 * 會員登入：身分證 + 生日（民國年三選單）+ reCAPTCHA。
 * 對應舊 Views/MainMs/Login.cshtml，見 docs/blueprints/member-auth.md。
 */
@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly recaptcha = inject(RecaptchaService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // 民國年下拉（今年起前 100 年），由小到大排序（對應舊 for(i=y-100; i<=y) 升冪）
  readonly years = Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - 99 + i);
  readonly months = Array.from({ length: 12 }, (_, i) => i + 1);
  readonly days = Array.from({ length: 31 }, (_, i) => i + 1);

  readonly form = this.fb.nonNullable.group({
    number: ['', [Validators.required, Validators.pattern(/^[A-Z]\d{9}$/)]],
    yyyy: [0, Validators.required],
    mm: [0, Validators.required],
    dd: [0, Validators.required],
  });

  /** dest：登入成功後導向頁（進入預約 → '/'；預約查詢 → '/appointments'）。 */
  submit(dest: string = '/') {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const v = this.form.getRawValue();
    this.recaptcha.execute('login').then((token) => {
    this.auth.login({ ...v, googleCaptchaToken: token }).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data?.status === 1) {
          this.router.navigate([dest]);
        } else if (res.data?.status === 2) {
          // 查無會員 → 導初診建檔，帶入已填的身分證+生日
          this.router.navigate(['/join-us'], { queryParams: { number: v.number, yyyy: v.yyyy, mm: v.mm, dd: v.dd } });
        } else {
          this.error.set(res.message ?? '登入失敗');
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set('系統忙線，請稍後再試');
      },
    });
    });
  }
}
