import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Params } from '@angular/router';
import { DashboardApiService } from '../core/services/dashboard-api.service';
import { Dashboard, DashboardTrendDay } from '../core/models';

/**
 * 分院系列色（固定順序 ta→ch→chDentist，不依資料重排；調色盤已跑過 dataviz 驗證器：
 * 亮度帶/彩度/CVD 相鄰對比/表面對比全數通過）。文字一律用 text-ink/text-muted，不著系列色。
 */
const BRANCH_COLORS: Record<string, string> = {
  ta: '#00538d', // 品牌藍（台中．四季）
  ch: '#d97706', // 琥珀（二林．四季）
  chDentist: '#059669', // 綠（二林．齒科）
};

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/**
 * 後台儀表板（舊 Main/Index 為空殼 widget，本頁為新系統新增功能，見 docs/blueprints/admin-dashboard.md）。
 * 區塊由後端依可讀權限過濾：分院當日統計（3 組預約 Lims key）＋未來 7 天趨勢；會員統計（Members key）。
 * 無任何可讀區塊時顯示引導文字。
 */
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  template: `
    <div class="space-y-4">
      <div class="bg-white rounded shadow-sm border border-hairline px-5 py-3 flex flex-wrap items-center justify-between gap-2">
        <h1 class="text-base font-semibold text-ink"><i class="fa fa-dashboard text-muted mr-2"></i>儀表板</h1>
        <span class="text-sm text-muted">今日 {{ todayLabel() }}</span>
      </div>

      @if (loading()) {
        <div class="bg-white rounded shadow-sm border border-hairline p-6 text-sm text-muted">
          <i class="fa fa-spinner fa-spin mr-2"></i>載入中…
        </div>
      } @else if (error()) {
        <div class="bg-white rounded shadow-sm border border-hairline p-6 text-sm text-red-500">{{ error() }}</div>
      } @else if (data(); as d) {

        @if (d.members; as m) {
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-white rounded shadow-sm border border-hairline p-4">
              <div class="text-xs text-muted mb-1">會員總數</div>
              <div class="text-2xl font-semibold text-ink">{{ m.totalMembers.toLocaleString() }}</div>
            </div>
            <div class="bg-white rounded shadow-sm border border-hairline p-4">
              <div class="text-xs text-muted mb-1">今日新增會員</div>
              <div class="text-2xl font-semibold text-ink">{{ m.todayNew }}</div>
            </div>
            <div class="bg-white rounded shadow-sm border border-hairline p-4">
              <div class="text-xs text-muted mb-1">本月新增會員</div>
              <div class="text-2xl font-semibold text-ink">{{ m.monthNew }}</div>
            </div>
            <div class="bg-white rounded shadow-sm border border-hairline p-4">
              <div class="text-xs text-muted mb-1">黑名單會員</div>
              <div class="text-2xl font-semibold text-ink">{{ m.blacklistCount }}</div>
            </div>
          </div>
        }

        @if (d.branches.length > 0) {
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            @for (b of d.branches; track b.branchKey) {
              <div class="bg-white rounded shadow-sm border border-hairline p-4 flex flex-col gap-3">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="w-2.5 h-2.5 rounded-sm shrink-0" [style.background]="color(b.branchKey)"></span>
                    <h2 class="text-sm font-semibold text-ink truncate">{{ b.branchTitle }}</h2>
                  </div>
                  <a [routerLink]="'/reserve'" [queryParams]="reserveQuery(b.branchKey)"
                     class="text-xs text-brand hover:underline shrink-0">預約維護 <i class="fa fa-angle-right"></i></a>
                </div>
                <div>
                  <div class="text-3xl font-semibold text-ink leading-none">{{ b.todayCount }}</div>
                  <div class="text-xs text-muted mt-1">今日有效預約</div>
                </div>
                @if (b.clinics.length > 0) {
                  <div class="flex flex-wrap gap-1.5">
                    @for (c of b.clinics; track c.clinic) {
                      <span class="text-xs text-ink bg-surface border border-hairline rounded px-2 py-0.5">
                        {{ c.clinicTitle }} {{ c.todayCount }}
                      </span>
                    }
                  </div>
                }
                <div class="flex gap-4 text-xs text-muted border-t border-hairline pt-2 mt-auto">
                  <span>初診 <span class="text-ink font-medium">{{ b.todayFirstVisit }}</span></span>
                  <span>今日已取消 <span class="text-ink font-medium">{{ b.todayCancelled }}</span></span>
                </div>
              </div>
            }
          </div>

          <div class="bg-white rounded shadow-sm border border-hairline p-5">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 class="text-sm font-semibold text-ink">未來 7 天預約量</h2>
              @if (d.branches.length > 1) {
                <div class="flex flex-wrap gap-3">
                  @for (b of d.branches; track b.branchKey) {
                    <span class="inline-flex items-center gap-1.5 text-xs text-muted">
                      <span class="w-2.5 h-2.5 rounded-sm" [style.background]="color(b.branchKey)"></span>{{ b.branchTitle }}
                    </span>
                  }
                </div>
              }
            </div>
            <div class="space-y-2">
              @for (day of d.trend; track day.date) {
                <div class="grid grid-cols-[7rem_1fr_3rem] items-center gap-2">
                  <span class="text-xs" [class]="isToday(day.date) ? 'text-ink font-medium' : 'text-muted'">{{ dayLabel(day.date) }}</span>
                  <div class="h-4 flex gap-[2px] items-stretch">
                    @for (b of d.branches; track b.branchKey) {
                      @if (segWidth(day, b.branchKey) > 0) {
                        <div class="rounded-[4px] min-w-[3px]"
                             [style.width.%]="segWidth(day, b.branchKey)"
                             [style.background]="color(b.branchKey)"
                             [title]="b.branchTitle + ' ' + day.perBranch[b.branchKey] + ' 筆'"></div>
                      }
                    }
                  </div>
                  <span class="text-xs text-ink text-right tabular-nums">{{ day.total }}</span>
                </div>
              }
            </div>
          </div>
        }

        @if (d.branches.length === 0 && !d.members) {
          <div class="bg-white rounded shadow-sm border border-hairline p-6 text-sm text-muted">
            目前帳號沒有可檢視的統計區塊（需具備預約管理或會員管理的讀取權限）。請由左側選單使用您已授權的功能。
          </div>
        }
      }
    </div>
  `,
})
export class DashboardComponent {
  private readonly api = inject(DashboardApiService);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly data = signal<Dashboard | null>(null);

  /** 趨勢橫條的比例基準（全部日皆 0 時取 1 避免除以零）。 */
  private readonly maxTrendTotal = computed(() =>
    Math.max(1, ...(this.data()?.trend.map((t) => t.total) ?? [1])),
  );

  readonly todayLabel = computed(() => {
    const iso = this.data()?.date;
    return iso ? this.dayLabel(iso) : '';
  });

  constructor() {
    this.api.get().subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) this.data.set(res.data);
        else this.error.set(res.message || '載入儀表板失敗');
      },
      error: () => {
        this.loading.set(false);
        this.error.set('載入儀表板失敗，請稍後再試');
      },
    });
  }

  color(branchKey: string): string {
    return BRANCH_COLORS[branchKey] ?? '#7c8796';
  }

  /** 趨勢分段寬度（％，以 7 天最大總量為基準；同列各段相加 ≤ 100）。 */
  segWidth(day: DashboardTrendDay, branchKey: string): number {
    return ((day.perBranch[branchKey] ?? 0) / this.maxTrendTotal()) * 100;
  }

  dayLabel(iso: string): string {
    const d = new Date(iso.slice(0, 10) + 'T00:00:00');
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}（${WEEKDAYS[d.getDay()]}）`;
  }

  isToday(iso: string): boolean {
    return iso.slice(0, 10) === (this.data()?.date ?? '').slice(0, 10);
  }

  /** 前往預約維護的 query（比照 menu-route-map 的 Lims 對應：chDentist 需帶 clinic=Dentist）。 */
  reserveQuery(branchKey: string): Params {
    return branchKey === 'chDentist' ? { branch: branchKey, clinic: 'Dentist' } : { branch: branchKey };
  }
}
