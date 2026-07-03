import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { BasicDataApiService } from '../../core/services/basic-data-api.service';
import { CategoryAdmin, QuestionTypeUpsertRequest } from '../../core/models';

/**
 * 後台基礎資料 — 新增/編輯問卷類型（對應舊 BasicMs/Add·EditQuestionTypes）。
 * 科別項目下拉合併 Skin + Cosmetic 兩份清單（問卷類型可掛在任一診別的項目下）。
 */
@Component({
  selector: 'app-question-type-form',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="bg-white rounded shadow-sm border border-hairline max-w-lg">
      <div class="px-5 py-3 border-b border-hairline">
        <h1 class="text-base font-semibold text-ink">
          <i class="fa fa-list-alt text-muted mr-2"></i>{{ isEdit() ? '編輯問卷類型' : '新增問卷類型' }}
        </h1>
      </div>

      @if (error()) {
        <div class="mx-5 mt-4 text-sm text-red-500">{{ error() }}</div>
      }

      <form [formGroup]="form" (ngSubmit)="submit()" class="p-5 space-y-4">
        <div>
          <label class="block text-sm font-medium text-ink mb-1">科別項目 <span class="text-red-400">*</span></label>
          <select formControlName="categoryId"
                  class="w-full border border-hairline rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand">
            <option value="" disabled>請選擇</option>
            @for (c of categories(); track c.categoryId) {
              <option [value]="c.categoryId">{{ c.title }}（{{ c.clinic === 'Skin' ? '健保' : '美容' }}）</option>
            }
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-ink mb-1">問卷名稱 <span class="text-red-400">*</span></label>
          <input formControlName="title"
                 class="w-full border border-hairline rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
        </div>

        <div class="flex items-center gap-2 pt-2">
          <button type="submit" [disabled]="saving()"
                  class="bg-brand text-white text-sm rounded px-4 py-2 hover:bg-brand-deep disabled:opacity-50">
            {{ saving() ? '儲存中…' : '儲存' }}
          </button>
          <a routerLink="/basic/question-types" class="text-sm text-muted hover:text-ink px-3 py-2">取消</a>
        </div>
      </form>
    </div>
  `,
})
export class QuestionTypeFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(BasicDataApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly questionTypeId = this.route.snapshot.paramMap.get('id');
  readonly isEdit = signal(!!this.questionTypeId);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly categories = signal<CategoryAdmin[]>([]);

  readonly form = this.fb.nonNullable.group({
    categoryId: ['', Validators.required],
    title: ['', Validators.required],
  });

  constructor() {
    forkJoin([this.api.listAllCategories('Skin'), this.api.listAllCategories('Cosmetic')]).subscribe({
      next: ([skin, cosmetic]) => {
        this.categories.set([...(skin.data ?? []), ...(cosmetic.data ?? [])]);
      },
    });
    if (this.questionTypeId) this.loadEdit(this.questionTypeId);
  }

  private loadEdit(id: string): void {
    this.api.listQuestionTypes().subscribe({
      next: (res) => {
        const qt = res.success ? res.data?.find((x) => x.questionTypeId === id) : undefined;
        if (qt) this.form.patchValue({ categoryId: qt.categoryId, title: qt.title });
        else this.error.set('找不到問卷');
      },
      error: () => this.error.set('系統忙線，請稍後再試'),
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const req: QuestionTypeUpsertRequest = { categoryId: raw.categoryId, title: raw.title.trim() };

    this.saving.set(true);
    this.error.set(null);
    const call = this.questionTypeId
      ? this.api.updateQuestionType(this.questionTypeId, req)
      : this.api.createQuestionType(req);
    call.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) this.router.navigate(['/basic/question-types']);
        else this.error.set(res.message ?? '儲存失敗');
      },
      error: () => { this.saving.set(false); this.error.set('儲存失敗'); },
    });
  }
}
