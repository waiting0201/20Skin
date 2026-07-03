import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminApiService } from '../../core/services/admin-api.service';
import { AuthService } from '../../core/services/auth.service';
import { AdminListItem } from '../../core/models';

/**
 * 權限管理 — 管理員列表（對應舊 AuthorityMs/Admins）。
 * 新增/編輯/刪除鈕依 can('Admins', op) 顯示；授權真相在 API。
 * 分頁沿用舊做法：pageSize 固定 20（見 docs/design/frontend-backend.md §分頁規範）。
 */
@Component({
  selector: 'app-admins-list',
  imports: [RouterLink],
  template: `
    <div class="bg-white rounded shadow-sm border border-hairline">
      <div class="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-hairline">
        <h1 class="text-base font-semibold text-ink"><i class="fa fa-users text-muted mr-2"></i>管理員</h1>
        @if (auth.can('Admins', 'add')) {
          <a routerLink="/authority/admins/new"
             class="inline-flex items-center gap-1.5 bg-brand text-white text-sm rounded px-3 py-1.5 hover:bg-brand-deep">
            <i class="fa fa-plus"></i> 新增管理員
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
            <th class="px-5 py-2.5 font-medium w-32">姓名</th>
            <th class="px-5 py-2.5 font-medium w-auto">帳號</th>
            <th class="px-5 py-2.5 font-medium text-center w-20">操作</th>
          </tr>
        </thead>
        <tbody>
          @for (a of admins(); track a.adminId) {
            <tr class="border-b border-hairline hover:bg-surface">
              <td class="px-5 py-2.5 text-ink">{{ a.name || '—' }}</td>
              <td class="px-5 py-2.5 text-muted">{{ a.username }}</td>
              <td class="px-5 py-2.5 text-center">
                <span class="inline-flex items-center gap-3">
                  @if (auth.can('Admins', 'update')) {
                    <a [routerLink]="['/authority/admins', a.adminId, 'edit']"
                       class="text-brand hover:text-brand-deep" title="編輯"><i class="fa fa-pencil"></i></a>
                  }
                  @if (auth.can('Admins', 'delete')) {
                    <button (click)="remove(a)" class="text-red-500 hover:text-red-700" title="刪除"><i class="fa fa-trash"></i></button>
                  }
                </span>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="3" class="px-5 py-6 text-center text-muted">{{ loading() ? '載入中…' : '尚無管理員' }}</td></tr>
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
export class AdminsListComponent {
  private readonly api = inject(AdminApiService);
  readonly auth = inject(AuthService);

  readonly pageSize = 20;
  readonly admins = signal<AdminListItem[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.listAdmins(this.page()).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) {
          this.admins.set(res.data.items);
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

  remove(a: AdminListItem): void {
    if (!confirm(`確定刪除管理員「${a.name || a.username}」？`)) return;
    this.api.deleteAdmin(a.adminId).subscribe({
      next: (res) => {
        if (res.success) this.load();
        else this.error.set(res.message ?? '刪除失敗');
      },
      error: () => this.error.set('刪除失敗'),
    });
  }
}
