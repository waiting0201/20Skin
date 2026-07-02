import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AppointmentService } from '../../core/services/appointment.service';
import { UploadService } from '../../core/services/upload.service';
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
              @if (showArrivalNotice(a)) {
                <div class="form-block center" style="color:red;">現場報到時，請告知櫃檯人員有線上預約及預約時段</div>
              }
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
                <div class="form-box left">
                  {{ a.status === 1 ? '預約成功' : '已取消' }}
                  @if (showArrivalReminder(a)) {
                    <span style="color:red; font-size:11px;">請提前10分鐘報到，只保留10分鐘。</span>
                  }
                </div>
              </div>
              <div class="form-block">
                <div class="from-title blue-text">問卷填寫狀態：</div>
                <div class="form-box left">
                  @if (!a.isQuestion) {
                    不需填寫問卷
                  } @else if (a.questionAnswered) {
                    已填寫
                  } @else {
                    未填寫　<a routerLink="/questionnaire">前往填寫</a>
                  }
                </div>
              </div>
              @if (uploads.photoUrl(a.photo); as url) {
                <div class="form-block">
                  <div class="from-title blue-text">上傳圖片：</div>
                  <div class="form-box left"><img [src]="url" alt="預約圖片" style="max-width:240px; max-height:240px;" /></div>
                </div>
              }
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
  readonly uploads = inject(UploadService);
  readonly d = signal<AppointmentDetail | null>(null);
  readonly ct = clinicTitle;

  /** 二林分院（對應舊 Complete.cshtml 硬編碼 BranchID，沿用 clinic.ts 既有慣例：分院 GUID 存於元件、不進 template）。 */
  private readonly ERLIN_BRANCH_ID = 'c59d0277-bd0e-48f8-aece-9a4a47e5f2a3';

  constructor() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.appointments.detail(id).subscribe((r) => { if (r.success) this.d.set(r.data!); });
  }

  /** 二林 + 健保門診：頁面上方到院報到提醒（對應舊 Complete.cshtml L13-16）。 */
  showArrivalNotice(a: AppointmentDetail): boolean {
    return a.branchId === this.ERLIN_BRANCH_ID && a.clinic === 'Skin';
  }

  /** 二林：預約狀態欄位額外顯示提前報到提醒（對應舊 Complete.cshtml L91-94，無診別限制）。 */
  showArrivalReminder(a: AppointmentDetail): boolean {
    return a.branchId === this.ERLIN_BRANCH_ID;
  }
}
