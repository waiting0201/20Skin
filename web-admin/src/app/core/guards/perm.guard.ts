import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { PermOp } from '../models';

/**
 * 權限 guard：route.data.perm = { key, op } 指定所需權限。
 * 未登入 → /login；權限不足 → /forbidden。授權真相仍在 API。
 * 見 docs/design/frontend-backend.md、blueprints/admin-auth-authority.md。
 */
export const permGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    router.navigate(['/login']);
    return false;
  }
  const need = route.data?.['perm'] as { key: string; op?: PermOp } | undefined;
  if (need && !auth.can(need.key, need.op ?? 'read')) {
    router.navigate(['/forbidden']);
    return false;
  }
  return true;
};
