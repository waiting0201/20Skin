using System.Reflection;
using Microsoft.Azure.Functions.Worker.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Skin.Api.Auth;
using Skin.Api.Routing;
using Skin.Data;
using Skin.Services;
using Skin.Services.Booking;
using Skin.Services.Recaptcha;
using Skin.Services.Sms;

var builder = FunctionsApplication.CreateBuilder(args);

builder.ConfigureFunctionsWebApplication();

// TODO: 觀測（Serilog + Application Insights）見 docs/design/infrastructure.md

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

// 預約規則（設定驅動，取代舊硬編碼分院 GUID）
builder.Services.AddSingleton(new BookingOptions
{
    DuplicateWindowDaysByBranch = config.GetSection("Booking:DuplicateWindowDaysByBranch")
        .GetChildren().ToDictionary(c => c.Key, c => int.TryParse(c.Value, out var v) ? v : 0,
            StringComparer.OrdinalIgnoreCase),
});
builder.Services.AddScoped<IBookingService, BookingService>();
builder.Services.AddScoped<IAppointmentService, AppointmentService>();

// 問卷（術前電子病歷）
builder.Services.AddScoped<Skin.Services.Question.IQuestionService, Skin.Services.Question.QuestionService>();

// 簡訊寄送：dev 用 no-op（不真的發；客人手機）。正式環境改注入智邦 API 實作。
builder.Services.AddSingleton<ISmsSender, DevNoOpSmsSender>();

builder.Build().Run();
