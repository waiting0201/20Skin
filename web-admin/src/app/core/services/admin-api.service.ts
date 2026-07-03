import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdminDetail,
  AdminListItem,
  AdminUpsertRequest,
  ApiResponse,
  LimNode,
  MenuNode,
  PagedResult,
} from '../models';

/**
 * 後台管理 API：資料驅動選單 + 權限管理（Admins CRUD + 權限樹）。
 * 對應 API AdminController（見 docs/design/api-design.md）。
 */
@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase;

  /** 資料驅動左側選單（依當前管理員權限過濾）。 */
  menu(): Observable<ApiResponse<MenuNode[]>> {
    return this.http.get<ApiResponse<MenuNode[]>>(`${this.base}/admin/menu`);
  }

  /** 分頁列表（pageSize 固定 20，見 docs/design/frontend-backend.md §分頁規範）。 */
  listAdmins(page = 1): Observable<ApiResponse<PagedResult<AdminListItem>>> {
    return this.http.get<ApiResponse<PagedResult<AdminListItem>>>(`${this.base}/admins?page=${page}`);
  }

  getAdmin(id: string): Observable<ApiResponse<AdminDetail>> {
    return this.http.get<ApiResponse<AdminDetail>>(`${this.base}/admins/${id}`);
  }

  /** 新增表單用的空權限樹。 */
  limsTree(): Observable<ApiResponse<LimNode[]>> {
    return this.http.get<ApiResponse<LimNode[]>>(`${this.base}/lims`);
  }

  checkUsername(username: string, excludeId?: string): Observable<ApiResponse<{ exists: boolean }>> {
    const q = new URLSearchParams({ username });
    if (excludeId) q.set('excludeId', excludeId);
    return this.http.get<ApiResponse<{ exists: boolean }>>(`${this.base}/admin/check-username?${q.toString()}`);
  }

  createAdmin(req: AdminUpsertRequest): Observable<ApiResponse<AdminDetail>> {
    return this.http.post<ApiResponse<AdminDetail>>(`${this.base}/admins`, req);
  }

  updateAdmin(id: string, req: AdminUpsertRequest): Observable<ApiResponse<AdminDetail>> {
    return this.http.put<ApiResponse<AdminDetail>>(`${this.base}/admins/${id}`, req);
  }

  deleteAdmin(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/admins/${id}`);
  }
}
