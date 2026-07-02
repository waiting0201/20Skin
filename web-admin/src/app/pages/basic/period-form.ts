import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BasicDataApiService } from '../../core/services/basic-data-api.service';
import { OutpatientTime, PeriodUpsertRequest } from '../../core/models';

/**
 * 後台基礎資料 — 新增/編輯時段（對應舊 BasicMs/Add·EditTa·Ch·ChDentist·CosmeticPeriods）。
 * branch/clinic 由 query params 帶入（決定呼叫哪組後端變體 proxy），編輯時不可改。
 */
@Component({
  selector: 'app-period-form',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="bg-white rounded shadow-sm border border-gray-200 max-w-lg">
      <div class="px-5 py-3 border-b border-gray-100">
        <h1 class="text-base font-semibold text-gray-800">
          <i class="fa fa-clock-o text-gray-400 mr-2"></i>{{ isEdit() ? '編輯時段' : '新增時段' }}
        </h1>
      </div>

      @if (error()) {
        <div class="mx-5 mt-4 text-sm text-red-500">{{ error() }}</div>
      }

      <form [formGroup]="form" (ngSubmit)="submit()" class="p-5 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">名稱 <span class="text-red-400">*</span></label>
          <input formControlName="title" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">門診時段 <span class="text-red-400">*</span></label>
          <select formControlName="outpatientTimeId" class="w-full border border-gray-300 rounded px-3 py-2 text-sm">
            @for (o of outpatientTimes(); track o.outpatientTimeId) {
              <option [value]="o.outpatientTimeId">{{ o.title }}</option>
            }
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">起始號碼（留空則不自動配號）</label>
          <input type="number" formControlName="startNumber" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">容量 <span class="text-red-400">*</span></label>
          <input type="number" formControlName="patients" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </div>

        <div class="flex items-center gap-2 pt-2">
          <button type="submit" [disabled]="saving()"
                  class="bg-teal-600 text-white text-sm rounded px-4 py-2 hover:bg-teal-700 disabled:opacity-50">
            {{ saving() ? '儲存中…' : '儲存' }}
          </button>
          <a [routerLink]="['/basic/periods']" [queryParams]="{ branch, clinic }"
             class="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">取消</a>
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
  readonly isEdit = signal(!!this.periodId);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly outpatientTimes = signal<OutpatientTime[]>([]);

  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
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

  private loadEdit(id: string): void {
    this.api.listPeriods(this.branch, this.clinic).subscribe({
      next: (res) => {
        const p = res.success ? res.data?.find((x) => x.periodId === id) : undefined;
        if (p) {
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
