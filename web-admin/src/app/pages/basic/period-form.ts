import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BasicDataApiService, periodLabel } from '../../core/services/basic-data-api.service';
import { OutpatientTime, PeriodUpsertRequest } from '../../core/models';

/** 舊系統時段表單「時段」欄位是 HH:MM 兩個下拉（非自由輸入文字），見 BasicMs/AddTaPeriods.cshtml。 */
const HOURS = Array.from({ length: 14 }, (_, i) => String(i + 8).padStart(2, '0')); // 08–21
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')); // 00–55，step 5

/** 時段模式：numbered=配號（早/晚診自動配號）、walkin=一般時段（現場取號）。 */
type PeriodMode = 'numbered' | 'walkin';

/**
 * 後台基礎資料 — 新增/編輯時段（對應舊 BasicMs/Add·EditTa·Ch·ChDentist·CosmeticPeriods）。
 * branch/clinic 由 query params 帶入（決定呼叫哪組後端變體 proxy），編輯時不可改。
 *
 * 【模式感知（刻意偏離舊系統逐字用詞，使用者已同意，見 docs/design/frontend-backend.md）】
 * 底層兩欄語意與中文直覺相反：「時間」=outpatientTimeId（診次 上午/下午/晚診）、「時段」=title（HH:MM 時鐘）。
 * 客戶每次只看到其中一個，由「起始編號」開關決定（配號 numbered ⇒ 看診次；現場取號 walkin ⇒ 看 HH:MM），
 * 判斷同 BookingService `numbered = IsAutoRowNumber && StartNumber != null`。故表單改為二選一模式：
 * 依 branch-meta 的 isAutoRowNumber 決定是否提供「配號」模式（二林分院鎖死 walkin，不顯示切換）。
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
        @if (showModeToggle()) {
          <div class="rounded border border-hairline bg-surface px-4 py-3">
            <div class="text-sm font-medium text-ink mb-2">時段類型</div>
            <div class="flex flex-col gap-2">
              <label class="flex items-start gap-2 cursor-pointer">
                <input type="radio" name="mode" class="mt-1" [checked]="mode() === 'numbered'"
                       (change)="setMode('numbered')" />
                <span class="text-sm">
                  <span class="text-ink font-medium">配號</span>
                  <span class="text-muted">（早/晚診自動配號，客戶看到「早診/晚診」）</span>
                </span>
              </label>
              <label class="flex items-start gap-2 cursor-pointer">
                <input type="radio" name="mode" class="mt-1" [checked]="mode() === 'walkin'"
                       (change)="setMode('walkin')" />
                <span class="text-sm">
                  <span class="text-ink font-medium">一般時段</span>
                  <span class="text-muted">（現場取號，客戶看到時段時間）</span>
                </span>
              </label>
            </div>
          </div>
        }

        <div [class.opacity-50]="mode() === 'walkin'">
          <label class="block text-sm font-medium text-ink mb-1">
            {{ mode() === 'numbered' ? '診次（客戶看到 早診/晚診）' : '診次（僅內部分類，客戶看不到）' }}
            <span class="text-red-400">*</span>
          </label>
          <select formControlName="outpatientTimeId" (change)="setOutpatientTime($any($event.target).value)"
                  class="w-full border border-hairline rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand">
            @for (o of outpatientTimes(); track o.outpatientTimeId) {
              <option [value]="o.outpatientTimeId">{{ o.title }}</option>
            }
          </select>
        </div>

        <div [class.opacity-50]="mode() === 'numbered'">
          <label class="block text-sm font-medium text-ink mb-1">
            {{ mode() === 'numbered' ? '時段時間（內部排序用，客戶不顯示）' : '時段時間（客戶看到的時間）' }}
            <span class="text-red-400">*</span>
          </label>
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

        @if (mode() === 'numbered') {
          <div>
            <label class="block text-sm font-medium text-ink mb-1">起始編號 <span class="text-red-400">*</span></label>
            <input type="number" formControlName="startNumber" min="1"
                   class="w-full border border-hairline rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
            <p class="text-xs text-muted mt-1">此時段依此號碼自動配門診號（早/晚診現為 12）。清空即改為「現場取號」模式。</p>
          </div>
        }

        <div>
          <label class="block text-sm font-medium text-ink mb-1">人數 <span class="text-red-400">*</span></label>
          <input type="number" formControlName="patients"
                 class="w-full border border-hairline rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
          <p class="text-xs text-muted mt-1">此為預設值；客戶實際可約人數以「門診管理」的排班人數為準。</p>
        </div>

        <div class="rounded bg-surface border border-hairline px-4 py-2.5 text-sm">
          <span class="text-muted">客戶會看到：</span>
          <span class="text-ink font-medium">{{ previewText() }}</span>
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

  /** 配號模式僅在自動配號分院（台中）提供；二林分院鎖死 walkin。 */
  readonly isAutoRowNumber = signal(false);
  readonly mode = signal<PeriodMode>('walkin');
  readonly showModeToggle = computed(() => this.isAutoRowNumber());

  /** 目前選中的診次 id，供即時預覽用（form control 值非 signal，另存一份）。 */
  private readonly selectedOtId = signal(1);

  /** 即時預覽「客戶會看到」：配號→診次標題（早診/晚診）；現場取號→時段時間（HH:MM）。 */
  readonly previewText = computed(() => {
    if (this.mode() === 'numbered') {
      const ot = this.outpatientTimes().find((o) => o.outpatientTimeId === this.selectedOtId());
      return ot?.title ?? '—';
    }
    return `${this.hour()}:${this.minute()}`;
  });

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
    // 先取分院是否自動配號，再決定初始模式（loadEdit 需要 isAutoRowNumber，避免時序競態）。
    this.api.getPeriodBranchMeta(this.branch).subscribe({
      next: (res) => {
        if (res.success && res.data) this.isAutoRowNumber.set(res.data.isAutoRowNumber);
        this.afterMeta();
      },
      error: () => this.afterMeta(),
    });
  }

  private afterMeta(): void {
    if (this.periodId) this.loadEdit(this.periodId);
    else this.setMode('walkin'); // 新增預設一般時段；台中可切換為配號
  }

  setMode(m: PeriodMode): void {
    this.mode.set(m);
    const sn = this.form.controls.startNumber;
    if (m === 'numbered') {
      sn.setValidators([Validators.required, Validators.min(1)]);
    } else {
      sn.clearValidators();
      sn.setValue(null); // 現場取號一律不配號
    }
    sn.updateValueAndValidity();
  }

  setOutpatientTime(value: string): void {
    this.selectedOtId.set(Number(value));
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
          this.selectedOtId.set(p.outpatientTimeId);
          this.form.patchValue({
            title: p.title,
            outpatientTimeId: p.outpatientTimeId,
            startNumber: p.startNumber,
            patients: p.patients,
          });
          // 依既有資料推導模式：僅自動配號分院且起始編號有值 ⇒ 配號。
          this.setMode(this.isAutoRowNumber() && p.startNumber != null ? 'numbered' : 'walkin');
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
    // 一般時段強制不配號（startNumber=null）；配號模式送出所填號碼。title/outpatientTimeId 兩模式皆 NOT NULL 恆送。
    const startNumber = this.mode() === 'numbered' && raw.startNumber !== null ? Number(raw.startNumber) : null;
    const req: PeriodUpsertRequest = {
      title: raw.title.trim(),
      outpatientTimeId: Number(raw.outpatientTimeId),
      startNumber,
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
