import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, QuestionForm, QuestionnaireCategory, SaveMemberQuestionsRequest } from '../models';

/** 問卷（術前電子病歷）API（見 docs/blueprints/questionnaire.md）。 */
@Injectable({ providedIn: 'root' })
export class QuestionnaireService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase;

  private unwrap<T>() {
    return map((r: ApiResponse<T>): T => {
      if (!r.success) throw new Error(r.message ?? 'API error');
      return r.data as T;
    });
  }

  /** 有啟用問卷的項目清單（可依 clinic 或 categoryId 過濾），含已作答旗標。 */
  categories(opts: { clinic?: string; categoryId?: string } = {}): Observable<QuestionnaireCategory[]> {
    let params = new HttpParams();
    if (opts.clinic) params = params.set('clinic', opts.clinic);
    if (opts.categoryId) params = params.set('categoryId', opts.categoryId);
    return this.http
      .get<ApiResponse<QuestionnaireCategory[]>>(`${this.base}/question-types`, { params })
      .pipe(this.unwrap<QuestionnaireCategory[]>());
  }

  /** 單份問卷表單（題目 + 選項 + 既有作答 pre-fill）。 */
  form(questionTypeId: string): Observable<QuestionForm> {
    return this.http
      .get<ApiResponse<QuestionForm>>(`${this.base}/question-types/${questionTypeId}`)
      .pipe(this.unwrap<QuestionForm>());
  }

  /** 提交作答。 */
  submit(req: SaveMemberQuestionsRequest): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/member-questions`, req);
  }
}
