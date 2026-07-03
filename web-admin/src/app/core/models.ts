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

/** 排班列表項（對應後端 RosterListItemDto）。 */
export interface RosterListItem {
  rosterId: string;
  rosterDate: string;
  doctorId: string | null;
  doctorName: string | null;
  outpatientTimeId: number | null;
  outpatientTimeTitle: string | null;
  isAppointment: boolean;
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

/** 編輯排班請求（不含 rosterDate/重複設定）。 */
export interface RosterUpdateRequest {
  doctorId: string | null;
  outpatientTimeId: number | null;
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
