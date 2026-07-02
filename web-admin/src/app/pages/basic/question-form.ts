import { Component, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BasicDataApiService } from '../../core/services/basic-data-api.service';
import { QuestionAnswerInput, QuestionUpsertRequest } from '../../core/models';

/**
 * 後台基礎資料 — 新增/編輯問卷題目（對應舊 BasicMs/Add·EditQuestions）。
 * 選項用 FormArray 動態增刪：送出時整個陣列打包送後端比對 diff（現有但移除的 → 硬刪除，
 * 沿用舊系統行為，不查歷史作答引用，見 docs/blueprints/admin-basic-data.md）。
 */
@Component({
  selector: 'app-question-form',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="bg-white rounded shadow-sm border border-gray-200 max-w-2xl">
      <div class="px-5 py-3 border-b border-gray-100">
        <h1 class="text-base font-semibold text-gray-800">
          <i class="fa fa-question-circle text-gray-400 mr-2"></i>{{ isEdit() ? '編輯題目' : '新增題目' }}
        </h1>
      </div>

      @if (error()) {
        <div class="mx-5 mt-4 text-sm text-red-500">{{ error() }}</div>
      }

      <form [formGroup]="form" (ngSubmit)="submit()" class="p-5 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">題目 <span class="text-red-400">*</span></label>
          <input formControlName="title" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">題型 <span class="text-red-400">*</span></label>
          <div class="flex gap-4">
            <label class="flex items-center gap-1.5 text-sm text-gray-700">
              <input type="radio" formControlName="optionType" [value]="1" /> 單選
            </label>
            <label class="flex items-center gap-1.5 text-sm text-gray-700">
              <input type="radio" formControlName="optionType" [value]="2" /> 複選
            </label>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <input type="checkbox" id="isOther" formControlName="isOther" />
          <label for="isOther" class="text-sm text-gray-700">含「其他」自填欄</label>
        </div>
        @if (form.controls.isOther.value) {
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">「其他」欄位標題</label>
            <input formControlName="otherTitle" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
        }

        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="block text-sm font-medium text-gray-700">選項 <span class="text-red-400">*</span></label>
            <button type="button" (click)="addAnswer()" class="text-sm text-teal-600 hover:underline">
              <i class="fa fa-plus"></i> 新增選項
            </button>
          </div>
          <div class="space-y-2">
            @for (a of answers.controls; track $index) {
              <div [formGroup]="$any(a)" class="flex items-center gap-2">
                <input formControlName="title" placeholder="選項名稱" class="flex-1 border border-gray-300 rounded px-3 py-2 text-sm" />
                <input type="number" formControlName="sort" class="w-16 border border-gray-300 rounded px-2 py-2 text-sm" />
                <button type="button" (click)="removeAnswer($index)" class="text-red-500 hover:underline text-sm">
                  <i class="fa fa-trash"></i>
                </button>
              </div>
            }
            @if (answers.length === 0) {
              <p class="text-sm text-gray-400">尚未新增選項</p>
            }
          </div>
        </div>

        <div class="flex items-center gap-2 pt-2">
          <button type="submit" [disabled]="saving()"
                  class="bg-teal-600 text-white text-sm rounded px-4 py-2 hover:bg-teal-700 disabled:opacity-50">
            {{ saving() ? '儲存中…' : '儲存' }}
          </button>
          <a [routerLink]="['/basic/question-types', questionTypeId, 'questions']"
             class="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">取消</a>
        </div>
      </form>
    </div>
  `,
})
export class QuestionFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(BasicDataApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly questionTypeId = this.route.snapshot.paramMap.get('questionTypeId') ?? '';
  private readonly questionId = this.route.snapshot.paramMap.get('id');
  readonly isEdit = signal(!!this.questionId);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    optionType: [1, Validators.required],
    isOther: [false],
    otherTitle: [''],
    answers: this.fb.array<ReturnType<typeof this.newAnswerGroup>>([]),
  });

  get answers(): FormArray {
    return this.form.controls.answers;
  }

  private newAnswerGroup(questionAnswerId: string | null, title: string, sort: number) {
    return this.fb.nonNullable.group({
      questionAnswerId: [questionAnswerId as string | null],
      title: [title, Validators.required],
      sort: [sort],
    });
  }

  constructor() {
    if (this.questionId) this.loadEdit(this.questionId);
    else this.addAnswer();
  }

  addAnswer(): void {
    this.answers.push(this.newAnswerGroup(null, '', this.answers.length + 1));
  }

  removeAnswer(index: number): void {
    this.answers.removeAt(index);
  }

  private loadEdit(id: string): void {
    this.api.listQuestions(this.questionTypeId).subscribe({
      next: (res) => {
        const q = res.success ? res.data?.find((x) => x.questionId === id) : undefined;
        if (q) {
          this.form.patchValue({
            title: q.title,
            optionType: q.optionType,
            isOther: q.isOther,
            otherTitle: q.otherTitle ?? '',
          });
          this.answers.clear();
          for (const a of q.answers) {
            this.answers.push(this.newAnswerGroup(a.questionAnswerId, a.title, a.sort));
          }
        } else {
          this.error.set('找不到題目');
        }
      },
      error: () => this.error.set('系統忙線，請稍後再試'),
    });
  }

  submit(): void {
    if (this.form.invalid || this.answers.length === 0) {
      this.form.markAllAsTouched();
      if (this.answers.length === 0) this.error.set('至少需要一個選項');
      return;
    }
    const raw = this.form.getRawValue();
    const answers: QuestionAnswerInput[] = raw.answers.map((a) => ({
      questionAnswerId: a.questionAnswerId,
      title: a.title.trim(),
      sort: Number(a.sort),
    }));
    const req: QuestionUpsertRequest = {
      title: raw.title.trim(),
      optionType: Number(raw.optionType),
      isOther: raw.isOther,
      otherTitle: raw.isOther && raw.otherTitle ? raw.otherTitle.trim() : null,
      answers,
    };

    this.saving.set(true);
    this.error.set(null);
    const call = this.questionId
      ? this.api.updateQuestion(this.questionId, req)
      : this.api.createQuestion(this.questionTypeId, req);
    call.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) this.router.navigate(['/basic/question-types', this.questionTypeId, 'questions']);
        else this.error.set(res.message ?? '儲存失敗');
      },
      error: () => { this.saving.set(false); this.error.set('儲存失敗'); },
    });
  }
}
