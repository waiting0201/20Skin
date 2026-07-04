import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { BasicDataApiService, periodLabel, periodResourceKey } from '../../core/services/basic-data-api.service';
import { AuthService } from '../../core/services/auth.service';
import { PeriodAdmin } from '../../core/models';

/**
 * 後台基礎資料 — 時段列表（對應舊 BasicMs/Ta·Ch·ChDentist·CosmeticPeriods，clinic 參數化收斂為單一元件）。
 * 舊系統 5 個變體是各自獨立頁面、彼此間沒有切換頁籤（只能透過選單分別進入），故本頁不內建頁籤 UI，
 * branch/clinic 完全由選單連結的 query params 決定（見 core/menu-route-map.ts）。
 * 排序沿用舊做法：每列數字輸入框 + 整批「儲存排序」（見 docs/blueprints/admin-basic-data.md）。
 */
@Component({
  selector: 'app-periods-list',
  imports: [RouterLink],
  template: `
    <div class="bg-white rounded shadow-sm border border-hairline">
      <div class="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-hairline">
        <h1 class="text-base font-semibold text-ink"><i class="fa fa-clock-o text-muted mr-2"></i>{{ pageLabel() }}</h1>
        @if (auth.can(resourceKey(), 'add')) {
          <a [routerLink]="['/basic/periods/new']" [queryParams]="{ branch: branch(), clinic: clinic() }"
             class="inline-flex items-center gap-1.5 bg-brand text-white text-sm rounded px-3 py-1.5 hover:bg-brand-deep">
            <i class="fa fa-plus"></i> 新增{{ pageLabel() }}
          </a>
        }
      </div>

      @if (error()) {
        <div class="m-5 text-sm text-red-500">{{ error() }}</div>
      }

      <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-muted border-b border-hairline bg-surface">
            <th class="px-5 py-2.5 font-medium text-center w-20">排序</th>
            <th class="px-5 py-2.5 font-medium text-center w-32">時間</th>
            <th class="px-5 py-2.5 font-medium w-auto">時段</th>
            <th class="px-5 py-2.5 font-medium text-center w-24">起始編號</th>
            <th class="px-5 py-2.5 font-medium text-center w-20">人數</th>
            <th class="px-5 py-2.5 font-medium text-center w-20">操作</th>
          </tr>
        </thead>
        <tbody>
          @for (p of periods(); track p.periodId) {
            <tr class="border-b border-hairline hover:bg-surface">
              <td class="px-5 py-2.5 text-center">
                <input type="number" [value]="sorts()[p.periodId]"
                       (change)="setSort(p.periodId, $any($event.target).value)"
                       class="w-16 border border-hairline rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
              </td>
              <td class="px-5 py-2.5 text-center text-muted">{{ p.outpatientTimeTitle }}</td>
              <td class="px-5 py-2.5 text-ink">{{ p.title }}</td>
              <td class="px-5 py-2.5 text-center text-muted">{{ p.startNumber ?? '—' }}</td>
              <td class="px-5 py-2.5 text-center text-muted">{{ p.patients }}</td>
              <td class="px-5 py-2.5 text-center">
                <span class="inline-flex items-center gap-3">
                  @if (auth.can(resourceKey(), 'update')) {
                    <a [routerLink]="['/basic/periods', p.periodId, 'edit']" [queryParams]="{ branch: branch(), clinic: clinic() }"
                       class="text-brand hover:text-brand-deep" title="編輯"><i class="fa fa-pencil"></i></a>
                  }
                  @if (auth.can(resourceKey(), 'delete')) {
                    <button (click)="remove(p)" class="text-red-500 hover:text-red-700" title="刪除"><i class="fa fa-trash"></i></button>
                  }
                </span>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="6" class="px-5 py-6 text-center text-muted">{{ loading() ? '載入中…' : '尚無時段' }}</td></tr>
          }
        </tbody>
      </table>
      </div>

      @if (periods().length > 0 && auth.can(resourceKey(), 'update')) {
        <div class="px-5 py-3 border-t border-hairline">
          <button (click)="saveSort()" [disabled]="savingSort()"
                  class="bg-ink text-white text-sm rounded px-4 py-2 hover:bg-black disabled:opacity-50">
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

  private readonly queryParams = toSignal(this.route.queryParamMap);
  readonly branch = computed(() => this.queryParams()?.get('branch') ?? 'ta');
  readonly clinic = computed(() => this.queryParams()?.get('clinic') ?? 'Skin');
  readonly resourceKey = computed(() => periodResourceKey(this.branch(), this.clinic()));
  readonly pageLabel = computed(() => periodLabel(this.branch(), this.clinic()));

  readonly periods = signal<PeriodAdmin[]>([]);
  readonly sorts = signal<Record<string, number>>({});
  readonly loading = signal(true);
  readonly savingSort = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    // branch()/clinic() 隨選單導頁（同元件不同 query params）而變，effect 自動重新載入。
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
