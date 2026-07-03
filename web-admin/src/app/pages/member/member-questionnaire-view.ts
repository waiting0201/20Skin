import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MemberApiService } from '../../core/services/member-api.service';
import { QuestionForm } from '../../core/models';

/**
 * 後台會員管理 — 唯讀檢視數位作答問卷（對應舊 MemberMs/ViewMemberQAs.cshtml）。
 * 重用客戶前台問卷表單資料（含 pre-fill 已勾選狀態），純唯讀渲染，無編輯能力。
 */
@Component({
  selector: 'app-member-questionnaire-view',
  imports: [RouterLink],
  template: `
    <div class="bg-white rounded shadow-sm border border-hairline max-w-3xl">
      <div class="px-5 py-3 border-b border-hairline">
        <h1 class="text-base font-semibold text-ink"><i class="fa fa-search text-muted mr-2"></i>瀏覽問卷</h1>
      </div>

      @if (error()) {
        <div class="m-5 text-sm text-red-500">{{ error() }}</div>
      }

      @if (form(); as f) {
        <div class="p-5">
          <h2 class="text-sm font-semibold text-ink mb-3">{{ f.title }}</h2>
          <div class="overflow-x-auto">
          <table class="w-full text-sm border border-hairline">
            <tbody>
              @for (q of f.questions; track q.questionId) {
                <tr class="bg-surface">
                  <td colspan="2" class="px-4 py-2 font-medium text-ink border-b border-hairline">{{ q.title }}</td>
                </tr>
                @for (a of q.answers; track a.questionAnswerId) {
                  <tr class="border-b border-hairline">
                    <td class="px-4 py-2 text-center w-12">
                      @if (q.selectedAnswerIds.includes(a.questionAnswerId)) { <i class="fa fa-check text-brand"></i> }
                    </td>
                    <td class="px-4 py-2 text-ink">{{ a.title }}</td>
                  </tr>
                }
                @if (q.isOther) {
                  <tr class="border-b border-hairline">
                    <td colspan="2" class="px-4 py-2 text-ink">{{ q.otherTitle }}：{{ q.otherText }}</td>
                  </tr>
                }
              }
            </tbody>
          </table>
          </div>

          <div class="pt-4">
            <a [routerLink]="['/member', memberId, 'questionnaires']" class="text-sm text-muted hover:text-ink px-3 py-2">返回</a>
          </div>
        </div>
      }
    </div>
  `,
})
export class MemberQuestionnaireViewComponent {
  private readonly api = inject(MemberApiService);
  private readonly route = inject(ActivatedRoute);

  readonly memberId = this.route.snapshot.paramMap.get('id')!;
  private readonly questionTypeId = this.route.snapshot.paramMap.get('questionTypeId')!;

  readonly form = signal<QuestionForm | null>(null);
  readonly error = signal<string | null>(null);

  constructor() {
    this.api.viewQuestionnaire(this.memberId, this.questionTypeId).subscribe({
      next: (res) => {
        if (res.success && res.data) this.form.set(res.data);
        else this.error.set(res.message ?? '找不到問卷');
      },
      error: () => this.error.set('系統忙線，請稍後再試'),
    });
  }
}
