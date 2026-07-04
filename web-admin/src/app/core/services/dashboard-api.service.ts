import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, Dashboard } from '../models';

/**
 * 後台儀表板 API。單一端點、任何管理員可呼叫；回應區塊依可讀權限過濾
 * （後端 DashboardAdminController，見 docs/blueprints/admin-dashboard.md）。
 */
@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private readonly http = inject(HttpClient);

  get(): Observable<ApiResponse<Dashboard>> {
    return this.http.get<ApiResponse<Dashboard>>(`${environment.apiBase}/admin/dashboard`);
  }
}
