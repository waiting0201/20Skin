/** 選單葉節點的導航目標：路徑 + 選填的 query 參數（分開存放，見下方「踩雷」說明）。 */
export interface MenuRoute {
  path: string;
  queryParams?: Record<string, string>;
}

/**
 * Lims.Key → Angular 路由對應（選單資料驅動、點擊目標在此解析）。
 * 舊系統 href = /{模組Key}/{子Key}；新系統路由不同名，故以此表轉譯。
 *
 * 已實作：權限管理（Admins）+ 基礎資料分院/醫師/時段（Branchs/Doctors/*Periods）。其餘模組路由已預留，但尚未建頁 →
 * 以 BUILT_KEYS 控制：未建者一律導 /coming-soon（選單仍完整顯示，像舊系統）。
 * 逐一補齊各模組時，把該 key 加入 BUILT_KEYS 並確保路由存在即可。
 *
 * **踩雷**：path 與 queryParams 必須分開存放，不可寫成單一字串（如 `'/basic/periods?branch=ta'`）
 * 直接餵給 `[routerLink]`。Angular `RouterLink` 收到純字串時只會用 `/` 切割路徑片段，
 * 不會解析 `?`——整段 `periods?branch=ta&clinic=Skin` 會被當成單一路徑片段去匹配路由，
 * 永遠匹配不到，最終落到 `{ path: '**', redirectTo: '' }`，使用者看到的現象就是「點選單沒反應」。
 * 正確用法：模板同時綁定 `[routerLink]="route(key).path"` 與 `[queryParams]="route(key).queryParams"`。
 */
// 以下 key 為 reused DB `Lims` 實際內容（已對真實 DB 確認）。新系統以 clinic 參數化取代
// 舊 Ta/Ch/ChDentist/Cosmetic 變體頁（見 design/frontend-backend.md），故多個變體 key 對到同一路由。
export const LIMS_ROUTE_MAP: Record<string, MenuRoute> = {
  // 權限管理（AuthorityMs）— 已實作
  Admins: { path: '/authority/admins' },

  // 預約設定管理（BasicMs）
  Branchs: { path: '/basic/branches' },
  Doctors: { path: '/basic/doctors' },
  QuestionTypes: { path: '/basic/question-types' },
  Skins: { path: '/basic/categories', queryParams: { clinic: 'Skin' } },
  Cosmetics: { path: '/basic/categories', queryParams: { clinic: 'Cosmetic' } },
  TaPeriods: { path: '/basic/periods', queryParams: { branch: 'ta', clinic: 'Skin' } },
  ChPeriods: { path: '/basic/periods', queryParams: { branch: 'ch', clinic: 'Skin' } },
  TaCosmeticPeriods: { path: '/basic/periods', queryParams: { branch: 'ta', clinic: 'Cosmetic' } },
  ChCosmeticPeriods: { path: '/basic/periods', queryParams: { branch: 'ch', clinic: 'Cosmetic' } },
  // 注意：ChDentist 是「二林．齒科」獨立分院（真實 DB BranchID 已查證與「二林．四季」不同），
  // 不是「ch 分院的 Dentist 診別」，故 branch 用獨立別名 chDentist（見後端 PeriodsOptions 註解）。
  ChDentistPeriods: { path: '/basic/periods', queryParams: { branch: 'chDentist', clinic: 'Dentist' } },

  // 門診管理（ShiftMs）— 班表
  TaRosters: { path: '/roster', queryParams: { branch: 'ta', clinic: 'Skin' } },
  ChRosters: { path: '/roster', queryParams: { branch: 'ch', clinic: 'Skin' } },
  TaCosmeticRosters: { path: '/roster', queryParams: { branch: 'ta', clinic: 'Cosmetic' } },
  ChCosmeticRosters: { path: '/roster', queryParams: { branch: 'ch', clinic: 'Cosmetic' } },
  ChDentistRosters: { path: '/roster', queryParams: { branch: 'chDentist', clinic: 'Dentist' } },

  // 預約管理（ReserveMs）
  TaAppointments: { path: '/reserve', queryParams: { branch: 'ta' } },
  ChAppointments: { path: '/reserve', queryParams: { branch: 'ch' } },
  ChDentistAppointments: { path: '/reserve', queryParams: { branch: 'chDentist', clinic: 'Dentist' } },

  // 會員管理（MemberMs）
  Members: { path: '/member' },
};

const COMING_SOON: MenuRoute = { path: '/coming-soon' };

/** 本 session 已實作、可實際導向的模組 key。 */
export const BUILT_KEYS = new Set<string>([
  'Admins',
  'Branchs',
  'Doctors',
  'TaPeriods',
  'ChPeriods',
  'TaCosmeticPeriods',
  'ChCosmeticPeriods',
  'ChDentistPeriods',
  'Skins',
  'Cosmetics',
  'QuestionTypes',
  'TaRosters',
  'ChRosters',
  'TaCosmeticRosters',
  'ChCosmeticRosters',
  'ChDentistRosters',
  'Members',
  'TaAppointments',
  'ChAppointments',
  'ChDentistAppointments',
]);

/** 解析選單葉節點的點擊目標（路徑 + query 參數）；未建模組導佔位頁。 */
export function resolveMenuRoute(key: string): MenuRoute {
  if (BUILT_KEYS.has(key)) return LIMS_ROUTE_MAP[key] ?? COMING_SOON;
  return COMING_SOON;
}
