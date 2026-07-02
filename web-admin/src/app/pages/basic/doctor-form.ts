import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BasicDataApiService } from '../../core/services/basic-data-api.service';
import { DoctorUpsertRequest } from '../../core/models';

/** 後台基礎資料 — 新增/編輯醫師（對應舊 BasicMs/AddDoctors、EditDoctors）。 */
@Component({
  selector: 'app-doctor-form',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="bg-white rounded shadow-sm border border-gray-200 max-w-lg">
      <div class="px-5 py-3 border-b border-gray-100">
        <h1 class="text-base font-semibold text-gray-800">
          <i class="fa fa-user-md text-gray-400 mr-2"></i>{{ isEdit() ? '編輯醫師' : '新增醫師' }}
        </h1>
      </div>

      @if (error()) {
        <div class="mx-5 mt-4 text-sm text-red-500">{{ error() }}</div>
      }

      <form [formGroup]="form" (ngSubmit)="submit()" class="p-5 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">姓名 <span class="text-red-400">*</span></label>
          <input formControlName="name" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </div>

        <div class="flex items-center gap-2 pt-2">
          <button type="submit" [disabled]="saving()"
                  class="bg-teal-600 text-white text-sm rounded px-4 py-2 hover:bg-teal-700 disabled:opacity-50">
            {{ saving() ? '儲存中…' : '儲存' }}
          </button>
          <a routerLink="/basic/doctors" class="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">取消</a>
        </div>
      </form>
    </div>
  `,
})
export class DoctorFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(BasicDataApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly doctorId = this.route.snapshot.paramMap.get('id');
  readonly isEdit = signal(!!this.doctorId);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
  });

  constructor() {
    if (this.doctorId) this.loadEdit(this.doctorId);
  }

  private loadEdit(id: string): void {
    this.api.getDoctor(id).subscribe({
      next: (res) => {
        if (res.success && res.data) this.form.patchValue({ name: res.data.name });
        else this.error.set(res.message ?? '載入失敗');
      },
      error: () => this.error.set('系統忙線，請稍後再試'),
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const req: DoctorUpsertRequest = { name: this.form.getRawValue().name.trim() };

    this.saving.set(true);
    this.error.set(null);
    const call = this.doctorId ? this.api.updateDoctor(this.doctorId, req) : this.api.createDoctor(req);
    call.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) this.router.navigate(['/basic/doctors']);
        else this.error.set(res.message ?? '儲存失敗');
      },
      error: () => { this.saving.set(false); this.error.set('儲存失敗'); },
    });
  }
}
