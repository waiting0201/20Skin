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
