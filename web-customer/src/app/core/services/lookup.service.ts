import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, Zipcode } from '../models';

/** 公開參照資料（免登入）：郵遞區號等。 */
@Injectable({ providedIn: 'root' })
export class LookupService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase;

  /** 郵遞區號（城市→區→ZipcodeID），供註冊城市/區連動。 */
  zipcodes(): Observable<Zipcode[]> {
    return this.http.get<ApiResponse<Zipcode[]>>(`${this.base}/zipcodes`).pipe(
      map((r) => {
        if (!r.success) throw new Error(r.message ?? 'API error');
        return r.data as Zipcode[];
      }),
    );
  }
}
