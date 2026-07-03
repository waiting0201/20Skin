import { Component } from '@angular/core';

/** 後台首頁占位（對應舊 Main/Index）。 */
@Component({
  selector: 'app-dashboard',
  template: `
    <div class="bg-white rounded-lg shadow p-6">
      <h1 class="text-xl font-bold text-ink mb-2">儀表板</h1>
      <p class="text-muted">各模組待接 API。見 docs/blueprints/admin-*.md。</p>
    </div>
  `,
})
export class DashboardComponent {}
