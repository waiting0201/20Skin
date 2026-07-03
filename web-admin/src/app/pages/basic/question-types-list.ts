import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BasicDataApiService } from '../../core/services/basic-data-api.service';
import { AuthService } from '../../core/services/auth.service';
import { QuestionTypeAdmin } from '../../core/models';

/**
 * 後台基礎資料 — 問卷類型列表（對應舊 BasicMs/QuestionTypes）。
 * 真實 Lims 無獨立 Questions key，本頁與題目管理皆用 auth.can('QuestionTypes', op) 判斷。
 * 列表顯示全部（含已軟刪 IsEnabled=false），排序沿用舊做法（見 docs/blueprints/admin-basic-data.md）。
 */
@Component({
  selector: 'app-question-types-list',
  imports: [RouterLink],
  template: `
    <div class="bg-white rounded shadow-sm border border-hairline">
      <div class="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-hairline">
        <h1 class="text-base font-semibold text-ink"><i class="fa fa-list-alt text-muted mr-2"></i>問卷類型</h1>
        @if (auth.can('QuestionTypes', 'add')) {
          <a routerLink="/basic/question-types/new"
             class="inline-flex items-center gap-1.5 bg-brand text-white text-sm rounded px-3 py-1.5 hover:bg-brand-deep">
            <i class="fa fa-plus"></i> 新增問卷
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
            <th class="px-5 py-2.5 font-medium w-40">科別項目</th>
            <th class="px-5 py-2.5 font-medium w-auto">問卷名稱</th>
            <th class="px-5 py-2.5 font-medium text-center w-24">狀態</th>
            <th class="px-5 py-2.5 font-medium text-center w-20">操作</th>
          </tr>
        </thead>
        <tbody>
          @for (qt of questionTypes(); track qt.questionTypeId) {
            <tr class="border-b border-hairline hover:bg-surface">
              <td class="px-5 py-2.5 text-center">
                <input type="number" [value]="sorts()[qt.questionTypeId]"
                       (change)="setSort(qt.questionTypeId, $any($event.target).value)"
                       class="w-16 border border-hairline rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
              </td>
              <td class="px-5 py-2.5 text-muted">{{ qt.categoryTitle }}</td>
              <td class="px-5 py-2.5 text-ink">
                @if (auth.can('QuestionTypes', 'read')) {
                  <a [routerLink]="['/basic/question-types', qt.questionTypeId, 'questions']" class="text-brand hover:underline">{{ qt.title }}</a>
                } @else {
                  {{ qt.title }}
                }
              </td>
              <td class="px-5 py-2.5 text-center">
                @if (qt.isEnabled) { <span class="text-green-600">開啟</span> } @else { <span class="text-muted">關閉</span> }
              </td>
              <td class="px-5 py-2.5 text-center">
                <span class="inline-flex items-center gap-3">
                  @if (auth.can('QuestionTypes', 'update')) {
                    <a [routerLink]="['/basic/question-types', qt.questionTypeId, 'edit']"
                       class="text-brand hover:text-brand-deep" title="編輯"><i class="fa fa-pencil"></i></a>
                  }
                  @if (auth.can('QuestionTypes', 'delete') && qt.isEnabled) {
                    <button (click)="remove(qt)" class="text-red-500 hover:text-red-700" title="停用"><i class="fa fa-trash"></i></button>
                  }
                </span>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="5" class="px-5 py-6 text-center text-muted">{{ loading() ? '載入中…' : '尚無問卷' }}</td></tr>
          }
        </tbody>
      </table>
      </div>

      @if (questionTypes().length > 0 && auth.can('QuestionTypes', 'update')) {
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
export class QuestionTypesListComponent {
  private readonly api = inject(BasicDataApiService);
  readonly auth = inject(AuthService);

  readonly questionTypes = signal<QuestionTypeAdmin[]>([]);
  readonly sorts = signal<Record<string, number>>({});
  readonly loading = signal(true);
  readonly savingSort = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.listQuestionTypes().subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) {
          this.questionTypes.set(res.data);
          this.sorts.set(Object.fromEntries(res.data.map((qt) => [qt.questionTypeId, qt.sort])));
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

  setSort(questionTypeId: string, value: string): void {
    this.sorts.set({ ...this.sorts(), [questionTypeId]: Number(value) });
  }

  saveSort(): void {
    const items = Object.entries(this.sorts()).map(([id, sort]) => ({ id, sort }));
    this.savingSort.set(true);
    this.api.sortQuestionTypes(items).subscribe({
      next: (res) => {
        this.savingSort.set(false);
        if (res.success) this.load();
        else this.error.set(res.message ?? '排序失敗');
      },
      error: () => { this.savingSort.set(false); this.error.set('排序失敗'); },
    });
  }

  remove(qt: QuestionTypeAdmin): void {
    if (!confirm(`確定停用問卷「${qt.title}」？（軟刪除，不會刪除既有作答資料）`)) return;
    this.api.deleteQuestionType(qt.questionTypeId).subscribe({
      next: (res) => {
        if (res.success) this.load();
        else this.error.set(res.message ?? '停用失敗');
      },
      error: () => this.error.set('停用失敗'),
    });
  }
}
