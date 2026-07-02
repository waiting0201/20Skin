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
    <div class="bg-white rounded shadow-sm border border-gray-200">
      <div class="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <h1 class="text-base font-semibold text-gray-800"><i class="fa fa-calendar text-gray-400 mr-2"></i>排班</h1>
        @if (auth.can(resourceKey(), 'add')) {
          <a [routerLink]="['/roster/new']" [queryParams]="{ branch: branch(), clinic: clinic() }"
             class="inline-flex items-center gap-1.5 bg-teal-600 text-white text-sm rounded px-3 py-1.5 hover:bg-teal-700">
            <i class="fa fa-plus"></i> 新增排班
          </a>
        }
      </div>

      <div class="flex gap-1 px-5 pt-3 border-b border-gray-100">
        @for (tab of tabs; track tab.branch + tab.clinic) {
          <a [routerLink]="['/roster']" [queryParams]="{ branch: tab.branch, clinic: tab.clinic }"
             class="px-3 py-1.5 text-sm rounded-t border-b-2"
             [class.border-teal-600]="tab.branch === branch() && tab.clinic === clinic()"
             [class.text-teal-700]="tab.branch === branch() && tab.clinic === clinic()"
             [class.border-transparent]="!(tab.branch === branch() && tab.clinic === clinic())"
             [class.text-gray-500]="!(tab.branch === branch() && tab.clinic === clinic())">
            {{ tab.label }}
          </a>
        }
      </div>

      <div class="flex items-center gap-3 px-5 py-3 border-b border-gray-100 text-sm">
        <label class="flex items-center gap-1.5">
          日期
          <input type="date" [value]="dateFilter()" (change)="setDate($any($event.target).value)"
                 class="border border-gray-300 rounded px-2 py-1" />
        </label>
        <label class="flex items-center gap-1.5">
          醫師
          <select [value]="doctorFilter()" (change)="setDoctor($any($event.target).value)"
                  class="border border-gray-300 rounded px-2 py-1">
            <option value="">全部</option>
            @for (d of doctors(); track d.doctorId) {
              <option [value]="d.doctorId">{{ d.name }}</option>
            }
          </select>
        </label>
        @if (dateFilter() || doctorFilter()) {
          <button (click)="clearFilters()" class="text-gray-500 hover:underline">清除篩選</button>
        }
      </div>

      @if (error()) {
        <div class="m-5 text-sm text-red-500">{{ error() }}</div>
      }

      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
            <th class="px-5 py-2.5 font-medium">日期</th>
            <th class="px-5 py-2.5 font-medium">醫師</th>
            <th class="px-5 py-2.5 font-medium">班別</th>
            <th class="px-5 py-2.5 font-medium">開放指定預約</th>
            <th class="px-5 py-2.5 font-medium text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          @for (r of items(); track r.rosterId) {
            <tr class="border-b border-gray-50 hover:bg-gray-50">
              <td class="px-5 py-2.5 text-gray-800">{{ r.rosterDate.slice(0, 10) }}</td>
              <td class="px-5 py-2.5 text-gray-600">{{ r.doctorName ?? '不指定' }}</td>
              <td class="px-5 py-2.5 text-gray-600">{{ r.outpatientTimeTitle ?? '—' }}</td>
              <td class="px-5 py-2.5">
                @if (r.isAppointment) { <span class="text-green-600">是</span> } @else { <span class="text-gray-400">否</span> }
              </td>
              <td class="px-5 py-2.5 text-right space-x-2">
                @if (auth.can(resourceKey(), 'update')) {
                  <a [routerLink]="['/roster', r.rosterId, 'edit']" [queryParams]="{ branch: branch(), clinic: clinic() }"
                     class="text-blue-600 hover:underline"><i class="fa fa-pencil"></i> 編輯</a>
                }
                @if (auth.can(resourceKey(), 'delete')) {
                  <button (click)="remove(r)" class="text-red-500 hover:underline"><i class="fa fa-trash"></i> 刪除</button>
                }
              </td>
            </tr>
          } @empty {
            <tr><td colspan="5" class="px-5 py-6 text-center text-gray-400">{{ loading() ? '載入中…' : '尚無排班' }}</td></tr>
          }
        </tbody>
      </table>

      @if (total() > pageSize) {
        <div class="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-sm">
          <span class="text-gray-500">共 {{ total() }} 筆</span>
          <div class="space-x-2">
            <button (click)="prevPage()" [disabled]="page() <= 1"
                    class="px-3 py-1 border border-gray-300 rounded disabled:opacity-40">上一頁</button>
            <span>第 {{ page() }} 頁</span>
            <button (click)="nextPage()" [disabled]="page() * pageSize >= total()"
                    class="px-3 py-1 border border-gray-300 rounded disabled:opacity-40">下一頁</button>
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
