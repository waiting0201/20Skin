import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminApiService } from '../../core/services/admin-api.service';
import { AuthService } from '../../core/services/auth.service';
import { AdminListItem } from '../../core/models';

/**
 * 權限管理 — 管理員列表（對應舊 AuthorityMs/Admins）。
 * 新增/編輯/刪除鈕依 can('Admins', op) 顯示；授權真相在 API。
 */
@Component({
  selector: 'app-admins-list',
  imports: [RouterLink],
  template: `
    <div class="bg-white rounded shadow-sm border border-gray-200">
      <div class="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <h1 class="text-base font-semibold text-gray-800"><i class="fa fa-users text-gray-400 mr-2"></i>管理員</h1>
        @if (auth.can('Admins', 'add')) {
          <a routerLink="/authority/admins/new"
             class="inline-flex items-center gap-1.5 bg-teal-600 text-white text-sm rounded px-3 py-1.5 hover:bg-teal-700">
            <i class="fa fa-plus"></i> 新增管理員
          </a>
        }
      </div>

      @if (error()) {
        <div class="m-5 text-sm text-red-500">{{ error() }}</div>
      }

      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
            <th class="px-5 py-2.5 font-medium">姓名</th>
            <th class="px-5 py-2.5 font-medium">帳號</th>
            <th class="px-5 py-2.5 font-medium text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          @for (a of admins(); track a.adminId) {
            <tr class="border-b border-gray-50 hover:bg-gray-50">
              <td class="px-5 py-2.5 text-gray-800">{{ a.name || '—' }}</td>
              <td class="px-5 py-2.5 text-gray-600">{{ a.username }}</td>
              <td class="px-5 py-2.5 text-right space-x-2">
                @if (auth.can('Admins', 'update')) {
                  <a [routerLink]="['/authority/admins', a.adminId, 'edit']"
                     class="text-blue-600 hover:underline"><i class="fa fa-pencil"></i> 編輯</a>
                }
                @if (auth.can('Admins', 'delete')) {
                  <button (click)="remove(a)" class="text-red-500 hover:underline"><i class="fa fa-trash"></i> 刪除</button>
                }
              </td>
            </tr>
          } @empty {
            <tr><td colspan="3" class="px-5 py-6 text-center text-gray-400">{{ loading() ? '載入中…' : '尚無管理員' }}</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class AdminsListComponent {
  private readonly api = inject(AdminApiService);
  readonly auth = inject(AuthService);

  readonly admins = signal<AdminListItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.listAdmins().subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) this.admins.set(res.data);
        else this.error.set(res.message ?? '載入失敗');
      },
      error: () => {
        this.loading.set(false);
        this.error.set('系統忙線，請稍後再試');
      },
    });
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
