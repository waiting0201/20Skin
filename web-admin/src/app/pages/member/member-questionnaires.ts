import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MemberApiService } from '../../core/services/member-api.service';
import { AuthService } from '../../core/services/auth.service';
import { MemberQuestionnaireLink } from '../../core/models';

/**
 * 後台會員管理 — 問卷維護（對應舊 MemberMs/MemberQAs.cshtml）。
 * 兩個清單：已上傳掃描檔（可編輯/刪除）＋已數位作答問卷（唯讀連結）。
 */
@Component({
  selector: 'app-member-questionnaires',
  imports: [RouterLink],
  template: `
    <div class="space-y-4">
      <div class="bg-white rounded shadow-sm border border-hairline">
        <div class="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-hairline">
          <h1 class="text-base font-semibold text-ink"><i class="fa fa-list-ol text-muted mr-2"></i>問卷維護</h1>
          <div class="flex items-center gap-2">
            <a routerLink="/member" class="text-sm text-muted hover:text-ink px-3 py-1.5">
              <i class="fa fa-arrow-circle-left mr-1"></i>返回
            </a>
            @if (auth.can('Members', 'add')) {
              <a [routerLink]="['/member', memberId, 'questionnaires', 'new']"
                 class="inline-flex items-center gap-1.5 bg-brand text-white text-sm rounded px-3 py-1.5 hover:bg-brand-deep">
                <i class="fa fa-plus"></i> 新增問卷上傳
              </a>
            }
          </div>
        </div>

        @if (error()) {
          <div class="m-5 text-sm text-red-500">{{ error() }}</div>
        }

        <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-muted border-b border-hairline bg-surface">
              <th class="px-5 py-2.5 font-medium w-32">類別</th>
              <th class="px-5 py-2.5 font-medium w-auto">標題</th>
              <th class="px-5 py-2.5 font-medium text-center w-24">操作</th>
            </tr>
          </thead>
          <tbody>
            @for (q of uploaded(); track q.linkId) {
              <tr class="border-b border-hairline hover:bg-surface">
                <td class="px-5 py-2.5 text-ink">{{ q.categoryTitle }}</td>
                <td class="px-5 py-2.5 text-ink">{{ q.questionTypeTitle }}</td>
                <td class="px-5 py-2.5 text-center">
                  <span class="inline-flex items-center gap-3">
                    @if (auth.can('Members', 'update')) {
                      <a [routerLink]="['/member', memberId, 'questionnaires', q.linkId, 'edit']"
                         class="text-brand hover:text-brand-deep" title="編輯"><i class="fa fa-pencil"></i></a>
                    }
                    @if (auth.can('Members', 'delete')) {
                      <button (click)="remove(q)" class="text-red-500 hover:text-red-700" title="刪除"><i class="fa fa-trash"></i></button>
                    }
                  </span>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="3" class="px-5 py-6 text-center text-muted">{{ loading() ? '載入中…' : '尚無上傳掃描檔' }}</td></tr>
            }
          </tbody>
        </table>
        </div>
      </div>

      <div class="bg-white rounded shadow-sm border border-hairline">
        <div class="px-5 py-3 border-b border-hairline">
          <h2 class="text-sm font-semibold text-ink">已數位作答問卷</h2>
        </div>
        <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-muted border-b border-hairline bg-surface">
              <th class="px-5 py-2.5 font-medium w-32">類別</th>
              <th class="px-5 py-2.5 font-medium w-auto">標題</th>
              <th class="px-5 py-2.5 font-medium text-center w-24">瀏覽</th>
            </tr>
          </thead>
          <tbody>
            @for (q of digitalAnswered(); track q.linkId) {
              <tr class="border-b border-hairline hover:bg-surface">
                <td class="px-5 py-2.5 text-ink">{{ q.categoryTitle }}</td>
                <td class="px-5 py-2.5 text-ink">{{ q.questionTypeTitle }}</td>
                <td class="px-5 py-2.5 text-center">
                  <a [routerLink]="['/member', memberId, 'questionnaires', q.linkId, 'view']"
                     class="text-brand hover:text-brand-deep" title="瀏覽"><i class="fa fa-search"></i></a>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="3" class="px-5 py-6 text-center text-muted">尚無數位作答問卷</td></tr>
            }
          </tbody>
        </table>
        </div>
      </div>
    </div>
  `,
})
export class MemberQuestionnairesComponent {
  private readonly api = inject(MemberApiService);
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);

  readonly memberId = this.route.snapshot.paramMap.get('id')!;
  readonly uploaded = signal<MemberQuestionnaireLink[]>([]);
  readonly digitalAnswered = signal<MemberQuestionnaireLink[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.questionnaires(this.memberId).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) {
          this.uploaded.set(res.data.uploaded);
          this.digitalAnswered.set(res.data.digitalAnswered);
        } else {
          this.error.set(res.message ?? '載入失敗');
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set('系統忙線，請稍後再試');
      },
    });
  }

  remove(q: MemberQuestionnaireLink): void {
    if (!confirm(`確定刪除「${q.questionTypeTitle}」掃描檔？`)) return;
    this.api.deleteQuestionUpload(q.linkId).subscribe({
      next: (res) => {
        if (res.success) this.load();
        else this.error.set(res.message ?? '刪除失敗');
      },
      error: () => this.error.set('刪除失敗'),
    });
  }
}
