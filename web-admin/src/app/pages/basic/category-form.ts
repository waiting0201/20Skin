import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BasicDataApiService, categoryLabel } from '../../core/services/basic-data-api.service';
import { BasicUploadService } from '../../core/services/basic-upload.service';
import { CategoryUpsertRequest } from '../../core/models';

/**
 * 後台基礎資料 — 新增/編輯科別項目（對應舊 BasicMs/Add·EditSkins、Cosmetics）。
 * clinic 由 query params 帶入，編輯時不可改。
 * 表單欄位/用詞/顯示邏輯完全比照舊 View：
 * - 「需填問卷」（IsQuestion）**只在編輯頁顯示**，新增表單沒有此欄位（舊 AddSkins/AddCosmetics 的
 *   TryUpdateModel 白名單本來就不含 IsQuestion，新建項目一律 IsQuestion=false，只能之後在編輯頁開啟，
 *   且後端會檢查該項目是否已有 QuestionTypes，沒有則擋下「尚未編輯問卷」）。
 * - 「代表圖」新增時必填、編輯時選填（已有既有圖）。
 * - 「簡介」為必填單行文字（舊系統是 `TextBoxFor`，不是多行 textarea）。
 */
@Component({
  selector: 'app-category-form',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="bg-white rounded shadow-sm border border-hairline max-w-2xl">
      <div class="px-5 py-3 border-b border-hairline">
        <h1 class="text-base font-semibold text-ink">
          <i class="fa fa-stethoscope text-muted mr-2"></i>{{ isEdit() ? '編輯' : '新增' }}{{ pageLabel }}
        </h1>
      </div>

      @if (error()) {
        <div class="mx-5 mt-4 text-sm text-red-500">{{ error() }}</div>
      }

      <form [formGroup]="form" (ngSubmit)="submit()" class="p-5 space-y-4">
        <div>
          <label class="block text-sm font-medium text-ink mb-1">代表圖 <span class="text-red-400">*</span></label>
          @if (photoUrl(); as url) {
            <img [src]="url" class="w-24 h-24 object-cover rounded mb-2" />
          }
          <input type="file" accept="image/*" (change)="onFileSelected($event)" />
          @if (uploading()) { <span class="text-xs text-muted ml-2">上傳中…</span> }
          <p class="text-xs text-muted mt-1">建議尺寸 : 411 x 298</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-ink mb-1">標題 <span class="text-red-400">*</span></label>
          <input formControlName="title"
                 class="w-full border border-hairline rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
        </div>
        <div>
          <label class="block text-sm font-medium text-ink mb-1">簡介 <span class="text-red-400">*</span></label>
          <input formControlName="intro"
                 class="w-full border border-hairline rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
        </div>
        @if (isEdit()) {
          <div class="flex items-center gap-2">
            <input type="checkbox" id="isQuestion" formControlName="isQuestion" />
            <label for="isQuestion" class="text-sm text-ink">需填問卷</label>
          </div>
        }
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="flex items-center gap-2">
            <input type="checkbox" id="isOnly" formControlName="isOnly" />
            <label for="isOnly" class="text-sm text-ink">台中每次一人</label>
          </div>
          <div class="flex items-center gap-2">
            <input type="checkbox" id="chIsOnly" formControlName="chIsOnly" />
            <label for="chIsOnly" class="text-sm text-ink">二林每次一人</label>
          </div>
          <div class="flex items-center gap-2">
            <input type="checkbox" id="chDentistIsOnly" formControlName="chDentistIsOnly" />
            <label for="chDentistIsOnly" class="text-sm text-ink">齒科每次一人</label>
          </div>
        </div>

        <div class="flex items-center gap-2 pt-2">
          <button type="submit" [disabled]="saving()"
                  class="bg-brand text-white text-sm rounded px-4 py-2 hover:bg-brand-deep disabled:opacity-50">
            {{ saving() ? '儲存中…' : '儲存' }}
          </button>
          <a [routerLink]="['/basic/categories']" [queryParams]="{ clinic }"
             class="text-sm text-muted hover:text-ink px-3 py-2">取消</a>
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
  readonly pageLabel = categoryLabel(this.clinic);
  readonly isEdit = signal(!!this.categoryId);
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly error = signal<string | null>(null);
  readonly photoFilename = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    intro: ['', Validators.required],
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
    this.api.listAllCategories(this.clinic).subscribe({
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
    // 新增時代表圖必填（舊 AddSkins/AddCosmetics 的 data-bv-notempty）；編輯時已有既有圖，可不換。
    if (!this.isEdit() && !this.photoFilename()) {
      this.error.set('請選擇圖');
      return;
    }
    const raw = this.form.getRawValue();
    const req: CategoryUpsertRequest = {
      title: raw.title.trim(),
      intro: raw.intro.trim(),
      photo: this.photoFilename(),
      // 新增時 IsQuestion 一律 false（舊 AddSkins/AddCosmetics 沒有此欄位，後端也會強制忽略）。
      isQuestion: this.isEdit() ? raw.isQuestion : false,
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
