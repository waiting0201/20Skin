/** 對應後端 Skin.Core.ApiResponse（見 docs/design/api-design.md）。 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
}

export interface MeResponse {
  userId: string;
  role: 'member' | 'admin';
  name: string;
}

export type ClinicCode = 'Skin' | 'Cosmetic' | 'Dentist';

export interface Branch {
  branchId: string;
  title: string;
  branchType: number; // 2=齒科（直接跳預約表單）
  photo: string;
  isAutoRowNumber: boolean;
}

export interface Category {
  categoryId: string;
  clinic: string;
  title: string;
  intro: string | null;
  photo: string;
  isQuestion: boolean;
}

export interface TimeSlot {
  periodId: string;
  title: string;
  outpatientTimeId: number | null;
  outpatientTimeTitle: string | null;
  capacity: number;
  used: number;
  available: number;
  isAvailable: boolean;
}

export interface Doctor {
  doctorId: string;
  name: string;
}

export interface CreateAppointmentRequest {
  branchId: string;
  clinic: string;
  categoryId: string;
  periodId: string;
  doctorId: string | null;
  isAppointment: boolean;
  appointmentDate: string; // yyyy-MM-dd
  amount: number;
  questionTypeId: string | null;
  photo: string | null;
}

export interface CreateAppointmentResult {
  appointmentId: string;
  outpatientNum: number | null;
}

export interface AppointmentListItem {
  appointmentId: string;
  appointmentDate: string;
  clinic: string;
  branchTitle: string | null;
  categoryTitle: string | null;
  outpatientNum: number | null;
  status: number; // 1=有效 / 0=取消
}

export interface AppointmentDetail {
  appointmentId: string;
  appointmentDate: string;
  clinic: string;
  branchTitle: string | null;
  categoryTitle: string | null;
  doctorName: string | null;
  periodTitle: string | null;
  amount: number;
  outpatientNum: number | null;
  isFirstVisit: boolean;
  status: number;
  questionTypeId: string | null;
  photo: string | null;
}

/** 上傳結果（後端回檔名+公開 URL）。filename 存入預約 Photo。 */
export interface UploadResult {
  filename: string;
  folder: string;
  url: string;
}

export interface PagedAppointments {
  items: AppointmentListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export const clinicTitle = (c: string): string =>
  c === 'Skin' ? '健保門診' : c === 'Cosmetic' ? '醫學美容' : c === 'Dentist' ? '齒科' : c;

export interface Zipcode {
  zipcodeId: number;
  city: string;
  area: string;
  zipcode: string;
}

// ── 問卷（術前電子病歷）。OptionType：1=單選(radio) / 2=複選(checkbox)（見 docs/gotchas.md） ──

export interface QuestionnaireEntry {
  questionTypeId: string;
  title: string;
  sort: number;
  answered: boolean;
}

export interface QuestionnaireCategory {
  categoryId: string;
  clinic: string;
  title: string;
  intro: string | null;
  photo: string;
  questionTypes: QuestionnaireEntry[];
}

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

export interface MemberQuestionInput {
  questionId: string;
  answerIds: string[];
  other: string | null;
}

export interface SaveMemberQuestionsRequest {
  questionTypeId: string;
  answers: MemberQuestionInput[];
}
