namespace Skin.Core.Dtos;

/// <summary>後台基礎資料管理 DTO（見 docs/blueprints/admin-basic-data.md）。</summary>

/// <summary>分院（列表/詳情）。</summary>
public sealed record BranchAdminDto(Guid BranchId, string Title, int BranchType, string Photo, bool IsAutoRowNumber, int Sort, bool IsEnabled);

/// <summary>新增/編輯分院請求。</summary>
public sealed record BranchUpsertRequest(string Title, int BranchType, string? Photo, bool IsAutoRowNumber, bool IsEnabled);

/// <summary>醫師（列表/詳情）。Doctors 表無 Sort/IsEnabled 欄位。</summary>
public sealed record DoctorAdminDto(Guid DoctorId, string Name);

/// <summary>新增/編輯醫師請求。</summary>
public sealed record DoctorUpsertRequest(string Name);

/// <summary>排序項（PK + 目標 Sort 值）。</summary>
public sealed record SortItem(Guid Id, int Sort);

/// <summary>批次排序請求。</summary>
public sealed record SortRequest(List<SortItem> Items);

/// <summary>時段（列表/詳情）。BranchID/Clinic 由所屬變體 proxy 決定，編輯時不可改。</summary>
public sealed record PeriodAdminDto(Guid PeriodId, Guid BranchId, int OutpatientTimeId, string OutpatientTimeTitle, string Clinic, string Title, int? StartNumber, int Patients, int Sort);

/// <summary>新增/編輯時段請求（不含 BranchID/Clinic，由路由決定）。</summary>
public sealed record PeriodUpsertRequest(int OutpatientTimeId, string Title, int? StartNumber, int Patients);

/// <summary>門診時段字典（上午/下午/晚上），下拉選單用。</summary>
public sealed record OutpatientTimeDto(int OutpatientTimeId, string Title);

/// <summary>科別項目（列表/詳情）。Clinic 由所屬變體 proxy 決定，編輯時不可改。</summary>
public sealed record CategoryAdminDto(Guid CategoryId, string Clinic, string Title, string? Intro, string Photo, bool IsQuestion, bool IsOnly, bool ChIsOnly, bool ChDentistIsOnly, int Sort);

/// <summary>新增/編輯科別項目請求（不含 Clinic，由路由決定）。</summary>
public sealed record CategoryUpsertRequest(string Title, string? Intro, string? Photo, bool IsQuestion, bool IsOnly, bool ChIsOnly, bool ChDentistIsOnly);

/// <summary>問卷類型（列表/詳情）。CategoryTitle 為顯示用（JOIN Categorys）。刪除為軟刪（IsEnabled=false），沿用舊系統。</summary>
public sealed record QuestionTypeAdminDto(Guid QuestionTypeId, Guid CategoryId, string CategoryTitle, string Title, int Sort, bool IsEnabled);

/// <summary>新增/編輯問卷類型請求。</summary>
public sealed record QuestionTypeUpsertRequest(Guid CategoryId, string Title);

/// <summary>問卷題目選項（列表用）。</summary>
public sealed record QuestionAnswerAdminDto(Guid QuestionAnswerId, string Title, int Sort);

/// <summary>問卷題目選項輸入（編輯時整組送出，QuestionAnswerId 為 null 表新增）。</summary>
public sealed record QuestionAnswerInput(Guid? QuestionAnswerId, string Title, int Sort);

/// <summary>問卷題目（含巢狀選項）。刪除為軟刪（IsEnabled=false）。</summary>
public sealed record QuestionAdminDto(Guid QuestionId, Guid QuestionTypeId, string Title, int OptionType, bool IsOther, string? OtherTitle, int Sort, bool IsEnabled, List<QuestionAnswerAdminDto> Answers);

/// <summary>新增/編輯問卷題目請求（含整組選項，後端比對 diff：新舊 ID 比對增/改/硬刪，沿用舊系統行為）。</summary>
public sealed record QuestionUpsertRequest(string Title, int OptionType, bool IsOther, string? OtherTitle, List<QuestionAnswerInput> Answers);
