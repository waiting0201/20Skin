import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { RecaptchaService } from '../../core/services/recaptcha.service';

/** 後台登入：帳號+密碼+reCAPTCHA。見 docs/blueprints/admin-auth-authority.md、docs/design/security.md。 */
@Component({
  selector: 'app-admin-login',
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

  readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.recaptcha.execute('login').then((token) => {
      this.auth.login({ ...this.form.getRawValue(), googleCaptchaToken: token }).subscribe({
        next: (res) => {
          this.loading.set(false);
          if (res.success) this.router.navigate(['/']);
          else this.error.set(res.message ?? '登入失敗');
        },
        error: () => {
          this.loading.set(false);
          this.error.set('系統忙線，請稍後再試');
        },
      });
    });
  }
}
