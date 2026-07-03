import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { RosterApiService, rosterResourceKey } from '../../core/services/roster-api.service';
import { BasicDataApiService } from '../../core/services/basic-data-api.service';
import { AuthService } from '../../core/services/auth.service';
import { DoctorAdmin, RosterListItem } from '../../core/models';

const TABS = [
  { branch: 'ta', clinic: 'Skin', label: '台中．健保' },
  { branch: 'ta', clinic: 'Cosmetic', label: '台中．美容' },
  { branch: 'ch', clinic: 'Skin', label: '二林．健保' },
  { branch: 'ch', clinic: 'Cosmetic', label: '二林．美容' },
  { branch: 'chDentist', clinic: 'Dentist', label: '二林．齒科' },
];

/**
 * 後台排班列表（對應舊 ShiftMs/Ta·Ch·ChDentist·CosmeticRosters，clinic 參數化收斂為單一元件）。
 * 依日期/醫師篩選 + 分頁；刪除守門在後端（有任何預約引用即擋）。
 */
@Component({
  selector: 'app-rosters-list',
  imports: [RouterLink],
  template: `
    <div class="bg-white rounded shadow-sm border border-hairline">
      <div class="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-hairline">
        <h1 class="text-base font-semibold text-ink"><i class="fa fa-calendar text-muted mr-2"></i>排班</h1>
        @if (auth.can(resourceKey(), 'add')) {
          <a [routerLink]="['/roster/new']" [queryParams]="{ branch: branch(), clinic: clinic() }"
             class="inline-flex items-center gap-1.5 bg-brand text-white text-sm rounded px-3 py-1.5 hover:bg-brand-deep">
            <i class="fa fa-plus"></i> 新增排班
          </a>
        }
      </div>

      <div class="flex gap-1 px-5 pt-3 border-b border-hairline overflow-x-auto">
        @for (tab of tabs; track tab.branch + tab.clinic) {
          <a [routerLink]="['/roster']" [queryParams]="{ branch: tab.branch, clinic: tab.clinic }"
             class="px-3 py-1.5 text-sm rounded-t border-b-2"
             [class.border-brand]="tab.branch === branch() && tab.clinic === clinic()"
             [class.text-brand]="tab.branch === branch() && tab.clinic === clinic()"
             [class.border-transparent]="!(tab.branch === branch() && tab.clinic === clinic())"
             [class.text-muted]="!(tab.branch === branch() && tab.clinic === clinic())">
            {{ tab.label }}
          </a>
        }
      </div>

      <div class="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-hairline text-sm">
        <label class="flex items-center gap-1.5">
          日期
          <input type="date" [value]="dateFilter()" (change)="setDate($any($event.target).value)"
                 class="border border-hairline rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
        </label>
        <label class="flex items-center gap-1.5">
          醫師
          <select [value]="doctorFilter()" (change)="setDoctor($any($event.target).value)"
                  class="border border-hairline rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand">
            <option value="">全部</option>
            @for (d of doctors(); track d.doctorId) {
              <option [value]="d.doctorId">{{ d.name }}</option>
            }
          </select>
        </label>
        @if (dateFilter() || doctorFilter()) {
          <button (click)="clearFilters()" class="text-muted hover:underline">清除篩選</button>
        }
      </div>

      @if (error()) {
        <div class="m-5 text-sm text-red-500">{{ error() }}</div>
      }

      <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-muted border-b border-hairline bg-surface">
            <th class="px-5 py-2.5 font-medium w-32">醫師</th>
            <th class="px-5 py-2.5 font-medium w-28">日期</th>
            <th class="px-5 py-2.5 font-medium w-auto">班別</th>
            <th class="px-5 py-2.5 font-medium text-center w-32">開放指定預約</th>
            <th class="px-5 py-2.5 font-medium text-center w-20">操作</th>
          </tr>
        </thead>
        <tbody>
          @for (r of items(); track r.rosterId) {
            <tr class="border-b border-hairline hover:bg-surface">
              <td class="px-5 py-2.5 text-muted">{{ r.doctorName ?? '不指定' }}</td>
              <td class="px-5 py-2.5 text-ink">{{ r.rosterDate.slice(0, 10) }}</td>
              <td class="px-5 py-2.5 text-muted">{{ r.outpatientTimeTitle ?? '—' }}</td>
              <td class="px-5 py-2.5 text-center">
                @if (r.isAppointment) { <span class="text-green-600">是</span> } @else { <span class="text-muted">否</span> }
              </td>
              <td class="px-5 py-2.5 text-center">
                <span class="inline-flex items-center gap-3">
                  @if (auth.can(resourceKey(), 'update')) {
                    <a [routerLink]="['/roster', r.rosterId, 'edit']" [queryParams]="{ branch: branch(), clinic: clinic() }"
                       class="text-brand hover:text-brand-deep" title="編輯"><i class="fa fa-pencil"></i></a>
                  }
                  @if (auth.can(resourceKey(), 'delete')) {
                    <button (click)="remove(r)" class="text-red-500 hover:text-red-700" title="刪除"><i class="fa fa-trash"></i></button>
                  }
                </span>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="5" class="px-5 py-6 text-center text-muted">{{ loading() ? '載入中…' : '尚無排班' }}</td></tr>
          }
        </tbody>
      </table>
      </div>

      @if (total() > pageSize) {
        <div class="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-t border-hairline text-sm">
          <span class="text-muted">共 {{ total() }} 筆</span>
          <div class="space-x-2">
            <button (click)="prevPage()" [disabled]="page() <= 1"
                    class="px-3 py-1 border border-hairline rounded disabled:opacity-40">上一頁</button>
            <span>第 {{ page() }} 頁</span>
            <button (click)="nextPage()" [disabled]="page() * pageSize >= total()"
                    class="px-3 py-1 border border-hairline rounded disabled:opacity-40">下一頁</button>
          </div>
        </div>
      }
    </div>
  `,
})
export class RostersListComponent {
  private readonly api = inject(RosterApiService);
  private readonly basicApi = inject(BasicDataApiService);
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);

  readonly tabs = TABS;
  readonly pageSize = 20;
  private readonly queryParams = toSignal(this.route.queryParamMap);
  readonly branch = computed(() => this.queryParams()?.get('branch') ?? 'ta');
  readonly clinic = computed(() => this.queryParams()?.get('clinic') ?? 'Skin');
  readonly resourceKey = computed(() => rosterResourceKey(this.branch(), this.clinic()));

  readonly items = signal<RosterListItem[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly dateFilter = signal<string>('');
  readonly doctorFilter = signal<string>('');
  readonly doctors = signal<DoctorAdmin[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    this.basicApi.listDoctors().subscribe({
      next: (res) => { if (res.success && res.data) this.doctors.set(res.data); },
    });

    effect(() => {
      this.branch();
      this.clinic();
      this.page();
      this.dateFilter();
      this.doctorFilter();
      this.load();
    });
  }

  private load(): void {
    this.loading.set(true);
    this.api.listRosters(this.branch(), this.clinic(), this.dateFilter() || null, this.doctorFilter() || null, this.page()).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) {
          this.items.set(res.data.items);
          this.total.set(res.data.total);
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

  setDate(value: string): void {
    this.page.set(1);
    this.dateFilter.set(value);
  }

  setDoctor(value: string): void {
    this.page.set(1);
    this.doctorFilter.set(value);
  }

  clearFilters(): void {
    this.page.set(1);
    this.dateFilter.set('');
    this.doctorFilter.set('');
  }

  prevPage(): void {
    if (this.page() > 1) this.page.set(this.page() - 1);
  }

  nextPage(): void {
    if (this.page() * this.pageSize < this.total()) this.page.set(this.page() + 1);
  }

  remove(r: RosterListItem): void {
    if (!confirm(`確定刪除 ${r.rosterDate.slice(0, 10)} 的排班？`)) return;
    this.api.deleteRoster(this.branch(), this.clinic(), r.rosterId).subscribe({
      next: (res) => {
        if (res.success) this.load();
        else this.error.set(res.message ?? '刪除失敗');
      },
      error: () => this.error.set('刪除失敗'),
    });
  }
}
