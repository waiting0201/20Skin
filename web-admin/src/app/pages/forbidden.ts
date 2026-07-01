import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** 權限不足（perm.guard 導向）。 */
@Component({
  selector: 'app-forbidden',
  imports: [RouterLink],
  template: `
    <div class="bg-white rounded shadow-sm border border-gray-200 p-10 text-center">
      <i class="fa fa-lock text-4xl text-gray-300 mb-3"></i>
      <h1 class="text-lg font-semibold text-gray-700">權限不足</h1>
      <p class="text-sm text-gray-500 mt-1">您沒有存取此頁面的權限，請洽系統管理員。</p>
      <a routerLink="/" class="inline-block mt-4 text-sm text-teal-600 hover:underline">返回首頁</a>
    </div>
  `,
})
export class ForbiddenComponent {}
