import { Injectable, computed, signal } from '@angular/core';
import { Branch, Category, ClinicCode, clinicTitle } from '../core/models';

/**
 * 預約流程多步驟狀態，取代舊系統 Session["myReserve"]（見 docs/design/frontend-customer.md）。
 * 以 Angular signals 實作，並同步 sessionStorage 防 F5 遺失。
 */
@Injectable({ providedIn: 'root' })
export class ReservationStore {
  readonly branch = signal<Branch | null>(this.load('branch'));
  readonly clinic = signal<ClinicCode | null>(this.load('clinic'));
  readonly category = signal<Category | null>(this.load('category'));
  readonly questionTypeId = signal<string | null>(this.load('questionTypeId'));

  readonly appointmentDate = signal<string | null>(null);
  readonly periodId = signal<string | null>(null);
  readonly doctorId = signal<string | null>(null);
  readonly isAppointment = signal(false);
  readonly amount = signal(1);

  readonly clinicTitle = computed(() => (this.clinic() ? clinicTitle(this.clinic()!) : ''));

  setBranch(b: Branch) {
    this.branch.set(b);
    this.save('branch', b);
    if (b.branchType === 2) this.setClinic('Dentist'); // 齒科沿用舊邏輯
  }

  setClinic(c: ClinicCode) {
    this.clinic.set(c);
    this.save('clinic', c);
  }

  setCategory(c: Category) {
    this.category.set(c);
    this.save('category', c);
    // 換項目時清掉上一項目殘留的問卷選擇（避免帶錯 QuestionTypeID 到預約）。
    this.setQuestionTypeId(null);
  }

  /** 問卷作答完成後記下此問卷 ID（供預約表單一併送出，決定 Appointments.QuestionTypeID）。 */
  setQuestionTypeId(id: string | null) {
    this.questionTypeId.set(id);
    if (id) this.save('questionTypeId', id);
    else sessionStorage.removeItem('rsv_questionTypeId');
  }

  reset() {
    for (const k of ['branch', 'clinic', 'category', 'questionTypeId']) sessionStorage.removeItem(`rsv_${k}`);
    this.branch.set(null);
    this.clinic.set(null);
    this.category.set(null);
    this.questionTypeId.set(null);
    this.appointmentDate.set(null);
    this.periodId.set(null);
    this.doctorId.set(null);
    this.isAppointment.set(false);
    this.amount.set(1);
  }

  private save(key: string, value: unknown) {
    sessionStorage.setItem(`rsv_${key}`, JSON.stringify(value));
  }
  private load<T>(key: string): T | null {
    const raw = sessionStorage.getItem(`rsv_${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  }
}
