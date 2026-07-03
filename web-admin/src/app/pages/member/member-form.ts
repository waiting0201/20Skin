import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MemberApiService } from '../../core/services/member-api.service';
import { LookupService } from '../../core/services/lookup.service';
import { MemberUpdateRequest, Zipcode } from '../../core/models';

/**
 * 後台會員管理 — 編輯（對應舊 MemberMs/EditMembers.cshtml）。
 * 身分證號唯讀不可改；城市/區連動 + 過敏史/病史多選比照 web-customer/join-us.ts 的 signals 模式
 * （各自獨立一份，不共用跨專案程式碼）；沿用同一批業務詞彙選項。
 */
@Component({
  selector: 'app-member-form',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="bg-white rounded shadow-sm border border-hairline max-w-3xl">
      <div class="px-5 py-3 border-b border-hairline">
        <h1 class="text-base font-semibold text-ink"><i class="fa fa-pencil-square-o text-muted mr-2"></i>編輯會員</h1>
      </div>

      @if (error()) {
        <div class="mx-5 mt-4 text-sm text-red-500">{{ error() }}</div>
      }

      @if (loaded()) {
        <form [formGroup]="form" (ngSubmit)="submit()" class="p-5 space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium text-ink mb-1">身分證號</label>
              <p class="text-sm text-muted py-2">{{ number() }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-ink mb-1">手機號碼 <span class="text-red-400">*</span></label>
              <input formControlName="mobile" maxlength="15"
                     class="w-full border border-hairline rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
            </div>
            <div>
              <label class="block text-sm font-medium text-ink mb-1">生日 <span class="text-red-400">*</span></label>
              <input type="date" formControlName="birthday"
                     class="w-full border border-hairline rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium text-ink mb-1">姓名</label>
              <input formControlName="name" maxlength="20"
                     class="w-full border border-hairline rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
            </div>
            <div>
              <label class="block text-sm font-medium text-ink mb-1">性別</label>
              <div class="py-2">
                <label class="mr-4 text-sm"><input type="radio" formControlName="gender" [value]="1" /> 男生</label>
                <label class="text-sm"><input type="radio" formControlName="gender" [value]="2" /> 女生</label>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-ink mb-1">血型</label>
              <select formControlName="bloodType" class="w-full border border-hairline rounded px-3 py-2 text-sm">
                @for (b of bloodTypes; track b.value) { <option [value]="b.value">{{ b.label }}</option> }
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium text-ink mb-1">Email</label>
              <input formControlName="email" maxlength="150" type="email"
                     class="w-full border border-hairline rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
            </div>
            <div>
              <label class="block text-sm font-medium text-ink mb-1">緊急聯絡人</label>
              <input formControlName="emergencyName" maxlength="20"
                     class="w-full border border-hairline rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
            </div>
            <div>
              <label class="block text-sm font-medium text-ink mb-1">緊急聯絡電話</label>
              <input formControlName="emergencyPhone" maxlength="15"
                     class="w-full border border-hairline rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-ink mb-1">地址</label>
            <div class="flex flex-wrap gap-2 mb-2">
              <select [value]="selectedCity()" (change)="onCity($any($event.target).value)"
                      class="border border-hairline rounded px-2 py-1.5 text-sm">
                <option value="">請選擇縣市</option>
                @for (c of cities(); track c) { <option [value]="c">{{ c }}</option> }
              </select>
              <select [value]="zipcodeId() ?? ''" (change)="zipcodeId.set(+$any($event.target).value || null)"
                      class="border border-hairline rounded px-2 py-1.5 text-sm">
                <option value="">鄉鎮市區</option>
                @for (a of areas(); track a.zipcodeId) { <option [value]="a.zipcodeId">{{ a.area }}</option> }
              </select>
            </div>
            <input formControlName="address" maxlength="250"
                   class="w-full border border-hairline rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-ink mb-1">藥物過敏史</label>
              <div class="flex flex-wrap gap-3">
                @for (a of allergyOptions; track a) {
                  <label class="text-sm">
                    <input type="checkbox" [checked]="allergySet().has(a)" (change)="toggle(allergySet, a)" /> {{ a }}
                  </label>
                }
              </div>
              @if (allergySet().has('其他')) {
                <input formControlName="allergyOther" maxlength="50" class="mt-2 w-full border border-hairline rounded px-3 py-1.5 text-sm" placeholder="請填寫" />
              }
            </div>

            <div>
              <label class="block text-sm font-medium text-ink mb-1">重大傷病或慢性病史</label>
              <div class="flex flex-wrap gap-3">
                @for (m of medicalOptions; track m) {
                  <label class="text-sm">
                    <input type="checkbox" [checked]="medicalSet().has(m)" (change)="toggle(medicalSet, m)" /> {{ m }}
                  </label>
                }
              </div>
              @if (medicalSet().has('其他')) {
                <input formControlName="medicalHistoryOther" maxlength="50" class="mt-2 w-full border border-hairline rounded px-3 py-1.5 text-sm" placeholder="請填寫" />
              }
            </div>
          </div>

          <div class="flex items-center gap-2">
            <input type="checkbox" id="isBlackList" formControlName="isBlackList" />
            <label for="isBlackList" class="text-sm text-ink">黑名單</label>
          </div>

          <div class="flex items-center gap-2 pt-2">
            <button type="submit" [disabled]="saving()"
                    class="bg-brand text-white text-sm rounded px-4 py-2 hover:bg-brand-deep disabled:opacity-50">
              {{ saving() ? '儲存中…' : '確認' }}
            </button>
            <a routerLink="/member" class="text-sm text-muted hover:text-ink px-3 py-2">取消</a>
          </div>
        </form>
      }
    </div>
  `,
})
export class MemberFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(MemberApiService);
  private readonly lookup = inject(LookupService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly memberId = this.route.snapshot.paramMap.get('id')!;

  readonly bloodTypes = [
    { value: 'O', label: 'O' }, { value: 'A', label: 'A' }, { value: 'B', label: 'B' },
    { value: 'AB', label: 'AB' }, { value: 'NO', label: '不清楚' },
  ];
  readonly allergyOptions = ['無', '磺胺劑', '青黴素', 'Pyrine匹林類', '其他'];
  readonly medicalOptions = ['無', '糖尿病', '高血壓', '其他'];

  readonly loaded = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly number = signal('');

  private readonly zipcodes = signal<Zipcode[]>([]);
  readonly selectedCity = signal<string>('');
  readonly zipcodeId = signal<number | null>(null);
  readonly allergySet = signal<Set<string>>(new Set());
  readonly medicalSet = signal<Set<string>>(new Set());

  readonly cities = computed(() => [...new Set(this.zipcodes().map((z) => z.city))]);
  readonly areas = computed(() => this.zipcodes().filter((z) => z.city === this.selectedCity()));

  readonly form = this.fb.nonNullable.group({
    mobile: ['', [Validators.required, Validators.maxLength(15)]],
    birthday: ['', Validators.required],
    name: ['', Validators.maxLength(20)],
    gender: [0],
    bloodType: [''],
    email: ['', [Validators.email, Validators.maxLength(150)]],
    address: ['', Validators.maxLength(250)],
    emergencyName: ['', Validators.maxLength(20)],
    emergencyPhone: ['', Validators.maxLength(15)],
    allergyOther: ['', Validators.maxLength(50)],
    medicalHistoryOther: ['', Validators.maxLength(50)],
    isBlackList: [false],
  });

  constructor() {
    // 城市/區 <select> 用原生 [value] 綁定（非 ngModel），瀏覽器要求「賦值當下」須已存在對應 <option>
    // 才會生效，否則靜默失敗且之後選項出現也不會自動回填（經 Playwright 實測重現）。
    // 故 zipcodes（決定 <option> 清單）必須先載入完成、選項先render，才能載入會員資料去 set 已選城市/區，
    // 兩者不可平行送出——見 docs/design/frontend-backend.md §下拉選單預設值規範。
    this.lookup.zipcodes().subscribe({
      next: (z) => {
        this.zipcodes.set(z);
        this.loadMember();
      },
      error: () => this.error.set('載入地區資料失敗，請稍後再試'),
    });
  }

  private loadMember(): void {
    this.api.get(this.memberId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const d = res.data;
          this.number.set(d.number);
          this.form.patchValue({
            mobile: d.mobile,
            birthday: d.birthday.slice(0, 10),
            name: d.name ?? '',
            gender: d.gender ?? 0,
            bloodType: d.bloodType ?? '',
            email: d.email ?? '',
            address: d.address ?? '',
            emergencyName: d.emergencyName ?? '',
            emergencyPhone: d.emergencyPhone ?? '',
            allergyOther: d.allergyOther ?? '',
            medicalHistoryOther: d.medicalHistoryOther ?? '',
            isBlackList: d.isBlackList,
          });
          this.allergySet.set(new Set(d.allergy));
          this.medicalSet.set(new Set(d.medicalHistory));
          this.loaded.set(true);
          // 城市/區 <select> 這次才第一次被建立到 DOM（隨 @if(loaded()) 顯示），此刻其 <option>
          // 才剛掛載；若在同一輪 render 內就把 selectedCity/zipcodeId 設成非空值，Angular 會在
          // <option> 存在之前套用 [value] 綁定，瀏覽器賦值失敗且之後不會自動回補（經 Playwright
          // 實測重現，詳見 docs/design/frontend-backend.md §下拉選單預設值規範）。故延後一個
          // macrotask，確保「已掛載空值 <select>」这輪 render 先落地，下一輪再賦值才能成功配對。
          // 區 <select> 的 <option> 是由 areas()（依賴 selectedCity()）動態產生，同一問題會在
          // 「城市剛被設值、區的選項才剛出現」這一輪再度發生一次，故 zipcodeId 需再延後一輪設定。
          setTimeout(() => {
            this.selectedCity.set(d.city ?? '');
            setTimeout(() => this.zipcodeId.set(d.zipcodeId));
          });
        } else {
          this.error.set(res.message ?? '找不到會員');
        }
      },
      error: () => this.error.set('系統忙線，請稍後再試'),
    });
  }

  onCity(city: string): void {
    this.selectedCity.set(city);
    this.zipcodeId.set(null);
  }

  toggle(set: typeof this.allergySet, value: string): void {
    const next = new Set(set());
    next.has(value) ? next.delete(value) : next.add(value);
    set.set(next);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const req: MemberUpdateRequest = {
      mobile: v.mobile.trim(),
      birthday: v.birthday,
      name: v.name.trim() || null,
      gender: v.gender || null,
      bloodType: v.bloodType || null,
      email: v.email.trim() || null,
      zipcodeId: this.zipcodeId(),
      address: v.address.trim() || null,
      emergencyName: v.emergencyName.trim() || null,
      emergencyPhone: v.emergencyPhone.trim() || null,
      allergy: [...this.allergySet()],
      allergyOther: this.allergySet().has('其他') ? (v.allergyOther.trim() || null) : null,
      medicalHistory: [...this.medicalSet()],
      medicalHistoryOther: this.medicalSet().has('其他') ? (v.medicalHistoryOther.trim() || null) : null,
      isBlackList: v.isBlackList,
    };

    this.saving.set(true);
    this.error.set(null);
    this.api.update(this.memberId, req).subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) this.router.navigate(['/member']);
        else this.error.set(res.message ?? '儲存失敗');
      },
      error: () => { this.saving.set(false); this.error.set('儲存失敗'); },
    });
  }
}
