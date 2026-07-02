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
    <div class="bg-white rounded shadow-sm border border-gray-200">
      <div class="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <h1 class="text-base font-semibold text-gray-800"><i class="fa fa-user-md text-gray-400 mr-2"></i>醫師</h1>
        @if (auth.can('Doctors', 'add')) {
          <a routerLink="/basic/doctors/new"
             class="inline-flex items-center gap-1.5 bg-teal-600 text-white text-sm rounded px-3 py-1.5 hover:bg-teal-700">
            <i class="fa fa-plus"></i> 新增醫師
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
            <th class="px-5 py-2.5 font-medium text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          @for (d of doctors(); track d.doctorId) {
            <tr class="border-b border-gray-50 hover:bg-gray-50">
              <td class="px-5 py-2.5 text-gray-800">{{ d.name }}</td>
              <td class="px-5 py-2.5 text-right space-x-2">
                @if (auth.can('Doctors', 'update')) {
                  <a [routerLink]="['/basic/doctors', d.doctorId, 'edit']"
                     class="text-blue-600 hover:underline"><i class="fa fa-pencil"></i> 編輯</a>
                }
                @if (auth.can('Doctors', 'delete')) {
                  <button (click)="remove(d)" class="text-red-500 hover:underline"><i class="fa fa-trash"></i> 刪除</button>
                }
              </td>
            </tr>
          } @empty {
            <tr><td colspan="2" class="px-5 py-6 text-center text-gray-400">{{ loading() ? '載入中…' : '尚無醫師' }}</td></tr>
          }
        </tbody>
      </table>
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
