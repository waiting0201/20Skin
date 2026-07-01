import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { QuestionnaireService } from '../../core/services/questionnaire.service';
import { ReservationStore } from '../../store/reservation.store';
import { QuestionnaireCategory } from '../../core/models';

/**
 * 問卷清單。對應舊 QuestionTypes.cshtml。
 * 兩種進入點：
 *  - 獨立入口（無參數）：列出所有有啟用問卷的項目。
 *  - 預約流程（?categoryId=&return=booking）：只列該項目問卷；全部作答後才可「回預約表單」。
 */
@Component({
  selector: 'app-questionnaire-list',
  template: `
    <main id="main">
      <div class="block-online">
        <div class="block-item">
          <div class="block-title">術前問卷</div>
          <div class="block-stitle">
            @if (fromBooking()) {
              <div class="btn"><a href="javascript:;" (click)="back()">回上一頁</a></div>
            }
            <div class="stitle-choose">．請填寫下列術前問卷</div>
          </div>

          @if (notice()) { <p style="color:red; text-align:center;">{{ notice() }}</p> }
          @if (loading()) { <p style="text-align:center;">載入中…</p> }

          @if (!loading() && categories().length === 0) {
            <p style="text-align:center;">目前沒有需要填寫的問卷。</p>
          }

          <div class="block-con">
            <ul>
              @for (c of categories(); track c.categoryId) {
                <li>
                  <div class="title">{{ c.title }}</div>
                  @if (c.intro) { <div class="con">{{ c.intro }}</div> }
                  <div class="btn-block">
                    @for (qt of c.questionTypes; track qt.questionTypeId) {
                      <div class="btn left">
                        <a href="javascript:;" (click)="open(qt.questionTypeId)">
                          {{ qt.title }}{{ qt.answered ? '（已填寫）' : '' }}
                        </a>
                      </div>
                    }
                  </div>
                </li>
              }
            </ul>
          </div>

          @if (fromBooking()) {
            <div class="block-stitle">
              @if (allAnswered()) {
                <div class="btn center"><a href="javascript:;" (click)="continueBooking()">完成，回預約表單</a></div>
              } @else {
                <p style="text-align:center;">請先完成上列所有問卷，才能繼續預約。</p>
              }
            </div>
          }
        </div>
      </div>
    </main>
  `,
})
export class QuestionnaireListComponent {
  private readonly service = inject(QuestionnaireService);
  private readonly store = inject(ReservationStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly categoryId = signal<string | null>(this.route.snapshot.queryParamMap.get('categoryId'));
  readonly fromBooking = signal(this.route.snapshot.queryParamMap.get('return') === 'booking');

  readonly categories = signal<QuestionnaireCategory[]>([]);
  readonly loading = signal(true);
  readonly notice = signal<string | null>(null);

  readonly allAnswered = computed(() =>
    this.categories().length > 0 && this.categories().every((c) => c.questionTypes.every((q) => q.answered)));

  constructor() {
    this.reload();
  }

  private reload() {
    const catId = this.categoryId();
    // 獨立入口：不帶 clinic → 後端回全部；預約流程：帶 categoryId。
    this.loading.set(true);
    this.service.categories(catId ? { categoryId: catId } : {}).subscribe({
      next: (c) => { this.categories.set(c); this.loading.set(false); },
      error: () => { this.notice.set('載入問卷失敗'); this.loading.set(false); },
    });
  }

  open(questionTypeId: string) {
    this.router.navigate(['/booking/questionnaire'], {
      queryParams: {
        questionTypeId,
        ...(this.categoryId() ? { categoryId: this.categoryId() } : {}),
        ...(this.fromBooking() ? { return: 'booking' } : {}),
      },
    });
  }

  continueBooking() {
    // 一個 Category 可含多份問卷，但預約僅記一個 QuestionTypeID → 取第一份（沿用舊系統以「已填問卷」代表）。
    const first = this.categories()[0]?.questionTypes[0]?.questionTypeId ?? null;
    this.store.setQuestionTypeId(first);
    this.router.navigate(['/booking/appointment-form']);
  }

  back() {
    this.router.navigate(['/booking/category']);
  }
}
