import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { SlicePipe } from '@angular/common';
import { ReserveApiService, reserveLabel, reserveResourceKey } from '../../core/services/reserve-api.service';
import { BasicDataApiService } from '../../core/services/basic-data-api.service';
import { AuthService } from '../../core/services/auth.service';
import { AppointmentAdminListItem, CapacityItemInput, CategoryAdmin, PeriodAmount } from '../../core/models';
import { toRocDate } from '../../core/roc-date';

interface CapacityRow {
  periodId: string;
  rosterPeriodId: string | null;
  periodTitle: string;
  totalAmount: number;
  appointmentAmount: number;
}

/**
 * 後台預約管理 — 列表（對應舊 ReserveMs/Ta·Ch·ChDentistAppointments.cshtml，clinic 參數化收斂為單一元件）。
 * 舊系統只有 3 組變體（非時段/排班常見的 5 組），Ta/Ch 用 clinic 篩選下拉在 Skin/Cosmetic 間切換（同一頁面），
 * ChDentist 固定齒科、無 clinic/category 篩選，見 docs/blueprints/admin-reserve.md。
 * 版面比照舊系統左右兩欄：左窄欄時段容量表、右寬欄預約列表；pageSize 固定 50（非其他模組常見的 20）。
 */
@Component({
  selector: 'app-reserve-list',
  imports: [FormsModule, RouterLink, SlicePipe],
  template: `
    <div class="bg-white rounded shadow-sm border border-hairline">
      <div class="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-hairline">
        <h1 class="text-base font-semibold text-ink"><i class="fa fa-calendar-check-o text-muted mr-2"></i>{{ pageLabel() }}</h1>
      </div>

      <div class="flex flex-wrap items-end gap-3 px-5 py-3 border-b border-hairline bg-surface">
        @if (!isDentist()) {
          <div>
            <label class="block text-xs text-muted mb-1">項目</label>
            <select [ngModel]="clinic()" (ngModelChange)="onClinicChange($event)"
                    class="border border-hairline rounded px-2 py-1.5 text-sm">
              <option value="">請選擇項目</option>
              <option value="Skin">健保</option>
              <option value="Cosmetic">美容</option>
            </select>
          </div>
          @if (clinic()) {
            <div>
              <label class="block text-xs text-muted mb-1">科別項目</label>
              <select [(ngModel)]="categoryId" class="border border-hairline rounded px-2 py-1.5 text-sm">
                <option value="">全部</option>
                @for (c of categories(); track c.categoryId) { <option [value]="c.categoryId">{{ c.title }}</option> }
              </select>
            </div>
          }
        }
        <div>
          <label class="block text-xs text-muted mb-1">預約日期</label>
          <input type="date" [(ngModel)]="appointmentDate" class="border border-hairline rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label class="block text-xs text-muted mb-1">身分證號</label>
          <input [(ngModel)]="memberNumber" class="border border-hairline rounded px-2 py-1.5 text-sm" placeholder="身分證號" />
        </div>
        <div>
          <label class="block text-xs text-muted mb-1">手機號碼</label>
          <input [(ngModel)]="memberMobile" class="border border-hairline rounded px-2 py-1.5 text-sm" placeholder="手機號碼" />
        </div>
        <div>
          <label class="block text-xs text-muted mb-1">姓名</label>
          <input [(ngModel)]="memberName" class="border border-hairline rounded px-2 py-1.5 text-sm" placeholder="姓名" />
        </div>
        <div>
          <label class="block text-xs text-muted mb-1">生日</label>
          <input type="date" [(ngModel)]="birthday" class="border border-hairline rounded px-2 py-1.5 text-sm" />
        </div>
        <button (click)="applyFilter()" [disabled]="loading()"
                class="bg-brand text-white text-sm rounded px-3 py-1.5 hover:bg-brand-deep disabled:opacity-50 inline-flex items-center gap-1.5">
          <i class="fa" [class.fa-refresh]="!loading()" [class.fa-spinner]="loading()" [class.fa-spin]="loading()"></i>
          {{ loading() ? '篩選中…' : '篩選' }}
        </button>
        <div class="flex-1"></div>
        <button (click)="exportCheckin()" class="border border-hairline text-ink text-sm rounded px-3 py-1.5 hover:bg-white inline-flex items-center gap-1.5">
          <i class="fa fa-file-excel-o"></i>匯出
        </button>
        <button (click)="exportQuestionnaire()" class="border border-hairline text-ink text-sm rounded px-3 py-1.5 hover:bg-white inline-flex items-center gap-1.5">
          <i class="fa fa-file-pdf-o"></i>匯出問卷
        </button>
      </div>

      @if (error()) {
        <div class="m-5 text-sm text-red-500">{{ error() }}</div>
      }

      <div class="flex flex-col lg:flex-row gap-4 p-5">
        @if (capacityRows().length > 0) {
          <div class="lg:w-80 shrink-0">
            <div class="overflow-x-auto">
              <table class="w-full text-sm border border-hairline">
                <thead>
                  <tr class="text-left text-muted border-b border-hairline bg-surface">
                    <th class="px-3 py-2 font-medium">預約時段</th>
                    <th class="px-3 py-2 font-medium text-center w-24">設定人數</th>
                    <th class="px-3 py-2 font-medium text-center w-16">預約</th>
                    <th class="px-3 py-2 font-medium text-center w-16">剩餘</th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of capacityRows(); track r.periodId) {
                    <tr class="border-b border-hairline">
                      <td class="px-3 py-2 text-ink">{{ r.periodTitle }}</td>
                      <td class="px-3 py-2 text-center">
                        @if (auth.can(resourceKey(), 'update')) {
                          <input type="number" [ngModel]="r.totalAmount" (ngModelChange)="setCapacityAmount(r.periodId, $event)"
                                 class="w-16 border border-hairline rounded px-1.5 py-1 text-center" />
                        } @else {
                          <span class="text-ink">{{ r.totalAmount }}</span>
                        }
                      </td>
                      <td class="px-3 py-2 text-center text-muted">{{ r.appointmentAmount }}</td>
                      <td class="px-3 py-2 text-center text-muted">{{ r.totalAmount - r.appointmentAmount }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            @if (auth.can(resourceKey(), 'update')) {
              <div class="text-right mt-2">
                <button (click)="saveCapacity()" [disabled]="capacitySaving()"
                        class="bg-brand text-white text-sm rounded px-3 py-1.5 hover:bg-brand-deep disabled:opacity-50">
                  <i class="fa fa-save mr-1"></i>{{ capacitySaving() ? '儲存中…' : '確認' }}
                </button>
              </div>
            }
          </div>
        }

        <div class="flex-1 min-w-0">
          <div class="overflow-x-auto">
          <table class="w-full text-sm" [class.opacity-50]="loading()">
            <thead>
              <tr class="text-left text-muted border-b border-hairline bg-surface">
                <th class="px-3 py-2.5 font-medium text-center w-20 whitespace-nowrap">初診</th>
                <th class="px-3 py-2.5 font-medium w-28 whitespace-nowrap">醫師</th>
                <th class="px-3 py-2.5 font-medium text-center w-28 whitespace-nowrap">預約日期</th>
                <th class="px-3 py-2.5 font-medium text-center w-24 whitespace-nowrap">時間</th>
                <th class="px-3 py-2.5 font-medium text-center w-28 whitespace-nowrap">時段</th>
                <th class="px-3 py-2.5 font-medium text-center w-24 whitespace-nowrap">類型</th>
                <th class="px-3 py-2.5 font-medium text-center w-auto min-w-[160px] max-w-[320px]">項目</th>
                <th class="px-3 py-2.5 font-medium w-24 whitespace-nowrap">姓名</th>
                <th class="px-3 py-2.5 font-medium text-center w-24 whitespace-nowrap">生日</th>
                <th class="px-3 py-2.5 font-medium text-center w-28 whitespace-nowrap">手機號碼</th>
                @if (branchIsAutoRowNumber()) {
                  <th class="px-3 py-2.5 font-medium text-center w-20 whitespace-nowrap">編號</th>
                }
                <th class="px-3 py-2.5 font-medium text-center w-20 whitespace-nowrap">狀態</th>
                <th class="px-3 py-2.5 font-medium text-center w-20 whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              @for (a of items(); track a.appointmentId) {
                <tr class="border-b border-hairline hover:bg-surface">
                  <td class="px-3 py-2.5 text-center text-muted whitespace-nowrap">{{ a.isFirstVisit ? '是' : '否' }}</td>
                  <td class="px-3 py-2.5 text-ink whitespace-nowrap">{{ a.doctorName }}</td>
                  <td class="px-3 py-2.5 text-center text-muted whitespace-nowrap">{{ a.appointmentDate | slice:0:10 }}</td>
                  <td class="px-3 py-2.5 text-center text-muted whitespace-nowrap">{{ a.periodTitle }}</td>
                  <td class="px-3 py-2.5 text-center text-muted whitespace-nowrap">{{ a.slotTitle }}</td>
                  <td class="px-3 py-2.5 text-center text-muted whitespace-nowrap">{{ clinicText(a.clinic) }}</td>
                  <td class="px-3 py-2.5 text-center text-muted min-w-[160px] max-w-[320px] whitespace-normal break-words">{{ a.categoryTitle }}</td>
                  <td class="px-3 py-2.5 text-ink whitespace-nowrap">{{ a.memberName }}</td>
                  <td class="px-3 py-2.5 text-center text-muted whitespace-nowrap">{{ toRocDate(a.memberBirthday) }}</td>
                  <td class="px-3 py-2.5 text-center text-muted whitespace-nowrap">{{ a.memberMobile }}</td>
                  @if (branchIsAutoRowNumber()) {
                    <td class="px-3 py-2.5 text-center text-muted whitespace-nowrap">{{ a.outpatientNum }}</td>
                  }
                  <td class="px-3 py-2.5 text-center whitespace-nowrap">
                    @if (a.status === 1) { <span class="text-green-600">成功</span> } @else { <span class="text-red-500">取消</span> }
                  </td>
                  <td class="px-3 py-2.5 text-center whitespace-nowrap">
                    <span class="inline-flex items-center gap-3">
                      <a [routerLink]="['/reserve', a.appointmentId]" [queryParams]="detailQuery()"
                         class="text-brand hover:text-brand-deep" title="瀏覽"><i class="fa fa-search"></i></a>
                      @if (auth.can(resourceKey(), 'delete')) {
                        <button (click)="cancel(a)" [disabled]="a.status !== 1"
                                class="text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed" title="取消">
                          <i class="fa fa-trash"></i>
                        </button>
                      }
                    </span>
                  </td>
                </tr>
              } @empty {
                <tr><td [attr.colspan]="branchIsAutoRowNumber() ? 13 : 12" class="px-5 py-6 text-center text-muted">{{ loading() ? '載入中…' : '尚無預約' }}</td></tr>
              }
            </tbody>
          </table>
          </div>

          @if (total() > pageSize) {
            <div class="flex flex-wrap items-center justify-between gap-2 pt-3 text-sm">
              <span class="text-muted">共 {{ total() }} 筆</span>
              <div class="space-x-2">
                <button (click)="prevPage()" [disabled]="page() <= 1 || loading()"
                        class="px-3 py-1 border border-hairline rounded disabled:opacity-40">上一頁</button>
                <span>第 {{ page() }} 頁</span>
                <button (click)="nextPage()" [disabled]="page() * pageSize >= total() || loading()"
                        class="px-3 py-1 border border-hairline rounded disabled:opacity-40">下一頁</button>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class ReserveListComponent {
  private readonly api = inject(ReserveApiService);
  private readonly basicApi = inject(BasicDataApiService);
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);

  readonly toRocDate = toRocDate;
  readonly pageSize = 50;

  private readonly queryParams = toSignal(this.route.queryParamMap);
  readonly branch = computed(() => this.queryParams()?.get('branch') ?? 'ta');
  readonly isDentist = computed(() => this.branch() === 'chDentist');
  readonly resourceKey = computed(() => reserveResourceKey(this.branch()));
  readonly pageLabel = computed(() => reserveLabel(this.branch()));

  readonly clinic = signal('');
  categoryId = '';
  appointmentDate = '';
  memberNumber = '';
  memberMobile = '';
  memberName = '';
  birthday = '';

  readonly categories = signal<CategoryAdmin[]>([]);
  readonly items = signal<AppointmentAdminListItem[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly branchIsAutoRowNumber = signal(false);
  readonly capacityRows = signal<CapacityRow[]>([]);
  readonly loading = signal(false);
  readonly capacitySaving = signal(false);
  readonly error = signal<string | null>(null);

  /** 返回列表 / 進詳情頁時攜帶的還原篩選條件（僅 branch/clinic/appointmentDate，比照其他模組 returnQuery 慣例）。 */
  readonly detailQuery = computed(() => {
    const q: Record<string, string> = { branch: this.branch() };
    if (!this.isDentist() && this.clinic()) q['clinic'] = this.clinic();
    if (this.appointmentDate) q['appointmentDate'] = this.appointmentDate;
    return q;
  });

  constructor() {
    effect(() => {
      const b = this.branch();
      untracked(() => this.initForBranch(b));
    });
  }

  private initForBranch(branch: string): void {
    const qp = this.route.snapshot.queryParamMap;
    this.clinic.set(branch === 'chDentist' ? 'Dentist' : (qp.get('clinic') ?? ''));
    this.appointmentDate = qp.get('appointmentDate') ?? '';
    this.categoryId = '';
    this.memberNumber = '';
    this.memberMobile = '';
    this.memberName = '';
    this.birthday = '';
    this.page.set(1);
    this.categories.set([]);
    if (!this.isDentist() && this.clinic()) this.loadCategories(this.clinic());
    this.load();
  }

  onClinicChange(value: string): void {
    this.clinic.set(value);
    this.categoryId = '';
    this.categories.set([]);
    if (value) this.loadCategories(value);
  }

  private loadCategories(clinic: string): void {
    this.basicApi.listAllCategories(clinic).subscribe({
      next: (res) => { if (res.success && res.data) this.categories.set(res.data); },
    });
  }

  applyFilter(): void {
    this.page.set(1);
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .list(
        this.branch(),
        this.isDentist() ? null : this.clinic() || null,
        this.isDentist() ? null : this.categoryId || null,
        this.appointmentDate || null,
        this.memberNumber || null,
        this.memberMobile || null,
        this.memberName || null,
        this.birthday || null,
        this.page(),
      )
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          if (res.success && res.data) {
            this.items.set(res.data.items);
            this.total.set(res.data.total);
            this.branchIsAutoRowNumber.set(res.data.branchIsAutoRowNumber);
            this.buildCapacityRows(res.data.periodAmounts);
          } else {
            this.error.set(res.message ?? '載入失敗');
          }
        },
        error: () => {
          this.loading.set(false);
          this.error.set('系統忙線，請稍後再試');
        },
      });
  }

  private buildCapacityRows(list: PeriodAmount[]): void {
    this.capacityRows.set(
      list.map((p) => ({
        periodId: p.periodId,
        rosterPeriodId: p.rosterPeriodId,
        periodTitle: p.periodTitle,
        totalAmount: p.totalAmount,
        appointmentAmount: p.appointmentAmount,
      })),
    );
  }

  setCapacityAmount(periodId: string, value: number): void {
    this.capacityRows.set(this.capacityRows().map((r) => (r.periodId === periodId ? { ...r, totalAmount: Number(value) } : r)));
  }

  saveCapacity(): void {
    const items: CapacityItemInput[] = this.capacityRows().map((r) => ({
      periodId: r.periodId,
      rosterPeriodId: r.rosterPeriodId,
      patients: r.totalAmount,
    }));
    this.capacitySaving.set(true);
    this.api.updateCapacity(this.branch(), { items }).subscribe({
      next: (res) => {
        this.capacitySaving.set(false);
        if (res.success) this.load();
        else this.error.set(res.message ?? '儲存失敗');
      },
      error: () => {
        this.capacitySaving.set(false);
        this.error.set('儲存失敗');
      },
    });
  }

  prevPage(): void {
    if (this.page() > 1) { this.page.set(this.page() - 1); this.load(); }
  }

  nextPage(): void {
    if (this.page() * this.pageSize < this.total()) { this.page.set(this.page() + 1); this.load(); }
  }

  cancel(a: AppointmentAdminListItem): void {
    if (!confirm('確定要取消嗎？')) return;
    this.api.cancel(this.branch(), a.appointmentId).subscribe({
      next: (res) => {
        if (res.success) this.load();
        else this.error.set(res.message ?? '取消失敗');
      },
      error: (err) => this.error.set(err?.error?.message ?? '取消失敗'),
    });
  }

  clinicText(clinic: string): string {
    if (clinic === 'Skin') return '健保門診';
    if (clinic === 'Cosmetic') return '醫學美容';
    return '齒科';
  }

  exportCheckin(): void {
    if (!this.isDentist() && !this.clinic()) { alert('請選擇項目！'); return; }
    if (!this.appointmentDate) { alert('請選擇預約日期！'); return; }
    this.api.exportCheckin(this.branch(), this.isDentist() ? null : this.clinic(), this.appointmentDate).subscribe({
      next: (res) => {
        const blob = res.body;
        if (!blob) return;
        const filename = this.extractFilename(res.headers.get('content-disposition')) ?? `${this.appointmentDate}預約.xlsx`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },
      error: () => this.error.set('匯出失敗'),
    });
  }

  private extractFilename(header: string | null): string | null {
    if (!header) return null;
    const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
    return m ? decodeURIComponent(m[1]) : null;
  }

  exportQuestionnaire(): void {
    if (!this.isDentist() && !this.clinic()) { alert('請選擇項目！'); return; }
    if (!this.appointmentDate) { alert('請選擇預約日期！'); return; }
    const params = new URLSearchParams({ branch: this.branch(), appointmentDate: this.appointmentDate });
    if (!this.isDentist() && this.clinic()) params.set('clinic', this.clinic());
    window.open(`/reserve/print/questionnaire?${params.toString()}`, '_blank');
  }
}
