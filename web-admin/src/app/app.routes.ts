import { Routes } from '@angular/router';
import { permGuard } from './core/guards/perm.guard';

/**
 * 後台路由（對應舊六模組，見 docs/design/frontend-backend.md）。
 * 受保護路由走 admin-layout + permGuard；各模組頁面待建立。
 */
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.LoginComponent),
  },
  {
    path: '',
    loadComponent: () => import('./layout/admin-layout').then((m) => m.AdminLayoutComponent),
    canActivate: [permGuard],
    children: [
      { path: '', loadComponent: () => import('./pages/dashboard').then((m) => m.DashboardComponent) },
      // TODO: authority / basic / roster / reserve / member 模組（見 admin-*.md），各帶 data.perm
    ],
  },
  { path: '**', redirectTo: '' },
];
