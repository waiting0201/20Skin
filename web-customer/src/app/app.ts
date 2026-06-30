import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';

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
  /** 手機版側欄開合 */
  readonly sidebarOpen = signal(false);
  /** 側欄展開中的子選單 key */
  readonly expanded = signal<string | null>(null);

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
