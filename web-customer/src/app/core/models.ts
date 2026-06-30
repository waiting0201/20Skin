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
}

export interface PagedAppointments {
  items: AppointmentListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export const clinicTitle = (c: string): string =>
  c === 'Skin' ? '健保門診' : c === 'Cosmetic' ? '醫學美容' : c === 'Dentist' ? '齒科' : c;
