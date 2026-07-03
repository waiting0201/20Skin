import { Component } from '@angular/core';

/** 未建模組佔位（basic/roster/reserve/member 逐一補齊，見 docs/status.md）。 */
@Component({
  selector: 'app-coming-soon',
  template: `
    <div class="bg-white rounded shadow-sm border border-hairline p-10 text-center">
      <i class="fa fa-wrench text-4xl text-muted mb-3"></i>
      <h1 class="text-lg font-semibold text-ink">此模組尚未開放</h1>
      <p class="text-sm text-muted mt-1">本階段先完成「權限管理」，其餘模組將陸續上線。</p>
    </div>
  `,
})
export class ComingSoonComponent {}
