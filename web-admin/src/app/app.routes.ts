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

      // 基礎資料（對應舊 BasicMs）— 分院/醫師（Phase 1）；Periods/Categorys/QuestionTypes 依後續 Phase 補齊
      {
        path: 'basic/branches',
        loadComponent: () => import('./pages/basic/branches-list').then((m) => m.BranchesListComponent),
        canActivate: [permGuard],
        data: { perm: { key: 'Branchs', op: 'read' } },
      },
      {
        path: 'basic/branches/new',
        loadComponent: () => import('./pages/basic/branch-form').then((m) => m.BranchFormComponent),
        canActivate: [permGuard],
        data: { perm: { key: 'Branchs', op: 'add' } },
      },
      {
        path: 'basic/branches/:id/edit',
        loadComponent: () => import('./pages/basic/branch-form').then((m) => m.BranchFormComponent),
        canActivate: [permGuard],
        data: { perm: { key: 'Branchs', op: 'update' } },
      },
      {
        path: 'basic/doctors',
        loadComponent: () => import('./pages/basic/doctors-list').then((m) => m.DoctorsListComponent),
        canActivate: [permGuard],
        data: { perm: { key: 'Doctors', op: 'read' } },
      },
      {
        path: 'basic/doctors/new',
        loadComponent: () => import('./pages/basic/doctor-form').then((m) => m.DoctorFormComponent),
        canActivate: [permGuard],
        data: { perm: { key: 'Doctors', op: 'add' } },
      },
      {
        path: 'basic/doctors/:id/edit',
        loadComponent: () => import('./pages/basic/doctor-form').then((m) => m.DoctorFormComponent),
        canActivate: [permGuard],
        data: { perm: { key: 'Doctors', op: 'update' } },
      },

      // 時段（對應舊 Ta/TaCosmetic/Ch/ChCosmetic/ChDentistPeriods，clinic 參數化收斂為單一元件，見 basic-data-api.service.ts）。
      // 5 個舊變體權限粒度不同，資源 key 依 ?branch=&clinic= 動態決定，故不掛靜態 data.perm；
      // 前端只做登入檢查 + 依 auth.can(resourceKey) 控制按鈕顯示，授權真相仍在 API（見 admin-auth-authority.md）。
      {
        path: 'basic/periods',
        loadComponent: () => import('./pages/basic/periods-list').then((m) => m.PeriodsListComponent),
        canActivate: [permGuard],
      },
      {
        path: 'basic/periods/new',
        loadComponent: () => import('./pages/basic/period-form').then((m) => m.PeriodFormComponent),
        canActivate: [permGuard],
      },
      {
        path: 'basic/periods/:id/edit',
        loadComponent: () => import('./pages/basic/period-form').then((m) => m.PeriodFormComponent),
        canActivate: [permGuard],
      },

      // 科別項目（對應舊 Skins/Cosmetics，clinic 參數化收斂為單一元件；資源 key 動態，同 Periods 不掛靜態 data.perm）
      {
        path: 'basic/categories',
        loadComponent: () => import('./pages/basic/categories-list').then((m) => m.CategoriesListComponent),
        canActivate: [permGuard],
      },
      {
        path: 'basic/categories/new',
        loadComponent: () => import('./pages/basic/category-form').then((m) => m.CategoryFormComponent),
        canActivate: [permGuard],
      },
      {
        path: 'basic/categories/:id/edit',
        loadComponent: () => import('./pages/basic/category-form').then((m) => m.CategoryFormComponent),
        canActivate: [permGuard],
      },

      // 問卷類型 + 題目（對應舊 QuestionTypes/Questions；真實 Lims 無獨立 Questions key，
      // 兩者皆用 auth.can('QuestionTypes', op)，data.perm 統一指向 QuestionTypes）
      {
        path: 'basic/question-types',
        loadComponent: () => import('./pages/basic/question-types-list').then((m) => m.QuestionTypesListComponent),
        canActivate: [permGuard],
        data: { perm: { key: 'QuestionTypes', op: 'read' } },
      },
      {
        path: 'basic/question-types/new',
        loadComponent: () => import('./pages/basic/question-type-form').then((m) => m.QuestionTypeFormComponent),
        canActivate: [permGuard],
        data: { perm: { key: 'QuestionTypes', op: 'add' } },
      },
      {
        path: 'basic/question-types/:id/edit',
        loadComponent: () => import('./pages/basic/question-type-form').then((m) => m.QuestionTypeFormComponent),
        canActivate: [permGuard],
        data: { perm: { key: 'QuestionTypes', op: 'update' } },
      },
      {
        path: 'basic/question-types/:questionTypeId/questions',
        loadComponent: () => import('./pages/basic/questions-list').then((m) => m.QuestionsListComponent),
        canActivate: [permGuard],
        data: { perm: { key: 'QuestionTypes', op: 'read' } },
      },
      {
        path: 'basic/question-types/:questionTypeId/questions/new',
        loadComponent: () => import('./pages/basic/question-form').then((m) => m.QuestionFormComponent),
        canActivate: [permGuard],
        data: { perm: { key: 'QuestionTypes', op: 'add' } },
      },
      {
        path: 'basic/question-types/:questionTypeId/questions/:id/edit',
        loadComponent: () => import('./pages/basic/question-form').then((m) => m.QuestionFormComponent),
        canActivate: [permGuard],
        data: { perm: { key: 'QuestionTypes', op: 'update' } },
      },

      // 排班（對應舊 ShiftMs；資源 key 動態決定，同 Periods/Categorys 不掛靜態 data.perm）
      {
        path: 'roster',
        loadComponent: () => import('./pages/roster/rosters-list').then((m) => m.RostersListComponent),
        canActivate: [permGuard],
      },
      {
        path: 'roster/new',
        loadComponent: () => import('./pages/roster/roster-form').then((m) => m.RosterFormComponent),
        canActivate: [permGuard],
      },
      {
        path: 'roster/:id/edit',
        loadComponent: () => import('./pages/roster/roster-form').then((m) => m.RosterFormComponent),
        canActivate: [permGuard],
      },

      // 會員管理（對應舊 MemberMs）
      {
        path: 'member',
        loadComponent: () => import('./pages/member/members-list').then((m) => m.MembersListComponent),
        canActivate: [permGuard],
        data: { perm: { key: 'Members', op: 'read' } },
      },
      {
        path: 'member/:id/edit',
        loadComponent: () => import('./pages/member/member-form').then((m) => m.MemberFormComponent),
        canActivate: [permGuard],
        data: { perm: { key: 'Members', op: 'update' } },
      },
      {
        path: 'member/:id/questionnaires',
        loadComponent: () => import('./pages/member/member-questionnaires').then((m) => m.MemberQuestionnairesComponent),
        canActivate: [permGuard],
        data: { perm: { key: 'Members', op: 'read' } },
      },
      {
        path: 'member/:id/questionnaires/new',
        loadComponent: () => import('./pages/member/member-questionnaire-form').then((m) => m.MemberQuestionnaireFormComponent),
        canActivate: [permGuard],
        data: { perm: { key: 'Members', op: 'add' } },
      },
      {
        path: 'member/:id/questionnaires/:linkId/edit',
        loadComponent: () => import('./pages/member/member-questionnaire-form').then((m) => m.MemberQuestionnaireFormComponent),
        canActivate: [permGuard],
        data: { perm: { key: 'Members', op: 'update' } },
      },
      {
        path: 'member/:id/questionnaires/:questionTypeId/view',
        loadComponent: () => import('./pages/member/member-questionnaire-view').then((m) => m.MemberQuestionnaireViewComponent),
        canActivate: [permGuard],
        data: { perm: { key: 'Members', op: 'read' } },
      },

      // 預約管理（對應舊 ReserveMs；資源 key 動態決定，同 Periods/Categorys/Rosters 不掛靜態 data.perm）
      {
        path: 'reserve',
        loadComponent: () => import('./pages/reserve/reserve-list').then((m) => m.ReserveListComponent),
        canActivate: [permGuard],
      },
      {
        path: 'reserve/print/questionnaire',
        loadComponent: () => import('./pages/reserve/questionnaire-print').then((m) => m.QuestionnairePrintComponent),
        canActivate: [permGuard],
      },
      {
        path: 'reserve/:id',
        loadComponent: () => import('./pages/reserve/appointment-detail').then((m) => m.AppointmentDetailComponent),
        canActivate: [permGuard],
      },

      // 未建模組佔位
      { path: 'coming-soon', loadComponent: () => import('./pages/coming-soon').then((m) => m.ComingSoonComponent) },
      { path: 'forbidden', loadComponent: () => import('./pages/forbidden').then((m) => m.ForbiddenComponent) },
    ],
  },
  { path: '**', redirectTo: '' },
];
