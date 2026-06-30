import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppointmentService } from '../../core/services/appointment.service';
import { AppointmentListItem, clinicTitle } from '../../core/models';

/** 我的預約清單（對應舊 Appointment.cshtml）。 */
@Component({
  selector: 'app-appointment-list',
  imports: [RouterLink],
  template: `
    <main id="main">
      <div class="block-online">
        <div class="block-item">
          <div class="block-title">預約查詢</div>
          <div class="block-stitle">
            <div class="btn"><a routerLink="/">預約首頁</a></div>
          </div>
          <div class="block-con white-bg">
            <div class="online-list-tb">
              <table>
                <thead>
                  <tr class="blue-line">
                    <th scope="col">預約日期</th>
                    <th scope="col">預約地點</th>
                    <th scope="col">預約門診</th>
                    <th scope="col">預約科別</th>
                    <th scope="col">預約狀態</th>
                    <th scope="col">預約內容</th>
                  </tr>
                </thead>
                <tbody>
                  @if (loading()) {
                    <tr><td colspan="6" style="text-align:center;">載入中…</td></tr>
                  }
                  @if (!loading() && items().length === 0) {
                    <tr><td colspan="6" style="text-align:center;">目前沒有預約紀錄。</td></tr>
                  }
                  @for (a of items(); track a.appointmentId) {
                    <tr>
                      <td data-label="預約日期">{{ a.appointmentDate.slice(0,10) }}</td>
                      <td data-label="預約地點">{{ a.branchTitle }}</td>
                      <td data-label="預約門診">{{ ct(a.clinic) }}</td>
                      <td data-label="預約科別">{{ a.categoryTitle }}</td>
                      <td data-label="預約狀態">
                        @if (a.status === 1) {
                          <a [routerLink]="['/appointments', a.appointmentId]">我要取消</a>
                        } @else { 已取消 }
                      </td>
                      <td data-label="預約內容">
                        <a [routerLink]="['/appointments', a.appointmentId]">詳細內容</a>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  `,
})
export class AppointmentListComponent {
  private readonly appointments = inject(AppointmentService);
  readonly items = signal<AppointmentListItem[]>([]);
  readonly loading = signal(true);
  readonly ct = clinicTitle;

  constructor() {
    this.appointments.mine().subscribe({
      next: (r) => { this.items.set(r.items ?? []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
