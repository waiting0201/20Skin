import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BasicDataApiService } from '../../core/services/basic-data-api.service';
import { AuthService } from '../../core/services/auth.service';
import { QuestionAdmin } from '../../core/models';

/**
 * 後台基礎資料 — 問卷題目列表（對應舊 BasicMs/Questions?questiontypeid=）。
 * 顯示該問卷類型下所有題目（含已軟刪），排序沿用舊做法。
 */
@Component({
  selector: 'app-questions-list',
  imports: [RouterLink],
  template: `
    <div class="bg-white rounded shadow-sm border border-hairline">
      <div class="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-hairline">
        <h1 class="text-base font-semibold text-ink"><i class="fa fa-question-circle text-muted mr-2"></i>問卷題目</h1>
        @if (auth.can('QuestionTypes', 'add')) {
          <a [routerLink]="['/basic/question-types', questionTypeId, 'questions', 'new']"
             class="inline-flex items-center gap-1.5 bg-brand text-white text-sm rounded px-3 py-1.5 hover:bg-brand-deep">
            <i class="fa fa-plus"></i> 新增題目
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
            <th class="px-5 py-2.5 font-medium text-center w-20">排序</th>
            <th class="px-5 py-2.5 font-medium w-auto">題目</th>
            <th class="px-5 py-2.5 font-medium text-center w-24">題型</th>
            <th class="px-5 py-2.5 font-medium text-center w-24">狀態</th>
            <th class="px-5 py-2.5 font-medium text-center w-20">操作</th>
          </tr>
        </thead>
        <tbody>
          @for (q of questions(); track q.questionId) {
            <tr class="border-b border-hairline hover:bg-surface">
              <td class="px-5 py-2.5 text-center">
                <input type="number" [value]="sorts()[q.questionId]"
                       (change)="setSort(q.questionId, $any($event.target).value)"
                       class="w-16 border border-hairline rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
              </td>
              <td class="px-5 py-2.5 text-ink">{{ q.title }}</td>
              <td class="px-5 py-2.5 text-center text-muted">{{ q.optionType === 1 ? '單選' : '複選' }}{{ q.isOther ? '＋其他' : '' }}</td>
              <td class="px-5 py-2.5 text-center">
                @if (q.isEnabled) { <span class="text-green-600">開啟</span> } @else { <span class="text-muted">關閉</span> }
              </td>
              <td class="px-5 py-2.5 text-center">
                <span class="inline-flex items-center gap-3">
                  @if (auth.can('QuestionTypes', 'update')) {
                    <a [routerLink]="['/basic/question-types', questionTypeId, 'questions', q.questionId, 'edit']"
                       class="text-brand hover:text-brand-deep" title="編輯"><i class="fa fa-pencil"></i></a>
                  }
                  @if (auth.can('QuestionTypes', 'delete') && q.isEnabled) {
                    <button (click)="remove(q)" class="text-red-500 hover:text-red-700" title="停用"><i class="fa fa-trash"></i></button>
                  }
                </span>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="5" class="px-5 py-6 text-center text-muted">{{ loading() ? '載入中…' : '尚無題目' }}</td></tr>
          }
        </tbody>
      </table>
      </div>

      @if (questions().length > 0 && auth.can('QuestionTypes', 'update')) {
        <div class="px-5 py-3 border-t border-hairline">
          <button (click)="saveSort()" [disabled]="savingSort()"
                  class="bg-ink text-white text-sm rounded px-4 py-2 hover:bg-black disabled:opacity-50">
            {{ savingSort() ? '儲存中…' : '儲存排序' }}
          </button>
        </div>
      }
    </div>
  `,
})
export class QuestionsListComponent {
  private readonly api = inject(BasicDataApiService);
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);

  readonly questionTypeId = this.route.snapshot.paramMap.get('questionTypeId') ?? '';
  readonly questions = signal<QuestionAdmin[]>([]);
  readonly sorts = signal<Record<string, number>>({});
  readonly loading = signal(true);
  readonly savingSort = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.listQuestions(this.questionTypeId).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) {
          this.questions.set(res.data);
          this.sorts.set(Object.fromEntries(res.data.map((q) => [q.questionId, q.sort])));
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

  setSort(questionId: string, value: string): void {
    this.sorts.set({ ...this.sorts(), [questionId]: Number(value) });
  }

  saveSort(): void {
    const items = Object.entries(this.sorts()).map(([id, sort]) => ({ id, sort }));
    this.savingSort.set(true);
    this.api.sortQuestions(this.questionTypeId, items).subscribe({
      next: (res) => {
        this.savingSort.set(false);
        if (res.success) this.load();
        else this.error.set(res.message ?? '排序失敗');
      },
      error: () => { this.savingSort.set(false); this.error.set('排序失敗'); },
    });
  }

  remove(q: QuestionAdmin): void {
    if (!confirm(`確定停用題目「${q.title}」？（軟刪除，不會刪除既有作答資料）`)) return;
    this.api.deleteQuestion(q.questionId).subscribe({
      next: (res) => {
        if (res.success) this.load();
        else this.error.set(res.message ?? '停用失敗');
      },
      error: () => this.error.set('停用失敗'),
    });
  }
}
