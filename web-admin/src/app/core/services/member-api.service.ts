import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiResponse,
  MemberDetail,
  MemberListItem,
  MemberQuestionUpsertRequest,
  MemberQuestionnaires,
  MemberUpdateRequest,
  PagedResult,
  QuestionForm,
} from '../models';

/**
 * 後台會員管理 API（對應舊 MemberMsController）。路徑走 admin/ 前綴。
 * 見 docs/blueprints/admin-member.md。
 */
@Injectable({ providedIn: 'root' })
export class MemberApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase;

  list(page = 1, branchId?: string, number?: string, birthday?: string): Observable<ApiResponse<PagedResult<MemberListItem>>> {
    const params = new URLSearchParams({ page: String(page) });
    if (branchId) params.set('branchId', branchId);
    if (number) params.set('number', number);
    if (birthday) params.set('birthday', birthday);
    return this.http.get<ApiResponse<PagedResult<MemberListItem>>>(`${this.base}/admin/members?${params}`);
  }

  get(id: string): Observable<ApiResponse<MemberDetail>> {
    return this.http.get<ApiResponse<MemberDetail>>(`${this.base}/admin/members/${id}`);
  }

  update(id: string, req: MemberUpdateRequest): Observable<ApiResponse<MemberDetail>> {
    return this.http.put<ApiResponse<MemberDetail>>(`${this.base}/admin/members/${id}`, req);
  }

  /** 有預約或問卷紀錄即擋（後端回 MEMBER_IN_USE）。 */
  delete(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/admin/members/${id}`);
  }

  questionnaires(memberId: string): Observable<ApiResponse<MemberQuestionnaires>> {
    return this.http.get<ApiResponse<MemberQuestionnaires>>(`${this.base}/admin/members/${memberId}/questionnaires`);
  }

  viewQuestionnaire(memberId: string, questionTypeId: string): Observable<ApiResponse<QuestionForm>> {
    return this.http.get<ApiResponse<QuestionForm>>(
      `${this.base}/admin/members/${memberId}/questionnaires/${questionTypeId}/view`,
    );
  }

  createQuestionUpload(memberId: string, req: MemberQuestionUpsertRequest): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/admin/members/${memberId}/questionnaires`, req);
  }

  updateQuestionUpload(linkId: string, req: MemberQuestionUpsertRequest): Observable<ApiResponse<unknown>> {
    return this.http.put<ApiResponse<unknown>>(`${this.base}/admin/members/questionnaires/${linkId}`, req);
  }

  deleteQuestionUpload(linkId: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/admin/members/questionnaires/${linkId}`);
  }
}
