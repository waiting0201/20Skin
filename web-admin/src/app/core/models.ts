export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
}

/** 攤平的權限項（對應舊 Lims+AdminLims，見 docs/design/security.md）。 */
export interface AdminPerm {
  key: string;      // 資源 key，如 "TaAppointments"
  module: string;   // 模組 key，如 "Reserve"
  add: boolean;
  update: boolean;
  delete: boolean;
}

export type PermOp = 'read' | 'add' | 'update' | 'delete';

/** 資料驅動選單節點（對應舊 Lims 二層樹，已依權限過濾）。 */
export interface MenuNode {
  key: string;
  label: string | null;
  icon: string | null;
  sort: number;
  children: MenuNode[];
}

/** 權限樹（供權限管理勾選 UI）。 */
export interface LimNode {
  limId: number;
  key: string;
  label: string | null;
  icon: string | null;
  sort: number;
  children: LimChild[];
}
export interface LimChild {
  limId: number;
  key: string;
  label: string | null;
  sort: number;
  isAdd: boolean;
  isUpdate: boolean;
  isDelete: boolean;
}

export interface AdminListItem {
  adminId: string;
  username: string;
  name: string | null;
}

export interface AdminDetail {
  adminId: string;
  username: string;
  name: string | null;
  permissions: LimNode[];
}

/** 權限勾選輸入（只送有任一旗標者，對應後端 AdminLimInputDto）。 */
export interface AdminLimInput {
  limId: number;
  isAdd: boolean;
  isUpdate: boolean;
  isDelete: boolean;
}

export interface AdminUpsertRequest {
  username: string;
  password: string | null;
  name: string | null;
  lims: AdminLimInput[];
}
