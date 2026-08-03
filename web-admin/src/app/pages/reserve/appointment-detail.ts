import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ReserveApiService, reserveLabel } from '../../core/services/reserve-api.service';
import { BasicUploadService } from '../../core/services/basic-upload.service';
import { AppointmentAdminDetail } from '../../core/models';
import { toRocDate } from '../../core/roc-date';

/**
 * 後台預約管理 — 詳情（對應舊 ViewTaAppointments.cshtml 等 3 變體）。
 *
 * 版面：頂部「預約摘要條」（日期/診次/時段/門診號/醫師/診別/項目 + 狀態徽章）＋ 下方分卡
 * （會員資料 / 預約照片 / 問卷）。2026-08-03 使用者裁示改版，兩處刻意偏離舊系統：
 * ①舊 View 只印會員資料 + 診別 + 項目，看不出這筆預約是哪一天幾點、也看不出是否已取消，
 *   故補上預約本身欄位（後端 AppointmentAdminDetailDto 同步擴充）；
 * ②舊 View 用兩個 tab（預約資料/問卷），本頁比照本專案「不設頁籤」定案改為上下堆疊。
 * 操作維持只有「返回」（不放取消，避免與清單頁的不可逆操作重複；使用者裁示）。
 *
 * 問卷三態：questionnaire===null＝該項目不需填寫；answered===false＝需填但尚未作答；否則顯示作答內容。
 */
@Component({
  selector: 'app-appointment-detail',
  imports: [RouterLink],
  template: `
    <div class="max-w-4xl space-y-4">
      <div class="bg-white rounded shadow-sm border border-hairline">
        <div class="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-hairline">
          <h1 class="text-base font-semibold text-ink"><i class="fa fa-search text-muted mr-2"></i>瀏覽{{ branchLabel }}</h1>
          @if (detail(); as d) {
            @if (d.status === 1) {
              <span class="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                <i class="fa fa-check-circle"></i>預約成功
              </span>
            } @else {
              <span class="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-600">
                <i class="fa fa-times-circle"></i>已取消
              </span>
            }
          }
        </div>

        @if (error()) {
          <div class="m-5 text-sm text-red-500">{{ error() }}</div>
        }

        @if (detail(); as d) {
          <!-- 預約摘要條：已取消整條轉紅，讓狀態在捲動前就一眼可辨 -->
          <div class="border-l-4 px-5 py-4"
               [class.border-l-brand]="d.status === 1" [class.bg-surface]="d.status === 1"
               [class.border-l-red-500]="d.status !== 1" [class.bg-red-50]="d.status !== 1">
            <div class="flex flex-wrap items-start gap-x-8 gap-y-4">
              <div>
                <div class="text-xs text-muted mb-0.5">預約日期</div>
                <div class="text-lg font-semibold text-ink leading-tight">
                  {{ toRocDate(d.appointmentDate) }}
                  <span class="ml-1 text-sm font-normal text-muted">（{{ weekday(d.appointmentDate) }}）</span>
                </div>
              </div>
              @if (d.periodTitle) {
                <div>
                  <div class="text-xs text-muted mb-0.5">時間</div>
                  <div class="text-lg font-semibold text-ink leading-tight">{{ d.periodTitle }}</div>
                </div>
              }
              <div>
                <div class="text-xs text-muted mb-0.5">時段</div>
                <div class="text-lg font-semibold text-ink leading-tight">{{ d.slotTitle }}</div>
              </div>
              @if (d.branchIsAutoRowNumber) {
                <div>
                  <div class="text-xs text-muted mb-0.5">門診號碼</div>
                  <div class="text-lg font-semibold text-brand leading-tight">{{ d.outpatientNum ?? '—' }}</div>
                </div>
              }
              <div>
                <div class="text-xs text-muted mb-0.5">醫師</div>
                <div class="text-lg font-semibold text-ink leading-tight">{{ d.doctorName || '未指定' }}</div>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 pt-3 border-t border-hairline text-sm">
              <span class="text-muted">預約門診 <span class="text-ink">{{ clinicText(d.clinic) }}</span></span>
              <span class="text-muted">項目 <span class="text-ink">{{ d.categoryTitle }}</span></span>
              @if (d.isFirstVisit) {
                <span class="inline-flex items-center rounded bg-brand-tint px-2 py-0.5 text-xs font-medium text-brand">初診</span>
              }
              <div class="flex-1"></div>
              @if (d.createDate) {
                <span class="text-xs text-muted">建立於 {{ rocDateTime(d.createDate) }}</span>
              }
            </div>
          </div>
        }
      </div>

      @if (detail(); as d) {
        <div class="bg-white rounded shadow-sm border border-hairline">
          <h2 class="px-5 py-3 border-b border-hairline text-sm font-semibold text-ink">會員資料</h2>
          <dl class="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div class="flex gap-3"><dt class="w-28 shrink-0 text-muted">姓名</dt><dd class="text-ink">{{ d.memberName }}</dd></div>
            <div class="flex gap-3"><dt class="w-28 shrink-0 text-muted">身分證號</dt><dd class="text-ink">{{ d.memberNumber }}</dd></div>
            <div class="flex gap-3"><dt class="w-28 shrink-0 text-muted">性別</dt><dd class="text-ink">{{ genderText(d.memberGender) }}</dd></div>
            <div class="flex gap-3"><dt class="w-28 shrink-0 text-muted">生日</dt><dd class="text-ink">{{ toRocDate(d.memberBirthday) }}</dd></div>
            <div class="flex gap-3"><dt class="w-28 shrink-0 text-muted">手機號碼</dt><dd class="text-ink">{{ d.memberMobile }}</dd></div>
            <div class="flex gap-3"><dt class="w-28 shrink-0 text-muted">血型</dt><dd class="text-ink">{{ d.memberBloodType || '—' }}</dd></div>
            <div class="flex gap-3 sm:col-span-2">
              <dt class="w-28 shrink-0 text-muted">地址</dt>
              <dd class="text-ink">{{ addressText(d) || '—' }}</dd>
            </div>
            <div class="flex gap-3 sm:col-span-2">
              <dt class="w-28 shrink-0 text-muted">藥物過敏史</dt>
              <dd class="flex flex-wrap gap-1.5">
                @for (item of chips(d.memberAllergy, d.memberAllergyOther); track item) {
                  <span class="inline-block rounded border border-hairline bg-surface px-2 py-0.5 text-xs text-ink">{{ item }}</span>
                } @empty {
                  <span class="text-muted">—</span>
                }
              </dd>
            </div>
            <div class="flex gap-3 sm:col-span-2">
              <dt class="w-28 shrink-0 text-muted">重大傷病或慢性病史</dt>
              <dd class="flex flex-wrap gap-1.5">
                @for (item of chips(d.memberMedicalHistory, d.memberMedicalHistoryOther); track item) {
                  <span class="inline-block rounded border border-hairline bg-surface px-2 py-0.5 text-xs text-ink">{{ item }}</span>
                } @empty {
                  <span class="text-muted">—</span>
                }
              </dd>
            </div>
          </dl>
        </div>

        @if (photoUrl(d.photo); as url) {
          <div class="bg-white rounded shadow-sm border border-hairline">
            <h2 class="px-5 py-3 border-b border-hairline text-sm font-semibold text-ink">預約照片</h2>
            <div class="px-5 py-4">
              <a [href]="url" target="_blank" rel="noopener" title="開新分頁看原圖">
                <img [src]="url" alt="預約照片" class="max-h-64 rounded border border-hairline" />
              </a>
            </div>
          </div>
        }

        <div class="bg-white rounded shadow-sm border border-hairline">
          <h2 class="px-5 py-3 border-b border-hairline text-sm font-semibold text-ink">
            問卷
            @if (d.questionnaire; as f) { <span class="ml-1 font-normal text-muted">· {{ f.title }}</span> }
          </h2>
          <div class="px-5 py-4">
            @if (d.questionnaire; as f) {
              @if (!f.answered) {
                <p class="text-sm text-muted">尚未作答</p>
              } @else {
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
                            <td class="px-4 py-2"
                                [class.text-ink]="q.selectedAnswerIds.includes(ans.questionAnswerId)"
                                [class.font-medium]="q.selectedAnswerIds.includes(ans.questionAnswerId)"
                                [class.text-muted]="!q.selectedAnswerIds.includes(ans.questionAnswerId)">{{ ans.title }}</td>
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
              }
            } @else {
              <p class="text-sm text-muted">不需填寫問卷</p>
            }
          </div>
        </div>

        <div>
          <a [routerLink]="['/reserve']" [queryParams]="returnQuery"
             class="inline-flex items-center gap-1.5 border border-hairline bg-white text-ink text-sm rounded px-3 py-1.5 hover:bg-surface">
            <i class="fa fa-arrow-left"></i>返回
          </a>
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

  addressText(d: AppointmentAdminDetail): string {
    return [d.memberCity, d.memberArea, d.memberAddress].filter(Boolean).join(' ').trim();
  }

  /** 過敏/病史：CSV 陣列 + 「其他」自填合併成 chip 清單（空值不產生空 chip）。 */
  chips(list: string[], other: string | null): string[] {
    const items = list.filter((x) => !!x && x.trim() !== '');
    if (other && other.trim() !== '') items.push(other.trim());
    return items;
  }

  /**
   * 星期（以日期字串前 10 碼組 UTC 日期再取 getUTCDay，避免 `new Date(iso)` 在不同時區被位移一天）。
   */
  weekday(iso: string): string {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return ['日', '一', '二', '三', '四', '五', '六'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  }

  /** 民國年 + 時分（建立時間用；後端回的是本地時間字串，直接取字串片段不做時區換算）。 */
  rocDateTime(iso: string): string {
    const time = iso.slice(11, 16);
    return time ? `${toRocDate(iso)} ${time}` : toRocDate(iso);
  }
}
