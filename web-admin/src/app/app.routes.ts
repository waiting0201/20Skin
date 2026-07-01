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

      // 權限管理（對應舊 AuthorityMs）
      {
        path: 'authority/admins',
        loadComponent: () => import('./pages/authority/admins-list').then((m) => m.AdminsListComponent),
        canActivate: [permGuard],
        data: { perm: { key: 'Admins', op: 'read' } },
      },
      {
        path: 'authority/admins/new',
        loadComponent: () => import('./pages/authority/admin-form').then((m) => m.AdminFormComponent),
        canActivate: [permGuard],
        data: { perm: { key: 'Admins', op: 'add' } },
      },
      {
        path: 'authority/admins/:id/edit',
        loadComponent: () => import('./pages/authority/admin-form').then((m) => m.AdminFormComponent),
        canActivate: [permGuard],
        data: { perm: { key: 'Admins', op: 'update' } },
      },

      // 未建模組佔位（basic/roster/reserve/member 逐一補齊）
      { path: 'coming-soon', loadComponent: () => import('./pages/coming-soon').then((m) => m.ComingSoonComponent) },
      { path: 'forbidden', loadComponent: () => import('./pages/forbidden').then((m) => m.ForbiddenComponent) },
      // TODO: basic / roster / reserve / member 模組（見 admin-*.md），各帶 data.perm
    ],
  },
  { path: '**', redirectTo: '' },
];
