import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiResponse,
  BranchAdmin,
  BranchUpsertRequest,
  CategoryAdmin,
  CategoryUpsertRequest,
  DoctorAdmin,
  DoctorUpsertRequest,
  OutpatientTime,
  PagedResult,
  PeriodAdmin,
  PeriodBranchMeta,
  PeriodUpsertRequest,
  QuestionAdmin,
  QuestionTypeAdmin,
  QuestionTypeUpsertRequest,
  QuestionUpsertRequest,
  SortItem,
} from '../models';

/** 診別（clinic）→ 後端路由段（對應舊 Skins/Cosmetics 2 變體）。 */
const CATEGORY_SLUG: Record<string, string> = { Skin: 'skin', Cosmetic: 'cosmetic' };

function categorySlug(clinic: string): string {
  const slug = CATEGORY_SLUG[clinic];
  if (!slug) throw new Error(`未知的診別：${clinic}`);
  return slug;
}

/** 診別 → Lims Resource key（供 auth.can() 判斷按鈕顯示）。 */
const CATEGORY_RESOURCE: Record<string, string> = { Skin: 'Skins', Cosmetic: 'Cosmetics' };

export function categoryResourceKey(clinic: string): string {
  return CATEGORY_RESOURCE[clinic] ?? '';
}

/** 診別 → 舊系統頁面標題（「新增皮膚主治」等），完全沿用舊 View 用詞。 */
const CATEGORY_LABEL: Record<string, string> = { Skin: '皮膚主治', Cosmetic: '美容醫學' };

export function categoryLabel(clinic: string): string {
  return CATEGORY_LABEL[clinic] ?? '科別項目';
}

/**
 * 時段分院別名 + 診別 → 後端路由段（對應 5 個舊變體：Ta/TaCosmetic/Ch/ChCosmetic/ChDentist）。
 * 注意 chDentist 是「二林．齒科」獨立分院，非「ch 分院的 Dentist 診別」，見後端 PeriodsOptions 註解。
 */
const PERIOD_SLUG: Record<string, string> = {
  'ta:Skin': 'ta-skin',
  'ta:Cosmetic': 'ta-cosmetic',
  'ch:Skin': 'ch-skin',
  'ch:Cosmetic': 'ch-cosmetic',
  'chDentist:Dentist': 'ch-dentist',
};

function periodSlug(branch: string, clinic: string): string {
  const slug = PERIOD_SLUG[`${branch}:${clinic}`];
  if (!slug) throw new Error(`未知的分院/診別組合：${branch}/${clinic}`);
  return slug;
}

/** 分院別名+診別 → Lims Resource key（供 auth.can() 判斷按鈕顯示）。 */
const PERIOD_RESOURCE: Record<string, string> = {
  'ta:Skin': 'TaPeriods',
  'ta:Cosmetic': 'TaCosmeticPeriods',
  'ch:Skin': 'ChPeriods',
  'ch:Cosmetic': 'ChCosmeticPeriods',
  'chDentist:Dentist': 'ChDentistPeriods',
};

export function periodResourceKey(branch: string, clinic: string): string {
  return PERIOD_RESOURCE[`${branch}:${clinic}`] ?? '';
}

/** 分院別名+診別 → 舊系統頁面標題（如「新增台中健保時段」的變體名稱部分），完全沿用舊 View 用詞。 */
const PERIOD_LABEL: Record<string, string> = {
  'ta:Skin': '台中健保時段',
  'ta:Cosmetic': '台中美容時段',
  'ch:Skin': '二林健保時段',
  'ch:Cosmetic': '二林美容時段',
  'chDentist:Dentist': '二林齒科時段',
};

export function periodLabel(branch: string, clinic: string): string {
  return PERIOD_LABEL[`${branch}:${clinic}`] ?? '時段';
}

/**
 * 後台基礎資料 API：分院/醫師（Phase 1）、時段（Phase 2）。Categorys/QuestionTypes 依後續 Phase 擴充本檔。
 * 路徑走 admin/ 前綴，避免與客戶前台既有 Member 端點路由衝突（見 docs/design/api-design.md）。
 */
@Injectable({ providedIn: 'root' })
export class BasicDataApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase;

  // --- 分院（分頁，pageSize 固定 20，見 docs/design/frontend-backend.md §分頁規範）---
  listBranches(page = 1): Observable<ApiResponse<PagedResult<BranchAdmin>>> {
    return this.http.get<ApiResponse<PagedResult<BranchAdmin>>>(`${this.base}/admin/branches?page=${page}`);
  }

  /** 全量已啟用分院（不分頁，依 Sort 排序），供下拉選單使用（如會員列表分院篩選）。 */
  listEnabledBranches(): Observable<ApiResponse<PagedResult<BranchAdmin>>> {
    return this.http.get<ApiResponse<PagedResult<BranchAdmin>>>(`${this.base}/admin/branches?enabledOnly=true`);
  }

  getBranch(id: string): Observable<ApiResponse<BranchAdmin>> {
    return this.http.get<ApiResponse<BranchAdmin>>(`${this.base}/admin/branches/${id}`);
  }

  createBranch(req: BranchUpsertRequest): Observable<ApiResponse<BranchAdmin>> {
    return this.http.post<ApiResponse<BranchAdmin>>(`${this.base}/admin/branches`, req);
  }

  updateBranch(id: string, req: BranchUpsertRequest): Observable<ApiResponse<BranchAdmin>> {
    return this.http.put<ApiResponse<BranchAdmin>>(`${this.base}/admin/branches/${id}`, req);
  }

  deleteBranch(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/admin/branches/${id}`);
  }

  sortBranches(items: SortItem[]): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/admin/branches/sort`, { items });
  }

  // --- 醫師（無排序）---
  listDoctors(): Observable<ApiResponse<DoctorAdmin[]>> {
    return this.http.get<ApiResponse<DoctorAdmin[]>>(`${this.base}/admin/doctors`);
  }

  getDoctor(id: string): Observable<ApiResponse<DoctorAdmin>> {
    return this.http.get<ApiResponse<DoctorAdmin>>(`${this.base}/admin/doctors/${id}`);
  }

  createDoctor(req: DoctorUpsertRequest): Observable<ApiResponse<DoctorAdmin>> {
    return this.http.post<ApiResponse<DoctorAdmin>>(`${this.base}/admin/doctors`, req);
  }

  updateDoctor(id: string, req: DoctorUpsertRequest): Observable<ApiResponse<DoctorAdmin>> {
    return this.http.put<ApiResponse<DoctorAdmin>>(`${this.base}/admin/doctors/${id}`, req);
  }

  deleteDoctor(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/admin/doctors/${id}`);
  }

  // --- 時段（branch: 'ta'|'ch'|'chDentist'，clinic: 'Skin'|'Cosmetic'|'Dentist'）---
  listOutpatientTimes(): Observable<ApiResponse<OutpatientTime[]>> {
    return this.http.get<ApiResponse<OutpatientTime[]>>(`${this.base}/admin/outpatient-times`);
  }

  listPeriods(branch: string, clinic: string): Observable<ApiResponse<PeriodAdmin[]>> {
    return this.http.get<ApiResponse<PeriodAdmin[]>>(`${this.base}/admin/periods/${periodSlug(branch, clinic)}`);
  }

  /** 該分院是否自動配號（決定時段表單/清單/排班是否呈現「配號」模式）。branch: 'ta'|'ch'|'chDentist'。 */
  getPeriodBranchMeta(branch: string): Observable<ApiResponse<PeriodBranchMeta>> {
    return this.http.get<ApiResponse<PeriodBranchMeta>>(`${this.base}/admin/periods/branch-meta?branch=${branch}`);
  }

  createPeriod(branch: string, clinic: string, req: PeriodUpsertRequest): Observable<ApiResponse<PeriodAdmin>> {
    return this.http.post<ApiResponse<PeriodAdmin>>(`${this.base}/admin/periods/${periodSlug(branch, clinic)}`, req);
  }

  updatePeriod(branch: string, clinic: string, id: string, req: PeriodUpsertRequest): Observable<ApiResponse<PeriodAdmin>> {
    return this.http.put<ApiResponse<PeriodAdmin>>(`${this.base}/admin/periods/${periodSlug(branch, clinic)}/${id}`, req);
  }

  deletePeriod(branch: string, clinic: string, id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/admin/periods/${periodSlug(branch, clinic)}/${id}`);
  }

  sortPeriods(branch: string, clinic: string, items: SortItem[]): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/admin/periods/${periodSlug(branch, clinic)}/sort`, { items });
  }

  // --- 科別項目（clinic: 'Skin'|'Cosmetic'，分頁，pageSize 固定 20）---
  listCategories(clinic: string, page = 1): Observable<ApiResponse<PagedResult<CategoryAdmin>>> {
    return this.http.get<ApiResponse<PagedResult<CategoryAdmin>>>(`${this.base}/admin/categories/${categorySlug(clinic)}?page=${page}`);
  }

  /** 全量（不分頁），供其他表單下拉/多選使用（科別項目數量少，非分頁清單場景）。 */
  listAllCategories(clinic: string): Observable<ApiResponse<CategoryAdmin[]>> {
    return this.http.get<ApiResponse<CategoryAdmin[]>>(`${this.base}/admin/categories/${categorySlug(clinic)}/all`);
  }

  createCategory(clinic: string, req: CategoryUpsertRequest): Observable<ApiResponse<CategoryAdmin>> {
    return this.http.post<ApiResponse<CategoryAdmin>>(`${this.base}/admin/categories/${categorySlug(clinic)}`, req);
  }

  updateCategory(clinic: string, id: string, req: CategoryUpsertRequest): Observable<ApiResponse<CategoryAdmin>> {
    return this.http.put<ApiResponse<CategoryAdmin>>(`${this.base}/admin/categories/${categorySlug(clinic)}/${id}`, req);
  }

  deleteCategory(clinic: string, id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/admin/categories/${categorySlug(clinic)}/${id}`);
  }

  sortCategories(clinic: string, items: SortItem[]): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/admin/categories/${categorySlug(clinic)}/sort`, { items });
  }

  // --- 問卷類型（真實 Lims 無獨立 Questions key，題目/選項也共用 Resource="QuestionTypes"）---
  listQuestionTypes(categoryId?: string): Observable<ApiResponse<QuestionTypeAdmin[]>> {
    const q = categoryId ? `?categoryId=${categoryId}` : '';
    return this.http.get<ApiResponse<QuestionTypeAdmin[]>>(`${this.base}/admin/question-types${q}`);
  }

  createQuestionType(req: QuestionTypeUpsertRequest): Observable<ApiResponse<QuestionTypeAdmin>> {
    return this.http.post<ApiResponse<QuestionTypeAdmin>>(`${this.base}/admin/question-types`, req);
  }

  updateQuestionType(id: string, req: QuestionTypeUpsertRequest): Observable<ApiResponse<QuestionTypeAdmin>> {
    return this.http.put<ApiResponse<QuestionTypeAdmin>>(`${this.base}/admin/question-types/${id}`, req);
  }

  deleteQuestionType(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/admin/question-types/${id}`);
  }

  sortQuestionTypes(items: SortItem[]): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/admin/question-types/sort`, { items });
  }

  // --- 問卷題目 + 選項 ---
  listQuestions(questionTypeId: string): Observable<ApiResponse<QuestionAdmin[]>> {
    return this.http.get<ApiResponse<QuestionAdmin[]>>(`${this.base}/admin/question-types/${questionTypeId}/questions`);
  }

  createQuestion(questionTypeId: string, req: QuestionUpsertRequest): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/admin/questions?questionTypeId=${questionTypeId}`, req);
  }

  updateQuestion(id: string, req: QuestionUpsertRequest): Observable<ApiResponse<unknown>> {
    return this.http.put<ApiResponse<unknown>>(`${this.base}/admin/questions/${id}`, req);
  }

  deleteQuestion(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/admin/questions/${id}`);
  }

  sortQuestions(questionTypeId: string, items: SortItem[]): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/admin/questions/sort?questionTypeId=${questionTypeId}`, { items });
  }
}
