import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiResponse,
  AppointmentAdminDetail,
  AppointmentAdminListResult,
  CapacityUpdateRequest,
  QuestionnaireExportResult,
} from '../models';

/**
 * 預約分院別名 → 後端路由段（對應舊 ReserveMsController 3 組變體，見 docs/blueprints/admin-reserve.md）。
 * 只有 3 組（非時段/排班常見的 5 組）：Ta/Ch 各自用 clinic 查詢參數在 Skin/Cosmetic 間切換（同一頁面），
 * chDentist 固定 clinic=Dentist、無 clinic/category 篩選。
 */
const RESERVE_SLUG: Record<string, string> = { ta: 'ta', ch: 'ch', chDentist: 'ch-dentist' };

function reserveSlug(branch: string): string {
  const slug = RESERVE_SLUG[branch];
  if (!slug) throw new Error(`未知的預約分院：${branch}`);
  return slug;
}

/** 分院別名 → Lims Resource key（供 auth.can() 判斷按鈕顯示；權限粒度只到分院，非分院+診別）。 */
const RESERVE_RESOURCE: Record<string, string> = {
  ta: 'TaAppointments',
  ch: 'ChAppointments',
  chDentist: 'ChDentistAppointments',
};

export function reserveResourceKey(branch: string): string {
  return RESERVE_RESOURCE[branch] ?? '';
}

/** 分院別名 → 舊系統頁面標題，完全沿用舊 View 用詞（真實 DB Lims.Value 已查證）。 */
const RESERVE_LABEL: Record<string, string> = {
  ta: '台中預約維護',
  ch: '二林預約維護',
  chDentist: '二林齒科預約',
};

export function reserveLabel(branch: string): string {
  return RESERVE_LABEL[branch] ?? '預約維護';
}

/**
 * 後台預約管理 API：查詢/詳情/取消/容量批次更新/匯出。見 docs/blueprints/admin-reserve.md。
 * ch-dentist 呼叫時不帶 clinic/categoryId query 參數（後端該 proxy 簽章本就不接受這兩個參數）。
 */
@Injectable({ providedIn: 'root' })
export class ReserveApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase;

  list(
    branch: string,
    clinic: string | null,
    categoryId: string | null,
    appointmentDate: string | null,
    memberNumber: string | null,
    memberMobile: string | null,
    memberName: string | null,
    birthday: string | null,
    page: number,
  ): Observable<ApiResponse<AppointmentAdminListResult>> {
    const params = new URLSearchParams();
    const isDentist = branch === 'chDentist';
    if (!isDentist && clinic) params.set('clinic', clinic);
    if (!isDentist && categoryId) params.set('categoryId', categoryId);
    if (appointmentDate) params.set('appointmentDate', appointmentDate);
    if (memberNumber) params.set('memberNumber', memberNumber);
    if (memberMobile) params.set('memberMobile', memberMobile);
    if (memberName) params.set('memberName', memberName);
    if (birthday) params.set('birthday', birthday);
    params.set('page', String(page));
    return this.http.get<ApiResponse<AppointmentAdminListResult>>(
      `${this.base}/admin/appointments/${reserveSlug(branch)}?${params.toString()}`,
    );
  }

  detail(branch: string, id: string): Observable<ApiResponse<AppointmentAdminDetail>> {
    return this.http.get<ApiResponse<AppointmentAdminDetail>>(`${this.base}/admin/appointments/${reserveSlug(branch)}/${id}`);
  }

  cancel(branch: string, id: string): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/admin/appointments/${reserveSlug(branch)}/${id}/cancel`, {});
  }

  updateCapacity(branch: string, req: CapacityUpdateRequest): Observable<ApiResponse<unknown>> {
    return this.http.put<ApiResponse<unknown>>(`${this.base}/admin/appointments/${reserveSlug(branch)}/capacity`, req);
  }

  /** 簽到單 Excel（.xlsx）匯出，回傳含 body(Blob) 的完整 HttpResponse 供讀取 Content-Disposition 檔名。 */
  exportCheckin(branch: string, clinic: string | null, appointmentDate: string): Observable<HttpResponse<Blob>> {
    const params = new URLSearchParams();
    if (branch !== 'chDentist' && clinic) params.set('clinic', clinic);
    params.set('appointmentDate', appointmentDate);
    return this.http.get(`${this.base}/admin/appointments/${reserveSlug(branch)}/export/checkin?${params.toString()}`, {
      responseType: 'blob',
      observe: 'response',
    });
  }

  exportQuestionnaire(branch: string, clinic: string | null, appointmentDate: string): Observable<ApiResponse<QuestionnaireExportResult>> {
    const params = new URLSearchParams();
    if (branch !== 'chDentist' && clinic) params.set('clinic', clinic);
    params.set('appointmentDate', appointmentDate);
    return this.http.get<ApiResponse<QuestionnaireExportResult>>(
      `${this.base}/admin/appointments/${reserveSlug(branch)}/export/questionnaire?${params.toString()}`,
    );
  }
}
