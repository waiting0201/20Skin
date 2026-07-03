import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BasicDataApiService } from '../../core/services/basic-data-api.service';
import { AuthService } from '../../core/services/auth.service';
import { DoctorAdmin } from '../../core/models';

/** 後台基礎資料 — 醫師列表（對應舊 BasicMs/Doctors）。無排序、無停用（Doctors 表無對應欄位）。 */
@Component({
  selector: 'app-doctors-list',
  imports: [RouterLink],
  template: `
    <div class="bg-white rounded shadow-sm border border-hairline">
      <div class="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-hairline">
        <h1 class="text-base font-semibold text-ink"><i class="fa fa-user-md text-muted mr-2"></i>醫師</h1>
        @if (auth.can('Doctors', 'add')) {
          <a routerLink="/basic/doctors/new"
             class="inline-flex items-center gap-1.5 bg-brand text-white text-sm rounded px-3 py-1.5 hover:bg-brand-deep">
            <i class="fa fa-plus"></i> 新增醫師
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
            <th class="px-5 py-2.5 font-medium w-auto">姓名</th>
            <th class="px-5 py-2.5 font-medium text-center w-20">操作</th>
          </tr>
        </thead>
        <tbody>
          @for (d of doctors(); track d.doctorId) {
            <tr class="border-b border-hairline hover:bg-surface">
              <td class="px-5 py-2.5 text-ink">{{ d.name }}</td>
              <td class="px-5 py-2.5 text-center">
                <span class="inline-flex items-center gap-3">
                  @if (auth.can('Doctors', 'update')) {
                    <a [routerLink]="['/basic/doctors', d.doctorId, 'edit']"
                       class="text-brand hover:text-brand-deep" title="編輯"><i class="fa fa-pencil"></i></a>
                  }
                  @if (auth.can('Doctors', 'delete')) {
                    <button (click)="remove(d)" class="text-red-500 hover:text-red-700" title="刪除"><i class="fa fa-trash"></i></button>
                  }
                </span>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="2" class="px-5 py-6 text-center text-muted">{{ loading() ? '載入中…' : '尚無醫師' }}</td></tr>
          }
        </tbody>
      </table>
      </div>
    </div>
  `,
})
export class DoctorsListComponent {
  private readonly api = inject(BasicDataApiService);
  readonly auth = inject(AuthService);

  readonly doctors = signal<DoctorAdmin[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.listDoctors().subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) this.doctors.set(res.data);
        else this.error.set(res.message ?? '載入失敗');
      },
      error: () => {
        this.loading.set(false);
        this.error.set('系統忙線，請稍後再試');
      },
    });
  }

  remove(d: DoctorAdmin): void {
    if (!confirm(`確定刪除醫師「${d.name}」？`)) return;
    this.api.deleteDoctor(d.doctorId).subscribe({
      next: (res) => {
        if (res.success) this.load();
        else this.error.set(res.message ?? '刪除失敗');
      },
      error: () => this.error.set('刪除失敗'),
    });
  }
}
