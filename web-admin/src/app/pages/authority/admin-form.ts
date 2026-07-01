import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminApiService } from '../../core/services/admin-api.service';
import { AdminLimInput, AdminUpsertRequest, LimNode } from '../../core/models';

type Op = 'isAdd' | 'isUpdate' | 'isDelete';
type FlagState = Record<number, { isAdd: boolean; isUpdate: boolean; isDelete: boolean }>;

/**
 * 權限管理 — 新增/編輯管理員（對應舊 AuthorityMs/AddAdmins、EditAdmins）。
 * 權限樹：模組→子功能，每列 3 旗標（新增/修改/刪除）+ 整列/整模組全選。
 * 儲存時只送有任一旗標為真的子功能（對應後端 AdminLimInputDto）。
 */
@Component({
  selector: 'app-admin-form',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="bg-white rounded shadow-sm border border-gray-200 max-w-4xl">
      <div class="px-5 py-3 border-b border-gray-100">
        <h1 class="text-base font-semibold text-gray-800">
          <i class="fa fa-user-plus text-gray-400 mr-2"></i>{{ isEdit() ? '編輯管理員' : '新增管理員' }}
        </h1>
      </div>

      @if (error()) {
        <div class="mx-5 mt-4 text-sm text-red-500">{{ error() }}</div>
      }

      <form [formGroup]="form" (ngSubmit)="submit()" class="p-5 space-y-5">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">帳號 <span class="text-red-400">*</span></label>
            <input formControlName="username" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              密碼 @if (!isEdit()) { <span class="text-red-400">*</span> } @else { <span class="text-gray-400 text-xs">(留空不修改)</span> }
            </label>
            <input type="password" formControlName="password" autocomplete="new-password"
                   class="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">姓名</label>
            <input formControlName="name" class="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
        </div>

        <!-- 權限樹 -->
        <div>
          <h2 class="text-sm font-semibold text-gray-700 mb-2">功能權限</h2>
          <div class="space-y-4">
            @for (mod of tree(); track mod.limId) {
              <div class="border border-gray-200 rounded overflow-hidden">
                <div class="flex items-center justify-between bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <span class="text-sm font-medium text-gray-700">
                    <i class="fa fa-fw {{ mod.icon || 'fa-folder' }} text-gray-400 mr-1"></i>{{ mod.label || mod.key }}
                  </span>
                  <label class="text-xs text-gray-500 flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" [checked]="isModuleAll(mod)" (change)="toggleModule(mod, $any($event.target).checked)" />
                    全選
                  </label>
                </div>
                <table class="w-full text-sm">
                  <thead>
                    <tr class="text-gray-500 text-xs bg-white border-b border-gray-100">
                      <th class="text-left font-medium px-4 py-1.5">子功能</th>
                      <th class="font-medium px-2 py-1.5 w-20">新增</th>
                      <th class="font-medium px-2 py-1.5 w-20">修改</th>
                      <th class="font-medium px-2 py-1.5 w-20">刪除</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (child of mod.children; track child.limId) {
                      <tr class="border-b border-gray-50">
                        <td class="px-4 py-1.5 text-gray-700">{{ child.label || child.key }}</td>
                        <td class="px-2 py-1.5 text-center">
                          <input type="checkbox" [checked]="flags()[child.limId].isAdd"
                                 (change)="setFlag(child.limId, 'isAdd', $any($event.target).checked)" />
                        </td>
                        <td class="px-2 py-1.5 text-center">
                          <input type="checkbox" [checked]="flags()[child.limId].isUpdate"
                                 (change)="setFlag(child.limId, 'isUpdate', $any($event.target).checked)" />
                        </td>
                        <td class="px-2 py-1.5 text-center">
                          <input type="checkbox" [checked]="flags()[child.limId].isDelete"
                                 (change)="setFlag(child.limId, 'isDelete', $any($event.target).checked)" />
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @empty {
              <p class="text-sm text-gray-400">{{ loading() ? '載入中…' : '無權限項目' }}</p>
            }
          </div>
        </div>

        <div class="flex items-center gap-2 pt-2">
          <button type="submit" [disabled]="saving()"
                  class="bg-teal-600 text-white text-sm rounded px-4 py-2 hover:bg-teal-700 disabled:opacity-50">
            {{ saving() ? '儲存中…' : '儲存' }}
          </button>
          <a routerLink="/authority/admins" class="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">取消</a>
        </div>
      </form>
    </div>
  `,
})
export class AdminFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AdminApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly adminId = this.route.snapshot.paramMap.get('id');
  readonly isEdit = signal(!!this.adminId);
  readonly tree = signal<LimNode[]>([]);
  readonly flags = signal<FlagState>({});
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: [''],
    name: [''],
  });

  constructor() {
    if (this.adminId) this.loadEdit(this.adminId);
    else this.loadNew();
  }

  private loadNew(): void {
    this.form.controls.password.addValidators(Validators.required);
    this.api.limsTree().subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) this.initTree(res.data);
        else this.error.set(res.message ?? '載入失敗');
      },
      error: () => { this.loading.set(false); this.error.set('系統忙線，請稍後再試'); },
    });
  }

  private loadEdit(id: string): void {
    this.api.getAdmin(id).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) {
          this.form.patchValue({ username: res.data.username, name: res.data.name ?? '' });
          this.initTree(res.data.permissions);
        } else {
          this.error.set(res.message ?? '載入失敗');
        }
      },
      error: () => { this.loading.set(false); this.error.set('系統忙線，請稍後再試'); },
    });
  }

  private initTree(tree: LimNode[]): void {
    const state: FlagState = {};
    for (const mod of tree) {
      for (const c of mod.children) {
        state[c.limId] = { isAdd: c.isAdd, isUpdate: c.isUpdate, isDelete: c.isDelete };
      }
    }
    this.tree.set(tree);
    this.flags.set(state);
  }

  setFlag(limId: number, op: Op, value: boolean): void {
    const next = { ...this.flags() };
    next[limId] = { ...next[limId], [op]: value };
    this.flags.set(next);
  }

  isModuleAll(mod: LimNode): boolean {
    return mod.children.length > 0 && mod.children.every((c) => {
      const f = this.flags()[c.limId];
      return f.isAdd && f.isUpdate && f.isDelete;
    });
  }

  toggleModule(mod: LimNode, value: boolean): void {
    const next = { ...this.flags() };
    for (const c of mod.children) {
      next[c.limId] = { isAdd: value, isUpdate: value, isDelete: value };
    }
    this.flags.set(next);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const flags = this.flags();
    const lims: AdminLimInput[] = Object.entries(flags)
      .map(([limId, f]) => ({ limId: Number(limId), ...f }))
      .filter((l) => l.isAdd || l.isUpdate || l.isDelete);

    const raw = this.form.getRawValue();
    const req: AdminUpsertRequest = {
      username: raw.username.trim(),
      password: raw.password ? raw.password : null,
      name: raw.name ? raw.name.trim() : null,
      lims,
    };

    this.saving.set(true);
    this.error.set(null);
    const call = this.adminId ? this.api.updateAdmin(this.adminId, req) : this.api.createAdmin(req);
    call.subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) this.router.navigate(['/authority/admins']);
        else this.error.set(res.message ?? '儲存失敗');
      },
      error: () => { this.saving.set(false); this.error.set('儲存失敗'); },
    });
  }
}
