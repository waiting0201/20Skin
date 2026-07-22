import { Component, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { RosterApiService, rosterLabel } from '../../core/services/roster-api.service';
import { BasicDataApiService } from '../../core/services/basic-data-api.service';
import { CategoryAdmin, DoctorAdmin, PeriodAdmin, RosterCreateRequest, RosterPeriodInput, RosterUpdateRequest } from '../../core/models';

/**
 * 後台排班 — 新增/編輯（對應舊 ShiftMs/Add·EditTa·Ch·ChDentist·CosmeticRosters）。
 * 每個時段模板（該分院診別全部 Periods）都有一列容量輸入；新增才顯示重複模式（永不/每天/每周）+ 截止日。
 * 送出後若 skippedDates 非空，顯示提示（取代舊系統靜默跳過衝突日期）。
 * 表單欄位/顯示邏輯忠於舊 View：
 * - 「需預約」（IsAppointment）只在有選醫師時顯示，清空醫師會自動取消勾選（舊系統 `$("#DoctorID").change` 行為）。
 * - 「門診日期」新增/編輯皆可填寫（舊 `EditTaRosters` 的 `TryUpdateModel` 白名單含 `RosterDate`，並非不可改）。
 * - 「起始號碼」欄顯示時段模板固定值（唯讀，來自 `Periods.StartNumber`），只有「人數」可編輯。
 *   ⚠️ 此欄純顯示（`templateStartNumber`），與送出的 `RosterPeriods.StartNumber` 分離：新增一律送 null、編輯原樣回傳既有值，
 *   避免誤啟用 RosterPeriods 的 StartNumber 覆寫（模式權威來源恆為基礎資料 Periods，見 docs/gotchas.md）。
 * - 【模式分組】自動配號分院（台中）依模板起始號碼有無值把容量表分「配號 / 現場取號」兩區並加 SOP 警語
 *   （一般項目與二林模式項目不可同排班，見 docs/blueprints/customer-booking.md）；二林分院維持單一無分組表格。
 * - **沒有「班別」（OutpatientTimeID）欄位**——查證舊 `AddTaRosters`/`EditTaRosters.cshtml` 該下拉整段被 Razor 註解隱藏
 *   （`@*<div class="form-group">...OutpatientTimeID...</div>*@`），從未實際渲染，`Rosters.OutpatientTimeID` 因此
 *   一律維持建立時的預設值不變。`outpatientTimeId` 表單欄位保留但不渲染 UI：新增時固定送 `null`（比照舊系統新建排班該欄位一律未設定），
 *   編輯時原樣回傳既有值不覆寫（比照舊系統白名單雖含此欄位、但表單從未提交對應欄位時 model binder 不會清空既有值的行為）。
 */
@Component({
  selector: 'app-roster-form',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="bg-white rounded shadow-sm border border-hairline max-w-3xl">
      <div class="px-5 py-3 border-b border-hairline">
        <h1 class="text-base font-semibold text-ink">
          <i class="fa fa-calendar text-muted mr-2"></i>{{ isEdit() ? '編輯' : '新增' }}{{ pageLabel }}
        </h1>
      </div>

      @if (error()) {
        <div class="mx-5 mt-4 text-sm text-red-500 whitespace-pre-line">{{ error() }}</div>
      }
      @if (skippedMessage()) {
        <div class="mx-5 mt-4 text-sm text-amber-600">{{ skippedMessage() }}</div>
      }

      <form [formGroup]="form" (ngSubmit)="submit()" class="p-5 space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-ink mb-1">門診日期 <span class="text-red-400">*</span></label>
            <input type="date" formControlName="rosterDate"
                   class="w-full border border-hairline rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
          </div>
          <div>
            <label class="block text-sm font-medium text-ink mb-1">醫師</label>
            <select formControlName="doctorId" (change)="onDoctorChange()"
                    class="w-full border border-hairline rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand">
              <option [value]="null">不指定</option>
              @for (d of doctors(); track d.doctorId) {
                <option [value]="d.doctorId">{{ d.name }}</option>
              }
            </select>
          </div>
        </div>

        @if (form.controls.doctorId.value) {
          <div class="flex items-center gap-2">
            <input type="checkbox" id="isAppointment" formControlName="isAppointment" />
            <label for="isAppointment" class="text-sm text-ink">需預約</label>
          </div>
        }

        <div>
          <label class="block text-sm font-medium text-ink mb-2">項目 <span class="text-red-400">*</span></label>
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
          @if (isAutoRowNumber()) {
            <p class="text-xs text-amber-600 mb-2">
              ⚠️ 一般項目與二林模式（現場取號）項目請分開排班：同一張排班的時段為所有勾選項目共用，
              若在一般項目排班誤填現場取號時段人數，會讓一般項目也冒出細時段。
            </p>
          }
          <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-muted border-b border-hairline">
                <th class="py-1.5 font-medium">時段</th>
                <th class="py-1.5 font-medium w-24 text-center">起始號碼</th>
                <th class="py-1.5 font-medium w-32">人數</th>
              </tr>
            </thead>
            <tbody>
              @for (sec of rowSections(); track sec.title) {
                @if (sec.title) {
                  <tr class="bg-surface/70 border-b border-hairline">
                    <td colspan="3" class="py-1.5 text-xs font-semibold text-muted">{{ sec.title }}</td>
                  </tr>
                }
                @for (row of sec.rows; track row.value.periodId) {
                  <tr [formGroup]="$any(row)" class="border-b border-hairline">
                    <td class="py-1.5 text-ink">{{ row.value.periodTitle }}</td>
                    <td class="py-1.5 text-center text-muted">{{ row.value.templateStartNumber ?? '—' }}</td>
                    <td class="py-1.5">
                      <input type="number" formControlName="patients"
                             class="w-24 border border-hairline rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
          </div>
        </div>

        @if (!isEdit()) {
          <div>
            <label class="block text-sm font-medium text-ink mb-1">重複</label>
            <div class="flex items-center gap-4">
              <label class="flex items-center gap-1.5 text-sm text-ink">
                <input type="radio" formControlName="repeatMode" [value]="1" /> 每天
              </label>
              <label class="flex items-center gap-1.5 text-sm text-ink">
                <input type="radio" formControlName="repeatMode" [value]="2" /> 每周
              </label>
              <label class="flex items-center gap-1.5 text-sm text-ink">
                <input type="radio" formControlName="repeatMode" [value]="0" /> 永不
              </label>
              @if (form.controls.repeatMode.value !== 0) {
                <label class="flex items-center gap-1.5 text-sm text-ink">
                  重複結束日期
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
  readonly pageLabel = rosterLabel(this.branch, this.clinic);
  private readonly rosterId = this.route.snapshot.paramMap.get('id');
  readonly isEdit = signal(!!this.rosterId);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly skippedMessage = signal<string | null>(null);

  readonly doctors = signal<DoctorAdmin[]>([]);
  readonly categories = signal<CategoryAdmin[]>([]);
  readonly selectedCategoryIds = signal<Set<string>>(new Set());

  /** 自動配號分院（台中）才把容量表分「配號 / 現場取號」兩區；二林維持單一無標題表格。 */
  readonly isAutoRowNumber = signal(false);
  readonly rowSections = signal<{ title: string | null; rows: FormGroup[] }[]>([]);

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

  /**
   * templateStartNumber：純顯示/分組用（基礎資料 Periods.StartNumber，模式權威來源）。
   * startNumber：實際送出的 RosterPeriods.StartNumber（新增恆 null、編輯回傳既有值），兩者刻意分離。
   */
  private newPeriodRow(periodId: string, periodTitle: string, templateStartNumber: number | null, startNumber: number | null, patients: number) {
    return this.fb.nonNullable.group({
      periodId: [periodId],
      periodTitle: [periodTitle],
      templateStartNumber: [templateStartNumber as number | null],
      startNumber: [startNumber as number | null],
      patients: [patients],
    });
  }

  /** 依模板起始號碼有無值把 periodRows 分「配號 / 現場取號」兩區（僅自動配號分院）；空區不列。 */
  private rebuildSections(): void {
    const rows = this.periodRows.controls as FormGroup[];
    if (!this.isAutoRowNumber()) {
      this.rowSections.set([{ title: null, rows }]);
      return;
    }
    const numbered = rows.filter((r) => r.value.templateStartNumber != null);
    const walkin = rows.filter((r) => r.value.templateStartNumber == null);
    const secs: { title: string | null; rows: FormGroup[] }[] = [];
    if (numbered.length) secs.push({ title: '配號時段（客戶看到 早診/晚診）', rows: numbered });
    if (walkin.length) secs.push({ title: '現場取號時段（客戶看到時段時間）', rows: walkin });
    this.rowSections.set(secs.length ? secs : [{ title: null, rows: [] }]);
  }

  constructor() {
    forkJoin([
      this.basicApi.listDoctors(),
      this.basicApi.listAllCategories(this.clinic),
      this.basicApi.listPeriods(this.branch, this.clinic),
      this.basicApi.getPeriodBranchMeta(this.branch),
    ]).subscribe({
      next: ([doctorsRes, categoriesRes, periodsRes, metaRes]) => {
        this.doctors.set(doctorsRes.data ?? []);
        this.categories.set(categoriesRes.data ?? []);
        if (metaRes.success && metaRes.data) this.isAutoRowNumber.set(metaRes.data.isAutoRowNumber);
        const templates = periodsRes.data ?? [];

        if (this.rosterId) {
          this.loadEdit(this.rosterId, templates);
        } else {
          this.periodRows.clear();
          // 新增：起始號碼欄顯示模板值（修正舊版恆顯示「—」），但送出的 startNumber 維持 null。
          for (const p of templates) this.periodRows.push(this.newPeriodRow(p.periodId, p.title, p.startNumber, null, 0));
          this.rebuildSections();
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
            rosterDate: r.rosterDate.slice(0, 10),
            doctorId: r.doctorId,
            outpatientTimeId: r.outpatientTimeId,
            isAppointment: r.isAppointment,
          });
          this.selectedCategoryIds.set(new Set(r.categoryIds));

          this.periodRows.clear();
          for (const t of templates) {
            const existing = r.periods.find((p) => p.periodId === t.periodId);
            // 顯示/分組用模板值 t.startNumber；送出值沿用既有 RosterPeriods 值（維持寫入語意不變）。
            this.periodRows.push(this.newPeriodRow(t.periodId, t.title, t.startNumber, existing?.startNumber ?? null, existing?.patients ?? 0));
          }
          this.rebuildSections();
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

  /** 清空醫師時自動取消「需預約」（比照舊系統 `$("#DoctorID").change` 行為，見 AddTaRosters.cshtml）。 */
  onDoctorChange(): void {
    if (!this.form.controls.doctorId.value) {
      this.form.patchValue({ isAppointment: false });
    }
  }

  submit(): void {
    const categoryIds = Array.from(this.selectedCategoryIds());
    if (categoryIds.length === 0) {
      this.error.set('請至少選擇一個科別項目');
      return;
    }
    if (!this.form.controls.rosterDate.value) {
      this.error.set('請選擇門診日期');
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
        rosterDate: raw.rosterDate,
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
