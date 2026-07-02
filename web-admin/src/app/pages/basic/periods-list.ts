import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { BasicDataApiService, periodResourceKey } from '../../core/services/basic-data-api.service';
import { AuthService } from '../../core/services/auth.service';
import { PeriodAdmin } from '../../core/models';

/** 5 個舊變體切換頁籤（對應 Lims TaPeriods/TaCosmeticPeriods/ChPeriods/ChCosmeticPeriods/ChDentistPeriods）。 */
const TABS = [
  { branch: 'ta', clinic: 'Skin', label: '台中．健保' },
  { branch: 'ta', clinic: 'Cosmetic', label: '台中．美容' },
  { branch: 'ch', clinic: 'Skin', label: '二林．健保' },
  { branch: 'ch', clinic: 'Cosmetic', label: '二林．美容' },
  { branch: 'chDentist', clinic: 'Dentist', label: '二林．齒科' },
];

/**
 * 後台基礎資料 — 時段列表（對應舊 BasicMs/Ta·Ch·ChDentist·CosmeticPeriods，clinic 參數化收斂為單一元件）。
 * 排序沿用舊做法：每列數字輸入框 + 整批「儲存排序」（見 docs/blueprints/admin-basic-data.md）。
 */
@Component({
  selector: 'app-periods-list',
  imports: [RouterLink],
  template: `
    <div class="bg-white rounded shadow-sm border border-gray-200">
      <div class="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <h1 class="text-base font-semibold text-gray-800"><i class="fa fa-clock-o text-gray-400 mr-2"></i>時段</h1>
        @if (auth.can(resourceKey(), 'add')) {
          <a [routerLink]="['/basic/periods/new']" [queryParams]="{ branch: branch(), clinic: clinic() }"
             class="inline-flex items-center gap-1.5 bg-teal-600 text-white text-sm rounded px-3 py-1.5 hover:bg-teal-700">
            <i class="fa fa-plus"></i> 新增時段
          </a>
        }
      </div>

      <div class="flex gap-1 px-5 pt-3 border-b border-gray-100">
        @for (tab of tabs; track tab.branch + tab.clinic) {
          <a [routerLink]="['/basic/periods']" [queryParams]="{ branch: tab.branch, clinic: tab.clinic }"
             class="px-3 py-1.5 text-sm rounded-t border-b-2"
             [class.border-teal-600]="tab.branch === branch() && tab.clinic === clinic()"
             [class.text-teal-700]="tab.branch === branch() && tab.clinic === clinic()"
             [class.border-transparent]="!(tab.branch === branch() && tab.clinic === clinic())"
             [class.text-gray-500]="!(tab.branch === branch() && tab.clinic === clinic())">
            {{ tab.label }}
          </a>
        }
      </div>

      @if (error()) {
        <div class="m-5 text-sm text-red-500">{{ error() }}</div>
      }

      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
            <th class="px-5 py-2.5 font-medium">名稱</th>
            <th class="px-5 py-2.5 font-medium">門診時段</th>
            <th class="px-5 py-2.5 font-medium">起始號碼</th>
            <th class="px-5 py-2.5 font-medium">容量</th>
            <th class="px-5 py-2.5 font-medium w-24">排序</th>
            <th class="px-5 py-2.5 font-medium text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          @for (p of periods(); track p.periodId) {
            <tr class="border-b border-gray-50 hover:bg-gray-50">
              <td class="px-5 py-2.5 text-gray-800">{{ p.title }}</td>
              <td class="px-5 py-2.5 text-gray-600">{{ p.outpatientTimeTitle }}</td>
              <td class="px-5 py-2.5 text-gray-600">{{ p.startNumber ?? '—' }}</td>
              <td class="px-5 py-2.5 text-gray-600">{{ p.patients }}</td>
              <td class="px-5 py-2.5">
                <input type="number" [value]="sorts()[p.periodId]"
                       (change)="setSort(p.periodId, $any($event.target).value)"
                       class="w-16 border border-gray-300 rounded px-2 py-1 text-sm" />
              </td>
              <td class="px-5 py-2.5 text-right space-x-2">
                @if (auth.can(resourceKey(), 'update')) {
                  <a [routerLink]="['/basic/periods', p.periodId, 'edit']" [queryParams]="{ branch: branch(), clinic: clinic() }"
                     class="text-blue-600 hover:underline"><i class="fa fa-pencil"></i> 編輯</a>
                }
                @if (auth.can(resourceKey(), 'delete')) {
                  <button (click)="remove(p)" class="text-red-500 hover:underline"><i class="fa fa-trash"></i> 刪除</button>
                }
              </td>
            </tr>
          } @empty {
            <tr><td colspan="6" class="px-5 py-6 text-center text-gray-400">{{ loading() ? '載入中…' : '尚無時段' }}</td></tr>
          }
        </tbody>
      </table>

      @if (periods().length > 0 && auth.can(resourceKey(), 'update')) {
        <div class="px-5 py-3 border-t border-gray-100">
          <button (click)="saveSort()" [disabled]="savingSort()"
                  class="bg-gray-700 text-white text-sm rounded px-4 py-2 hover:bg-gray-800 disabled:opacity-50">
            {{ savingSort() ? '儲存中…' : '儲存排序' }}
          </button>
        </div>
      }
    </div>
  `,
})
export class PeriodsListComponent {
  private readonly api = inject(BasicDataApiService);
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);

  readonly tabs = TABS;
  private readonly queryParams = toSignal(this.route.queryParamMap);
  readonly branch = computed(() => this.queryParams()?.get('branch') ?? 'ta');
  readonly clinic = computed(() => this.queryParams()?.get('clinic') ?? 'Skin');
  readonly resourceKey = computed(() => periodResourceKey(this.branch(), this.clinic()));

  readonly periods = signal<PeriodAdmin[]>([]);
  readonly sorts = signal<Record<string, number>>({});
  readonly loading = signal(true);
  readonly savingSort = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    // branch()/clinic() 隨頁籤切換（同元件不同 query params）而變，effect 自動重新載入。
    effect(() => {
      this.branch();
      this.clinic();
      this.load();
    });
  }

  private load(): void {
    this.loading.set(true);
    this.api.listPeriods(this.branch(), this.clinic()).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) {
          this.periods.set(res.data);
          this.sorts.set(Object.fromEntries(res.data.map((p) => [p.periodId, p.sort])));
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

  setSort(periodId: string, value: string): void {
    this.sorts.set({ ...this.sorts(), [periodId]: Number(value) });
  }

  saveSort(): void {
    const items = Object.entries(this.sorts()).map(([id, sort]) => ({ id, sort }));
    this.savingSort.set(true);
    this.api.sortPeriods(this.branch(), this.clinic(), items).subscribe({
      next: (res) => {
        this.savingSort.set(false);
        if (res.success) this.load();
        else this.error.set(res.message ?? '排序失敗');
      },
      error: () => { this.savingSort.set(false); this.error.set('排序失敗'); },
    });
  }

  remove(p: PeriodAdmin): void {
    if (!confirm(`確定刪除時段「${p.title}」？`)) return;
    this.api.deletePeriod(this.branch(), this.clinic(), p.periodId).subscribe({
      next: (res) => {
        if (res.success) this.load();
        else this.error.set(res.message ?? '刪除失敗');
      },
      error: () => this.error.set('刪除失敗'),
    });
  }
}
