import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiResponse,
  PagedResult,
  RosterAdmin,
  RosterCreateRequest,
  RosterCreateResult,
  RosterListItem,
  RosterUpdateRequest,
} from '../models';

/**
 * 排班分院別名 + 診別 → 後端路由段（對應 5 個舊變體：Ta/TaCosmetic/Ch/ChCosmetic/ChDentist）。
 * 與 basic-data-api.service.ts 的 PERIOD_SLUG 同一組別名語意（chDentist 是獨立分院，非 ch 的齒科診別）。
 */
const ROSTER_SLUG: Record<string, string> = {
  'ta:Skin': 'ta-skin',
  'ta:Cosmetic': 'ta-cosmetic',
  'ch:Skin': 'ch-skin',
  'ch:Cosmetic': 'ch-cosmetic',
  'chDentist:Dentist': 'ch-dentist',
};

function rosterSlug(branch: string, clinic: string): string {
  const slug = ROSTER_SLUG[`${branch}:${clinic}`];
  if (!slug) throw new Error(`未知的分院/診別組合：${branch}/${clinic}`);
  return slug;
}

const ROSTER_RESOURCE: Record<string, string> = {
  'ta:Skin': 'TaRosters',
  'ta:Cosmetic': 'TaCosmeticRosters',
  'ch:Skin': 'ChRosters',
  'ch:Cosmetic': 'ChCosmeticRosters',
  'chDentist:Dentist': 'ChDentistRosters',
};

export function rosterResourceKey(branch: string, clinic: string): string {
  return ROSTER_RESOURCE[`${branch}:${clinic}`] ?? '';
}

/** 分院別名+診別 → 舊系統頁面標題（「新增台中健保門診」等），完全沿用舊 View 用詞。 */
const ROSTER_LABEL: Record<string, string> = {
  'ta:Skin': '台中健保門診',
  'ta:Cosmetic': '台中美容門診',
  'ch:Skin': '二林健保門診',
  'ch:Cosmetic': '二林美容門診',
  'chDentist:Dentist': '二林齒科門診',
};

export function rosterLabel(branch: string, clinic: string): string {
  return ROSTER_LABEL[`${branch}:${clinic}`] ?? '排班';
}

/** 後台排班 API（分院/醫師/時段/科別項目沿用 BasicDataApiService）。見 docs/blueprints/admin-roster.md。 */
@Injectable({ providedIn: 'root' })
export class RosterApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase;

  listRosters(
    branch: string,
    clinic: string,
    date: string | null,
    doctorId: string | null,
    page: number,
  ): Observable<ApiResponse<PagedResult<RosterListItem>>> {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (doctorId) params.set('doctorId', doctorId);
    params.set('page', String(page));
    return this.http.get<ApiResponse<PagedResult<RosterListItem>>>(
      `${this.base}/admin/rosters/${rosterSlug(branch, clinic)}?${params.toString()}`,
    );
  }

  getRoster(branch: string, clinic: string, id: string): Observable<ApiResponse<RosterAdmin>> {
    return this.http.get<ApiResponse<RosterAdmin>>(`${this.base}/admin/rosters/${rosterSlug(branch, clinic)}/${id}`);
  }

  createRoster(branch: string, clinic: string, req: RosterCreateRequest): Observable<ApiResponse<RosterCreateResult>> {
    return this.http.post<ApiResponse<RosterCreateResult>>(`${this.base}/admin/rosters/${rosterSlug(branch, clinic)}`, req);
  }

  updateRoster(branch: string, clinic: string, id: string, req: RosterUpdateRequest): Observable<ApiResponse<unknown>> {
    return this.http.put<ApiResponse<unknown>>(`${this.base}/admin/rosters/${rosterSlug(branch, clinic)}/${id}`, req);
  }

  deleteRoster(branch: string, clinic: string, id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/admin/rosters/${rosterSlug(branch, clinic)}/${id}`);
  }
}
