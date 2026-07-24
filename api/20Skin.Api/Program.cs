using System.Reflection;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Serilog;
using Serilog.Formatting.Compact;
using Skin.Api.Auth;
using Skin.Api.Routing;
using Skin.Data;
using Skin.Services;
using Skin.Services.Booking;
using Skin.Services.Recaptcha;
using Skin.Services.Sms;

var builder = FunctionsApplication.CreateBuilder(args);

builder.ConfigureFunctionsWebApplication();

// 觀測：Serilog 結構化 log（JSON lines，含 traceId，見 ApiRouterFunction）。
// Application Insights sink 待正式環境接上連線字串時再加（見 docs/design/infrastructure.md）。
builder.Services.AddSerilog((services, lc) => lc
    .ReadFrom.Services(services)
    .Enrich.FromLogContext()
    .WriteTo.Console(new CompactJsonFormatter()));

var config = builder.Configuration;

// --- 自訂 router 路由表（啟動時反射建立，singleton）---
builder.Services.AddSingleton(new RouteTable(Assembly.GetExecutingAssembly()));

// --- JWT ---
builder.Services.AddSingleton(new JwtOptions
{
    SigningKey = config["Jwt:SigningKey"] ?? "dev-only-insecure-signing-key-change-me-32+chars",
    Issuer = config["Jwt:Issuer"] ?? "20skin",
    Audience = config["Jwt:Audience"] ?? "20skin",
    AccessTokenMinutes = int.TryParse(config["Jwt:AccessTokenMinutes"], out var m) ? m : 60,
    AdminAccessTokenMinutes = int.TryParse(config["Jwt:AdminAccessTokenMinutes"], out var am) ? am : 600,
});
builder.Services.AddSingleton<JwtTokenService>();

// --- 超管（設定驅動，取代舊硬編碼 weypro）---
builder.Services.AddSingleton(new SuperAdminOptions
{
    Username = config["SuperAdmin:Username"] ?? "",
    Password = config["SuperAdmin:Password"] ?? "",
});

// --- 每請求使用者上下文 ---
builder.Services.AddScoped<RequestContext>();

// --- Dapper 連線工廠（沿用 reused DB；無 DbContext/migration）---
builder.Services.AddSingleton<IDbConnectionFactory>(
    new SqlConnectionFactory(config.GetConnectionString("SkinDatabase") ?? ""));

// --- reCAPTCHA ---
builder.Services.AddSingleton(new RecaptchaOptions
{
    SecretKey = config["Recaptcha:SecretKey"] ?? "",
    MinScore = double.TryParse(config["Recaptcha:MinScore"], out var s) ? s : 0.5,
});
builder.Services.AddHttpClient<IRecaptchaVerifier, RecaptchaVerifier>();

// --- 業務服務 ---
builder.Services.AddScoped<IMemberService, MemberService>();
builder.Services.AddScoped<Skin.Services.Admin.IAdminService, Skin.Services.Admin.AdminService>();

// 後台基礎資料（分院/醫師；Categorys/QuestionTypes 依 Phase 陸續加入）
builder.Services.AddScoped<Skin.Services.BasicData.IBranchAdminService, Skin.Services.BasicData.BranchAdminService>();
builder.Services.AddScoped<Skin.Services.BasicData.IDoctorAdminService, Skin.Services.BasicData.DoctorAdminService>();

// 後台基礎資料：時段（Ta/Ch/ChDentist 分院別名 → 實際 BranchID，設定驅動，GUID 不進原始碼）
builder.Services.AddSingleton(new Skin.Services.BasicData.PeriodsOptions
{
    BranchIdByAlias = ReadBranchAliasMap(config),
});
builder.Services.AddScoped<Skin.Services.BasicData.IPeriodAdminService, Skin.Services.BasicData.PeriodAdminService>();

// 後台基礎資料：科別項目（Skin/Cosmetic 診別參數化，取代舊 Skins/Cosmetics 2 變體）
builder.Services.AddScoped<Skin.Services.BasicData.ICategoryAdminService, Skin.Services.BasicData.CategoryAdminService>();

// 後台基礎資料：問卷類型 + 題目/選項（真實 Lims 無獨立 Questions key，兩者皆掛 Resource="QuestionTypes"）
builder.Services.AddScoped<Skin.Services.BasicData.IQuestionTypeAdminService, Skin.Services.BasicData.QuestionTypeAdminService>();
builder.Services.AddScoped<Skin.Services.BasicData.IQuestionAdminService, Skin.Services.BasicData.QuestionAdminService>();

// 後台排班（分院別名重用 Skin.Services.BasicData.PeriodsOptions，見 docs/blueprints/admin-roster.md）
builder.Services.AddScoped<Skin.Services.Roster.IRosterAdminService, Skin.Services.Roster.RosterAdminService>();

// 後台會員管理（查詢/編輯/黑名單 + 問卷掃描檔上傳維護，見 docs/blueprints/admin-member.md）
builder.Services.AddScoped<Skin.Services.Member.IMemberAdminService, Skin.Services.Member.MemberAdminService>();

// 後台預約管理（分院別名重用 Skin.Services.BasicData.PeriodsOptions，見 docs/blueprints/admin-reserve.md）
builder.Services.AddScoped<Skin.Services.Reserve.IAppointmentAdminService, Skin.Services.Reserve.AppointmentAdminService>();

// 後台儀表板（區塊依管理員可讀權限過濾，見 docs/blueprints/admin-dashboard.md）
builder.Services.AddScoped<Skin.Services.Dashboard.IDashboardAdminService, Skin.Services.Dashboard.DashboardAdminService>();

// 預約規則（設定驅動，取代舊硬編碼分院 GUID）
builder.Services.AddSingleton(new BookingOptions
{
    DuplicateWindowDaysByBranch = ReadBookingWindowMap(config),
});
builder.Services.AddScoped<IBookingService, BookingService>();
builder.Services.AddScoped<IAppointmentService, AppointmentService>();

// 問卷（術前電子病歷）
builder.Services.AddScoped<Skin.Services.Question.IQuestionService, Skin.Services.Question.QuestionService>();

// 檔案上傳（Azure Blob；連線字串統一用 AzureWebJobsStorage，本機 = Azurite）
builder.Services.AddSingleton(new Skin.Services.Storage.StorageOptions
{
    ConnectionString = config["AzureWebJobsStorage"] ?? "UseDevelopmentStorage=true",
    Container = config["Blob:Container"] ?? "upload",
    MaxBytes = (long.TryParse(config["Blob:MaxMB"], out var mb) ? mb : 8) * 1024 * 1024,
});
builder.Services.AddSingleton<Skin.Services.Storage.IFileStorage, Skin.Services.Storage.BlobFileStorage>();

// 簡訊寄送：總開關 Sms:Enabled 決定真發（智邦 API）或 no-op（不真的發；客人手機）。
// 正式環境部署後預設停用（Enabled=false → NoOp），驗證智邦帳號後再手動開啟。dev 恆停用。
// 機密（ApiKey/Username/Password）正式環境由 Key Vault 提供。
var smsOptions = new SmsOptions
{
    Enabled = bool.TryParse(config["Sms:Enabled"], out var smsEnabled) && smsEnabled,
    ApiUrl = config["Sms:ApiUrl"] is { Length: > 0 } smsUrl ? smsUrl : "https://pp.url.com.tw/api/msg",
    ApiKey = config["Sms:ApiKey"] ?? "",
    Username = config["Sms:Username"] ?? "",
    Password = config["Sms:Password"] ?? "",
};
builder.Services.AddSingleton(smsOptions);
if (smsOptions.Enabled)
    builder.Services.AddHttpClient<ISmsSender, ChiefTelSmsSender>();
else
    builder.Services.AddSingleton<ISmsSender, DevNoOpSmsSender>();
// 簡訊排程（Timer 撈當日待發，見 SmsReminderTimerFunction）。
builder.Services.AddScoped<ISmsService, SmsService>();

builder.Build().Run();

// Azure Functions Flex Consumption 的 App Setting 名稱不接受連字號（GUID 一定含連字號），故無法把
// "Periods:BranchIdByAlias:<GUID>" 這種逐項攤平的巢狀 key 直接部署成 App Setting（本機 local.settings.json
// 沒有這個限制，仍可用巢狀 key，下面優先讀取巢狀 key 以維持本機開發行為不變）。
// 正式環境改用單一 JSON 字串設定（"Periods:BranchIdByAliasJson"，對應 App Setting 名
// `Periods__BranchIdByAliasJson`，值本身不受這個名稱限制），僅在巢狀 key 查無資料時才 fallback 解析。
static Dictionary<string, Guid> ReadBranchAliasMap(IConfiguration config)
{
    var map = config.GetSection("Periods:BranchIdByAlias")
        .GetChildren().ToDictionary(c => c.Key, c => Guid.TryParse(c.Value, out var g) ? g : Guid.Empty,
            StringComparer.OrdinalIgnoreCase);
    if (map.Count == 0 && config["Periods:BranchIdByAliasJson"] is { Length: > 0 } json)
    {
        var raw = JsonSerializer.Deserialize<Dictionary<string, string>>(json) ?? new();
        map = raw.ToDictionary(kv => kv.Key, kv => Guid.TryParse(kv.Value, out var g) ? g : Guid.Empty,
            StringComparer.OrdinalIgnoreCase);
    }
    return map;
}

static Dictionary<string, int> ReadBookingWindowMap(IConfiguration config)
{
    var map = config.GetSection("Booking:DuplicateWindowDaysByBranch")
        .GetChildren().ToDictionary(c => c.Key, c => int.TryParse(c.Value, out var v) ? v : 0,
            StringComparer.OrdinalIgnoreCase);
    if (map.Count == 0 && config["Booking:DuplicateWindowDaysByBranchJson"] is { Length: > 0 } json)
    {
        var raw = JsonSerializer.Deserialize<Dictionary<string, int>>(json) ?? new();
        map = new Dictionary<string, int>(raw, StringComparer.OrdinalIgnoreCase);
    }
    return map;
}
