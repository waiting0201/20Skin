import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models';

/** 會員登入請求（身分證+生日，見 docs/blueprints/member-auth.md）。 */
export interface MemberLoginRequest {
  number: string;
  yyyy: number;
  mm: number;
  dd: number;
  googleCaptchaToken: string;
}

export interface LoginResult {
  status: 1 | 2 | 3; // 1=成功 / 2=新客 / 3=黑名單
  token?: string;
  memberId?: string;
  isFirstVisit?: boolean;
  message?: string;
}

/** 初診註冊請求（JoinUs，見 docs/blueprints/member-auth.md）。 */
export interface RegisterMemberRequest {
  number: string;
  yyyy: number;
  mm: number;
  dd: number;
  name: string;
  mobile: string;
  gender: number | null;
  bloodType: string | null;
  email: string | null;
  zipcodeId: number | null;
  address: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  allergy: string[];
  allergyOther: string | null;
  medicalHistory: string[];
  medicalHistoryOther: string | null;
  googleCaptchaToken: string;
}

const TOKEN_KEY = 'skin_token';
const FIRST_VISIT_KEY = 'skin_first_visit';

/**
 * 會員認證。token 存 localStorage，登入狀態以 signal 暴露。
 * 授權真相在 API；前端僅體驗（見 docs/design/security.md）。
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  readonly token = this._token.asReadonly();
  readonly isLoggedIn = computed(() => !!this._token());

  /** 初診/複診（對應舊 Session VisitTitle），登入/註冊時設定，供預約流程麵包屑顯示。 */
  private readonly _isFirstVisit = signal<boolean | null>(readFirstVisit());
  readonly visitTitle = computed(() => {
    if (!this.isLoggedIn() || this._isFirstVisit() === null) return '';
    return this._isFirstVisit() ? '初診' : '複診';
  });

  login(req: MemberLoginRequest): Observable<ApiResponse<LoginResult>> {
    return this.http
      .post<ApiResponse<LoginResult>>(`${environment.apiBase}/auth/member/login`, req)
      .pipe(tap((res) => {
        if (res.success && res.data?.token) this.setToken(res.data.token);
        if (res.success && res.data?.isFirstVisit !== undefined) this.setFirstVisit(res.data.isFirstVisit);
      }));
  }

  /** 初診註冊 → 成功即為登入態（後端回 JWT）。 */
  register(req: RegisterMemberRequest): Observable<ApiResponse<LoginResult>> {
    return this.http
      .post<ApiResponse<LoginResult>>(`${environment.apiBase}/auth/member/register`, req)
      .pipe(tap((res) => {
        if (res.success && res.data?.token) this.setToken(res.data.token);
        if (res.success && res.data?.isFirstVisit !== undefined) this.setFirstVisit(res.data.isFirstVisit);
      }));
  }

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    this._token.set(token);
  }

  private setFirstVisit(value: boolean): void {
    localStorage.setItem(FIRST_VISIT_KEY, JSON.stringify(value));
    this._isFirstVisit.set(value);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(FIRST_VISIT_KEY);
    this._token.set(null);
    this._isFirstVisit.set(null);
    this.router.navigate(['/login']);
  }
}

function readFirstVisit(): boolean | null {
  const raw = localStorage.getItem(FIRST_VISIT_KEY);
  return raw === null ? null : (JSON.parse(raw) as boolean);
}
