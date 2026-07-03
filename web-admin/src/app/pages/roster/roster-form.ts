import { Component, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { RosterApiService } from '../../core/services/roster-api.service';
import { BasicDataApiService } from '../../core/services/basic-data-api.service';
import { CategoryAdmin, DoctorAdmin, OutpatientTime, PeriodAdmin, RosterCreateRequest, RosterPeriodInput, RosterUpdateRequest } from '../../core/models';

/**
 * 後台排班 — 新增/編輯（對應舊 ShiftMs/Add·EditTa·Ch·ChDentist·CosmeticRosters）。
 * 每個時段模板（該分院診別全部 Periods）都有一列容量輸入；新增才顯示重複模式（不重複/每日/每週）+ 截止日。
 * 送出後若 skippedDates 非空，顯示提示（取代舊系統靜默跳過衝突日期）。
 */
@Component({
  selector: 'app-roster-form',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="bg-white rounded shadow-sm border border-hairline max-w-3xl">
      <div class="px-5 py-3 border-b border-hairline">
        <h1 class="text-base font-semibold text-ink">
          <i class="fa fa-calendar text-muted mr-2"></i>{{ isEdit() ? '編輯排班' : '新增排班' }}
        </h1>
      </div>

      @if (error()) {
        <div class="mx-5 mt-4 text-sm text-red-500 whitespace-pre-line">{{ error() }}</div>
      }
      @if (skippedMessage()) {
        <div class="mx-5 mt-4 text-sm text-amber-600">{{ skippedMessage() }}</div>
      }

      <form [formGroup]="form" (ngSubmit)="submit()" class="p-5 space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          @if (!isEdit()) {
            <div>
              <label class="block text-sm font-medium text-ink mb-1">排班日期 <span class="text-red-400">*</span></label>
              <input type="date" formControlName="rosterDate"
                     class="w-full border border-hairline rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
            </div>
          }
          <div>
            <label class="block text-sm font-medium text-ink mb-1">醫師</label>
            <select formControlName="doctorId"
                    class="w-full border border-hairline rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand">
              <option [value]="null">不指定</option>
              @for (d of doctors(); track d.doctorId) {
                <option [value]="d.doctorId">{{ d.name }}</option>
              }
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-ink mb-1">班別</label>
            <select formControlName="outpatientTimeId"
                    class="w-full border border-hairline rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand">
              <option [value]="null">未設定</option>
              @for (o of outpatientTimes(); track o.outpatientTimeId) {
                <option [value]="o.outpatientTimeId">{{ o.title }}</option>
              }
            </select>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <input type="checkbox" id="isAppointment" formControlName="isAppointment" />
          <label for="isAppointment" class="text-sm text-ink">開放指定醫師線上預約</label>
        </div>

        <div>
          <label class="block text-sm font-medium text-ink mb-2">開放科別項目 <span class="text-red-400">*</span></label>
          <div class="flex flex-wrap gap-3">
            @for (c of categories(); track c.categoryId) {
              <label class="flex items-center gap-1.5 text-sm text-ink">
                <input type="checkbox" [checked]="selectedCategoryIds().has(c.categoryId)"
                       (change)="toggleCategory(c.categoryId, $any($event.target).checked)" />
                {{ c.title }}
              </label>
            }
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-ink mb-2">各時段容量 <span class="text-red-400">*</span></label>
          <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-muted border-b border-hairline">
                <th class="py-1.5 font-medium">時段</th>
                <th class="py-1.5 font-medium w-32">起始號碼</th>
                <th class="py-1.5 font-medium w-32">容量</th>
              </tr>
            </thead>
            <tbody>
              @for (row of periodRows.controls; track $index) {
                <tr [formGroup]="$any(row)" class="border-b border-hairline">
                  <td class="py-1.5 text-ink">{{ row.value.periodTitle }}</td>
                  <td class="py-1.5">
                    <input type="number" formControlName="startNumber"
                           class="w-24 border border-hairline rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
                  </td>
                  <td class="py-1.5">
                    <input type="number" formControlName="patients"
                           class="w-24 border border-hairline rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
                  </td>
                </tr>
              }
            </tbody>
          </table>
          </div>
        </div>

        @if (!isEdit()) {
          <div>
            <label class="block text-sm font-medium text-ink mb-1">重複模式</label>
            <div class="flex items-center gap-4">
              <label class="flex items-center gap-1.5 text-sm text-ink">
                <input type="radio" formControlName="repeatMode" [value]="0" /> 不重複
              </label>
              <label class="flex items-center gap-1.5 text-sm text-ink">
                <input type="radio" formControlName="repeatMode" [value]="1" /> 每日
              </label>
              <label class="flex items-center gap-1.5 text-sm text-ink">
                <input type="radio" formControlName="repeatMode" [value]="2" /> 每週
              </label>
              @if (form.controls.repeatMode.value !== 0) {
                <label class="flex items-center gap-1.5 text-sm text-ink">
                  截止日
                  <input type="date" formControlName="expireDate"
                         class="border border-hairline rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
                </label>
              }
            </div>
          </div>
        }

        <div class="flex items-center gap-2 pt-2">
          <button type="submit" [disabled]="saving()"
                  class="bg-brand text-white text-sm rounded px-4 py-2 hover:bg-brand-deep disabled:opacity-50">
            {{ saving() ? '儲存中…' : '儲存' }}
          </button>
          <a [routerLink]="['/roster']" [queryParams]="{ branch, clinic }"
             class="text-sm text-muted hover:text-ink px-3 py-2">取消</a>
        </div>
      </form>
    </div>
  `,
})
export class RosterFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(RosterApiService);
  private readonly basicApi = inject(BasicDataApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly branch = this.route.snapshot.queryParamMap.get('branch') ?? 'ta';
  readonly clinic = this.route.snapshot.queryParamMap.get('clinic') ?? 'Skin';
  private readonly rosterId = this.route.snapshot.paramMap.get('id');
  readonly isEdit = signal(!!this.rosterId);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly skippedMessage = signal<string | null>(null);

  readonly doctors = signal<DoctorAdmin[]>([]);
  readonly outpatientTimes = signal<OutpatientTime[]>([]);
  readonly categories = signal<CategoryAdmin[]>([]);
  readonly selectedCategoryIds = signal<Set<string>>(new Set());

  readonly form = this.fb.nonNullable.group({
    rosterDate: [''],
    doctorId: [null as string | null],
    outpatientTimeId: [null as number | null],
    isAppointment: [false],
    repeatMode: [0],
    expireDate: [null as string | null],
    periodRows: this.fb.array<ReturnType<typeof this.newPeriodRow>>([]),
  });

  get periodRows(): FormArray {
    return this.form.controls.periodRows;
  }

  private newPeriodRow(periodId: string, periodTitle: string, startNumber: number | null, patients: number) {
    return this.fb.nonNullable.group({
      periodId: [periodId],
      periodTitle: [periodTitle],
      startNumber: [startNumber as number | null],
      patients: [patients],
    });
  }

  constructor() {
    forkJoin([
      this.basicApi.listDoctors(),
      this.basicApi.listOutpatientTimes(),
      this.basicApi.listAllCategories(this.clinic),
      this.basicApi.listPeriods(this.branch, this.clinic),
    ]).subscribe({
      next: ([doctorsRes, timesRes, categoriesRes, periodsRes]) => {
        this.doctors.set(doctorsRes.data ?? []);
        this.outpatientTimes.set(timesRes.data ?? []);
        this.categories.set(categoriesRes.data ?? []);
        const templates = periodsRes.data ?? [];

        if (this.rosterId) {
          this.loadEdit(this.rosterId, templates);
        } else {
          this.periodRows.clear();
          for (const p of templates) this.periodRows.push(this.newPeriodRow(p.periodId, p.title, null, 0));
        }
      },
      error: () => this.error.set('載入基礎資料失敗，請稍後再試'),
    });
  }

  private loadEdit(id: string, templates: PeriodAdmin[]): void {
    this.api.getRoster(this.branch, this.clinic, id).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const r = res.data;
          this.form.patchValue({
            doctorId: r.doctorId,
            outpatientTimeId: r.outpatientTimeId,
            isAppointment: r.isAppointment,
          });
          this.selectedCategoryIds.set(new Set(r.categoryIds));

          this.periodRows.clear();
          for (const t of templates) {
            const existing = r.periods.find((p) => p.periodId === t.periodId);
            this.periodRows.push(this.newPeriodRow(t.periodId, t.title, existing?.startNumber ?? null, existing?.patients ?? 0));
          }
        } else {
          this.error.set(res.message ?? '找不到排班');
        }
      },
      error: () => this.error.set('系統忙線，請稍後再試'),
    });
  }

  toggleCategory(categoryId: string, checked: boolean): void {
    const next = new Set(this.selectedCategoryIds());
    if (checked) next.add(categoryId);
    else next.delete(categoryId);
    this.selectedCategoryIds.set(next);
  }

  submit(): void {
    const categoryIds = Array.from(this.selectedCategoryIds());
    if (categoryIds.length === 0) {
      this.error.set('請至少選擇一個科別項目');
      return;
    }
    const raw = this.form.getRawValue();
    const periods: RosterPeriodInput[] = raw.periodRows.map((p) => ({
      periodId: p.periodId,
      startNumber: p.startNumber === null || p.startNumber === undefined ? null : Number(p.startNumber),
      patients: Number(p.patients),
    }));

    this.saving.set(true);
    this.error.set(null);
    this.skippedMessage.set(null);

    if (this.rosterId) {
      const req: RosterUpdateRequest = {
        doctorId: raw.doctorId,
        outpatientTimeId: raw.outpatientTimeId === null ? null : Number(raw.outpatientTimeId),
        isAppointment: raw.isAppointment,
        categoryIds,
        periods,
      };
      this.api.updateRoster(this.branch, this.clinic, this.rosterId, req).subscribe({
        next: (res) => {
          this.saving.set(false);
          if (res.success) this.router.navigate(['/roster'], { queryParams: { branch: this.branch, clinic: this.clinic } });
          else this.error.set(res.message ?? '儲存失敗');
        },
        error: () => { this.saving.set(false); this.error.set('儲存失敗'); },
      });
    } else {
      if (!raw.rosterDate) {
        this.saving.set(false);
        this.error.set('請選擇排班日期');
        return;
      }
      const req: RosterCreateRequest = {
        doctorId: raw.doctorId,
        outpatientTimeId: raw.outpatientTimeId === null ? null : Number(raw.outpatientTimeId),
        rosterDate: raw.rosterDate,
        isAppointment: raw.isAppointment,
        categoryIds,
        periods,
        repeatMode: Number(raw.repeatMode),
        expireDate: raw.repeatMode === 0 ? null : raw.expireDate,
      };
      this.api.createRoster(this.branch, this.clinic, req).subscribe({
        next: (res) => {
          this.saving.set(false);
          if (res.success && res.data) {
            if (res.data.skippedDates.length > 0) {
              // 有跳過日期時停留在本頁顯示提示，不自動導頁，讓使用者看得到訊息
              this.skippedMessage.set(`已建立 ${res.data.createdDates.length} 天；已跳過 ${res.data.skippedDates.length} 天（與既有排班科別重疊）：${res.data.skippedDates.map((d) => d.slice(0, 10)).join('、')}`);
            } else {
              this.router.navigate(['/roster'], { queryParams: { branch: this.branch, clinic: this.clinic } });
            }
          } else {
            this.error.set(res.message ?? '儲存失敗');
          }
        },
        error: () => { this.saving.set(false); this.error.set('儲存失敗'); },
      });
    }
  }
}
