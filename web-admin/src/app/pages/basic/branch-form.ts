import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BasicDataApiService } from '../../core/services/basic-data-api.service';
import { BasicUploadService } from '../../core/services/basic-upload.service';
import { BranchUpsertRequest } from '../../core/models';

/** 後台基礎資料 — 新增/編輯分院（對應舊 BasicMs/AddBranchs、EditBranchs）。 */
@Component({
  selector: 'app-branch-form',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="bg-white rounded shadow-sm border border-hairline max-w-2xl">
      <div class="px-5 py-3 border-b border-hairline">
        <h1 class="text-base font-semibold text-ink">
          <i class="fa fa-hospital-o text-muted mr-2"></i>{{ isEdit() ? '編輯分院' : '新增分院' }}
        </h1>
      </div>

      @if (error()) {
        <div class="mx-5 mt-4 text-sm text-red-500">{{ error() }}</div>
      }

      <form [formGroup]="form" (ngSubmit)="submit()" class="p-5 space-y-4">
        <div>
          <label class="block text-sm font-medium text-ink mb-1">名稱 <span class="text-red-400">*</span></label>
          <input formControlName="title"
                 class="w-full border border-hairline rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
        </div>
        <div>
          <label class="block text-sm font-medium text-ink mb-1">類型（BranchType）</label>
          <input type="number" formControlName="branchType"
                 class="w-full border border-hairline rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
        </div>
        <div>
          <label class="block text-sm font-medium text-ink mb-1">圖片</label>
          @if (photoUrl(); as url) {
            <img [src]="url" class="w-24 h-24 object-cover rounded mb-2" />
          }
          <input type="file" accept="image/*" (change)="onFileSelected($event)" />
          @if (uploading()) { <span class="text-xs text-muted ml-2">上傳中…</span> }
        </div>
        <div class="flex items-center gap-2">
          <input type="checkbox" id="isAutoRowNumber" formControlName="isAutoRowNumber" />
          <label for="isAutoRowNumber" class="text-sm text-ink">自動配號（IsAutoRowNumber）</label>
        </div>
        <div class="flex items-center gap-2">
          <input type="checkbox" id="isEnabled" formControlName="isEnabled" />
          <label for="isEnabled" class="text-sm text-ink">啟用</label>
        </div>

        <div class="flex items-center gap-2 pt-2">
          <button type="submit" [disabled]="saving()"
                  class="bg-brand text-white text-sm rounded px-4 py-2 hover:bg-brand-deep disabled:opacity-50">
            {{ saving() ? '儲存中…' : '儲存' }}
          </button>
          <a routerLink="/basic/branches" class="text-sm text-muted hover:text-ink px-3 py-2">取消</a>
        </div>
      </form>
    </div>
  `,
})
export class BranchFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(BasicDataApiService);
  private readonly upload = inject(BasicUploadService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly branchId = this.route.snapshot.paramMap.get('id');
  readonly isEdit = signal(!!this.branchId);
  readonly loading = signal(!!this.branchId);
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly error = signal<string | null>(null);
  readonly photoFilename = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    branchType: [0],
    isAutoRowNumber: [false],
    isEnabled: [true],
  });

  constructor() {
    if (this.branchId) this.loadEdit(this.branchId);
  }

  photoUrl(): string | null {
    return this.upload.photoUrl(this.photoFilename(), 'branchs');
  }

  private loadEdit(id: string): void {
    this.api.getBranch(id).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) {
          const b = res.data;
          this.form.patchValue({
            title: b.title,
            branchType: b.branchType,
            isAutoRowNumber: b.isAutoRowNumber,
            isEnabled: b.isEnabled,
          });
          this.photoFilename.set(b.photo || null);
        } else {
          this.error.set(res.message ?? '載入失敗');
        }
      },
      error: () => { this.loading.set(false); this.error.set('系統忙線，請稍後再試'); },
    });
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading.set(true);
    this.upload.upload(file, 'branchs').subscribe({
      next: (r) => { this.uploading.set(false); this.photoFilename.set(r.filename); },
      error: () => { this.uploading.set(false); this.error.set('圖片上傳失敗'); },
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const req: BranchUpsertRequest = {
      title: raw.title.trim(),
      branchType: raw.branchType,
      photo: this.photoFilename(),
      isAutoRowNumber: raw.isAutoRowNumber,
      isEnabled: raw.isEnabled,
    };

    this.saving.set(true);
    this.error.set(null);
    const call = this.branchId ? this.api.updateBranch(this.branchId, req) : this.api.createBranch(req);
    call.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) this.router.navigate(['/basic/branches']);
        else this.error.set(res.message ?? '儲存失敗');
      },
      error: () => { this.saving.set(false); this.error.set('儲存失敗'); },
    });
  }
}
