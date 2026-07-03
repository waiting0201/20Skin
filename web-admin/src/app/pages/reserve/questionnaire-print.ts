import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ReserveApiService, reserveLabel } from '../../core/services/reserve-api.service';
import { QuestionnaireExportItem } from '../../core/models';

/**
 * 後台預約管理 — 問卷可列印頁面（取代舊 iTextSharp PDF 匯出，見 docs/blueprints/admin-reserve.md「匯出策略」）。
 * 刻意選擇瀏覽器原生列印（`window.print()`）而非 pdfmake/html2pdf，避免新增 npm 依賴與 CJK 字型問題；
 * 列印時由全域 `styles.css` 的 `@media print` 規則隱藏 AdminLayoutComponent 的側欄/頂欄/Ribbon/頁尾，只印本頁內容。
 * 不自動彈出列印對話框，改由使用者主動按「列印」按鈕觸發，避免開新分頁後突然彈窗造成困惑。
 */
@Component({
  selector: 'app-questionnaire-print',
  template: `
    <div class="max-w-3xl mx-auto">
      <div class="flex items-center justify-between mb-4 print:hidden">
        <h1 class="text-base font-semibold text-ink">{{ title() }}</h1>
        <button (click)="print()" class="bg-brand text-white text-sm rounded px-4 py-2 hover:bg-brand-deep">
          <i class="fa fa-print mr-1"></i>列印
        </button>
      </div>

      @if (error()) { <div class="text-sm text-red-500 mb-4">{{ error() }}</div> }
      @if (loading()) { <div class="text-sm text-muted">載入中…</div> }

      @for (item of items(); track item.appointmentId) {
        <div class="border border-hairline rounded p-4 mb-6 break-inside-avoid">
          <h2 class="text-sm font-semibold text-ink mb-1">{{ item.memberName }} — {{ item.categoryTitle }}（{{ item.periodTitle }}）</h2>
          <h3 class="text-xs text-muted mb-3">{{ item.questionTypeTitle }}</h3>
          <div class="overflow-x-auto">
          <table class="w-full text-sm border border-hairline">
            <tbody>
              @for (q of item.questionnaire.questions; track q.questionId) {
                <tr class="bg-surface">
                  <td colspan="2" class="px-3 py-1.5 font-medium text-ink border-b border-hairline">{{ q.title }}</td>
                </tr>
                @for (a of q.answers; track a.questionAnswerId) {
                  <tr class="border-b border-hairline">
                    <td class="px-3 py-1.5 text-center w-10">
                      @if (q.selectedAnswerIds.includes(a.questionAnswerId)) { <i class="fa fa-check text-brand"></i> }
                    </td>
                    <td class="px-3 py-1.5 text-ink">{{ a.title }}</td>
                  </tr>
                }
                @if (q.isOther) {
                  <tr class="border-b border-hairline">
                    <td colspan="2" class="px-3 py-1.5 text-ink">{{ q.otherTitle }}：{{ q.otherText }}</td>
                  </tr>
                }
              }
            </tbody>
          </table>
          </div>
        </div>
      } @empty {
        @if (!loading() && !error()) {
          <p class="text-sm text-muted">查無資料</p>
        }
      }
    </div>
  `,
})
export class QuestionnairePrintComponent {
  private readonly api = inject(ReserveApiService);
  private readonly route = inject(ActivatedRoute);

  private readonly branch = this.route.snapshot.queryParamMap.get('branch') ?? 'ta';
  private readonly clinic = this.route.snapshot.queryParamMap.get('clinic');
  private readonly appointmentDate = this.route.snapshot.queryParamMap.get('appointmentDate') ?? '';

  readonly title = signal(`${reserveLabel(this.branch)}問卷列印（${this.appointmentDate}）`);
  readonly items = signal<QuestionnaireExportItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    this.api.exportQuestionnaire(this.branch, this.clinic, this.appointmentDate).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) this.items.set(res.data.items);
        else this.error.set(res.message ?? '載入失敗');
      },
      error: () => {
        this.loading.set(false);
        this.error.set('系統忙線，請稍後再試');
      },
    });
  }

  print(): void {
    window.print();
  }
}
