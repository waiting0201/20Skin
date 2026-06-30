import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/services/auth.service';

interface MenuItem {
  label: string;
  route: string;
  permKey: string; // 對應 perms.key；超管或具該 key 任一權限才顯示
}

/**
 * 後台版型（重現 SmartAdmin：深色側欄 + 內容區），選單依 JWT 權限過濾。
 * 見 docs/design/frontend-backend.md、visual-design.md。
 */
@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="flex min-h-screen">
      <aside class="w-64 bg-gray-900 text-white flex flex-col">
        <div class="h-16 flex items-center px-4 text-lg font-bold border-b border-gray-800">20Skin 管理</div>
        <nav class="flex-1 overflow-y-auto p-2 space-y-1">
          @for (item of visibleMenu(); track item.route) {
            <a [routerLink]="item.route" routerLinkActive="bg-blue-600"
               class="block px-3 py-2 rounded text-sm hover:bg-gray-800">{{ item.label }}</a>
          }
        </nav>
      </aside>
      <div class="flex-1 flex flex-col bg-gray-100">
        <header class="h-16 bg-white border-b flex items-center justify-between px-6">
          <span class="text-gray-600 text-sm">後台管理系統</span>
          <div class="flex items-center gap-3 text-sm">
            <span class="text-gray-700">{{ auth.name() }}</span>
            <button (click)="auth.logout()" class="text-gray-600 hover:text-blue-600">登出</button>
          </div>
        </header>
        <main class="flex-1 p-6"><router-outlet /></main>
      </div>
    </div>
  `,
})
export class AdminLayoutComponent {
  readonly auth = inject(AuthService);

  private readonly menu: MenuItem[] = [
    { label: '權限管理', route: '/authority/admins', permKey: 'Admins' },
    { label: '基礎資料', route: '/basic/branches', permKey: 'Branchs' },
    { label: '排班管理', route: '/roster', permKey: 'TaRosters' },
    { label: '預約管理', route: '/reserve', permKey: 'TaAppointments' },
    { label: '會員管理', route: '/member', permKey: 'Members' },
  ];

  readonly visibleMenu = computed(() => this.menu.filter((m) => this.auth.can(m.permKey, 'read')));
}
