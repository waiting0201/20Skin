import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BookingService } from '../../core/services/booking.service';
import { AuthService } from '../../core/services/auth.service';
import { ReservationStore } from '../../store/reservation.store';
import { Branch } from '../../core/models';

/** 分院選擇首頁（對應舊 Index.cshtml）。 */
@Component({
  selector: 'app-index',
  template: `
    <main id="main">
      <div class="online-clinic-choose-block">
        <div class="item-block">
          <div class="title-block">選擇預約診所</div>
          <div class="choose-item-block">
            @if (error()) { <p style="color:red; text-align:center;">{{ error() }}</p> }
            <ul>
              @for (b of branches(); track b.branchId) {
                <li>
                  <div class="pic">
                    <div class="name">{{ b.title }}</div>
                    <img class="online-p" [src]="cardImage(b, $index)" [alt]="b.title" />
                  </div>
                  <div class="btn">
                    <a href="javascript:;" (click)="select(b)">選擇</a>
                  </div>
                </li>
              }
            </ul>
          </div>
        </div>
      </div>
    </main>
  `,
})
export class IndexComponent {
  private readonly booking = inject(BookingService);
  private readonly store = inject(ReservationStore);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  readonly branches = signal<Branch[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    this.store.reset();
    this.booking.branches().subscribe({
      next: (b) => { this.branches.set(b); this.loading.set(false); },
      error: () => { this.error.set('載入分院失敗'); this.loading.set(false); },
    });
  }

  /**
   * 分院卡圖：API 有提供 Blob URL 則用之，否則套用舊 online/clinic-chose-*.jpg 裝飾圖。
   * 舊 `~/Upload/Branchs/` 上傳檔不在 repo，故以同套舊裝飾圖按序對應。
   */
  cardImage(b: Branch, i: number): string {
    if (b.photo && /^https?:\/\//.test(b.photo)) return b.photo;
    return `/images/online/clinic-chose-0${(i % 3) + 1}.jpg`;
  }

  select(b: Branch) {
    this.store.setBranch(b);
    // 齒科（branchType=2）直接跳預約表單；其餘進科別選擇
    this.router.navigate([b.branchType === 2 ? '/booking/appointment-form' : '/booking/clinic']);
  }
}
