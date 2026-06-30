import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

/** 客戶前台路由（對應舊 Views/MainMs，見 docs/design/frontend-customer.md）。 */
export const routes: Routes = [
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
