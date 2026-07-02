import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BasicDataApiService } from '../../core/services/basic-data-api.service';
import { BasicUploadService } from '../../core/services/basic-upload.service';
import { AuthService } from '../../core/services/auth.service';
import { BranchAdmin } from '../../core/models';

/**
 * 後台基礎資料 — 分院列表（對應舊 BasicMs/Branchs）。
 * 排序沿用舊做法：每列一個數字輸入框，整批「儲存排序」送出（見 docs/blueprints/admin-basic-data.md）。
 */
@Component({
  selector: 'app-branches-list',
  imports: [RouterLink],
  template: `
    <div class="bg-white rounded shadow-sm border border-gray-200">
      <div class="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <h1 class="text-base font-semibold text-gray-800"><i class="fa fa-hospital-o text-gray-400 mr-2"></i>分院</h1>
        @if (auth.can('Branchs', 'add')) {
          <a routerLink="/basic/branches/new"
             class="inline-flex items-center gap-1.5 bg-teal-600 text-white text-sm rounded px-3 py-1.5 hover:bg-teal-700">
            <i class="fa fa-plus"></i> 新增分院
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
            <th class="px-5 py-2.5 font-medium">類型</th>
            <th class="px-5 py-2.5 font-medium">啟用</th>
            <th class="px-5 py-2.5 font-medium w-24">排序</th>
            <th class="px-5 py-2.5 font-medium text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          @for (b of branches(); track b.branchId) {
            <tr class="border-b border-gray-50 hover:bg-gray-50">
              <td class="px-5 py-2.5">
                @if (upload.photoUrl(b.photo, 'branchs'); as url) {
                  <img [src]="url" class="w-10 h-10 object-cover rounded" />
                } @else {
                  <span class="text-gray-300">—</span>
                }
              </td>
              <td class="px-5 py-2.5 text-gray-800">{{ b.title }}</td>
              <td class="px-5 py-2.5 text-gray-600">{{ b.branchType }}</td>
              <td class="px-5 py-2.5">
                @if (b.isEnabled) {
                  <span class="text-green-600">啟用</span>
                } @else {
                  <span class="text-gray-400">停用</span>
                }
              </td>
              <td class="px-5 py-2.5">
                <input type="number" [value]="sorts()[b.branchId]"
                       (change)="setSort(b.branchId, $any($event.target).value)"
                       class="w-16 border border-gray-300 rounded px-2 py-1 text-sm" />
              </td>
              <td class="px-5 py-2.5 text-right space-x-2">
                @if (auth.can('Branchs', 'update')) {
                  <a [routerLink]="['/basic/branches', b.branchId, 'edit']"
                     class="text-blue-600 hover:underline"><i class="fa fa-pencil"></i> 編輯</a>
                }
                @if (auth.can('Branchs', 'delete')) {
                  <button (click)="remove(b)" class="text-red-500 hover:underline"><i class="fa fa-trash"></i> 刪除</button>
                }
              </td>
            </tr>
          } @empty {
            <tr><td colspan="6" class="px-5 py-6 text-center text-gray-400">{{ loading() ? '載入中…' : '尚無分院' }}</td></tr>
          }
        </tbody>
      </table>

      @if (branches().length > 0 && auth.can('Branchs', 'update')) {
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
export class BranchesListComponent {
  private readonly api = inject(BasicDataApiService);
  readonly upload = inject(BasicUploadService);
  readonly auth = inject(AuthService);

  readonly branches = signal<BranchAdmin[]>([]);
  readonly sorts = signal<Record<string, number>>({});
  readonly loading = signal(true);
  readonly savingSort = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.listBranches().subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) {
          this.branches.set(res.data);
          this.sorts.set(Object.fromEntries(res.data.map((b) => [b.branchId, b.sort])));
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
