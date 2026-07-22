export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
}

/** 分頁清單回應信封（後端 `{ items, total, page, pageSize }`，pageSize 固定 20，見 docs/design/frontend-backend.md §分頁規範）。 */
export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
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

/** 上傳結果（後端回檔名+公開 URL）。filename 存入 Photo 欄位。 */
export interface UploadResult {
  filename: string;
  folder: string;
  url: string;
}

/** 排序項（PK + 目標 Sort 值），對應後端 SortItem。 */
export interface SortItem {
  id: string;
  sort: number;
}

/** 分院（對應後端 BranchAdminDto）。 */
export interface BranchAdmin {
  branchId: string;
  title: string;
  branchType: number;
  photo: string;
  isAutoRowNumber: boolean;
  sort: number;
  isEnabled: boolean;
}

export interface BranchUpsertRequest {
  title: string;
  branchType: number;
  photo: string | null;
  isAutoRowNumber: boolean;
  isEnabled: boolean;
}

/** 醫師（對應後端 DoctorAdminDto）。Doctors 表無 Sort/IsEnabled 欄位。 */
export interface DoctorAdmin {
  doctorId: string;
  name: string;
}

export interface DoctorUpsertRequest {
  name: string;
}

/** 時段（對應後端 PeriodAdminDto）。BranchID/Clinic 由所屬變體 proxy 決定，編輯時不可改。 */
export interface PeriodAdmin {
  periodId: string;
  branchId: string;
  outpatientTimeId: number;
  outpatientTimeTitle: string;
  clinic: string;
  title: string;
  startNumber: number | null;
  patients: number;
  sort: number;
}

export interface PeriodUpsertRequest {
  outpatientTimeId: number;
  title: string;
  startNumber: number | null;
  patients: number;
}

/** 門診時段字典（上午/下午/晚上）。 */
export interface OutpatientTime {
  outpatientTimeId: number;
  title: string;
}

/**
 * 時段模式判斷用分院旗標（對應後端 PeriodBranchMetaDto）。
 * 模式＝ isAutoRowNumber 分院 且 startNumber 有值 → 配號；否則現場取號（同 BookingService `numbered`）。
 */
export interface PeriodBranchMeta {
  isAutoRowNumber: boolean;
}

/** 科別項目（對應後端 CategoryAdminDto）。Clinic 由所屬變體 proxy 決定，編輯時不可改。 */
export interface CategoryAdmin {
  categoryId: string;
  clinic: string;
  title: string;
  intro: string | null;
  photo: string;
  isQuestion: boolean;
  isOnly: boolean;
  chIsOnly: boolean;
  chDentistIsOnly: boolean;
  sort: number;
}

export interface CategoryUpsertRequest {
  title: string;
  intro: string | null;
  photo: string | null;
  isQuestion: boolean;
  isOnly: boolean;
  chIsOnly: boolean;
  chDentistIsOnly: boolean;
}

/** 問卷類型（對應後端 QuestionTypeAdminDto）。刪除為軟刪（IsEnabled=false）。 */
export interface QuestionTypeAdmin {
  questionTypeId: string;
  categoryId: string;
  categoryTitle: string;
  title: string;
  sort: number;
  isEnabled: boolean;
}

export interface QuestionTypeUpsertRequest {
  categoryId: string;
  title: string;
}

/** 問卷題目選項（對應後端 QuestionAnswerAdminDto）。 */
export interface QuestionAnswerAdmin {
  questionAnswerId: string;
  title: string;
  sort: number;
}

/** 選項輸入（編輯時整組送出，questionAnswerId 為 null 表新增）。 */
export interface QuestionAnswerInput {
  questionAnswerId: string | null;
  title: string;
  sort: number;
}

/** 問卷題目（含巢狀選項，對應後端 QuestionAdminDto）。刪除為軟刪（IsEnabled=false）。 */
export interface QuestionAdmin {
  questionId: string;
  questionTypeId: string;
  title: string;
  optionType: number;
  isOther: boolean;
  otherTitle: string | null;
  sort: number;
  isEnabled: boolean;
  answers: QuestionAnswerAdmin[];
}

export interface QuestionUpsertRequest {
  title: string;
  optionType: number;
  isOther: boolean;
  otherTitle: string | null;
  answers: QuestionAnswerInput[];
}

/** 排班列表項（對應後端 RosterListItemDto）。categoryTitles 為開放科別項目標題逗號串接，對應舊系統「項目」欄。 */
export interface RosterListItem {
  rosterId: string;
  rosterDate: string;
  doctorId: string | null;
  doctorName: string | null;
  outpatientTimeId: number | null;
  outpatientTimeTitle: string | null;
  isAppointment: boolean;
  categoryTitles: string;
}

/** 排班的單一時段容量覆蓋（對應後端 RosterPeriodAdminDto）。 */
export interface RosterPeriodAdmin {
  periodId: string;
  periodTitle: string;
  startNumber: number | null;
  patients: number;
  sort: number;
}

/** 排班詳情（對應後端 RosterAdminDto）。 */
export interface RosterAdmin {
  rosterId: string;
  branchId: string;
  doctorId: string | null;
  doctorName: string | null;
  outpatientTimeId: number | null;
  outpatientTimeTitle: string | null;
  rosterDate: string;
  clinic: string;
  isAppointment: boolean;
  categoryIds: string[];
  periods: RosterPeriodAdmin[];
}

/** 時段容量輸入（對應後端 RosterPeriodInput）。 */
export interface RosterPeriodInput {
  periodId: string;
  startNumber: number | null;
  patients: number;
}

/** 新增排班請求；repeatMode：0=不重複／1=每日／2=每週。 */
export interface RosterCreateRequest {
  doctorId: string | null;
  outpatientTimeId: number | null;
  rosterDate: string;
  isAppointment: boolean;
  categoryIds: string[];
  periods: RosterPeriodInput[];
  repeatMode: number;
  expireDate: string | null;
}

/** 編輯排班請求（不含重複設定；rosterDate 可修改，忠於舊系統）。 */
export interface RosterUpdateRequest {
  doctorId: string | null;
  outpatientTimeId: number | null;
  rosterDate: string;
  isAppointment: boolean;
  categoryIds: string[];
  periods: RosterPeriodInput[];
}

/** 新增排班結果：實際建立的日期 + 因衝突跳過的日期。 */
export interface RosterCreateResult {
  createdDates: string[];
  skippedDates: string[];
}

/** 會員列表項（對應後端 MemberListItemDto）。BranchTitles 為曾就診分院去重清單，空陣列表尚未預約。 */
export interface MemberListItem {
  memberId: string;
  number: string;
  mobile: string;
  birthday: string;
  name: string | null;
  isBlackList: boolean;
  isFirstVisit: boolean;
  branchTitles: string[];
}

/** 會員詳情（編輯表單用，對應後端 MemberDetailDto）。number 唯讀不可改。 */
export interface MemberDetail {
  memberId: string;
  number: string;
  mobile: string;
  birthday: string;
  name: string | null;
  gender: number | null;
  bloodType: string | null;
  email: string | null;
  zipcodeId: number | null;
  city: string | null;
  address: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  allergy: string[];
  allergyOther: string | null;
  medicalHistory: string[];
  medicalHistoryOther: string | null;
  isBlackList: boolean;
}

/** 編輯會員請求（對應後端 MemberUpdateRequest，不含 number）。 */
export interface MemberUpdateRequest {
  mobile: string;
  birthday: string;
  name: string | null;
  gender: number | null;
  bloodType: string | null;
  email: string | null;
  zipcodeId: number | null;
  address: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  allergy: string[] | null;
  allergyOther: string | null;
  medicalHistory: string[] | null;
  medicalHistoryOther: string | null;
  isBlackList: boolean;
}

/**
 * 會員問卷清單項（對應後端 MemberQuestionnaireLinkDto）。linkId：掃描檔=memberQuestionId／唯讀=questionTypeId。
 * questionTypeId/filename 供編輯表單預填（掃描檔項）；數位作答項 filename 恆為 null。
 */
export interface MemberQuestionnaireLink {
  linkId: string;
  categoryTitle: string;
  questionTypeTitle: string;
  questionTypeId: string;
  filename: string | null;
}

/** 會員問卷維護頁（對應後端 MemberQuestionnairesDto）。 */
export interface MemberQuestionnaires {
  uploaded: MemberQuestionnaireLink[];
  digitalAnswered: MemberQuestionnaireLink[];
}

/** 新增/編輯問卷掃描檔請求（對應後端 MemberQuestionUpsertRequest）。filename 為 null 表編輯時不換檔。 */
export interface MemberQuestionUpsertRequest {
  questionTypeId: string;
  filename: string | null;
}

/**
 * 問卷表單（唯讀檢視用，對應後端 QuestionFormDto，重用客戶前台 IQuestionService.GetFormAsync）。
 * 與 web-customer/core/models.ts 的同名型別各自獨立一份（兩專案不共用程式碼）。
 */
export interface QuestionAnswerOption {
  questionAnswerId: string;
  title: string;
  sort: number;
}

export interface QuestionFormItem {
  questionId: string;
  title: string;
  optionType: number; // 1=單選 / 2=複選
  isOther: boolean;
  otherTitle: string | null;
  answers: QuestionAnswerOption[];
  selectedAnswerIds: string[];
  otherText: string | null;
}

export interface QuestionForm {
  questionTypeId: string;
  categoryId: string;
  title: string;
  answered: boolean;
  questions: QuestionFormItem[];
}

/** 郵遞區號（對應後端 ZipcodeDto），供會員編輯頁城市/區連動。 */
export interface Zipcode {
  zipcodeId: number;
  city: string;
  area: string;
  zipcode: string;
}

/**
 * 預約列表項（對應後端 AppointmentAdminListItemDto，見 docs/blueprints/admin-reserve.md）。
 * periodTitle 為「時間」欄（Rosters.OutpatientTimes.Title 優先，否則 fallback Periods.OutpatientTimes.Title）；
 * slotTitle 為「時段」欄（Periods.Title）。status：1=成功／0=取消。
 */
export interface AppointmentAdminListItem {
  appointmentId: string;
  appointmentDate: string;
  clinic: string;
  doctorName: string | null;
  periodTitle: string | null;
  slotTitle: string;
  categoryTitle: string;
  memberName: string | null;
  memberBirthday: string;
  memberMobile: string;
  outpatientNum: number | null;
  status: number;
  isFirstVisit: boolean;
}

/** 時段容量統計（對應後端 PeriodAmountDto）。rosterPeriodId 為 null 表示該時段目前無對應排班容量覆蓋。 */
export interface PeriodAmount {
  periodId: string;
  periodTitle: string;
  sort: number;
  totalAmount: number;
  appointmentAmount: number;
  rosterPeriodId: string | null;
}

/**
 * 預約列表結果（對應後端 AppointmentAdminListResultDto）。branchIsAutoRowNumber 決定是否顯示「編號」欄；
 * periodAmounts 僅當篩選條件足以定位單一天的時段容量表時才非空。
 */
export interface AppointmentAdminListResult {
  items: AppointmentAdminListItem[];
  total: number;
  page: number;
  pageSize: number;
  branchIsAutoRowNumber: boolean;
  periodAmounts: PeriodAmount[];
}

/**
 * 預約詳情（對應後端 AppointmentAdminDetailDto）。photo 為 Appointments.Photo 上傳圖檔名（folder 為 'appointments'）；
 * memberGender：1=男／其他=女（比照舊 View，含 null 亦顯示為女，忠於舊系統邏輯，非新增判斷）。
 */
export interface AppointmentAdminDetail {
  appointmentId: string;
  clinic: string;
  categoryTitle: string;
  photo: string | null;
  memberNumber: string;
  memberMobile: string;
  memberBirthday: string;
  memberName: string | null;
  memberGender: number | null;
  memberBloodType: string | null;
  memberCity: string | null;
  memberArea: string | null;
  memberAddress: string | null;
  memberAllergy: string[];
  memberAllergyOther: string | null;
  memberMedicalHistory: string[];
  memberMedicalHistoryOther: string | null;
  questionnaire: QuestionForm | null;
}

/** 單筆容量輸入（對應後端 CapacityItemInput）；rosterPeriodId 有值時同時更新 RosterPeriods.Patients。 */
export interface CapacityItemInput {
  periodId: string;
  rosterPeriodId: string | null;
  patients: number;
}

/** 容量批次更新請求（對應後端 CapacityUpdateRequest）。 */
export interface CapacityUpdateRequest {
  items: CapacityItemInput[];
}

/** 單筆問卷匯出項（對應後端 QuestionnaireExportItemDto）。 */
export interface QuestionnaireExportItem {
  appointmentId: string;
  periodTitle: string;
  memberName: string | null;
  categoryTitle: string;
  questionTypeTitle: string;
  questionnaire: QuestionForm;
}

/** 問卷匯出結果（對應後端 QuestionnaireExportDto）。 */
export interface QuestionnaireExportResult {
  items: QuestionnaireExportItem[];
}

/** 儀表板各診別當日有效預約數（對應後端 DashboardClinicStatDto）。 */
export interface DashboardClinicStat {
  clinic: string;
  clinicTitle: string;
  todayCount: number;
}

/** 儀表板單一分院當日統計（對應後端 DashboardBranchDto；branchKey 同預約管理路由參數 ta/ch/chDentist）。 */
export interface DashboardBranch {
  branchKey: string;
  branchTitle: string;
  todayCount: number;
  todayFirstVisit: number;
  todayCancelled: number;
  clinics: DashboardClinicStat[];
}

/** 儀表板未來 7 天（含今日）預約量（對應後端 DashboardTrendDayDto；perBranch 鍵為 branchKey）。 */
export interface DashboardTrendDay {
  date: string;
  total: number;
  perBranch: Record<string, number>;
}

/** 儀表板會員統計（對應後端 DashboardMemberStatsDto；需 Members 讀取權限，無權限時後端回 null）。 */
export interface DashboardMemberStats {
  totalMembers: number;
  todayNew: number;
  monthNew: number;
  blacklistCount: number;
}

/** 儀表板（對應後端 DashboardDto；區塊依管理員可讀權限過濾，見 docs/blueprints/admin-dashboard.md）。 */
export interface Dashboard {
  date: string;
  branches: DashboardBranch[];
  trend: DashboardTrendDay[];
  members: DashboardMemberStats | null;
}
