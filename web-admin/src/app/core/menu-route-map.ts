/**
 * Lims.Key → Angular 路由對應（選單資料驅動、點擊目標在此解析）。
 * 舊系統 href = /{模組Key}/{子Key}；新系統路由不同名，故以此表轉譯。
 *
 * 本次僅實作權限管理（Admins）；其餘模組路由已預留，但尚未建頁 →
 * 以 BUILT_KEYS 控制：未建者一律導 /coming-soon（選單仍完整顯示，像舊系統）。
 * 逐一補齊各模組時，把該 key 加入 BUILT_KEYS 並確保路由存在即可。
 */
// 以下 key 為 reused DB `Lims` 實際內容（已對真實 DB 確認）。新系統以 clinic 參數化取代
// 舊 Ta/Ch/ChDentist/Cosmetic 變體頁（見 design/frontend-backend.md），故多個變體 key 對到同一路由。
export const LIMS_ROUTE_MAP: Record<string, string> = {
  // 權限管理（AuthorityMs）— 本次已實作
  Admins: '/authority/admins',

  // 預約設定管理（BasicMs）
  Branchs: '/basic/branches',
  Doctors: '/basic/doctors',
  QuestionTypes: '/basic/question-types',
  Skins: '/basic/categories?clinic=Skin',
  Cosmetics: '/basic/categories?clinic=Cosmetic',
  TaPeriods: '/basic/periods?branch=ta&clinic=Skin',
  ChPeriods: '/basic/periods?branch=ch&clinic=Skin',
  TaCosmeticPeriods: '/basic/periods?branch=ta&clinic=Cosmetic',
  ChCosmeticPeriods: '/basic/periods?branch=ch&clinic=Cosmetic',
  ChDentistPeriods: '/basic/periods?branch=ch&clinic=Dentist',

  // 門診管理（ShiftMs）— 班表
  TaRosters: '/roster?branch=ta&clinic=Skin',
  ChRosters: '/roster?branch=ch&clinic=Skin',
  TaCosmeticRosters: '/roster?branch=ta&clinic=Cosmetic',
  ChCosmeticRosters: '/roster?branch=ch&clinic=Cosmetic',
  ChDentistRosters: '/roster?branch=ch&clinic=Dentist',

  // 預約管理（ReserveMs）
  TaAppointments: '/reserve?branch=ta',
  ChAppointments: '/reserve?branch=ch',
  ChDentistAppointments: '/reserve?branch=ch&clinic=Dentist',

  // 會員管理（MemberMs）
  Members: '/member',
};

/** 本 session 已實作、可實際導向的模組 key。 */
export const BUILT_KEYS = new Set<string>(['Admins']);

/** 解析選單葉節點的點擊路由；未建模組導佔位頁。 */
export function resolveMenuRoute(key: string): string {
  if (BUILT_KEYS.has(key)) return LIMS_ROUTE_MAP[key] ?? '/coming-soon';
  return '/coming-soon';
}
