import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BasicDataApiService, periodLabel } from '../../core/services/basic-data-api.service';
import { OutpatientTime, PeriodUpsertRequest } from '../../core/models';

/** 舊系統時段表單「時段」欄位是 HH:MM 兩個下拉（非自由輸入文字），見 BasicMs/AddTaPeriods.cshtml。 */
const HOURS = Array.from({ length: 14 }, (_, i) => String(i + 8).padStart(2, '0')); // 08–21
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')); // 00–55，step 5

/**
 * 後台基礎資料 — 新增/編輯時段（對應舊 BasicMs/Add·EditTa·Ch·ChDentist·CosmeticPeriods）。
 * branch/clinic 由 query params 帶入（決定呼叫哪組後端變體 proxy），編輯時不可改。
 * 表單欄位/用詞完全比照舊 View：時間（OutpatientTimeID 下拉）、時段（HH:MM 兩個下拉組成）、
 * 起始編號（選填；2026-07-04 起為「配號時段」開關——有值才自動配號，留空不配號，見 docs/gotchas.md）、人數（必填）。
 */
@Component({
  selector: 'app-period-form',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="bg-white rounded shadow-sm border border-hairline max-w-lg">
      <div class="px-5 py-3 border-b border-hairline">
        <h1 class="text-base font-semibold text-ink">
          <i class="fa fa-clock-o text-muted mr-2"></i>{{ isEdit() ? '編輯' : '新增' }}{{ pageLabel }}
        </h1>
      </div>

      @if (error()) {
        <div class="mx-5 mt-4 text-sm text-red-500">{{ error() }}</div>
      }

      <form [formGroup]="form" (ngSubmit)="submit()" class="p-5 space-y-4">
        <div>
          <label class="block text-sm font-medium text-ink mb-1">時間 <span class="text-red-400">*</span></label>
          <select formControlName="outpatientTimeId"
                  class="w-full border border-hairline rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand">
            @for (o of outpatientTimes(); track o.outpatientTimeId) {
              <option [value]="o.outpatientTimeId">{{ o.title }}</option>
            }
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-ink mb-1">時段 <span class="text-red-400">*</span></label>
          <div class="flex items-center gap-2">
            <select [value]="hour()" (change)="setHour($any($event.target).value)"
                    class="border border-hairline rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand">
              @for (h of hours; track h) { <option [value]="h">{{ h }}</option> }
            </select>
            <span class="text-muted">:</span>
            <select [value]="minute()" (change)="setMinute($any($event.target).value)"
                    class="border border-hairline rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand">
              @for (m of minutes; track m) { <option [value]="m">{{ m }}</option> }
            </select>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-ink mb-1">起始編號</label>
          <input type="number" formControlName="startNumber"
                 class="w-full border border-hairline rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
          <p class="text-xs text-muted mt-1">自動配號分院（台中健保）填寫後該時段依此編號自動配號；留空則不配號（客戶顯示「請至現場取號」）</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-ink mb-1">人數 <span class="text-red-400">*</span></label>
          <input type="number" formControlName="patients"
                 class="w-full border border-hairline rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
        </div>

        <div class="flex items-center gap-2 pt-2">
          <button type="submit" [disabled]="saving()"
                  class="bg-brand text-white text-sm rounded px-4 py-2 hover:bg-brand-deep disabled:opacity-50">
            {{ saving() ? '儲存中…' : '儲存' }}
          </button>
          <a [routerLink]="['/basic/periods']" [queryParams]="{ branch, clinic }"
             class="text-sm text-muted hover:text-ink px-3 py-2">取消</a>
        </div>
      </form>
    </div>
  `,
})
export class PeriodFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(BasicDataApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly periodId = this.route.snapshot.paramMap.get('id');
  readonly branch = this.route.snapshot.queryParamMap.get('branch') ?? 'ta';
  readonly clinic = this.route.snapshot.queryParamMap.get('clinic') ?? 'Skin';
  readonly pageLabel = periodLabel(this.branch, this.clinic);
  readonly isEdit = signal(!!this.periodId);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly outpatientTimes = signal<OutpatientTime[]>([]);

  readonly hours = HOURS;
  readonly minutes = MINUTES;
  readonly hour = signal('08');
  readonly minute = signal('00');

  readonly form = this.fb.nonNullable.group({
    title: ['08:00', Validators.required],
    outpatientTimeId: [1, Validators.required],
    startNumber: [null as number | null],
    patients: [0, Validators.required],
  });

  constructor() {
    this.api.listOutpatientTimes().subscribe({
      next: (res) => { if (res.success && res.data) this.outpatientTimes.set(res.data); },
    });
    if (this.periodId) this.loadEdit(this.periodId);
  }

  setHour(value: string): void {
    this.hour.set(value);
    this.syncTitle();
  }

  setMinute(value: string): void {
    this.minute.set(value);
    this.syncTitle();
  }

  private syncTitle(): void {
    this.form.patchValue({ title: `${this.hour()}:${this.minute()}` });
  }

  private loadEdit(id: string): void {
    this.api.listPeriods(this.branch, this.clinic).subscribe({
      next: (res) => {
        const p = res.success ? res.data?.find((x) => x.periodId === id) : undefined;
        if (p) {
          const [h, m] = p.title.split(':');
          this.hour.set(h ?? '08');
          this.minute.set(m ?? '00');
          this.form.patchValue({
            title: p.title,
            outpatientTimeId: p.outpatientTimeId,
            startNumber: p.startNumber,
            patients: p.patients,
          });
        } else {
          this.error.set('找不到時段');
        }
      },
      error: () => this.error.set('系統忙線，請稍後再試'),
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const req: PeriodUpsertRequest = {
      title: raw.title.trim(),
      outpatientTimeId: Number(raw.outpatientTimeId),
      startNumber: raw.startNumber === null ? null : Number(raw.startNumber),
      patients: Number(raw.patients),
    };

    this.saving.set(true);
    this.error.set(null);
    const call = this.periodId
      ? this.api.updatePeriod(this.branch, this.clinic, this.periodId, req)
      : this.api.createPeriod(this.branch, this.clinic, req);
    call.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) this.router.navigate(['/basic/periods'], { queryParams: { branch: this.branch, clinic: this.clinic } });
        else this.error.set(res.message ?? '儲存失敗');
      },
      error: () => { this.saving.set(false); this.error.set('儲存失敗'); },
    });
  }
}
