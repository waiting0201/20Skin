import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminPerm, ApiResponse, PermOp } from '../models';

export interface AdminLoginRequest {
  username: string;
  password: string;
  googleCaptchaToken: string;
}

export interface AdminLoginResult {
  token: string;
}

interface JwtPayload {
  sub?: string;
  name?: string;
  is_super_admin?: boolean;
  perms?: AdminPerm[];
  exp?: number;
}

const TOKEN_KEY = 'skin_admin_token';

/**
 * 後台認證。登入取得 JWT（含攤平權限），前端據此控制選單/進頁體驗。
 * 授權真相在 API（見 docs/design/security.md、blueprints/admin-auth-authority.md）。
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  readonly isLoggedIn = computed(() => !!this._token());
  readonly payload = computed<JwtPayload | null>(() => this.decode(this._token()));
  readonly perms = computed<AdminPerm[]>(() => this.payload()?.perms ?? []);
  readonly isSuperAdmin = computed(() => this.payload()?.is_super_admin === true);
  readonly name = computed(() => this.payload()?.name ?? '');

  login(req: AdminLoginRequest): Observable<ApiResponse<AdminLoginResult>> {
    return this.http
      .post<ApiResponse<AdminLoginResult>>(`${environment.apiBase}/auth/admin/login`, req)
      .pipe(tap((res) => {
        if (res.success && res.data?.token) this.setToken(res.data.token);
      }));
  }

  /** 是否對某資源具備某操作權限（超管全放行）。 */
  can(resourceKey: string, op: PermOp = 'read'): boolean {
    if (this.isSuperAdmin()) return true;
    const p = this.perms().find((x) => x.key === resourceKey);
    if (!p) return false;
    return op === 'read' ? true : op === 'add' ? p.add : op === 'update' ? p.update : p.delete;
  }

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    this._token.set(token);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this._token.set(null);
    this.router.navigate(['/login']);
  }

  private decode(token: string | null): JwtPayload | null {
    if (!token) return null;
    try {
      const payload = token.split('.')[1];
      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decodeURIComponent(escape(json)));
    } catch {
      return null;
    }
  }
}
