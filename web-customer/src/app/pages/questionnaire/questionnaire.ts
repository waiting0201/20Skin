import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { QuestionnaireService } from '../../core/services/questionnaire.service';
import { ReservationStore } from '../../store/reservation.store';
import { QuestionForm } from '../../core/models';

interface AnswerState {
  answerIds: string[];
  other: string;
}

/**
 * 問卷填答。對應舊 Questions.cshtml。動態題型：OptionType 1=單選(radio) / 2=複選(checkbox)，
 * IsOther 額外顯示「其他」自填欄。既有作答會 pre-fill；送出後回問卷清單（預約流程續填/回預約）。
 */
@Component({
  selector: 'app-questionnaire',
  imports: [FormsModule],
  template: `
    <main id="main">
      <div class="block-online">
        <div class="block-item">
          <div class="block-title">{{ form()?.title || '術前問卷' }}</div>
          <div class="block-stitle">
            <div class="btn"><a href="javascript:;" (click)="back()">回上一頁</a></div>
            <div class="stitle-choose">．填寫狀態：{{ form()?.answered ? '已填寫' : '未填寫' }}</div>
          </div>

          @if (notice()) { <p style="color:red; text-align:center;">{{ notice() }}</p> }
          @if (loading()) { <p style="text-align:center;">載入中…</p> }

          @if (form(); as f) {
            <form (ngSubmit)="submit()">
              <div class="block-con white-bg">
                @for (q of f.questions; track q.questionId) {
                  <div class="form-block">
                    <span class="form-red">*</span>{{ q.title }}
                    <div class="form-box">
                      @for (a of q.answers; track a.questionAnswerId) {
                        <div class="input-left">
                          <label>
                            @if (q.optionType === 2) {
                              <input type="checkbox"
                                     [checked]="isChecked(q.questionId, a.questionAnswerId)"
                                     (change)="toggle(q.questionId, a.questionAnswerId)" />
                            } @else {
                              <input type="radio" [name]="q.questionId"
                                     [checked]="isChecked(q.questionId, a.questionAnswerId)"
                                     (change)="setRadio(q.questionId, a.questionAnswerId)" />
                            }
                            {{ a.title }}
                          </label>
                        </div>
                      }
                      @if (q.isOther) {
                        <div style="clear:both;">
                          {{ q.otherTitle || '其他' }}：
                          <input type="text" [ngModel]="otherText(q.questionId)"
                                 [ngModelOptions]="{ standalone: true }"
                                 (ngModelChange)="setOther(q.questionId, $event)" autocomplete="off" />
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
              <div class="block-stitle">
                <div class="btn center">
                  <a href="javascript:;" (click)="submit()" [style.opacity]="submitting() ? '0.5' : '1'">
                    {{ submitting() ? '儲存中…' : '送出' }}
                  </a>
                </div>
              </div>
            </form>
          }
        </div>
      </div>
    </main>
  `,
})
export class QuestionnaireComponent {
  private readonly service = inject(QuestionnaireService);
  private readonly store = inject(ReservationStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly questionTypeId = this.route.snapshot.queryParamMap.get('questionTypeId');
  private readonly categoryId = this.route.snapshot.queryParamMap.get('categoryId');
  private readonly fromBooking = this.route.snapshot.queryParamMap.get('return') === 'booking';

  readonly form = signal<QuestionForm | null>(null);
  readonly answers = signal<Record<string, AnswerState>>({});
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly notice = signal<string | null>(null);

  /** 未作答題數（每題至少一個選項，或 IsOther 題填了其他文字）。 */
  readonly unanswered = computed(() => {
    const f = this.form();
    if (!f) return 0;
    const a = this.answers();
    return f.questions.filter((q) => {
      const st = a[q.questionId];
      const hasAnswer = (st?.answerIds.length ?? 0) > 0;
      const hasOther = q.isOther && !!st?.other?.trim();
      return !hasAnswer && !hasOther;
    }).length;
  });

  constructor() {
    if (!this.questionTypeId) { this.router.navigate(['/questionnaire']); return; }
    this.service.form(this.questionTypeId).subscribe({
      next: (f) => {
        this.form.set(f);
        // pre-fill 既有作答
        const init: Record<string, AnswerState> = {};
        for (const q of f.questions) {
          init[q.questionId] = { answerIds: [...q.selectedAnswerIds], other: q.otherText ?? '' };
        }
        this.answers.set(init);
        this.loading.set(false);
      },
      error: () => { this.notice.set('載入問卷失敗'); this.loading.set(false); },
    });
  }

  isChecked(qid: string, answerId: string): boolean {
    return (this.answers()[qid]?.answerIds ?? []).includes(answerId);
  }

  setRadio(qid: string, answerId: string) {
    this.patch(qid, { answerIds: [answerId] });
  }

  toggle(qid: string, answerId: string) {
    const cur = this.answers()[qid]?.answerIds ?? [];
    const next = cur.includes(answerId) ? cur.filter((x) => x !== answerId) : [...cur, answerId];
    this.patch(qid, { answerIds: next });
  }

  otherText(qid: string): string {
    return this.answers()[qid]?.other ?? '';
  }

  setOther(qid: string, value: string) {
    this.patch(qid, { other: value });
  }

  private patch(qid: string, patch: Partial<AnswerState>) {
    this.answers.update((a) => {
      const cur: AnswerState = a[qid] ?? { answerIds: [], other: '' };
      return { ...a, [qid]: { ...cur, ...patch } };
    });
  }

  submit() {
    if (this.submitting()) return;
    const f = this.form();
    if (!f) return;
    if (this.unanswered() > 0) {
      this.notice.set(`尚有 ${this.unanswered()} 題未填寫，請完成所有題目。`);
      window.scrollTo({ top: 0 });
      return;
    }
    const a = this.answers();
    this.submitting.set(true);
    this.notice.set(null);
    this.service
      .submit({
        questionTypeId: f.questionTypeId,
        answers: f.questions.map((q) => ({
          questionId: q.questionId,
          answerIds: a[q.questionId]?.answerIds ?? [],
          other: q.isOther ? (a[q.questionId]?.other?.trim() || null) : null,
        })),
      })
      .subscribe({
        next: (res) => {
          this.submitting.set(false);
          if (!res.success) { this.notice.set(res.message ?? '儲存失敗'); return; }
          this.store.setQuestionTypeId(f.questionTypeId);
          // 回問卷清單（預約流程續填其餘問卷或回預約表單；獨立入口則回清單）。
          this.router.navigate(['/questionnaire'], {
            queryParams: {
              ...(this.categoryId ? { categoryId: this.categoryId } : {}),
              ...(this.fromBooking ? { return: 'booking' } : {}),
            },
          });
        },
        error: () => { this.submitting.set(false); this.notice.set('系統忙線，請稍後再試'); },
      });
  }

  back() {
    this.router.navigate(['/questionnaire'], {
      queryParams: {
        ...(this.categoryId ? { categoryId: this.categoryId } : {}),
        ...(this.fromBooking ? { return: 'booking' } : {}),
      },
    });
  }
}
