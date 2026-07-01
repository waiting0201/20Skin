import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LookupService } from '../../core/services/lookup.service';
import { RecaptchaService } from '../../core/services/recaptcha.service';
import { Zipcode } from '../../core/models';

/**
 * 初診會員註冊（JoinUs）。對應舊 Views/MainMs/JoinUs.cshtml，見 docs/blueprints/member-auth.md。
 * 文字欄用 Reactive Forms；城市→區連動、過敏史/病史多選以 signals 管理。
 * 註冊成功即登入態（後端回 JWT），導預約首頁。
 */
@Component({
  selector: 'app-join-us',
  imports: [ReactiveFormsModule],
  template: `
    <main id="main">
      <div class="online-item">
        <div class="item-block">
          <div class="online-in-item">
            <div class="item-right">
              <form [formGroup]="form">
                <div class="online-in-title-block first">
                  <div class="online-title blue">初診資料建檔</div>
                </div>

                @if (error()) {
                  <div class="field-validation-error" style="display:block; margin-bottom:8px;">{{ error() }}</div>
                }

                <div class="online-in-field-block">
                  <div class="field-title">姓&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;名 ｜</div>
                  <div class="field-text"><input formControlName="name" maxlength="15" type="text" /></div>
                  @if (invalid('name')) { <span class="field-validation-error">請輸入真實姓名</span> }
                </div>

                <div class="online-in-field-block">
                  <div class="field-title">身分證號 ｜</div>
                  <div class="field-text"><input formControlName="number" maxlength="10" type="text" /></div>
                  @if (invalid('number')) { <span class="field-validation-error">請輸入有效身分證號</span> }
                </div>

                <div class="online-in-field-block">
                  <div class="field-title">手機號碼 ｜</div>
                  <div class="field-text"><input formControlName="mobile" maxlength="10" type="text" placeholder="例：0987654321" /></div>
                  @if (invalid('mobile')) { <span class="field-validation-error">手機格式錯誤（例：0987654321）</span> }
                </div>

                <div class="online-in-field-block">
                  <div class="field-title">生&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;日 ｜</div>
                  <div class="field-text">
                    <select formControlName="yyyy">
                      <option [value]="0">　年</option>
                      @for (y of years; track y) { <option [value]="y">{{ y - 1911 }} 年</option> }
                    </select>
                    <select formControlName="mm">
                      <option [value]="0">　月</option>
                      @for (m of months; track m) { <option [value]="m">{{ m }} 月</option> }
                    </select>
                    <select formControlName="dd">
                      <option [value]="0">　日</option>
                      @for (d of days; track d) { <option [value]="d">{{ d }} 日</option> }
                    </select>
                  </div>
                  @if (invalidBirthday()) { <span class="field-validation-error">請選擇完整生日</span> }
                </div>

                <div class="online-in-field-block">
                  <div class="field-title">性&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;別 ｜</div>
                  <div class="field-text">
                    <select formControlName="gender">
                      <option [value]="0">　請選擇</option>
                      <option [value]="1">男</option>
                      <option [value]="2">女</option>
                    </select>
                  </div>
                  @if (invalidGender()) { <span class="field-validation-error">請選擇性別</span> }
                </div>

                <div class="online-in-field-block">
                  <div class="field-title">血&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;型 ｜</div>
                  <div class="field-text">
                    <select formControlName="bloodType">
                      <option value="">　請選擇</option>
                      @for (b of bloodTypes; track b.value) { <option [value]="b.value">{{ b.label }}</option> }
                    </select>
                  </div>
                  @if (invalid('bloodType')) { <span class="field-validation-error">請選擇血型</span> }
                </div>

                <div class="online-in-field-block">
                  <div class="field-title">E-mail ｜</div>
                  <div class="field-text"><input formControlName="email" maxlength="150" type="email" /></div>
                  @if (invalid('email')) { <span class="field-validation-error">Email 格式錯誤</span> }
                </div>

                <div class="online-in-field-block">
                  <div class="field-title">縣市地區 ｜</div>
                  <div class="field-text">
                    <select [value]="selectedCity()" (change)="onCity($any($event.target).value)">
                      <option value="">請選擇城市</option>
                      @for (c of cities(); track c) { <option [value]="c">{{ c }}</option> }
                    </select>
                    <select [value]="zipcodeId() ?? ''" (change)="zipcodeId.set(+$any($event.target).value || null)">
                      <option value="">鄉鎮市區</option>
                      @for (a of areas(); track a.zipcodeId) { <option [value]="a.zipcodeId">{{ a.area }}</option> }
                    </select>
                  </div>
                  @if (touched() && !zipcodeId()) { <span class="field-validation-error">請選擇縣市與地區</span> }
                </div>

                <div class="online-in-field-block">
                  <div class="field-title">詳細地址 ｜</div>
                  <div class="field-text"><input formControlName="address" maxlength="250" type="text" /></div>
                  @if (invalid('address')) { <span class="field-validation-error">請輸入地址</span> }
                </div>

                <div class="online-in-field-block">
                  <div class="field-title">緊急聯絡人 ｜</div>
                  <div class="field-text"><input formControlName="emergencyName" maxlength="20" type="text" /></div>
                  @if (invalid('emergencyName')) { <span class="field-validation-error">請輸入緊急聯絡人</span> }
                </div>

                <div class="online-in-field-block">
                  <div class="field-title">緊急聯絡電話 ｜</div>
                  <div class="field-text"><input formControlName="emergencyPhone" maxlength="15" type="text" /></div>
                  @if (invalid('emergencyPhone')) { <span class="field-validation-error">請輸入緊急聯絡電話</span> }
                </div>

                <div class="online-in-field-block">
                  <div class="field-title">藥物過敏史 ｜</div>
                  <div class="field-text">
                    @for (a of allergyOptions; track a) {
                      <label style="margin-right:12px;">
                        <input type="checkbox" [checked]="allergySet().has(a)" (change)="toggle(allergySet, a)" /> {{ a }}
                      </label>
                    }
                    @if (allergySet().has('其他')) {
                      <input formControlName="allergyOther" maxlength="50" type="text" placeholder="請填寫" />
                    }
                  </div>
                  @if (touched() && allergySet().size === 0) { <span class="field-validation-error">請選擇藥物過敏史</span> }
                </div>

                <div class="online-in-field-block">
                  <div class="field-title">重大傷病/慢性病史 ｜</div>
                  <div class="field-text">
                    @for (m of medicalOptions; track m) {
                      <label style="margin-right:12px;">
                        <input type="checkbox" [checked]="medicalSet().has(m)" (change)="toggle(medicalSet, m)" /> {{ m }}
                      </label>
                    }
                    @if (medicalSet().has('其他')) {
                      <input formControlName="medicalHistoryOther" maxlength="50" type="text" placeholder="請填寫" />
                    }
                  </div>
                  @if (touched() && medicalSet().size === 0) { <span class="field-validation-error">請選擇重大傷病或慢性病史</span> }
                </div>

                <div class="online-in-title-block second">
                  <div class="online-btn right">
                    <a href="javascript:;" (click)="submit()" [style.opacity]="loading() ? '0.5' : '1'">
                      {{ loading() ? '送出中…' : '送出並登入' }}
                    </a>
                  </div>
                  <div class="online-btn right">
                    <a href="javascript:;" (click)="cancel()">回登入</a>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  `,
})
export class JoinUsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly lookup = inject(LookupService);
  private readonly recaptcha = inject(RecaptchaService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly years = Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - 99 + i);
  readonly months = Array.from({ length: 12 }, (_, i) => i + 1);
  readonly days = Array.from({ length: 31 }, (_, i) => i + 1);
  readonly bloodTypes = [
    { value: 'O', label: 'O' }, { value: 'A', label: 'A' }, { value: 'B', label: 'B' },
    { value: 'AB', label: 'AB' }, { value: 'NO', label: '不清楚' },
  ];
  readonly allergyOptions = ['無', '磺胺劑', '青黴素', 'Pyrine匹林類', '其他'];
  readonly medicalOptions = ['無', '糖尿病', '高血壓', '其他'];

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly touched = signal(false);

  private readonly zipcodes = signal<Zipcode[]>([]);
  readonly selectedCity = signal<string>('');
  readonly zipcodeId = signal<number | null>(null);
  readonly allergySet = signal<Set<string>>(new Set());
  readonly medicalSet = signal<Set<string>>(new Set());

  readonly cities = computed(() => [...new Set(this.zipcodes().map((z) => z.city))]);
  readonly areas = computed(() => this.zipcodes().filter((z) => z.city === this.selectedCity()));

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(15)]],
    number: ['', [Validators.required, Validators.pattern(/^[A-Za-z]\d{9}$/)]],
    mobile: ['', [Validators.required, Validators.pattern(/^09\d{8}$/)]],
    yyyy: [0, Validators.required],
    mm: [0, Validators.required],
    dd: [0, Validators.required],
    gender: [0, Validators.required],
    bloodType: ['', Validators.required],
    email: ['', [Validators.email, Validators.maxLength(150)]],
    address: ['', [Validators.required, Validators.maxLength(250)]],
    emergencyName: ['', [Validators.required, Validators.maxLength(20)]],
    emergencyPhone: ['', [Validators.required, Validators.maxLength(15)]],
    allergyOther: ['', Validators.maxLength(50)],
    medicalHistoryOther: ['', Validators.maxLength(50)],
  });

  constructor() {
    // 由登入頁帶入身分證/生日（查無會員時導來）。
    const qp = this.route.snapshot.queryParamMap;
    this.form.patchValue({
      number: qp.get('number') ?? '',
      yyyy: +(qp.get('yyyy') ?? 0),
      mm: +(qp.get('mm') ?? 0),
      dd: +(qp.get('dd') ?? 0),
    });
    this.lookup.zipcodes().subscribe({
      next: (z) => this.zipcodes.set(z),
      error: () => this.error.set('載入地區資料失敗，請稍後再試'),
    });
  }

  invalid(name: keyof typeof this.form.controls): boolean {
    const c = this.form.controls[name];
    return (c.touched || this.touched()) && c.invalid;
  }
  invalidBirthday(): boolean {
    const c = this.form.controls;
    return this.touched() && (!c.yyyy.value || !c.mm.value || !c.dd.value);
  }
  invalidGender(): boolean {
    return (this.form.controls.gender.touched || this.touched()) && !this.form.controls.gender.value;
  }

  onCity(city: string) {
    this.selectedCity.set(city);
    this.zipcodeId.set(null); // 換城市清空區
  }

  toggle(set: typeof this.allergySet, value: string) {
    const next = new Set(set());
    next.has(value) ? next.delete(value) : next.add(value);
    set.set(next);
  }

  submit() {
    this.touched.set(true);
    this.form.markAllAsTouched();
    const okForm = this.form.valid && !!this.form.controls.yyyy.value
      && !!this.form.controls.mm.value && !!this.form.controls.dd.value && !!this.form.controls.gender.value;
    if (!okForm || !this.zipcodeId() || this.allergySet().size === 0 || this.medicalSet().size === 0) {
      this.error.set('請完整填寫必填欄位');
      window.scrollTo({ top: 0 });
      return;
    }
    this.error.set(null);
    this.loading.set(true);
    const v = this.form.getRawValue();
    this.recaptcha.execute('login').then((token) => {
    this.auth
      .register({
        number: v.number.toUpperCase(),
        yyyy: v.yyyy, mm: v.mm, dd: v.dd,
        name: v.name, mobile: v.mobile,
        gender: v.gender, bloodType: v.bloodType,
        email: v.email || null,
        zipcodeId: this.zipcodeId(),
        address: v.address,
        emergencyName: v.emergencyName,
        emergencyPhone: v.emergencyPhone,
        allergy: [...this.allergySet()],
        allergyOther: this.allergySet().has('其他') ? (v.allergyOther || null) : null,
        medicalHistory: [...this.medicalSet()],
        medicalHistoryOther: this.medicalSet().has('其他') ? (v.medicalHistoryOther || null) : null,
        googleCaptchaToken: token,
      })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          if (res.success && res.data?.status === 1) this.router.navigate(['/']);
          else if (res.data?.status === 3) this.error.set(res.data.message ?? '此帳號已被限制');
          else this.error.set(res.message ?? '註冊失敗');
        },
        error: () => { this.loading.set(false); this.error.set('系統忙線，請稍後再試'); },
      });
    });
  }

  cancel() {
    this.router.navigate(['/login']);
  }
}
