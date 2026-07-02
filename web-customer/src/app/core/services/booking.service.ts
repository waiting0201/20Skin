import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, Branch, Category, Doctor, TimeSlot } from '../models';

/** 預約讀取面 API（見 docs/design/api-design.md）。 */
@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase;

  private unwrap<T>() {
    return map((r: ApiResponse<T>): T => {
      if (!r.success) throw new Error(r.message ?? 'API error');
      return r.data as T;
    });
  }

  branches(): Observable<Branch[]> {
    return this.http.get<ApiResponse<Branch[]>>(`${this.base}/branches`).pipe(this.unwrap<Branch[]>());
  }

  categories(branchId: string, clinic: string): Observable<Category[]> {
    const params = new HttpParams().set('branchId', branchId).set('clinic', clinic);
    return this.http.get<ApiResponse<Category[]>>(`${this.base}/categories`, { params }).pipe(this.unwrap<Category[]>());
  }

  /** doctorId 有值 → 指定醫師時段（IsAppointment=1）；不帶 → 不指定（IsAppointment=0）。 */
  timeSlots(branchId: string, clinic: string, categoryId: string, date: string, doctorId?: string): Observable<TimeSlot[]> {
    let params = new HttpParams().set('branchId', branchId).set('clinic', clinic).set('categoryId', categoryId).set('date', date);
    if (doctorId) params = params.set('doctorId', doctorId);
    return this.http.get<ApiResponse<TimeSlot[]>>(`${this.base}/rosters`, { params }).pipe(this.unwrap<TimeSlot[]>());
  }

  doctors(branchId: string, clinic: string, categoryId: string, date: string): Observable<Doctor[]> {
    const params = new HttpParams().set('branchId', branchId).set('clinic', clinic).set('categoryId', categoryId).set('date', date);
    return this.http.get<ApiResponse<Doctor[]>>(`${this.base}/rosters/doctors`, { params }).pipe(this.unwrap<Doctor[]>());
  }

  checkAvailability(branchId: string, clinic: string, date: string): Observable<{ available: boolean; reason?: string }> {
    return this.http
      .post<ApiResponse<{ available: boolean; reason?: string }>>(`${this.base}/rosters/check-availability`, { branchId, clinic, date })
      .pipe(this.unwrap<{ available: boolean; reason?: string }>());
  }
}
