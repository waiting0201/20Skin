import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BasicDataApiService } from '../../core/services/basic-data-api.service';
import { AuthService } from '../../core/services/auth.service';
import { QuestionAdmin } from '../../core/models';

/**
 * 後台基礎資料 — 問卷題目列表（對應舊 BasicMs/Questions?questiontypeid=）。
 * 顯示該問卷類型下所有題目（含已軟刪）與選項摘要，排序沿用舊做法。
 */
@Component({
  selector: 'app-questions-list',
  imports: [RouterLink],
  template: `
    <div class="bg-white rounded shadow-sm border border-gray-200">
      <div class="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <h1 class="text-base font-semibold text-gray-800"><i class="fa fa-question-circle text-gray-400 mr-2"></i>問卷題目</h1>
        @if (auth.can('QuestionTypes', 'add')) {
          <a [routerLink]="['/basic/question-types', questionTypeId, 'questions', 'new']"
             class="inline-flex items-center gap-1.5 bg-teal-600 text-white text-sm rounded px-3 py-1.5 hover:bg-teal-700">
            <i class="fa fa-plus"></i> 新增題目
          </a>
        }
      </div>

      @if (error()) {
        <div class="m-5 text-sm text-red-500">{{ error() }}</div>
      }

      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
            <th class="px-5 py-2.5 font-medium">題目</th>
            <th class="px-5 py-2.5 font-medium">題型</th>
            <th class="px-5 py-2.5 font-medium">選項</th>
            <th class="px-5 py-2.5 font-medium">狀態</th>
            <th class="px-5 py-2.5 font-medium w-24">排序</th>
            <th class="px-5 py-2.5 font-medium text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          @for (q of questions(); track q.questionId) {
            <tr class="border-b border-gray-50 hover:bg-gray-50">
              <td class="px-5 py-2.5 text-gray-800">{{ q.title }}</td>
              <td class="px-5 py-2.5 text-gray-600">{{ q.optionType === 1 ? '單選' : '複選' }}{{ q.isOther ? '＋其他' : '' }}</td>
              <td class="px-5 py-2.5 text-gray-600">{{ q.answers.map(a => a.title).join('、') }}</td>
              <td class="px-5 py-2.5">
                @if (q.isEnabled) { <span class="text-green-600">啟用</span> } @else { <span class="text-gray-400">停用</span> }
              </td>
              <td class="px-5 py-2.5">
                <input type="number" [value]="sorts()[q.questionId]"
                       (change)="setSort(q.questionId, $any($event.target).value)"
                       class="w-16 border border-gray-300 rounded px-2 py-1 text-sm" />
              </td>
              <td class="px-5 py-2.5 text-right space-x-2">
                @if (auth.can('QuestionTypes', 'update')) {
                  <a [routerLink]="['/basic/question-types', questionTypeId, 'questions', q.questionId, 'edit']"
                     class="text-blue-600 hover:underline"><i class="fa fa-pencil"></i> 編輯</a>
                }
                @if (auth.can('QuestionTypes', 'delete') && q.isEnabled) {
                  <button (click)="remove(q)" class="text-red-500 hover:underline"><i class="fa fa-trash"></i> 停用</button>
                }
              </td>
            </tr>
          } @empty {
            <tr><td colspan="6" class="px-5 py-6 text-center text-gray-400">{{ loading() ? '載入中…' : '尚無題目' }}</td></tr>
          }
        </tbody>
      </table>

      @if (questions().length > 0 && auth.can('QuestionTypes', 'update')) {
        <div class="px-5 py-3 border-t border-gray-100">
          <button (click)="saveSort()" [disabled]="savingSort()"
                  class="bg-gray-700 text-white text-sm rounded px-4 py-2 hover:bg-gray-800 disabled:opacity-50">
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
