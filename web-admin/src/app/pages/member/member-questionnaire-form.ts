import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MemberApiService } from '../../core/services/member-api.service';
import { BasicDataApiService } from '../../core/services/basic-data-api.service';
import { BasicUploadService } from '../../core/services/basic-upload.service';
import { QuestionTypeAdmin } from '../../core/models';

/**
 * 後台會員管理 — 新增/編輯問卷掃描檔（對應舊 MemberMs/Add·EditMemberQAs.cshtml）。
 * 選問卷類型 + 上傳掃描檔（重用既有 POST /api/uploads?folder=memberquestions）。
 */
@Component({
  selector: 'app-member-questionnaire-form',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="bg-white rounded shadow-sm border border-hairline max-w-xl">
      <div class="px-5 py-3 border-b border-hairline">
        <h1 class="text-base font-semibold text-ink">
          <i class="fa fa-pencil-square-o text-muted mr-2"></i>{{ isEdit() ? '編輯問卷上傳' : '新增問卷上傳' }}
        </h1>
      </div>

      @if (error()) {
        <div class="mx-5 mt-4 text-sm text-red-500">{{ error() }}</div>
      }

      @if (loaded()) {
        <div class="p-5 space-y-4">
          <div>
            <label class="block text-sm font-medium text-ink mb-1">問卷 <span class="text-red-400">*</span></label>
            <select [(ngModel)]="questionTypeId"
                    class="w-full border border-hairline rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand">
              <option value="">請選擇問卷</option>
              @for (qt of questionTypes(); track qt.questionTypeId) {
                <option [value]="qt.questionTypeId">{{ qt.categoryTitle }} {{ qt.title }}</option>
              }
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-ink mb-1">掃描檔案 @if (!isEdit()) { <span class="text-red-400">*</span> }</label>
            @if (photoUrl(); as url) {
              <img [src]="url" class="max-w-[150px] mb-2" />
            }
            <input type="file" accept="image/*" (change)="onFileSelected($event)" />
            @if (uploading()) { <span class="text-xs text-muted ml-2">上傳中…</span> }
          </div>

          <div class="flex items-center gap-2 pt-2">
            <button (click)="submit()" [disabled]="saving()"
                    class="bg-brand text-white text-sm rounded px-4 py-2 hover:bg-brand-deep disabled:opacity-50">
              {{ saving() ? '儲存中…' : '確認' }}
            </button>
            <a [routerLink]="['/member', memberId, 'questionnaires']" class="text-sm text-muted hover:text-ink px-3 py-2">取消</a>
          </div>
        </div>
      }
    </div>
  `,
})
export class MemberQuestionnaireFormComponent {
  private readonly api = inject(MemberApiService);
  private readonly basicApi = inject(BasicDataApiService);
  private readonly upload = inject(BasicUploadService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly memberId = this.route.snapshot.paramMap.get('id')!;
  private readonly linkId = this.route.snapshot.paramMap.get('linkId');
  readonly isEdit = signal(!!this.linkId);

  readonly questionTypes = signal<QuestionTypeAdmin[]>([]);
  readonly loaded = signal(false);
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly error = signal<string | null>(null);
  readonly filename = signal<string | null>(null);

  questionTypeId = '';

  constructor() {
    this.basicApi.listQuestionTypes().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          // 忠於舊 AddMemberQAs/EditMemberQAs：.OrderBy(o => o.CategoryID).ThenBy(o => o.Sort)
          // ——先依科別分組（同科別問卷相鄰），組內再依排序；後端 API 目前只依全域 Sort 排序，跨科別會交錯。
          const sorted = [...res.data].sort((a, b) =>
            a.categoryId.localeCompare(b.categoryId) || a.sort - b.sort);
          this.questionTypes.set(sorted);
        }
      },
    });

    if (this.linkId) {
      this.api.questionnaires(this.memberId).subscribe({
        next: (res) => {
          const q = res.success ? res.data?.uploaded.find((x) => x.linkId === this.linkId) : undefined;
          if (q) {
            this.questionTypeId = q.questionTypeId;
            this.filename.set(q.filename);
            this.loaded.set(true);
          } else {
            this.error.set('找不到問卷上傳紀錄');
          }
        },
        error: () => this.error.set('系統忙線，請稍後再試'),
      });
    } else {
      this.loaded.set(true);
    }
  }

  photoUrl(): string | null {
    return this.upload.photoUrl(this.filename(), 'memberquestions');
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading.set(true);
    this.upload.upload(file, 'memberquestions').subscribe({
      next: (r) => { this.uploading.set(false); this.filename.set(r.filename); },
      error: () => { this.uploading.set(false); this.error.set('檔案上傳失敗'); },
    });
  }

  submit(): void {
    if (!this.questionTypeId) {
      this.error.set('請選擇問卷');
      return;
    }
    if (!this.isEdit() && !this.filename()) {
      this.error.set('請上傳掃描檔案');
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    const req = { questionTypeId: this.questionTypeId, filename: this.filename() };
    const call = this.linkId
      ? this.api.updateQuestionUpload(this.linkId, req)
      : this.api.createQuestionUpload(this.memberId, req);
    call.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) this.router.navigate(['/member', this.memberId, 'questionnaires']);
        else this.error.set(res.message ?? '儲存失敗');
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.message ?? '儲存失敗');
      },
    });
  }
}
