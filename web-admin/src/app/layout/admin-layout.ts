import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { AdminApiService } from '../core/services/admin-api.service';
import { MenuNode } from '../core/models';
import { resolveMenuRoute } from '../core/menu-route-map';

/**
 * 後台版型：企業識別重現 —— 深藍左側欄（承接客戶前台品牌色，資料驅動選單）+ 頂欄 + Ribbon 麵包屑 + 內容 + 頁尾。
 * 選單忠於舊做法：由 API `/admin/menu` 回傳 Lims 二層樹（已依 AdminLims 過濾），葉節點以 route-map 導向。
 * 視覺 token 見 docs/design/visual-design.md §後台視覺策略；見 frontend-backend.md、blueprints/admin-auth-authority.md。
 */
@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="flex min-h-screen bg-surface">
      <!-- 手機版遮罩（側欄展開時顯示，點擊收合） -->
      @if (mobileMenuOpen()) {
        <div class="fixed inset-0 z-30 bg-black/40 lg:hidden" (click)="mobileMenuOpen.set(false)"></div>
      }

      <!-- 左側品牌深藍導覽：手機為 off-canvas 抽屜（預設收合），lg 以上固定顯示 -->
      <aside
        class="fixed inset-y-0 left-0 z-40 w-64 shrink-0 bg-brand-deep text-white/70 flex flex-col
               transition-transform duration-200 ease-out
               lg:static lg:translate-x-0"
        [class.translate-x-0]="mobileMenuOpen()" [class.-translate-x-full]="!mobileMenuOpen()">
        <div class="h-16 flex items-center gap-3 px-4 bg-brand-deeper border-b border-white/10">
          <img src="images/logo-mark.jpg" alt="20SKIN" class="w-8 h-8 rounded-full ring-1 ring-white/30" />
          <div class="leading-tight">
            <div class="text-white font-semibold tracking-wide text-sm">20SKIN</div>
            <div class="text-white/50 text-[11px] tracking-wider">後台管理系統</div>
          </div>
        </div>

        <nav class="flex-1 overflow-y-auto py-2">
          @for (mod of menu(); track mod.key) {
            <div>
              <button type="button" (click)="toggle(mod.key)"
                      class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 transition-colors">
                <i class="fa fa-lg fa-fw {{ mod.icon || 'fa-folder' }} text-white/50"></i>
                <span class="flex-1 text-left font-medium">{{ mod.label || mod.key }}</span>
                <i class="fa text-xs transition-transform" [class.fa-chevron-down]="isOpen(mod.key)"
                   [class.fa-chevron-left]="!isOpen(mod.key)"></i>
              </button>
              @if (isOpen(mod.key)) {
                <ul class="bg-black/15">
                  @for (child of mod.children; track child.key) {
                    <li>
                      <a [routerLink]="route(child.key)" routerLinkActive="!text-white before:bg-white bg-white/10"
                         (click)="mobileMenuOpen.set(false)"
                         class="relative flex items-center pl-12 pr-4 py-2 text-sm text-white/60 hover:text-white
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
            <p class="px-4 py-3 text-xs text-white/40">（無可用選單，請確認權限設定）</p>
          }
        </nav>
      </aside>

      <!-- 右側內容 -->
      <div class="flex-1 flex flex-col min-w-0">
        <header class="h-14 bg-white border-b border-hairline flex items-center justify-between px-4 sm:px-6 shadow-sm">
          <div class="flex items-center gap-3">
            <button type="button" (click)="mobileMenuOpen.set(true)"
                    class="text-muted hover:text-ink lg:hidden" aria-label="開啟選單">
              <i class="fa fa-lg fa-bars"></i>
            </button>
            <div class="flex items-center gap-2 text-muted text-sm">
              <i class="fa fa-user-circle text-muted"></i>
              <span class="hidden sm:inline">{{ auth.name() || '管理員' }}</span>
              @if (auth.isSuperAdmin()) {
                <span class="ml-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[11px]">超級管理員</span>
              }
            </div>
          </div>
          <button (click)="auth.logout()" class="flex items-center gap-1.5 text-muted hover:text-red-500 text-sm">
            <i class="fa fa-sign-out"></i><span class="hidden sm:inline"> 登出</span>
          </button>
        </header>

        <!-- Ribbon 麵包屑 -->
        <div class="bg-white border-b border-l-4 border-l-brand border-b-hairline px-4 sm:px-6 py-2 text-xs text-muted flex items-center gap-2">
          <i class="fa fa-home"></i>
          <span>首頁</span>
          @if (breadcrumb()) {
            <span class="text-hairline">/</span>
            <span class="text-ink font-medium">{{ breadcrumb() }}</span>
          }
        </div>

        <main class="flex-1 p-4 sm:p-6 overflow-y-auto overflow-x-hidden"><router-outlet /></main>

        <footer class="px-4 sm:px-6 py-3 text-center text-xs text-muted border-t border-hairline bg-white">
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
  readonly mobileMenuOpen = signal(false);
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
      .subscribe((e) => {
        this.currentUrl.set(e.urlAfterRedirects);
        this.mobileMenuOpen.set(false);
      });

    this.api.menu().subscribe((res) => {
      this.loaded.set(true);
      if (!res.success || !res.data) return;
      this.menu.set(res.data);
      // 預設收起；僅展開含當前路由的模組
      const active = new Set<string>();
      for (const mod of res.data) {
        if (mod.children.some((c) => this.currentUrl().startsWith(this.route(c.key)))) {
          active.add(mod.key);
          break;
        }
      }
      this.openModules.set(active);
    });
  }

  route(key: string): string {
    return resolveMenuRoute(key);
  }

  isOpen(key: string): boolean {
    return this.openModules().has(key);
  }

  /** 手風琴行為：展開一個模組時自動收合其他模組。 */
  toggle(key: string): void {
    this.openModules.set(this.isOpen(key) ? new Set() : new Set([key]));
  }
}
