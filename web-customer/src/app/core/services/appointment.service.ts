import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiResponse, AppointmentDetail, CreateAppointmentRequest, CreateAppointmentResult, PagedAppointments,
} from '../models';

/** 預約寫入/查詢 API（見 docs/blueprints/customer-booking.md）。 */
@Injectable({ providedIn: 'root' })
export class AppointmentService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase;

  create(req: CreateAppointmentRequest): Observable<ApiResponse<CreateAppointmentResult>> {
    return this.http.post<ApiResponse<CreateAppointmentResult>>(`${this.base}/appointments`, req);
  }

  mine(page = 1, pageSize = 15): Observable<PagedAppointments> {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http
      .get<ApiResponse<PagedAppointments>>(`${this.base}/appointments`, { params })
      .pipe(map((r) => r.data as PagedAppointments));
  }

  detail(id: string): Observable<ApiResponse<AppointmentDetail>> {
    return this.http.get<ApiResponse<AppointmentDetail>>(`${this.base}/appointments/${id}`);
  }

  cancel(id: string): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/appointments/${id}/cancel`, {});
  }
}
