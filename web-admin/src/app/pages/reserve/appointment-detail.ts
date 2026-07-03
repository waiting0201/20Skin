import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ReserveApiService, reserveLabel } from '../../core/services/reserve-api.service';
import { BasicUploadService } from '../../core/services/basic-upload.service';
import { AppointmentAdminDetail } from '../../core/models';
import { toRocDate } from '../../core/roc-date';

/**
 * 後台預約管理 — 詳情（對應舊 ViewTaAppointments.cshtml 等 3 變體）。
 * 比照本專案「列表頁不設頁籤」定案：預約資料 + 問卷兩段直接上下堆疊，不做 tab 切換
 * （舊 ViewChDentistAppointments 本來就沒有問卷 tab，本頁 questionnaire===null 時統一顯示提示文字涵蓋此差異）。
 */
@Component({
  selector: 'app-appointment-detail',
  imports: [RouterLink],
  template: `
    <div class="bg-white rounded shadow-sm border border-hairline max-w-3xl">
      <div class="px-5 py-3 border-b border-hairline">
        <h1 class="text-base font-semibold text-ink"><i class="fa fa-search text-muted mr-2"></i>瀏覽{{ branchLabel }}</h1>
      </div>

      @if (error()) {
        <div class="m-5 text-sm text-red-500">{{ error() }}</div>
      }

      @if (detail(); as d) {
        <div class="p-5 space-y-6">
          <div>
            <h2 class="text-sm font-semibold text-ink mb-3">預約資料</h2>
            @if (photoUrl(d.photo); as url) {
              <div class="mb-4">
                <img [src]="url" alt="預約照片" class="max-w-xs rounded border border-hairline" />
              </div>
            }
            <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div><dt class="text-muted">預約門診</dt><dd class="text-ink">{{ clinicText(d.clinic) }}</dd></div>
              <div><dt class="text-muted">項目</dt><dd class="text-ink">{{ d.categoryTitle }}</dd></div>
              <div><dt class="text-muted">身分證號</dt><dd class="text-ink">{{ d.memberNumber }}</dd></div>
              <div><dt class="text-muted">手機號碼</dt><dd class="text-ink">{{ d.memberMobile }}</dd></div>
              <div><dt class="text-muted">生日</dt><dd class="text-ink">{{ toRocDate(d.memberBirthday) }}</dd></div>
              <div><dt class="text-muted">姓名</dt><dd class="text-ink">{{ d.memberName }}</dd></div>
              <div><dt class="text-muted">性別</dt><dd class="text-ink">{{ genderText(d.memberGender) }}</dd></div>
              <div><dt class="text-muted">血型</dt><dd class="text-ink">{{ d.memberBloodType }}</dd></div>
              <div class="sm:col-span-2"><dt class="text-muted">地址</dt><dd class="text-ink">{{ d.memberCity }} {{ d.memberArea }} {{ d.memberAddress }}</dd></div>
              <div class="sm:col-span-2"><dt class="text-muted">藥物過敏史</dt><dd class="text-ink">{{ d.memberAllergy.join('、') }} {{ d.memberAllergyOther }}</dd></div>
              <div class="sm:col-span-2"><dt class="text-muted">重大傷病或慢性病史</dt><dd class="text-ink">{{ d.memberMedicalHistory.join('、') }} {{ d.memberMedicalHistoryOther }}</dd></div>
            </dl>
          </div>

          <div>
            <h2 class="text-sm font-semibold text-ink mb-3">問卷</h2>
            @if (d.questionnaire; as f) {
              <div class="overflow-x-auto">
              <table class="w-full text-sm border border-hairline">
                <tbody>
                  @for (q of f.questions; track q.questionId) {
                    <tr class="bg-surface">
                      <td colspan="2" class="px-4 py-2 font-medium text-ink border-b border-hairline">{{ q.title }}</td>
                    </tr>
                    @for (ans of q.answers; track ans.questionAnswerId) {
                      <tr class="border-b border-hairline">
                        <td class="px-4 py-2 text-center w-12">
                          @if (q.selectedAnswerIds.includes(ans.questionAnswerId)) { <i class="fa fa-check text-brand"></i> }
                        </td>
                        <td class="px-4 py-2 text-ink">{{ ans.title }}</td>
                      </tr>
                    }
                    @if (q.isOther) {
                      <tr class="border-b border-hairline">
                        <td colspan="2" class="px-4 py-2 text-ink">{{ q.otherTitle }}：{{ q.otherText }}</td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
              </div>
            } @else {
              <p class="text-sm text-muted">不需填寫問卷</p>
            }
          </div>

          <div>
            <a [routerLink]="['/reserve']" [queryParams]="returnQuery" class="text-sm text-muted hover:text-ink px-3 py-2">返回</a>
          </div>
        </div>
      }
    </div>
  `,
})
export class AppointmentDetailComponent {
  private readonly api = inject(ReserveApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly upload = inject(BasicUploadService);

  readonly toRocDate = toRocDate;
  private readonly id = this.route.snapshot.paramMap.get('id')!;
  private readonly branch = this.route.snapshot.queryParamMap.get('branch') ?? 'ta';
  readonly branchLabel = reserveLabel(this.branch);

  /** 返回列表時還原篩選條件（branch/clinic/appointmentDate，比照其他模組 returnQuery 慣例）。 */
  readonly returnQuery: Record<string, string> = (() => {
    const q: Record<string, string> = { branch: this.branch };
    const clinic = this.route.snapshot.queryParamMap.get('clinic');
    const appointmentDate = this.route.snapshot.queryParamMap.get('appointmentDate');
    if (clinic) q['clinic'] = clinic;
    if (appointmentDate) q['appointmentDate'] = appointmentDate;
    return q;
  })();

  readonly detail = signal<AppointmentAdminDetail | null>(null);
  readonly error = signal<string | null>(null);

  constructor() {
    this.api.detail(this.branch, this.id).subscribe({
      next: (res) => {
        if (res.success && res.data) this.detail.set(res.data);
        else this.error.set(res.message ?? '找不到預約');
      },
      error: () => this.error.set('系統忙線，請稍後再試'),
    });
  }

  photoUrl(photo: string | null): string | null {
    return this.upload.photoUrl(photo, 'appointments');
  }

  clinicText(clinic: string): string {
    if (clinic === 'Skin') return '健保門診';
    if (clinic === 'Cosmetic') return '醫學美容';
    return '齒科';
  }

  /** 比照舊 View `Model.Members.Gender == 1 ? "男生" : "女生"`：非 1（含 null）一律顯示女生，忠於舊系統既有行為。 */
  genderText(gender: number | null): string {
    return gender === 1 ? '男生' : '女生';
  }
}
