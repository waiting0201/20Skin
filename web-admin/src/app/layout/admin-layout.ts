import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { AdminApiService } from '../core/services/admin-api.service';
import { MenuNode } from '../core/models';
import { resolveMenuRoute } from '../core/menu-route-map';

/**
 * 後台版型：Tailwind 重現 SmartAdmin —— 深色左側欄（資料驅動選單）+ 頂欄 + Ribbon 麵包屑 + 內容 + 頁尾。
 * 選單忠於舊做法：由 API `/admin/menu` 回傳 Lims 二層樹（已依 AdminLims 過濾），葉節點以 route-map 導向。
 * 見 docs/design/frontend-backend.md、visual-design.md、blueprints/admin-auth-authority.md。
 */
@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="flex min-h-screen bg-gray-100">
      <!-- 左側深色導覽（SmartAdmin 風） -->
      <aside class="w-64 shrink-0 bg-[#31353d] text-gray-300 flex flex-col">
        <div class="h-14 flex items-center gap-2 px-4 bg-[#282c34] border-b border-black/20">
          <i class="fa fa-heartbeat text-teal-400"></i>
          <span class="text-white font-semibold tracking-wide">20SKIN 後台</span>
        </div>

        <nav class="flex-1 overflow-y-auto py-2">
          @for (mod of menu(); track mod.key) {
            <div>
              <button type="button" (click)="toggle(mod.key)"
                      class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-white/5 transition-colors">
                <i class="fa fa-lg fa-fw {{ mod.icon || 'fa-folder' }} text-gray-400"></i>
                <span class="flex-1 text-left font-medium">{{ mod.label || mod.key }}</span>
                <i class="fa text-xs transition-transform" [class.fa-chevron-down]="isOpen(mod.key)"
                   [class.fa-chevron-left]="!isOpen(mod.key)"></i>
              </button>
              @if (isOpen(mod.key)) {
                <ul class="bg-black/20">
                  @for (child of mod.children; track child.key) {
                    <li>
                      <a [routerLink]="route(child.key)" routerLinkActive="!text-white before:bg-teal-400 bg-white/5"
                         class="relative flex items-center pl-12 pr-4 py-2 text-sm text-gray-400 hover:text-white
                                before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-transparent">
                        {{ child.label || child.key }}
                      </a>
                    </li>
                  }
                </ul>
              }
            </div>
          }
          @if (menu().length === 0 && loaded()) {
            <p class="px-4 py-3 text-xs text-gray-500">（無可用選單，請確認權限設定）</p>
          }
        </nav>
      </aside>

      <!-- 右側內容 -->
      <div class="flex-1 flex flex-col min-w-0">
        <header class="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
          <div class="flex items-center gap-2 text-gray-500 text-sm">
            <i class="fa fa-user-circle text-gray-400"></i>
            <span>{{ auth.name() || '管理員' }}</span>
            @if (auth.isSuperAdmin()) {
              <span class="ml-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[11px]">超級管理員</span>
            }
          </div>
          <button (click)="auth.logout()" class="flex items-center gap-1.5 text-gray-500 hover:text-red-500 text-sm">
            <i class="fa fa-sign-out"></i> 登出
          </button>
        </header>

        <!-- Ribbon 麵包屑 -->
        <div class="bg-gray-50 border-b border-gray-200 px-6 py-2 text-xs text-gray-500 flex items-center gap-2">
          <i class="fa fa-home"></i>
          <span>首頁</span>
          @if (breadcrumb()) {
            <span class="text-gray-300">/</span>
            <span class="text-gray-700">{{ breadcrumb() }}</span>
          }
        </div>

        <main class="flex-1 p-6 overflow-y-auto"><router-outlet /></main>

        <footer class="px-6 py-3 text-center text-xs text-gray-400 border-t border-gray-200 bg-white">
          20SKIN 預約管理系統 · © {{ year }}
        </footer>
      </div>
    </div>
  `,
})
export class AdminLayoutComponent {
  readonly auth = inject(AuthService);
  private readonly api = inject(AdminApiService);
  private readonly router = inject(Router);

  readonly year = new Date().getFullYear();
  readonly menu = signal<MenuNode[]>([]);
  readonly loaded = signal(false);
  private readonly openModules = signal<Set<string>>(new Set());
  private readonly currentUrl = signal<string>(this.router.url);

  /** 當前頁面所屬葉節點 label（Ribbon 用）。 */
  readonly breadcrumb = computed(() => {
    const url = this.currentUrl();
    for (const mod of this.menu()) {
      for (const child of mod.children) {
        if (url.startsWith(this.route(child.key)) && this.route(child.key) !== '/coming-soon') {
          return `${mod.label || mod.key} / ${child.label || child.key}`;
        }
      }
    }
    return '';
  });

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.currentUrl.set(e.urlAfterRedirects));

    this.api.menu().subscribe((res) => {
      this.loaded.set(true);
      if (!res.success || !res.data) return;
      this.menu.set(res.data);
      // 預設展開含當前路由的模組；否則展開全部第一層（秀氣但不空白）
      const active = new Set<string>();
      for (const mod of res.data) {
        if (mod.children.some((c) => this.currentUrl().startsWith(this.route(c.key)))) active.add(mod.key);
      }
      this.openModules.set(active.size > 0 ? active : new Set(res.data.map((m) => m.key)));
    });
  }

  route(key: string): string {
    return resolveMenuRoute(key);
  }

  isOpen(key: string): boolean {
    return this.openModules().has(key);
  }

  toggle(key: string): void {
    const next = new Set(this.openModules());
    next.has(key) ? next.delete(key) : next.add(key);
    this.openModules.set(next);
  }
}
