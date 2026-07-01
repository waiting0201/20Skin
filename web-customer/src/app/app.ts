import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { AuthService } from './core/services/auth.service';

/**
 * 客戶前台外殼（對應舊 _Layout + _Header + _Sidebar + _Footer）。
 * 行銷導覽列連回 www.20skin.tw；手機版漢堡開合右側滑出選單。
 * 見 docs/design/frontend-customer.md、docs/design/visual-design.md。
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  /** 會員登入狀態（控制登出鈕顯示；舊系統無登出功能，此為新增） */
  private readonly auth = inject(AuthService);
  readonly isLoggedIn = this.auth.isLoggedIn;

  /** 手機版側欄開合 */
  readonly sidebarOpen = signal(false);
  /** 側欄展開中的子選單 key */
  readonly expanded = signal<string | null>(null);

  /** 登出並導回 /login；側欄開著時一併關閉 */
  logout() {
    this.closeSidebar();
    this.auth.logout();
  }

  toggleSidebar() {
    this.sidebarOpen.update((v) => !v);
  }
  closeSidebar() {
    this.sidebarOpen.set(false);
  }
  toggleSection(key: string) {
    this.expanded.update((v) => (v === key ? null : key));
  }

  readonly site = 'https://www.20skin.tw';
}
