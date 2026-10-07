using System.ComponentModel;
using System.Globalization;
using System.Windows;

namespace NargisClinic.Desktop.Localization;

public enum AppLanguage
{
    English,
    Arabic,
}

/// <summary>
/// Single source of UI text. XAML binds with <c>{Binding [key], Source={x:Static Strings.Instance}}</c>,
/// so switching language refreshes every bound label without reloading the window.
/// </summary>
public sealed class Strings : INotifyPropertyChanged
{
    private AppLanguage _language = AppLanguage.English;

    public static Strings Instance { get; } = new();

    public event PropertyChangedEventHandler? PropertyChanged;

    public event EventHandler? LanguageChanged;

    public AppLanguage Language
    {
        get => _language;
        set
        {
            if (_language == value)
                return;

            _language = value;
            Raise(nameof(Language));
            Raise(nameof(FlowDirection));
            Raise("Item[]");
            LanguageChanged?.Invoke(this, EventArgs.Empty);
        }
    }

    public FlowDirection FlowDirection => _language == AppLanguage.Arabic ? FlowDirection.RightToLeft : FlowDirection.LeftToRight;

    public CultureInfo Culture => CultureInfo.GetCultureInfo(_language == AppLanguage.Arabic ? "ar-IQ" : "en-US");

    public string this[string key] => StringTable.Get(key, _language);

    public string Format(string key, params object[] args) => string.Format(Culture, this[key], args);

    private void Raise(string propertyName) => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
}

/// <summary>English and Arabic text for every visible label. Missing keys show the key itself, so gaps are easy to spot.</summary>
internal static class StringTable
{
    private static readonly Dictionary<string, (string English, string Arabic)> Entries = new()
    {
        ["app_name"] = ("Nargis Dental Clinic", "نرجس لطب الأسنان"),
        ["login_title"] = ("Welcome back", "أهلاً بعودتك"),
        ["login_subtitle"] = ("Sign in to your clinic workspace.", "سجّل الدخول إلى مساحة عمل العيادة."),
        ["email"] = ("Email", "البريد الإلكتروني"),
        ["password"] = ("Password", "كلمة المرور"),
        ["sign_in"] = ("Sign in", "تسجيل الدخول"),
        ["signing_in"] = ("Signing in…", "جارٍ تسجيل الدخول…"),
        ["sign_out"] = ("Sign out", "تسجيل الخروج"),
        ["language_switch"] = ("العربية", "English"),
        ["not_configured"] = (
            "This app is not connected to a clinic server yet. Add the Supabase URL and publishable key to supabase.settings.json.",
            "التطبيق غير متصل بخادم العيادة بعد. أضف رابط Supabase والمفتاح العام إلى ملف supabase.settings.json."),
        ["err_fields_required"] = ("Enter your email and password.", "أدخل البريد الإلكتروني وكلمة المرور."),
        ["err_invalid_credentials"] = ("The email or password is incorrect.", "البريد الإلكتروني أو كلمة المرور غير صحيحة."),
        ["err_network"] = (
            "Could not reach the clinic server. Check your internet connection and try again.",
            "تعذر الوصول إلى خادم العيادة. تحقق من اتصال الإنترنت وحاول مرة أخرى."),
        ["err_no_clinic"] = ("This account is not linked to an active clinic.", "هذا الحساب غير مرتبط بعيادة نشطة."),
        ["err_unknown"] = ("Something went wrong. Please try again.", "حدث خطأ. حاول مرة أخرى."),
        ["signed_in_as"] = ("Signed in as {0}", "مسجّل الدخول باسم {0}"),
        ["clinic_label"] = ("Clinic", "العيادة"),
        ["nav_patients"] = ("Patients", "المرضى"),
        ["nav_appointments"] = ("Appointments", "المواعيد"),
        ["nav_payments"] = ("Payments", "المدفوعات"),
        ["nav_staff"] = ("Staff", "الموظفون"),
        ["nav_inventory"] = ("Inventory", "المخزون"),
        ["nav_reports"] = ("Reports", "التقارير"),
        ["nav_settings"] = ("Settings", "الإعدادات"),
        ["coming_soon_title"] = ("Coming soon", "قريباً"),
        ["coming_soon_body"] = (
            "This screen is part of the Windows app roadmap. Use the web workspace for it until it ships here.",
            "هذه الشاشة ضمن خطة تطبيق ويندوز. استخدم نسخة الويب لها إلى أن تصل إلى هنا."),
        ["no_sections"] = (
            "Your role does not have access to any screen yet. Ask an administrator to review your role.",
            "دورك الحالي لا يملك صلاحية الوصول لأي شاشة. اطلب من المدير مراجعة دورك."),
        ["role_owner"] = ("Owner", "المالك"),
        ["role_admin"] = ("Administrator", "مدير"),
        ["role_dentist"] = ("Dentist", "طبيب أسنان"),
        ["role_hygienist"] = ("Dental hygienist", "أخصائي صحة الأسنان"),
        ["role_assistant"] = ("Dental assistant", "مساعد طبيب أسنان"),
        ["role_front_desk"] = ("Front desk", "الاستقبال"),
        ["role_billing"] = ("Billing", "الفوترة"),
        ["role_viewer"] = ("Viewer", "مشاهد"),
        ["role_unknown"] = ("No access", "بدون صلاحية"),
        ["patients_title"] = ("Patients", "المرضى"),
        ["patients_search_placeholder"] = ("Search by name, phone or patient number", "ابحث بالاسم أو الهاتف أو رقم المريض"),
        ["patients_count"] = ("{0} patients", "{0} مريض"),
        ["patients_empty"] = ("No patients match your search.", "لا يوجد مرضى مطابقون للبحث."),
        ["patients_load_error"] = ("Patients could not be loaded.", "تعذر تحميل قائمة المرضى."),
        ["page_indicator"] = ("Page {0} of {1}", "صفحة {0} من {1}"),
        ["previous"] = ("Previous", "السابق"),
        ["next"] = ("Next", "التالي"),
        ["retry"] = ("Retry", "إعادة المحاولة"),
        ["loading"] = ("Loading…", "جارٍ التحميل…"),
        ["col_number"] = ("Patient no.", "رقم المريض"),
        ["col_name"] = ("Name", "الاسم"),
        ["col_phone"] = ("Phone", "الهاتف"),
        ["col_age"] = ("Age", "العمر"),
        ["col_balance"] = ("Balance", "الرصيد"),
        ["col_status"] = ("Status", "الحالة"),
        ["col_last_visit"] = ("Last visit", "آخر زيارة"),
        ["status_active"] = ("Active", "نشط"),
        ["status_inactive"] = ("Inactive", "غير نشط"),
        ["no_visits"] = ("No visits yet", "لا توجد زيارات بعد"),
        ["age_years"] = ("{0} yrs", "{0} سنة"),
    };

    public static string Get(string key, AppLanguage language)
    {
        if (!Entries.TryGetValue(key, out var entry))
            return key;

        return language == AppLanguage.Arabic ? entry.Arabic : entry.English;
    }
}
