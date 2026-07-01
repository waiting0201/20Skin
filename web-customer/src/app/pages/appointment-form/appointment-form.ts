import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BookingService } from '../../core/services/booking.service';
import { AppointmentService } from '../../core/services/appointment.service';
import { ReservationStore } from '../../store/reservation.store';
import { Doctor, TimeSlot } from '../../core/models';

/** 預約表單：日期 → 載入時段 → 選時段 → 送出。對應舊 AppointmentForm.cshtml。 */
@Component({
  selector: 'app-appointment-form',
  imports: [FormsModule, RouterLink],
  template: `
    <main id="main">
      <div class="block-online">
        <div class="block-item">
          <div class="block-title">填寫預約表單</div>
          <div class="block-stitle">
            <div class="btn"><a routerLink="/booking/category">回上一頁</a></div>
            <div class="btn"><a routerLink="/appointments">預約查詢</a></div>
            <div class="stitle-choose">
              <a routerLink="/">．{{ store.branch()?.title }}</a>
              <a routerLink="/booking/clinic">．{{ store.clinicTitle() }}</a>
              <a routerLink="/booking/category">．{{ store.category()?.title }}</a>．填寫預約表單
            </div>
          </div>
          <form>
            <div class="block-con white-bg">
              <div class="con-title">預約選擇</div>

              @if (error()) { <p style="color:red; text-align:center;">{{ error() }}</p> }

              <div class="form-block">
                <div class="from-title"></div>預約人數<span class="form-red">*</span>
                <div class="form-box">
                  <input type="number" min="1" [ngModel]="amount()" (ngModelChange)="amount.set($event)" [ngModelOptions]="{ standalone: true }" autocomplete="off" />
                </div>
              </div>

              <div class="form-block">
                <div class="from-title"></div>預約日期<span class="form-red">*</span>
                <div class="form-box width-date">
                  <input type="date" [min]="today" [ngModel]="date()" (ngModelChange)="date.set($event); onDateChange()" [ngModelOptions]="{ standalone: true }" autocomplete="off" />
                </div>
              </div>

              @if (date()) {
                <div class="form-block">
                  <div class="from-title"></div>指定醫師<span class="form-red">*</span>
                  <div class="form-box">
                    <label style="margin-right:16px;">
                      <input type="radio" name="designate" [checked]="!designate()" (change)="setDesignate(false)" /> 不指定
                    </label>
                    <label>
                      <input type="radio" name="designate" [checked]="designate()" (change)="setDesignate(true)" /> 指定醫師
                    </label>
                  </div>
                </div>
              }

              @if (designate() && date()) {
                <div class="form-block">
                  <div class="from-title"></div>選擇醫師<span class="form-red">*</span>
                  <div class="form-box">
                    @if (loadingDoctors()) {
                      載入醫師中…
                    } @else if (doctors().length === 0) {
                      <p>此日期無可指定的醫師，請改選日期或改為不指定。</p>
                    } @else {
                      <select [value]="doctorId() ?? ''" (change)="onDoctorChange($any($event.target).value)">
                        <option value="">請選擇醫師</option>
                        @for (d of doctors(); track d.doctorId) { <option [value]="d.doctorId">{{ d.name }}</option> }
                      </select>
                    }
                  </div>
                </div>
              }

              @if (loadingSlots()) {
                <div class="form-block"><div class="form-box">載入時段中…</div></div>
              }

              @if (showSlots() && !loadingSlots()) {
                <div class="form-block no-line">
                  <div class="from-title"></div>選擇時段<span class="form-red">*</span>
                  <div class="form-box">
                    <div class="time-btns">
                      @if (slots().length === 0) {
                        <p>此日期無可預約時段，請改選其他日期。</p>
                      } @else {
                        @for (s of slots(); track s.periodId) {
                          <div type="button" class="time-btn"
                               [class.js-active]="periodId() === s.periodId"
                               [style.opacity]="!s.isAvailable ? '0.4' : '1'"
                               [style.cursor]="!s.isAvailable ? 'not-allowed' : 'pointer'"
                               (click)="s.isAvailable && periodId.set(s.periodId)">
                            {{ s.outpatientTimeTitle || s.title }}（餘 {{ s.available }}）
                          </div>
                        }
                      }
                    </div>
                  </div>
                </div>
              }
            </div>
            <div class="block-stitle">
              <div class="btn center">
                <a href="javascript:;" (click)="submit()"
                   [style.opacity]="(!canSubmit() || submitting()) ? '0.5' : '1'">
                  {{ submitting() ? '預約中…' : '送出' }}
                </a>
              </div>
            </div>
          </form>
        </div>
      </div>
    </main>
  `,
})
export class AppointmentFormComponent {
  private readonly booking = inject(BookingService);
  private readonly appointments = inject(AppointmentService);
  readonly store = inject(ReservationStore);
  private readonly router = inject(Router);

  readonly today = new Date().toISOString().slice(0, 10);
  readonly amount = signal(1);
  readonly date = signal<string>('');
  readonly slots = signal<TimeSlot[]>([]);
  readonly periodId = signal<string | null>(null);
  readonly loadingSlots = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  // 指定醫師
  readonly designate = signal(false);
  readonly doctors = signal<Doctor[]>([]);
  readonly doctorId = signal<string | null>(null);
  readonly loadingDoctors = signal(false);

  /** 時段區塊顯示時機：不指定+已選日期，或指定+已選醫師。 */
  readonly showSlots = computed(() => !!this.date() && (!this.designate() || !!this.doctorId()));
  readonly canSubmit = computed(() =>
    !!this.date() && !!this.periodId() && this.amount() >= 1 && (!this.designate() || !!this.doctorId()));

  constructor() {
    if (!this.store.branch() || !this.store.clinic() || !this.store.category()) this.router.navigate(['/']);
  }

  onDateChange() {
    this.periodId.set(null);
    this.slots.set([]);
    this.doctorId.set(null);
    this.doctors.set([]);
    if (!this.date()) return;
    if (this.designate()) this.loadDoctors();
    else this.loadSlots();
  }

  setDesignate(value: boolean) {
    if (this.designate() === value) return;
    this.designate.set(value);
    this.periodId.set(null);
    this.slots.set([]);
    this.doctorId.set(null);
    this.doctors.set([]);
    if (!this.date()) return;
    if (value) this.loadDoctors();
    else this.loadSlots();
  }

  onDoctorChange(id: string) {
    this.doctorId.set(id || null);
    this.periodId.set(null);
    this.slots.set([]);
    if (id) this.loadSlots();
  }

  private loadDoctors() {
    const b = this.store.branch()!, clinic = this.store.clinic()!, cat = this.store.category()!;
    this.loadingDoctors.set(true);
    this.error.set(null);
    this.booking.doctors(b.branchId, clinic, cat.categoryId, this.date()).subscribe({
      next: (d) => { this.doctors.set(d); this.loadingDoctors.set(false); },
      error: () => { this.error.set('載入醫師失敗'); this.loadingDoctors.set(false); },
    });
  }

  private loadSlots() {
    const b = this.store.branch()!, clinic = this.store.clinic()!, cat = this.store.category()!;
    this.loadingSlots.set(true);
    this.error.set(null);
    this.booking.timeSlots(b.branchId, clinic, cat.categoryId, this.date(), this.doctorId() ?? undefined).subscribe({
      next: (s) => { this.slots.set(s); this.loadingSlots.set(false); },
      error: () => { this.error.set('載入時段失敗'); this.loadingSlots.set(false); },
    });
  }

  submit() {
    if (!this.canSubmit()) return;
    const b = this.store.branch()!, clinic = this.store.clinic()!, cat = this.store.category()!;
    this.submitting.set(true);
    this.error.set(null);
    this.appointments.create({
      branchId: b.branchId, clinic, categoryId: cat.categoryId,
      periodId: this.periodId()!, doctorId: this.designate() ? this.doctorId() : null, isAppointment: this.designate(),
      appointmentDate: this.date(), amount: this.amount(),
      questionTypeId: this.store.questionTypeId(), photo: null,
    }).subscribe({
      next: (res) => {
        this.submitting.set(false);
        if (res.success && res.data) this.router.navigate(['/booking/complete', res.data.appointmentId]);
        else this.error.set(res.message ?? '預約失敗');
      },
      error: () => { this.submitting.set(false); this.error.set('系統忙線，請稍後再試'); },
    });
  }
}
