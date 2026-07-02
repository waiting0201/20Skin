import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ReservationStore } from '../../store/reservation.store';
import { AuthService } from '../../core/services/auth.service';
import { ClinicCode } from '../../core/models';

/** 選擇科別（健保/醫美）。對應舊 Clinic.cshtml。 */
@Component({
  selector: 'app-clinic',
  imports: [RouterLink],
  template: `
    <main id="main">
      <div class="block-online">
        <div class="block-item">
          <div class="block-title">選擇預約科別</div>
          <div class="block-stitle">
            <div class="btn"><a routerLink="/">回上一頁</a></div>
            <div class="btn"><a routerLink="/appointments">預約查詢</a></div>
            <div class="stitle-choose">
              {{ auth.visitTitle() }} <a routerLink="/">．{{ store.branch()?.title }}</a>．選擇預約科別
            </div>
          </div>
          <div class="block-con">
            <ul>
              <li>
                <div class="pic"><img class="online-p" src="/images/online/4g-clinic-c.jpg" alt="健保門診"></div>
                <div class="title">健保門診</div>
                <div class="btn"><a href="javascript:;" (click)="select('Skin')">選擇</a></div>
              </li>
              <!-- 醫學美容線上掛號入口全院隱藏（對應舊 Clinic.cshtml 該段落整段 Razor 註解，非台中限定），
                   僅影響客戶自行選擇診別入口，既有醫美歷史預約查詢/詳情頁與後台排班不受影響。 -->
            </ul>
          </div>
        </div>
      </div>
    </main>
  `,
})
export class ClinicComponent {
  readonly store = inject(ReservationStore);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    if (!this.store.branch()) this.router.navigate(['/']);
  }

  select(c: ClinicCode) {
    this.store.setClinic(c);
    this.router.navigate(['/booking/category']);
  }
}
