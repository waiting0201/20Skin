import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AppointmentService } from '../../core/services/appointment.service';
import { AppointmentDetail, clinicTitle } from '../../core/models';

/** 預約完成頁（對應舊 Complete.cshtml）。 */
@Component({
  selector: 'app-complete',
  imports: [RouterLink],
  template: `
    <main id="main">
      <div class="block-online">
        <div class="block-item">
          <div class="block-title">預約成功</div>
          <div class="block-stitle">
            <div class="btn"><a routerLink="/appointments">預約查詢</a></div>
            <div class="btn"><a routerLink="/">預約診所</a></div>
          </div>
          @if (d(); as a) {
            <div class="block-con white-bg">
              <div class="con-title center">詳細內容</div>
              <div class="form-block">
                <div class="from-title blue-text">預約日期：</div>
                <div class="form-box left">{{ a.appointmentDate.slice(0,10) }}</div>
              </div>
              <div class="form-block">
                <div class="from-title blue-text">預約看診號碼：</div>
                <div class="form-box left">{{ a.outpatientNum ? a.outpatientNum + '號' : '請至現場取號' }}</div>
              </div>
              @if (a.doctorName) {
                <div class="form-block">
                  <div class="from-title blue-text">指定醫師：</div>
                  <div class="form-box left">{{ a.doctorName }}醫師</div>
                </div>
              }
              <div class="form-block">
                <div class="from-title blue-text">指定時間：</div>
                <div class="form-box left">{{ a.periodTitle }}</div>
              </div>
              <div class="form-block">
                <div class="from-title blue-text">預約地點：</div>
                <div class="form-box left">{{ a.branchTitle }}診所</div>
              </div>
              <div class="form-block">
                <div class="from-title blue-text">預約門診：</div>
                <div class="form-box left">{{ ct(a.clinic) }}</div>
              </div>
              <div class="form-block">
                <div class="from-title blue-text">預約項目：</div>
                <div class="form-box left">{{ a.categoryTitle }}</div>
              </div>
              <div class="form-block">
                <div class="from-title blue-text">預約人數：</div>
                <div class="form-box left">{{ a.amount }}人</div>
              </div>
              <div class="form-block">
                <div class="from-title blue-text">預約狀態：</div>
                <div class="form-box left">{{ a.status === 1 ? '預約成功' : '已取消' }}</div>
              </div>
            </div>
          }
          <div class="block-stitle">
            <div class="btn center"><a routerLink="/appointments">預約查詢</a></div>
          </div>
        </div>
      </div>
    </main>
  `,
})
export class CompleteComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly appointments = inject(AppointmentService);
  readonly d = signal<AppointmentDetail | null>(null);
  readonly ct = clinicTitle;

  constructor() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.appointments.detail(id).subscribe((r) => { if (r.success) this.d.set(r.data!); });
  }
}
