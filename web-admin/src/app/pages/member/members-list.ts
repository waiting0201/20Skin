import { Component, inject, signal } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MemberApiService } from '../../core/services/member-api.service';
import { BasicDataApiService } from '../../core/services/basic-data-api.service';
import { AuthService } from '../../core/services/auth.service';
import { BranchAdmin, MemberListItem } from '../../core/models';

/**
 * 後台會員管理 — 列表（對應舊 MemberMs/Members.cshtml）。
 * 篩選：分院/身分證號/生日；分頁 20 筆（比照 docs/design/frontend-backend.md §分頁規範）。
 * 無排序欄（Members 表無 Sort 欄位，同 doctors-list 模式）。
 */
@Component({
  selector: 'app-members-list',
  imports: [FormsModule, RouterLink, SlicePipe],
  template: `
    <div class="bg-white rounded shadow-sm border border-hairline">
      <div class="flex items-center justify-between px-5 py-3 border-b border-hairline">
        <h1 class="text-base font-semibold text-ink"><i class="fa fa-hospital-o text-muted mr-2"></i>會員管理</h1>
      </div>

      <div class="flex flex-wrap items-end gap-3 px-5 py-3 border-b border-hairline bg-surface">
        <div>
          <label class="block text-xs text-muted mb-1">分院</label>
          <select [(ngModel)]="filterBranchId" class="border border-hairline rounded px-2 py-1.5 text-sm">
            <option value="">請選擇分院</option>
            @for (b of branches(); track b.branchId) { <option [value]="b.branchId">{{ b.title }}</option> }
          </select>
        </div>
        <div>
          <label class="block text-xs text-muted mb-1">身分證號</label>
          <input [(ngModel)]="filterNumber" class="border border-hairline rounded px-2 py-1.5 text-sm" placeholder="身分證號" />
        </div>
        <div>
          <label class="block text-xs text-muted mb-1">生日</label>
          <input type="date" [(ngModel)]="filterBirthday" class="border border-hairline rounded px-2 py-1.5 text-sm" />
        </div>
        <button (click)="applyFilter()" [disabled]="loading()"
                class="bg-brand text-white text-sm rounded px-3 py-1.5 hover:bg-brand-deep disabled:opacity-50 inline-flex items-center gap-1.5">
          <i class="fa" [class.fa-refresh]="!loading()" [class.fa-spinner]="loading()" [class.fa-spin]="loading()"></i>
          {{ loading() ? '篩選中…' : '篩選' }}
        </button>
      </div>

      @if (error()) {
        <div class="m-5 text-sm text-red-500">{{ error() }}</div>
      }

      <div class="overflow-x-auto">
      <table class="w-full text-sm" [class.opacity-50]="loading()">
        <thead>
          <tr class="text-left text-muted border-b border-hairline bg-surface">
            <th class="px-5 py-2.5 font-medium text-center w-20">初診</th>
            <th class="px-5 py-2.5 font-medium text-center w-32">分院</th>
            <th class="px-5 py-2.5 font-medium text-center w-32">身分證號</th>
            <th class="px-5 py-2.5 font-medium text-center w-32">手機號碼</th>
            <th class="px-5 py-2.5 font-medium text-center w-28">生日</th>
            <th class="px-5 py-2.5 font-medium w-auto">姓名</th>
            <th class="px-5 py-2.5 font-medium text-center w-24">黑名單</th>
            <th class="px-5 py-2.5 font-medium text-center w-28">操作</th>
          </tr>
        </thead>
        <tbody>
          @for (m of members(); track m.memberId) {
            <tr class="border-b border-hairline hover:bg-surface">
              <td class="px-5 py-2.5 text-center text-muted">{{ m.isFirstVisit ? '是' : '否' }}</td>
              <td class="px-5 py-2.5 text-center text-muted">
                @for (t of m.branchTitles; track t) { <div>{{ t }}</div> } @empty { 尚未預約 }
              </td>
              <td class="px-5 py-2.5 text-center text-muted">{{ m.number }}</td>
              <td class="px-5 py-2.5 text-center text-muted">{{ m.mobile }}</td>
              <td class="px-5 py-2.5 text-center text-muted">{{ m.birthday | slice:0:10 }}</td>
              <td class="px-5 py-2.5 text-ink">{{ m.name }}</td>
              <td class="px-5 py-2.5 text-center text-muted">{{ m.isBlackList ? '是' : '不是' }}</td>
              <td class="px-5 py-2.5 text-center">
                <span class="inline-flex items-center gap-3">
                  @if (auth.can('Members', 'read')) {
                    <a [routerLink]="['/member', m.memberId, 'questionnaires']"
                       class="text-brand hover:text-brand-deep" title="問卷"><i class="fa fa-list-ol"></i></a>
                  }
                  @if (auth.can('Members', 'update')) {
                    <a [routerLink]="['/member', m.memberId, 'edit']"
                       class="text-brand hover:text-brand-deep" title="編輯"><i class="fa fa-pencil"></i></a>
                  }
                  @if (auth.can('Members', 'delete')) {
                    <button (click)="remove(m)" class="text-red-500 hover:text-red-700" title="刪除"><i class="fa fa-trash"></i></button>
                  }
                </span>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="8" class="px-5 py-6 text-center text-muted">{{ loading() ? '載入中…' : '尚無會員' }}</td></tr>
          }
        </tbody>
      </table>
      </div>

      @if (total() > pageSize) {
        <div class="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-t border-hairline text-sm">
          <span class="text-muted">共 {{ total() }} 筆</span>
          <div class="space-x-2">
            <button (click)="prevPage()" [disabled]="page() <= 1 || loading()"
                    class="px-3 py-1 border border-hairline rounded disabled:opacity-40">上一頁</button>
            <span>第 {{ page() }} 頁</span>
            <button (click)="nextPage()" [disabled]="page() * pageSize >= total() || loading()"
                    class="px-3 py-1 border border-hairline rounded disabled:opacity-40">下一頁</button>
          </div>
        </div>
      }
    </div>
  `,
})
export class MembersListComponent {
  private readonly api = inject(MemberApiService);
  private readonly basicApi = inject(BasicDataApiService);
  readonly auth = inject(AuthService);

  readonly pageSize = 20;
  readonly members = signal<MemberListItem[]>([]);
  readonly branches = signal<BranchAdmin[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  filterBranchId = '';
  filterNumber = '';
  filterBirthday = '';

  constructor() {
    // 分院篩選下拉只列已啟用分院（忠於舊 MemberMsController.Members：Where(IsEnabled).OrderBy(Sort)）。
    this.basicApi.listEnabledBranches().subscribe({
      next: (res) => { if (res.success && res.data) this.branches.set(res.data.items); },
    });
    this.load();
  }

  applyFilter(): void {
    this.page.set(1);
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.list(this.page(), this.filterBranchId || undefined, this.filterNumber || undefined, this.filterBirthday || undefined)
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          if (res.success && res.data) {
            this.members.set(res.data.items);
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
    if (this.page() > 1) { this.page.set(this.page() - 1); this.load(); }
  }

  nextPage(): void {
    if (this.page() * this.pageSize < this.total()) { this.page.set(this.page() + 1); this.load(); }
  }

  remove(m: MemberListItem): void {
    if (!confirm(`確定刪除會員「${m.name ?? m.number}」？（有預約或問卷紀錄將無法刪除）`)) return;
    this.api.delete(m.memberId).subscribe({
      next: (res) => {
        if (res.success) this.load();
        else this.error.set(res.message ?? '刪除失敗');
      },
      error: (err) => this.error.set(err?.error?.message ?? '刪除失敗'),
    });
  }
}
