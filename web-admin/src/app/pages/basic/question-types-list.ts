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
    <div class="bg-white rounded shadow-sm border border-gray-200">
      <div class="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <h1 class="text-base font-semibold text-gray-800"><i class="fa fa-list-alt text-gray-400 mr-2"></i>問卷類型</h1>
        @if (auth.can('QuestionTypes', 'add')) {
          <a routerLink="/basic/question-types/new"
             class="inline-flex items-center gap-1.5 bg-teal-600 text-white text-sm rounded px-3 py-1.5 hover:bg-teal-700">
            <i class="fa fa-plus"></i> 新增問卷
          </a>
        }
      </div>

      @if (error()) {
        <div class="m-5 text-sm text-red-500">{{ error() }}</div>
      }

      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
            <th class="px-5 py-2.5 font-medium">科別項目</th>
            <th class="px-5 py-2.5 font-medium">問卷名稱</th>
            <th class="px-5 py-2.5 font-medium">狀態</th>
            <th class="px-5 py-2.5 font-medium w-24">排序</th>
            <th class="px-5 py-2.5 font-medium text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          @for (qt of questionTypes(); track qt.questionTypeId) {
            <tr class="border-b border-gray-50 hover:bg-gray-50">
              <td class="px-5 py-2.5 text-gray-600">{{ qt.categoryTitle }}</td>
              <td class="px-5 py-2.5 text-gray-800">
                @if (auth.can('QuestionTypes', 'read')) {
                  <a [routerLink]="['/basic/question-types', qt.questionTypeId, 'questions']" class="text-blue-600 hover:underline">{{ qt.title }}</a>
                } @else {
                  {{ qt.title }}
                }
              </td>
              <td class="px-5 py-2.5">
                @if (qt.isEnabled) { <span class="text-green-600">啟用</span> } @else { <span class="text-gray-400">停用</span> }
              </td>
              <td class="px-5 py-2.5">
                <input type="number" [value]="sorts()[qt.questionTypeId]"
                       (change)="setSort(qt.questionTypeId, $any($event.target).value)"
                       class="w-16 border border-gray-300 rounded px-2 py-1 text-sm" />
              </td>
              <td class="px-5 py-2.5 text-right space-x-2">
                @if (auth.can('QuestionTypes', 'update')) {
                  <a [routerLink]="['/basic/question-types', qt.questionTypeId, 'edit']"
                     class="text-blue-600 hover:underline"><i class="fa fa-pencil"></i> 編輯</a>
                }
                @if (auth.can('QuestionTypes', 'delete') && qt.isEnabled) {
                  <button (click)="remove(qt)" class="text-red-500 hover:underline"><i class="fa fa-trash"></i> 停用</button>
                }
              </td>
            </tr>
          } @empty {
            <tr><td colspan="5" class="px-5 py-6 text-center text-gray-400">{{ loading() ? '載入中…' : '尚無問卷' }}</td></tr>
          }
        </tbody>
      </table>

      @if (questionTypes().length > 0 && auth.can('QuestionTypes', 'update')) {
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
