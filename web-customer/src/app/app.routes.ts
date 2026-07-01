import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

/**
 * 舊系統 `/MainMs/{action}` URL 後方相容（舊為 MVC 標準路由，預設 controller=MainMs）。
 * 目的：舊書籤（尤以 `/MainMs/Login` 為主）仍能連到新 SPA 對應頁面，不會 404。
 * 帶 `?AppointmentID=` 的舊頁面以函式型 redirect 轉成新的 `:id` 路徑；未重建的頁面導向最接近的入口。
 * ⚠️ 正式部署（Static Web Apps）需在 staticwebapp.config.json 設 navigationFallback → index.html，
 *    伺服器才會把 `/MainMs/*` 交給 SPA 由此路由處理（見 docs/design/frontend-customer.md）。
 */
const legacyRoutes: Routes = [
  { path: 'MainMs', pathMatch: 'full', redirectTo: '' },
  { path: 'MainMs/Index', redirectTo: '' },
  { path: 'MainMs/Login', redirectTo: 'login' },
  { path: 'MainMs/Clinic', redirectTo: 'booking/clinic' },
  { path: 'MainMs/Category', redirectTo: 'booking/category' },
  { path: 'MainMs/AppointmentForm', redirectTo: 'booking/appointment-form' },
  { path: 'MainMs/Appointment', redirectTo: 'appointments' },
  // 帶 ?AppointmentID= 的舊 URL → 新 :id 路徑（無 id 則退回清單/首頁）
  { path: 'MainMs/Complete', redirectTo: ({ queryParams }) => (queryParams['AppointmentID'] ? `/booking/complete/${queryParams['AppointmentID']}` : '/appointments') },
  { path: 'MainMs/AppointmentDetail', redirectTo: ({ queryParams }) => (queryParams['AppointmentID'] ? `/appointments/${queryParams['AppointmentID']}` : '/appointments') },
  { path: 'MainMs/AppointmentCancel', redirectTo: ({ queryParams }) => (queryParams['AppointmentID'] ? `/appointments/${queryParams['AppointmentID']}` : '/appointments') },
  // 尚未重建的舊頁面 → 導向最接近的既有入口
  { path: 'MainMs/JoinUs', redirectTo: 'login' },
  { path: 'MainMs/QuestionTypes', redirectTo: '' },
  { path: 'MainMs/Questions', redirectTo: '' },
  { path: 'MainMs/QuestionComplete', redirectTo: '' },
];

/** 客戶前台路由（對應舊 Views/MainMs，見 docs/design/frontend-customer.md）。 */
export const routes: Routes = [
  ...legacyRoutes,

  { path: 'login', loadComponent: () => import('./pages/login/login').then((m) => m.LoginComponent) },

  { path: '', canActivate: [authGuard], loadComponent: () => import('./pages/index/index').then((m) => m.IndexComponent) },
  {
    path: 'booking',
    canActivate: [authGuard],
    children: [
      { path: 'clinic', loadComponent: () => import('./pages/clinic/clinic').then((m) => m.ClinicComponent) },
      { path: 'category', loadComponent: () => import('./pages/category/category').then((m) => m.CategoryComponent) },
      { path: 'appointment-form', loadComponent: () => import('./pages/appointment-form/appointment-form').then((m) => m.AppointmentFormComponent) },
      { path: 'complete/:id', loadComponent: () => import('./pages/complete/complete').then((m) => m.CompleteComponent) },
    ],
  },
  {
    path: 'appointments',
    canActivate: [authGuard],
    children: [
      { path: '', loadComponent: () => import('./pages/appointment-list/appointment-list').then((m) => m.AppointmentListComponent) },
      { path: ':id', loadComponent: () => import('./pages/appointment-detail/appointment-detail').then((m) => m.AppointmentDetailComponent) },
    ],
  },
  { path: '**', redirectTo: '' },
];
