import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BasicDataApiService } from '../../core/services/basic-data-api.service';
import { AuthService } from '../../core/services/auth.service';
import { BranchAdmin } from '../../core/models';

/**
 * 後台基礎資料 — 分院列表（對應舊 BasicMs/Branchs）。
 * 排序沿用舊做法：每列一個數字輸入框，整批「儲存排序」送出（見 docs/blueprints/admin-basic-data.md）。
 * 分頁沿用舊做法：pageSize 固定 20（見 docs/design/frontend-backend.md §分頁規範）；「儲存排序」僅送出當頁資料。
 */
@Component({
  selector: 'app-branches-list',
  imports: [RouterLink],
  template: `
    <div class="bg-white rounded shadow-sm border border-hairline">
      <div class="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-hairline">
        <h1 class="text-base font-semibold text-ink"><i class="fa fa-hospital-o text-muted mr-2"></i>分院</h1>
        @if (auth.can('Branchs', 'add')) {
          <a routerLink="/basic/branches/new"
             class="inline-flex items-center gap-1.5 bg-brand text-white text-sm rounded px-3 py-1.5 hover:bg-brand-deep">
            <i class="fa fa-plus"></i> 新增分院
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
            <th class="px-5 py-2.5 font-medium text-center w-24">類型</th>
            <th class="px-5 py-2.5 font-medium w-auto">名稱</th>
            <th class="px-5 py-2.5 font-medium text-center w-28">自動編號</th>
            <th class="px-5 py-2.5 font-medium text-center w-24">啟用</th>
            <th class="px-5 py-2.5 font-medium text-center w-20">操作</th>
          </tr>
        </thead>
        <tbody>
          @for (b of branches(); track b.branchId) {
            <tr class="border-b border-hairline hover:bg-surface">
              <td class="px-5 py-2.5 text-center">
                <input type="number" [value]="sorts()[b.branchId]"
                       (change)="setSort(b.branchId, $any($event.target).value)"
                       class="w-16 border border-hairline rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
              </td>
              <td class="px-5 py-2.5 text-center text-muted">{{ b.branchType === 1 ? '皮膚' : '齒科' }}</td>
              <td class="px-5 py-2.5 text-ink">{{ b.title }}</td>
              <td class="px-5 py-2.5 text-center text-muted">{{ b.isAutoRowNumber ? '是' : '否' }}</td>
              <td class="px-5 py-2.5 text-center">
                @if (b.isEnabled) {
                  <span class="text-green-600">是</span>
                } @else {
                  <span class="text-muted">不啟用</span>
                }
              </td>
              <td class="px-5 py-2.5 text-center">
                <span class="inline-flex items-center gap-3">
                  @if (auth.can('Branchs', 'update')) {
                    <a [routerLink]="['/basic/branches', b.branchId, 'edit']"
                       class="text-brand hover:text-brand-deep" title="編輯"><i class="fa fa-pencil"></i></a>
                  }
                  @if (auth.can('Branchs', 'delete')) {
                    <button (click)="remove(b)" class="text-red-500 hover:text-red-700" title="刪除"><i class="fa fa-trash"></i></button>
                  }
                </span>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="6" class="px-5 py-6 text-center text-muted">{{ loading() ? '載入中…' : '尚無分院' }}</td></tr>
          }
        </tbody>
      </table>
      </div>

      @if (branches().length > 0 && auth.can('Branchs', 'update')) {
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
export class BranchesListComponent {
  private readonly api = inject(BasicDataApiService);
  readonly auth = inject(AuthService);

  readonly pageSize = 20;
  readonly branches = signal<BranchAdmin[]>([]);
  readonly sorts = signal<Record<string, number>>({});
  readonly total = signal(0);
  readonly page = signal(1);
  readonly loading = signal(true);
  readonly savingSort = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.listBranches(this.page()).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) {
          this.branches.set(res.data.items);
          this.total.set(res.data.total);
          this.sorts.set(Object.fromEntries(res.data.items.map((b) => [b.branchId, b.sort])));
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

  setSort(branchId: string, value: string): void {
    this.sorts.set({ ...this.sorts(), [branchId]: Number(value) });
  }

  saveSort(): void {
    const items = Object.entries(this.sorts()).map(([id, sort]) => ({ id, sort }));
    this.savingSort.set(true);
    this.api.sortBranches(items).subscribe({
      next: (res) => {
        this.savingSort.set(false);
        if (res.success) this.load();
        else this.error.set(res.message ?? '排序失敗');
      },
      error: () => { this.savingSort.set(false); this.error.set('排序失敗'); },
    });
  }

  remove(b: BranchAdmin): void {
    if (!confirm(`確定刪除分院「${b.title}」？`)) return;
    this.api.deleteBranch(b.branchId).subscribe({
      next: (res) => {
        if (res.success) this.load();
        else this.error.set(res.message ?? '刪除失敗');
      },
      error: () => this.error.set('刪除失敗'),
    });
  }
}
