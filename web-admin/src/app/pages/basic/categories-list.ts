import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { BasicDataApiService, categoryResourceKey } from '../../core/services/basic-data-api.service';
import { BasicUploadService } from '../../core/services/basic-upload.service';
import { AuthService } from '../../core/services/auth.service';
import { CategoryAdmin } from '../../core/models';

const TABS = [
  { clinic: 'Skin', label: '皮膚（健保）' },
  { clinic: 'Cosmetic', label: '醫學美容' },
];

/**
 * 後台基礎資料 — 科別項目列表（對應舊 BasicMs/Skins·Cosmetics，clinic 參數化收斂為單一元件）。
 * 排序沿用舊做法：每列數字輸入框 + 整批「儲存排序」（見 docs/blueprints/admin-basic-data.md）。
 */
@Component({
  selector: 'app-categories-list',
  imports: [RouterLink],
  template: `
    <div class="bg-white rounded shadow-sm border border-gray-200">
      <div class="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <h1 class="text-base font-semibold text-gray-800"><i class="fa fa-stethoscope text-gray-400 mr-2"></i>科別項目</h1>
        @if (auth.can(resourceKey(), 'add')) {
          <a [routerLink]="['/basic/categories/new']" [queryParams]="{ clinic: clinic() }"
             class="inline-flex items-center gap-1.5 bg-teal-600 text-white text-sm rounded px-3 py-1.5 hover:bg-teal-700">
            <i class="fa fa-plus"></i> 新增項目
          </a>
        }
      </div>

      <div class="flex gap-1 px-5 pt-3 border-b border-gray-100">
        @for (tab of tabs; track tab.clinic) {
          <a [routerLink]="['/basic/categories']" [queryParams]="{ clinic: tab.clinic }"
             class="px-3 py-1.5 text-sm rounded-t border-b-2"
             [class.border-teal-600]="tab.clinic === clinic()"
             [class.text-teal-700]="tab.clinic === clinic()"
             [class.border-transparent]="tab.clinic !== clinic()"
             [class.text-gray-500]="tab.clinic !== clinic()">
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
            <th class="px-5 py-2.5 font-medium w-16">圖片</th>
            <th class="px-5 py-2.5 font-medium">名稱</th>
            <th class="px-5 py-2.5 font-medium">需填問卷</th>
            <th class="px-5 py-2.5 font-medium w-24">排序</th>
            <th class="px-5 py-2.5 font-medium text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          @for (c of categories(); track c.categoryId) {
            <tr class="border-b border-gray-50 hover:bg-gray-50">
              <td class="px-5 py-2.5">
                @if (upload.photoUrl(c.photo, 'categorys'); as url) {
                  <img [src]="url" class="w-10 h-10 object-cover rounded" />
                } @else {
                  <span class="text-gray-300">—</span>
                }
              </td>
              <td class="px-5 py-2.5 text-gray-800">{{ c.title }}</td>
              <td class="px-5 py-2.5">
                @if (c.isQuestion) { <span class="text-amber-600">是</span> } @else { <span class="text-gray-400">否</span> }
              </td>
              <td class="px-5 py-2.5">
                <input type="number" [value]="sorts()[c.categoryId]"
                       (change)="setSort(c.categoryId, $any($event.target).value)"
                       class="w-16 border border-gray-300 rounded px-2 py-1 text-sm" />
              </td>
              <td class="px-5 py-2.5 text-right space-x-2">
                @if (auth.can(resourceKey(), 'update')) {
                  <a [routerLink]="['/basic/categories', c.categoryId, 'edit']" [queryParams]="{ clinic: clinic() }"
                     class="text-blue-600 hover:underline"><i class="fa fa-pencil"></i> 編輯</a>
                }
                @if (auth.can(resourceKey(), 'delete')) {
                  <button (click)="remove(c)" class="text-red-500 hover:underline"><i class="fa fa-trash"></i> 刪除</button>
                }
              </td>
            </tr>
          } @empty {
            <tr><td colspan="5" class="px-5 py-6 text-center text-gray-400">{{ loading() ? '載入中…' : '尚無項目' }}</td></tr>
          }
        </tbody>
      </table>

      @if (categories().length > 0 && auth.can(resourceKey(), 'update')) {
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
export class CategoriesListComponent {
  private readonly api = inject(BasicDataApiService);
  private readonly route = inject(ActivatedRoute);
  readonly upload = inject(BasicUploadService);
  readonly auth = inject(AuthService);

  readonly tabs = TABS;
  private readonly queryParams = toSignal(this.route.queryParamMap);
  readonly clinic = computed(() => this.queryParams()?.get('clinic') ?? 'Skin');
  readonly resourceKey = computed(() => categoryResourceKey(this.clinic()));

  readonly categories = signal<CategoryAdmin[]>([]);
  readonly sorts = signal<Record<string, number>>({});
  readonly loading = signal(true);
  readonly savingSort = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.clinic();
      this.load();
    });
  }

  private load(): void {
    this.loading.set(true);
    this.api.listCategories(this.clinic()).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) {
          this.categories.set(res.data);
          this.sorts.set(Object.fromEntries(res.data.map((c) => [c.categoryId, c.sort])));
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
