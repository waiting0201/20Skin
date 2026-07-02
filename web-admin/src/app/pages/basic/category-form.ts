import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BasicDataApiService } from '../../core/services/basic-data-api.service';
import { BasicUploadService } from '../../core/services/basic-upload.service';
import { CategoryUpsertRequest } from '../../core/models';

/**
 * 後台基礎資料 — 新增/編輯科別項目（對應舊 BasicMs/Add·EditSkins、Cosmetics）。
 * clinic 由 query params 帶入，編輯時不可改。
 */
@Component({
  selector: 'app-category-form',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="bg-white rounded shadow-sm border border-gray-200 max-w-2xl">
      <div class="px-5 py-3 border-b border-gray-100">
        <h1 class="text-base font-semibold text-gray-800">
          <i class="fa fa-stethoscope text-gray-400 mr-2"></i>{{ isEdit() ? '編輯項目' : '新增項目' }}
        </h1>
      </div>

      @if (error()) {
        <div class="mx-5 mt-4 text-sm text-red-500">{{ error() }}</div>
      }

      <form [formGroup]="form" (ngSubmit)="submit()" class="p-5 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">名稱 <span class="text-red-400">*</span></label>
          <input formControlName="title" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">簡介</label>
          <textarea formControlName="intro" rows="3" class="w-full border border-gray-300 rounded px-3 py-2 text-sm"></textarea>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">圖片</label>
          @if (photoUrl(); as url) {
            <img [src]="url" class="w-24 h-24 object-cover rounded mb-2" />
          }
          <input type="file" accept="image/*" (change)="onFileSelected($event)" />
          @if (uploading()) { <span class="text-xs text-gray-400 ml-2">上傳中…</span> }
        </div>
        <div class="flex items-center gap-2">
          <input type="checkbox" id="isQuestion" formControlName="isQuestion" />
          <label for="isQuestion" class="text-sm text-gray-700">預約前需填問卷（IsQuestion）</label>
        </div>
        <div class="grid grid-cols-3 gap-4">
          <div class="flex items-center gap-2">
            <input type="checkbox" id="isOnly" formControlName="isOnly" />
            <label for="isOnly" class="text-sm text-gray-700">台中院限定</label>
          </div>
          <div class="flex items-center gap-2">
            <input type="checkbox" id="chIsOnly" formControlName="chIsOnly" />
            <label for="chIsOnly" class="text-sm text-gray-700">二林院限定</label>
          </div>
          <div class="flex items-center gap-2">
            <input type="checkbox" id="chDentistIsOnly" formControlName="chDentistIsOnly" />
            <label for="chDentistIsOnly" class="text-sm text-gray-700">二林齒科限定</label>
          </div>
        </div>

        <div class="flex items-center gap-2 pt-2">
          <button type="submit" [disabled]="saving()"
                  class="bg-teal-600 text-white text-sm rounded px-4 py-2 hover:bg-teal-700 disabled:opacity-50">
            {{ saving() ? '儲存中…' : '儲存' }}
          </button>
          <a [routerLink]="['/basic/categories']" [queryParams]="{ clinic }"
             class="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">取消</a>
        </div>
      </form>
    </div>
  `,
})
export class CategoryFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(BasicDataApiService);
  private readonly upload = inject(BasicUploadService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly categoryId = this.route.snapshot.paramMap.get('id');
  readonly clinic = this.route.snapshot.queryParamMap.get('clinic') ?? 'Skin';
  readonly isEdit = signal(!!this.categoryId);
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly error = signal<string | null>(null);
  readonly photoFilename = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    intro: [''],
    isQuestion: [false],
    isOnly: [false],
    chIsOnly: [false],
    chDentistIsOnly: [false],
  });

  constructor() {
    if (this.categoryId) this.loadEdit(this.categoryId);
  }

  photoUrl(): string | null {
    return this.upload.photoUrl(this.photoFilename(), 'categorys');
  }

  private loadEdit(id: string): void {
    this.api.listCategories(this.clinic).subscribe({
      next: (res) => {
        const c = res.success ? res.data?.find((x) => x.categoryId === id) : undefined;
        if (c) {
          this.form.patchValue({
            title: c.title,
            intro: c.intro ?? '',
            isQuestion: c.isQuestion,
            isOnly: c.isOnly,
            chIsOnly: c.chIsOnly,
            chDentistIsOnly: c.chDentistIsOnly,
          });
          this.photoFilename.set(c.photo || null);
        } else {
          this.error.set('找不到項目');
        }
      },
      error: () => this.error.set('系統忙線，請稍後再試'),
    });
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading.set(true);
    this.upload.upload(file, 'categorys').subscribe({
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
    const req: CategoryUpsertRequest = {
      title: raw.title.trim(),
      intro: raw.intro.trim() || null,
      photo: this.photoFilename(),
      isQuestion: raw.isQuestion,
      isOnly: raw.isOnly,
      chIsOnly: raw.chIsOnly,
      chDentistIsOnly: raw.chDentistIsOnly,
    };

    this.saving.set(true);
    this.error.set(null);
    const call = this.categoryId
      ? this.api.updateCategory(this.clinic, this.categoryId, req)
      : this.api.createCategory(this.clinic, req);
    call.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) this.router.navigate(['/basic/categories'], { queryParams: { clinic: this.clinic } });
        else this.error.set(res.message ?? '儲存失敗');
      },
      error: () => { this.saving.set(false); this.error.set('儲存失敗'); },
    });
  }
}
