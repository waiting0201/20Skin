import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, UploadResult } from '../models';

/** 檔案上傳（Azure Blob，見 docs/blueprints/file-upload.md）。需登入（authInterceptor 帶 token）。 */
@Injectable({ providedIn: 'root' })
export class UploadService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase;

  /** 上傳圖片到指定資料夾（預設 appointments）→ 回 { filename, folder, url }。 */
  upload(file: File, folder = 'appointments'): Observable<UploadResult> {
    const form = new FormData();
    form.append('file', file);
    form.append('folder', folder);
    return this.http.post<ApiResponse<UploadResult>>(`${this.base}/uploads`, form).pipe(
      map((r) => {
        if (!r.success) throw new Error(r.message ?? '上傳失敗');
        return r.data as UploadResult;
      }),
    );
  }

  /** 由檔名組公開顯示 URL（沿用舊系統 ~/Upload/{folder}/{file} 的路徑結構）。 */
  photoUrl(filename: string | null | undefined, folder = 'appointments'): string | null {
    if (!filename) return null;
    if (/^https?:\/\//.test(filename)) return filename;
    return `${environment.uploadBase}/${folder}/${filename}`;
  }
}
