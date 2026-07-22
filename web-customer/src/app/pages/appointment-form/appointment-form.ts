import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BookingService } from '../../core/services/booking.service';
import { AppointmentService } from '../../core/services/appointment.service';
import { UploadService } from '../../core/services/upload.service';
import { ReservationStore } from '../../store/reservation.store';
import { AuthService } from '../../core/services/auth.service';
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
              {{ auth.visitTitle() }} <a routerLink="/">．{{ store.branch()?.title }}</a>
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
                  @if (amountLocked()) {
                    <input type="text" [value]="1" readonly autocomplete="off" />
                  } @else {
                    <input type="number" min="1" [max]="selectedAvailable()" [ngModel]="amount()" (ngModelChange)="amount.set($event)" [ngModelOptions]="{ standalone: true }" autocomplete="off" />
                    @if (amountExceedsCapacity()) {
                      <p style="color:red;">所選時段僅剩 {{ selectedAvailable() }} 個名額，無法容納 {{ amount() }} 人，請減少人數或改選時段。</p>
                    }
                  }
                </div>
              </div>

              <div class="form-block">
                <div class="from-title"></div>預約日期<span class="form-red">*</span>
                <div class="form-box width-date">
                  <input type="date" [min]="today" [ngModel]="date()" (ngModelChange)="date.set($event); onDateChange()" [ngModelOptions]="{ standalone: true }" autocomplete="off" />
                  @if (checkingDate()) { <span>檢查日期中…</span> }
                  @if (dateError()) { <p style="color:red;">{{ dateError() }}</p> }
                </div>
              </div>

              @if (date() && dateAvailable()) {
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

              @if (designate() && date() && dateAvailable()) {
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
                  <div class="from-title"></div>{{ periodSectionTitle() }}<span class="form-red">*</span>
                  <div class="form-box">
                    <div class="time-btns">
                      @if (slots().length === 0) {
                        <p>此日期無可預約時段，請改選其他日期。</p>
                      } @else {
                        @for (s of slots(); track s.periodId) {
                          <div type="button" class="time-btn"
                               [class.js-active]="periodId() === s.periodId"
                               (click)="periodId.set(s.periodId)">
                            {{ s.outpatientTimeTitle || s.title }}（餘 {{ s.available }}）
                          </div>
                        }
                      }
                    </div>
                  </div>
                </div>
              }

              <div class="form-block">
                <div class="from-title"></div>圖片上傳
                <div class="form-box">
                  <input type="file" accept="image/*" (change)="onPhotoSelected($event)" />
                  @if (uploadingPhoto()) { <span>上傳中…</span> }
                  @if (photoError()) { <span style="color:red;">{{ photoError() }}</span> }
                  @if (photoUrl()) {
                    <div style="margin-top:8px;">
                      <img [src]="photoUrl()" alt="已上傳圖片" style="max-width:200px; max-height:200px; display:block;" />
                      <a href="javascript:;" (click)="removePhoto()" style="color:#c00;">移除圖片</a>
                    </div>
                  }
                </div>
              </div>
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
  private readonly uploads = inject(UploadService);
  readonly store = inject(ReservationStore);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly today = new Date().toISOString().slice(0, 10);
  readonly amount = signal(1);
  readonly date = signal<string>('');
  readonly slots = signal<TimeSlot[]>([]);
  readonly periodId = signal<string | null>(null);
  readonly loadingSlots = signal(false);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  // 重複預約檢查（對應舊系統 AppointmentForm.AppointmentDate 的 CheckAppointmentDate Remote 驗證）
  readonly checkingDate = signal(false);
  readonly dateError = signal<string | null>(null);
  readonly dateAvailable = signal(true);

  // 指定醫師
  readonly designate = signal(false);
  readonly doctors = signal<Doctor[]>([]);
  readonly doctorId = signal<string | null>(null);
  readonly loadingDoctors = signal(false);

  // 圖片上傳（存 Blob，回檔名存 Appointments.Photo）
  readonly photoFilename = signal<string | null>(null);
  readonly photoUrl = signal<string | null>(null);
  readonly uploadingPhoto = signal(false);
  readonly photoError = signal<string | null>(null);

  /** 時段區塊顯示時機：日期通過重複預約檢查，且（不指定+已選日期，或指定+已選醫師）。 */
  readonly showSlots = computed(() =>
    !!this.date() && this.dateAvailable() && (!this.designate() || !!this.doctorId()));
  /** 對應舊 Categorys.IsOnly 系列：此分院＋此項目鎖定人數固定 1。 */
  readonly amountLocked = computed(() => !!this.store.category()?.isAmountLocked);
  /** 目前選中的時段（依 periodId 比對），用於人數上限＝該時段剩餘名額。 */
  readonly selectedSlot = computed(() => this.slots().find((s) => s.periodId === this.periodId()) ?? null);
  readonly selectedAvailable = computed(() => this.selectedSlot()?.available ?? null);
  /** 預約人數超過所選時段剩餘名額（後端仍為權威，這裡是即時前擋）。 */
  readonly amountExceedsCapacity = computed(() => {
    const avail = this.selectedAvailable();
    return !this.amountLocked() && avail != null && this.amount() > avail;
  });
  /** 對應舊 ViewBag.SelectPeriodTitle：任一時段帶 outpatientTimeTitle（台中門診時間設定）即顯示「選擇早晚診」，資料驅動不硬編碼分院。 */
  readonly periodSectionTitle = computed(() => (this.slots().some((s) => !!s.outpatientTimeTitle) ? '選擇早晚診' : '選擇時段'));
  readonly canSubmit = computed(() =>
    !!this.date() && this.dateAvailable() && !!this.periodId() &&
    (this.amountLocked() || (this.amount() >= 1 && !this.amountExceedsCapacity())) &&
    (!this.designate() || !!this.doctorId()));

  constructor() {
    if (!this.store.branch() || !this.store.clinic() || !this.store.category()) this.router.navigate(['/']);
  }

  onDateChange() {
    this.periodId.set(null);
    this.slots.set([]);
    this.doctorId.set(null);
    this.doctors.set([]);
    this.dateError.set(null);
    this.dateAvailable.set(true);
    if (!this.date()) return;
    this.checkDate();
  }

  /** 對應舊系統 CheckAppointmentDate：同分院同診別於視窗天數內已有預約則擋（三日內不可重複預約）。 */
  private checkDate() {
    const b = this.store.branch()!, clinic = this.store.clinic()!;
    this.checkingDate.set(true);
    this.booking.checkAvailability(b.branchId, clinic, this.date()).subscribe({
      next: (r) => {
        this.checkingDate.set(false);
        this.dateAvailable.set(r.available);
        if (!r.available) { this.dateError.set(r.reason ?? '三日內不可重複預約'); return; }
        if (this.designate()) this.loadDoctors();
        else this.loadSlots();
      },
      error: () => { this.checkingDate.set(false); this.dateError.set('日期檢查失敗，請重新選擇'); this.dateAvailable.set(false); },
    });
  }

  setDesignate(value: boolean) {
    if (this.designate() === value) return;
    this.designate.set(value);
    this.periodId.set(null);
    this.slots.set([]);
    this.doctorId.set(null);
    this.doctors.set([]);
    if (!this.date() || !this.dateAvailable()) return;
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

  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.photoError.set(null);
    if (!file.type.startsWith('image/')) { this.photoError.set('僅能上傳圖片'); input.value = ''; return; }
    if (file.size > 8 * 1024 * 1024) { this.photoError.set('圖片需在 8 MB 以內'); input.value = ''; return; }
    this.uploadingPhoto.set(true);
    this.uploads.upload(file, 'appointments').subscribe({
      next: (r) => { this.photoFilename.set(r.filename); this.photoUrl.set(r.url); this.uploadingPhoto.set(false); },
      error: (e) => { this.photoError.set(e?.message ?? '上傳失敗'); this.uploadingPhoto.set(false); },
    });
  }

  removePhoto() {
    this.photoFilename.set(null);
    this.photoUrl.set(null);
    this.photoError.set(null);
  }

  submit() {
    if (!this.canSubmit()) return;
    const b = this.store.branch()!, clinic = this.store.clinic()!, cat = this.store.category()!;
    this.submitting.set(true);
    this.error.set(null);
    this.appointments.create({
      branchId: b.branchId, clinic, categoryId: cat.categoryId,
      periodId: this.periodId()!, doctorId: this.designate() ? this.doctorId() : null, isAppointment: this.designate(),
      appointmentDate: this.date(), amount: this.amountLocked() ? 1 : this.amount(),
      questionTypeId: this.store.questionTypeId(), photo: this.photoFilename(),
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
