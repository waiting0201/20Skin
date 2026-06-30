import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AppointmentService } from '../../core/services/appointment.service';
import { AppointmentDetail, clinicTitle } from '../../core/models';

/** 預約詳情 + 取消（對應舊 AppointmentDetail/AppointmentCancel.cshtml）。 */
@Component({
  selector: 'app-appointment-detail',
  imports: [RouterLink],
  template: `
    <main id="main">
      <div class="block-online">
        <div class="block-item">
          <div class="block-title">預約查詢</div>
          <div class="block-stitle">
            <div class="btn"><a routerLink="/appointments">回上一頁</a></div>
          </div>
          <div class="block-con white-bg">
            <div class="con-title center">詳細內容</div>
            @if (msg()) {
              <div class="form-block center" [style.color]="ok() ? '#00538d' : 'red'">{{ msg() }}</div>
            }
            @if (d(); as a) {
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
            }
          </div>
          @if (d()?.status === 1) {
            <div class="block-stitle">
              <div class="btn center">
                <a href="javascript:;" (click)="cancel(d()!.appointmentId)"
                   [style.opacity]="busy() ? '0.5' : '1'">
                  {{ busy() ? '處理中…' : '確定取消' }}
                </a>
              </div>
            </div>
          }
          <div class="block-stitle">
            <div class="btn center"><a routerLink="/appointments">回上一頁</a></div>
          </div>
        </div>
      </div>
    </main>
  `,
})
export class AppointmentDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly appointments = inject(AppointmentService);
  readonly d = signal<AppointmentDetail | null>(null);
  readonly busy = signal(false);
  readonly msg = signal<string | null>(null);
  readonly ok = signal(false);
  readonly ct = clinicTitle;

  constructor() {
    this.load(this.route.snapshot.paramMap.get('id')!);
  }

  private load(id: string) {
    this.appointments.detail(id).subscribe((r) => {
      if (r.success) this.d.set(r.data!);
      else { this.msg.set(r.message ?? '找不到預約'); this.ok.set(false); }
    });
  }

  cancel(id: string) {
    this.busy.set(true);
    this.appointments.cancel(id).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.ok.set(r.success);
        this.msg.set(r.message ?? (r.success ? '取消成功' : '取消失敗'));
        if (r.success) this.load(id);
      },
      error: () => { this.busy.set(false); this.ok.set(false); this.msg.set('系統忙線，請稍後再試'); },
    });
  }
}
