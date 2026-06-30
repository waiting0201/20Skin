import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BookingService } from '../../core/services/booking.service';
import { ReservationStore } from '../../store/reservation.store';
import { Category } from '../../core/models';

/** 選擇就診項目。對應舊 Category.cshtml。 */
@Component({
  selector: 'app-category',
  imports: [RouterLink],
  template: `
    <main id="main">
      <div class="block-online">
        <div class="block-item">
          <div class="block-title">選擇預約類別</div>
          <div class="block-stitle">
            <div class="btn"><a routerLink="/booking/clinic">回上一頁</a></div>
            <div class="btn"><a routerLink="/appointments">預約查詢</a></div>
            <div class="stitle-choose">
              <a routerLink="/">．{{ store.branch()?.title }}</a>
              <a routerLink="/booking/clinic">．{{ store.clinicTitle() }}</a>．選擇預約類別
            </div>
          </div>
          @if (notice()) { <p style="color:red; text-align:center;">{{ notice() }}</p> }
          <div class="block-con">
            <ul>
              @for (c of categories(); track c.categoryId) {
                <li>
                  <div class="pic"><img class="online-p" [src]="cardImage(c, $index)" [alt]="c.title"></div>
                  <div class="title">{{ c.title }}</div>
                  <div class="con">{{ c.intro }}</div>
                  <div class="btn">
                    <a href="javascript:;" (click)="select(c)">選擇</a>
                  </div>
                </li>
              }
            </ul>
          </div>
          <div class="block-stitle">
            <div class="btn center"><a routerLink="/booking/clinic">回上一頁</a></div>
          </div>
        </div>
      </div>
    </main>
  `,
})
export class CategoryComponent {
  private readonly booking = inject(BookingService);
  readonly store = inject(ReservationStore);
  private readonly router = inject(Router);

  readonly categories = signal<Category[]>([]);
  readonly loading = signal(true);
  readonly notice = signal<string | null>(null);

  constructor() {
    const clinic = this.store.clinic();
    if (!this.store.branch() || !clinic) { this.router.navigate(['/']); return; }
    this.booking.categories(clinic).subscribe({
      next: (c) => { this.categories.set(c); this.loading.set(false); },
      error: () => { this.notice.set('載入項目失敗'); this.loading.set(false); },
    });
  }

  /**
   * 項目卡圖：API 有提供 Blob URL 則用之，否則套用舊裝飾圖
   * （健保→online/clinic-item-*.jpg；醫美→online/beauty-item-*.jpg）。
   * 舊 `~/Upload/Categorys/` 上傳檔不在 repo，故以同套舊裝飾圖按序對應。
   */
  cardImage(c: Category, i: number): string {
    if (c.photo && /^https?:\/\//.test(c.photo)) return c.photo;
    const set = this.store.clinic() === 'Cosmetic' ? 'beauty-item' : 'clinic-item';
    const n = String((i % 10) + 1).padStart(2, '0');
    return `/images/online/${set}-${n}.jpg`;
  }

  select(c: Category) {
    this.store.setCategory(c);
    if (c.isQuestion) {
      // 問卷功能建置中（見 docs/blueprints/questionnaire.md）；先擋下需問卷的項目
      this.notice.set('此項目需先填寫問卷，問卷功能建置中，暫無法線上預約。');
      return;
    }
    this.router.navigate(['/booking/appointment-form']);
  }
}
