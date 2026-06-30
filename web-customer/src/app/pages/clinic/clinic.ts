import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ReservationStore } from '../../store/reservation.store';
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
              <a routerLink="/">．{{ store.branch()?.title }}</a>．選擇預約科別
            </div>
          </div>
          <div class="block-con">
            <ul>
              <li>
                <div class="pic"><img class="online-p" src="/images/online/4g-clinic-c.jpg" alt="健保門診"></div>
                <div class="title">健保門診</div>
                <div class="btn"><a href="javascript:;" (click)="select('Skin')">選擇</a></div>
              </li>
              @if (!isTaichung()) {
                <li>
                  <div class="pic"><img class="online-p" src="/images/online/4g-clinic-b.jpg" alt="醫學美容"></div>
                  <div class="title">醫學美容</div>
                  <div class="btn"><a href="javascript:;" (click)="select('Cosmetic')">選擇</a></div>
                </li>
              }
            </ul>
          </div>
        </div>
      </div>
    </main>
  `,
})
export class ClinicComponent {
  readonly store = inject(ReservationStore);
  private readonly router = inject(Router);

  /** 台中（四季）分院隱藏醫學美容（對應舊 Clinic.cshtml 台中判斷）。 */
  private readonly TAICHUNG_BRANCH_ID = 'e65f4720-82a3-498a-9447-fb5dc910999e';
  isTaichung(): boolean {
    return this.store.branch()?.branchId === this.TAICHUNG_BRANCH_ID;
  }

  constructor() {
    if (!this.store.branch()) this.router.navigate(['/']);
  }

  select(c: ClinicCode) {
    this.store.setClinic(c);
    this.router.navigate(['/booking/category']);
  }
}
