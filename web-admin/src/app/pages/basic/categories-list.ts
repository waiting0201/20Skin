import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { BasicDataApiService, categoryLabel, categoryResourceKey } from '../../core/services/basic-data-api.service';
import { AuthService } from '../../core/services/auth.service';
import { CategoryAdmin } from '../../core/models';

/**
 * 後台基礎資料 — 科別項目列表（對應舊 BasicMs/Skins·Cosmetics，clinic 參數化收斂為單一元件）。
 * 舊系統 2 個變體是各自獨立頁面、彼此間沒有切換頁籤（只能透過選單分別進入），故本頁不內建頁籤 UI，
 * clinic 完全由選單連結的 query params 決定（見 core/menu-route-map.ts）。
 * 排序沿用舊做法：每列數字輸入框 + 整批「儲存排序」（見 docs/blueprints/admin-basic-data.md）。
 * 分頁沿用舊做法：pageSize 固定 20（見 docs/design/frontend-backend.md §分頁規範）；「儲存排序」僅送出當頁資料。
 */
@Component({
  selector: 'app-categories-list',
  imports: [RouterLink],
  template: `
    <div class="bg-white rounded shadow-sm border border-hairline">
      <div class="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-hairline">
        <h1 class="text-base font-semibold text-ink"><i class="fa fa-stethoscope text-muted mr-2"></i>{{ pageLabel() }}</h1>
        @if (auth.can(resourceKey(), 'add')) {
          <a [routerLink]="['/basic/categories/new']" [queryParams]="{ clinic: clinic() }"
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
            <th class="px-5 py-2.5 font-medium w-auto">標題</th>
            <th class="px-5 py-2.5 font-medium text-center w-28">需填問卷</th>
            <th class="px-5 py-2.5 font-medium text-center w-32">台中每次一人</th>
            <th class="px-5 py-2.5 font-medium text-center w-32">二林每次一人</th>
            <th class="px-5 py-2.5 font-medium text-center w-32">齒科每次一人</th>
            <th class="px-5 py-2.5 font-medium text-center w-20">操作</th>
          </tr>
        </thead>
        <tbody>
          @for (c of categories(); track c.categoryId) {
            <tr class="border-b border-hairline hover:bg-surface">
              <td class="px-5 py-2.5 text-center">
                <input type="number" [value]="sorts()[c.categoryId]"
                       (change)="setSort(c.categoryId, $any($event.target).value)"
                       class="w-16 border border-hairline rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
              </td>
              <td class="px-5 py-2.5 text-ink">{{ c.title }}</td>
              <td class="px-5 py-2.5 text-center text-muted">{{ c.isQuestion ? '需要' : '不需要' }}</td>
              <td class="px-5 py-2.5 text-center text-muted">{{ c.isOnly ? '是' : '不是' }}</td>
              <td class="px-5 py-2.5 text-center text-muted">{{ c.chIsOnly ? '是' : '不是' }}</td>
              <td class="px-5 py-2.5 text-center text-muted">{{ c.chDentistIsOnly ? '是' : '不是' }}</td>
              <td class="px-5 py-2.5 text-center">
                <span class="inline-flex items-center gap-3">
                  @if (auth.can(resourceKey(), 'update')) {
                    <a [routerLink]="['/basic/categories', c.categoryId, 'edit']" [queryParams]="{ clinic: clinic() }"
                       class="text-brand hover:text-brand-deep" title="編輯"><i class="fa fa-pencil"></i></a>
                  }
                  @if (auth.can(resourceKey(), 'delete')) {
                    <button (click)="remove(c)" class="text-red-500 hover:text-red-700" title="刪除"><i class="fa fa-trash"></i></button>
                  }
                </span>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="7" class="px-5 py-6 text-center text-muted">{{ loading() ? '載入中…' : '尚無項目' }}</td></tr>
          }
        </tbody>
      </table>
      </div>

      @if (categories().length > 0 && auth.can(resourceKey(), 'update')) {
        <div class="px-5 py-3 border-t border-hairline">
          <button (click)="saveSort()" [disabled]="savingSort()"
                  class="bg-ink text-white text-sm rounded px-4 py-2 hover:bg-black disabled:opacity-50">
            {{ savingSort() ? '儲存中…' : '儲存排序' }}
          </button>
        </div>
      }

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
export class CategoriesListComponent {
  private readonly api = inject(BasicDataApiService);
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);

  private readonly queryParams = toSignal(this.route.queryParamMap);
  readonly clinic = computed(() => this.queryParams()?.get('clinic') ?? 'Skin');
  readonly resourceKey = computed(() => categoryResourceKey(this.clinic()));
  readonly pageLabel = computed(() => categoryLabel(this.clinic()));

  readonly pageSize = 20;
  readonly categories = signal<CategoryAdmin[]>([]);
  readonly sorts = signal<Record<string, number>>({});
  readonly total = signal(0);
  readonly page = signal(1);
  readonly loading = signal(true);
  readonly savingSort = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.clinic();
      this.page.set(1);
      this.load();
    });
  }

  private load(): void {
    this.loading.set(true);
    this.api.listCategories(this.clinic(), this.page()).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) {
          this.categories.set(res.data.items);
          this.total.set(res.data.total);
          this.sorts.set(Object.fromEntries(res.data.items.map((c) => [c.categoryId, c.sort])));
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

  prevPage(): void {
    if (this.page() > 1) {
      this.page.set(this.page() - 1);
      this.load();
    }
  }

  nextPage(): void {
    if (this.page() * this.pageSize < this.total()) {
      this.page.set(this.page() + 1);
      this.load();
    }
  }

  setSort(categoryId: string, value: string): void {
    this.sorts.set({ ...this.sorts(), [categoryId]: Number(value) });
  }

  saveSort(): void {
    const items = Object.entries(this.sorts()).map(([id, sort]) => ({ id, sort }));
    this.savingSort.set(true);
    this.api.sortCategories(this.clinic(), items).subscribe({
      next: (res) => {
        this.savingSort.set(false);
        if (res.success) this.load();
        else this.error.set(res.message ?? '排序失敗');
      },
      error: () => { this.savingSort.set(false); this.error.set('排序失敗'); },
    });
  }

  remove(c: CategoryAdmin): void {
    if (!confirm(`確定刪除項目「${c.title}」？`)) return;
    this.api.deleteCategory(this.clinic(), c.categoryId).subscribe({
      next: (res) => {
        if (res.success) this.load();
        else this.error.set(res.message ?? '刪除失敗');
      },
      error: () => this.error.set('刪除失敗'),
    });
  }
}
