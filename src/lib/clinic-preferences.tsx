"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AppLanguage, ClinicCurrency } from "@/lib/types";
import {
  loadClinicPreferences,
  persistClinicPreferences,
  SAVE_FAILED,
  type ActionResult,
} from "@/lib/supabase/clinic-data";
import { hasSupabaseConfig } from "@/lib/supabase/client";
import {
  DEFAULT_CLINIC_TIME_ZONE,
  clinicDateLabel,
  clinicTimeLabel,
  localDateTimeToIso,
  resolveClinicTimeZone,
} from "@/lib/clinic-time";
import arAuth from "@/lib/i18n/ar/auth";
import arCommon from "@/lib/i18n/ar/common";
import arAppointments from "@/lib/i18n/ar/appointments";
import arDashboard from "@/lib/i18n/ar/dashboard";
import arErrors from "@/lib/i18n/ar/errors";
import arInventory from "@/lib/i18n/ar/inventory";
import arPatients from "@/lib/i18n/ar/patients";
import arPayments from "@/lib/i18n/ar/payments";
import arReports from "@/lib/i18n/ar/reports";
import arSettings from "@/lib/i18n/ar/settings";
import arShell from "@/lib/i18n/ar/shell";
import arStaff from "@/lib/i18n/ar/staff";
import arTreatments from "@/lib/i18n/ar/treatments";

export type TranslationParams = Record<string, string | number>;
export type DateInput = string | Date;
export type ClinicLocale = "ar-IQ" | "en-US";

export type ClinicPreferences = {
  /** Active UI language. Follows this workstation's choice, or the clinic default when there is none. */
  language: AppLanguage;
  isRtl: boolean;
  locale: ClinicLocale;
  /** Changes the language on this workstation only (cookie and localStorage). Never writes to the database. */
  setLanguage: (language: AppLanguage) => void;
  /** Writes the clinic-wide default (owner and admin only), then applies it on this workstation. */
  setClinicDefaultLanguage: (language: AppLanguage) => Promise<ActionResult>;
  currency: ClinicCurrency;
  setCurrency: (currency: ClinicCurrency) => Promise<ActionResult>;
  formatMoney: (value: number) => string;
  formatCompactMoney: (value: number) => string;
  /** Clinic-local date label. Set `options.timeZone` to the clinic zone. Defaults to Asia/Baghdad. */
  formatDate: (value: DateInput, options?: Intl.DateTimeFormatOptions) => string;
  /** Clinic-local time label, such as "8:30 AM". Set `options.timeZone` to the clinic zone. */
  formatTime: (value: DateInput, options?: Intl.DateTimeFormatOptions) => string;
  /** Returns the translation of an English key. {name} placeholders come from `params`. */
  t: (english: string, params?: TranslationParams) => string;
};

// The cookie name is also hard-coded in src/app/layout.tsx. A "use client" module cannot
// export a plain value to server code, so keep both in sync.
const LANGUAGE_COOKIE = "nargis-lang";
const LANGUAGE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const LANGUAGE_STORAGE_KEY = "nargis-lang";
const CURRENCY_STORAGE_KEY = "clinic-currency";
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PLACEHOLDER_PATTERN = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

/**
 * Legacy Arabic strings, kept as fallbacks. Each key is the English text exactly as it
 * appears in the JSX. The per-area files in src/lib/i18n/ar/ override these entries.
 */
const legacyAr: Record<string, string> = {
  "Could not open your clinic workspace. Please try again.":
    "تعذر فتح مساحة عمل العيادة. يرجى المحاولة مرة أخرى.",
  "Your account is not linked to a clinic workspace.": "حسابك غير مرتبط بمساحة عمل عيادة.",
  "Could not connect to the authentication service. Please try again.":
    "تعذر الاتصال بخدمة المصادقة. يرجى المحاولة مرة أخرى.",
  "Save PDF": "حفظ PDF",
  "Preparing PDF…": "جارٍ تجهيز PDF…",
  "PDF could not be created. Try again or use Print.":
    "تعذر إنشاء PDF. حاول مجدداً أو استخدم الطباعة.",
  "My profile": "ملفي الشخصي",
  "Edit profile": "تعديل الملف الشخصي",
  "Edit your photo, cover, bio and personal badges": "عدّل صورتك وغلافك ونبذتك وشاراتك الشخصية",
  "Camera unavailable. Allow camera access or upload a photo.":
    "الكاميرا غير متاحة. اسمح باستخدام الكاميرا أو ارفع صورة.",
  "Take photo": "التقاط صورة",
  "Image preview": "معاينة الصورة",
  "Zoom": "تكبير",
  "Vertical position": "الموضع العمودي",
  "Use image": "استخدام الصورة",
  "Choose a JPG, PNG or WebP image under 10 MB": "اختر صورة JPG أو PNG أو WebP أصغر من ١٠ ميغابايت",
  "Image could not be loaded": "تعذر تحميل الصورة",
  "Profile saved": "تم حفظ الملف الشخصي",
  "Profile could not be saved": "تعذر حفظ الملف الشخصي",
  "Profile could not be loaded": "تعذر تحميل الملف الشخصي",
  "Cover image": "صورة الغلاف",
  "Remove cover": "إزالة الغلاف",
  "Profile photo": "الصورة الشخصية",
  "Upload photo": "رفع صورة",
  "Remove photo": "إزالة الصورة",
  "Display name": "الاسم المعروض",
  "Bio": "نبذة عني",
  "Personal badges": "الشارات الشخصية",
  "Add a personal badge": "أضف شارة شخصية",
  "Add badge": "إضافة شارة",
  "Remove badge": "إزالة الشارة",
  "Inventory report": "تقرير المخزون",
  "Above reorder level": "أعلى من حد إعادة الطلب",
  "Navigation": "التنقل",
  "Create your account.": "أنشئ حسابك.",
  "New here?": "مستخدم جديد؟",
  "Retry": "إعادة المحاولة",
  "Doctors": "الأطباء",
  "Staff": "الموظفون",
  "active": "نشط",
  "invited": "تمت دعوته",
  "suspended": "موقوف",
  "Visits in this view": "الزيارات في هذه الفترة",
  "Dental hygienist": "أخصائي صحة الأسنان",
  "Dental assistant": "مساعد طبيب أسنان",
  "Front desk": "الاستقبال",
  "Billing": "الفوترة",
  "Search team": "البحث في الفريق",
  "Search team…": "ابحث عن أحد أعضاء الفريق…",
  "Filter by role": "التصفية حسب الدور",
  "All roles": "كل الأدوار",
  "Clinic team": "فريق العيادة",
  "Email not recorded": "لم يُسجّل بريد إلكتروني",
  "Login connected": "حساب دخول مرتبط",
  "Staff record only": "سجل موظف فقط",
  "No team members found": "لم يتم العثور على أعضاء في الفريق",
  "Try another name or choose a different role.": "جرّب اسماً آخر أو اختر دوراً مختلفاً.",
  "Clear filters": "مسح عوامل التصفية",
  "General dentistry": "طب الأسنان العام",
  "Appointment details": "تفاصيل الموعد",
  "Review the visit details and scheduled time.": "راجع تفاصيل الزيارة والوقت المحدد.",
  "The visit duration stays the same when rescheduling.":
    "تبقى مدة الزيارة كما هي عند تغيير موعدها.",
  "Saving…": "جارٍ الحفظ…",
  "Save schedule": "حفظ الموعد",
  "Previous period": "الفترة السابقة",
  "Next period": "الفترة التالية",
  "Agenda": "قائمة المواعيد",
  "Choose a visit to see details": "اختر زيارة لعرض التفاصيل",
  "A little breathing room": "وقت متاح في جدولك",
  "No appointments match this week. Try another date or clear your search.":
    "لا توجد مواعيد مطابقة لهذا الأسبوع. جرّب تاريخاً آخر أو امسح البحث.",
  "Outside calendar hours": "خارج ساعات التقويم",
  "Select a visit to review or reschedule it. You can also drag cards between time slots.":
    "اختر زيارة لمراجعتها أو تغيير موعدها. يمكنك أيضاً سحب البطاقات بين الفترات الزمنية.",
  "Select a visit to review its details.": "اختر زيارة لمراجعة تفاصيلها.",
  "No appointments today": "لا توجد مواعيد اليوم",
  "Active patients": "المرضى النشطون",
  "Completed visits": "الزيارات المكتملة",
  "No recent activity": "لا يوجد نشاط حديث",
  "Payments and appointment updates will appear here.": "ستظهر المدفوعات وتحديثات المواعيد هنا.",
  "No financial activity yet": "لا يوجد نشاط مالي حتى الآن",
  "live invoices": "فواتير مسجلة",
  "Clinic overview": "نظرة عامة على العيادة",
  "Demo workspace": "مساحة عمل تجريبية",
  "Recorded payments": "المدفوعات المسجلة",
  "All time": "كل الفترات",
  "Total collected": "إجمالي المبالغ المحصلة",
  "Progress": "التقدم",
  "Page sections": "أقسام الصفحة",
  "Receipt": "إيصال",
  "Previous page": "الصفحة السابقة",
  "Next page": "الصفحة التالية",
  "Pagination": "التنقل بين الصفحات",
  "Loading page": "جارٍ تحميل الصفحة",
  "Page": "الصفحة",
  "of": "من",
  "Surface findings": "نتائج فحص الأسطح",
  "Permanent dentition": "الأسنان الدائمة",
  "Patient's right": "يمين المريض",
  "Patient's left": "يسار المريض",
  "Upper arch": "الفك العلوي",
  "Lower arch": "الفك السفلي",
  "Universal numbering": "نظام الترقيم العالمي",
  "Tooth": "السن",
  "Molar": "ضرس",
  "Premolar": "ضاحك",
  "Canine": "ناب",
  "Incisor": "قاطع",
  "Dental Studio": "مركز طب الأسنان",
  "Workspace": "مساحة العمل",
  "Overview": "نظرة عامة",
  "Appointments": "المواعيد",
  "Patients": "المرضى",
  "Treatment plans": "خطط العلاج",
  "Management": "الإدارة",
  "Payments": "المدفوعات",
  "Doctors & staff": "الأطباء والموظفون",
  "Inventory": "المخزون",
  "Reports & analytics": "التقارير والتحليلات",
  "Clinic settings": "إعدادات العيادة",
  "Owner": "المالك",
  "Live workspace": "مساحة عمل مباشرة",
  "Today’s appointments": "مواعيد اليوم",
  "Total patients": "إجمالي المرضى",
  "Outstanding": "المبالغ المستحقة",
  "Active treatments": "العلاجات النشطة",
  "Revenue overview": "نظرة عامة على الإيرادات",
  "This year": "هذا العام",
  "Today’s schedule": "جدول اليوم",
  "View calendar": "عرض التقويم",
  "Treatment pipeline": "مسار العلاج",
  "Patient care": "رعاية المرضى",
  "Recall and retention": "المراجعة والاستبقاء",
  "Recent activity": "النشاط الأخير",
  "Proposed": "مقترح",
  "In progress": "قيد التنفيذ",
  "Completed": "مكتمل",
  "Retention": "الاستبقاء",
  "Payment received": "تم استلام دفعة",
  "Appointment booked": "تم حجز موعد",
  "Add patient": "إضافة مريض",
  "All patients": "كل المرضى",
  "Active": "نشط",
  "Inactive": "غير نشط",
  "Patient": "المريض",
  "Contact": "التواصل",
  "Last visit": "آخر زيارة",
  "Alerts": "التنبيهات",
  "Balance": "الرصيد",
  "Status": "الحالة",
  "Paid": "مدفوع",
  "Back to all patients": "العودة إلى جميع المرضى",
  "Book visit": "حجز زيارة",
  "Save profile": "حفظ الملف",
  "Dental chart": "مخطط الأسنان",
  "Visit history": "سجل الزيارات",
  "X-rays & images": "الأشعة والصور",
  "Medical profile": "الملف الطبي",
  "Allergies": "الحساسيات",
  "Medical conditions": "الحالات الطبية",
  "Financial summary": "الملخص المالي",
  "Insurance": "التأمين",
  "Interactive odontogram": "مخطط الأسنان التفاعلي",
  "Universal numbering system · adult dentition": "نظام الترقيم العالمي · أسنان البالغين",
  "Save chart": "حفظ المخطط",
  "Healthy": "سليم",
  "Caries": "تسوس",
  "Crown": "تاج",
  "Root Canal": "علاج الجذور",
  "Implant": "زرعة",
  "Extraction": "قلع",
  "Missing": "مفقود",
  "Reset": "إعادة ضبط",
  "Upload files": "رفع الملفات",
  "Add note": "إضافة ملاحظة",
  "New appointment": "موعد جديد",
  "Day": "يوم",
  "Week": "أسبوع",
  "Month": "شهر",
  "Today": "اليوم",
  "Clinic calendar": "تقويم العيادة",
  "Schedule appointment": "جدولة موعد",
  "Procedure": "الإجراء",
  "Date": "التاريخ",
  "Room": "الغرفة",
  "Start time": "وقت البدء",
  "End time": "وقت الانتهاء",
  "Doctor": "الطبيب",
  "Confirmed": "مؤكد",
  "Checked in": "تم تسجيل الوصول",
  "In treatment": "قيد العلاج",
  "Pending": "قيد الانتظار",
  "Cancelled": "ملغي",
  "New treatment plan": "خطة علاج جديدة",
  "Active plans": "الخطط النشطة",
  "Proposed value": "قيمة المقترحات",
  "Treatment progress": "تقدم العلاج",
  "Plan value": "قيمة الخطة",
  "Sessions": "الجلسات",
  "Record session": "تسجيل جلسة",
  "Record payment": "تسجيل دفعة",
  "Collected this month": "المحصل هذا الشهر",
  "Outstanding balance": "الرصيد المستحق",
  "Insurance pending": "التأمين قيد الانتظار",
  "Installments due": "الأقساط المستحقة",
  "Invoice": "الفاتورة",
  "Total": "الإجمالي",
  "Remaining": "المتبقي",
  "Method": "الطريقة",
  "Card": "بطاقة",
  "Cash": "نقداً",
  "Bank transfer": "تحويل مصرفي",
  "Partial": "جزئي",
  "Overdue": "متأخر",
  "Print receipt": "طباعة الإيصال",
  "Receipt number": "رقم الإيصال",
  "Payment date": "تاريخ الدفع",
  "Discount": "الخصم",
  "Amount paid": "المبلغ المدفوع",
  "Remaining balance": "الرصيد المتبقي",
  "Low stock": "مخزون منخفض",
  "Stock coverage": "تغطية المخزون",
  "Create purchase order": "إنشاء طلب شراء",
  "Add item": "إضافة صنف",
  "Export": "تصدير",
  "Item": "الصنف",
  "In stock": "في المخزون",
  "Reorder at": "إعادة الطلب عند",
  "Supplier": "المورد",
  "Expiry": "الانتهاء",
  "Adjust": "تعديل",
  "Notes": "ملاحظات",
  "Download report": "تنزيل التقرير",
  "Gross production": "إجمالي الإنتاج",
  "Net collection": "صافي التحصيل",
  "New patients": "المرضى الجدد",
  "Chair utilization": "استخدام الكرسي",
  "Production & expenses": "الإنتاج والمصروفات",
  "Procedure mix": "توزيع الإجراءات",
  "Provider performance": "أداء مقدمي الخدمة",
  "Clinic profile": "ملف العيادة",
  "Notifications": "الإشعارات",
  "Security & access": "الأمان والوصول",
  "English": "الإنجليزية",
  "Arabic": "العربية",
  "Save changes": "حفظ التغييرات",
  "Clinic name": "اسم العيادة",
  "Address": "العنوان",
  "Phone": "الهاتف",
  "Email": "البريد الإلكتروني",
  "Cancel": "إلغاء",
  "Close": "إغلاق",
  "Save": "حفظ",
  "Edit": "تعديل",
  "Preview": "معاينة",
  "Search patients…": "البحث عن المرضى…",
  "Search schedule…": "البحث في الجدول…",
  "Search treatment plans…": "البحث في خطط العلاج…",
  "Search invoices or patients…": "البحث في الفواتير أو المرضى…",
  "Search inventory…": "البحث في المخزون…",
  "All": "الكل",
  "On hold": "معلق",
  "None": "لا يوجد",
  "View receipt": "عرض الإيصال",
  "Endodontic": "علاج الجذور",
  "Medical": "طبي",
  "Lead Dentist": "طبيب الأسنان الرئيسي",
  "Dentist": "طبيب أسنان",
  "Dental Hygienist": "اختصاصي صحة الأسنان",
  "Dental Assistant": "مساعد طبيب أسنان",
  "Clinic Administrator": "مدير العيادة",
  "Restorative & Cosmetic": "الترميم والتجميل",
  "Endodontics & Surgery": "علاج الجذور والجراحة",
  "Implantology": "زراعة الأسنان",
  "Preventive care": "الرعاية الوقائية",
  "Clinical support": "الدعم السريري",
  "Operations & billing": "العمليات والفوترة",
  "In clinic": "في العيادة",
  "With patient": "مع مريض",
  "Specialty": "التخصص",
  "Inventory items": "أصناف المخزون",
  "Action required": "إجراء مطلوب",
  "All categories": "كل الفئات",
  "PPE": "معدات الوقاية",
  "Restorative": "ترميمي",
  "Anaesthetic": "تخدير",
  "Sterilization": "تعقيم",
  "Surgical": "جراحي",
  "Preventive": "وقائي",
  "Production": "الإنتاج",
  "Utilization": "الاستخدام",
  "Share of completed treatments": "حصة العلاجات المكتملة",
  "Last 90 days": "آخر 90 يوماً",
  "All providers": "كل مقدمي الخدمة",
  "Application language": "لغة التطبيق",
  "City & ZIP": "المدينة والرمز البريدي",
  "Notification preferences": "تفضيلات الإشعارات",
  "Email appointment reminders": "تذكيرات المواعيد بالبريد الإلكتروني",
  "Send patients confirmations and reminders by email":
    "إرسال التأكيدات والتذكيرات للمرضى بالبريد الإلكتروني",
  "SMS appointment reminders": "تذكيرات المواعيد بالرسائل النصية",
  "Send a text 24 hours before each visit": "إرسال رسالة نصية قبل كل زيارة بـ24 ساعة",
  "Low-stock alerts": "تنبيهات انخفاض المخزون",
  "Notify administrators when supplies reach reorder level":
    "إخطار المديرين عند وصول المستلزمات إلى مستوى إعادة الطلب",
  "Save preferences": "حفظ التفضيلات",
  "Multi-factor authentication": "المصادقة متعددة العوامل",
  "Enabled": "مفعلة",
  "Automatic sign-out": "تسجيل الخروج التلقائي",
  "After 30 minutes of inactivity": "بعد 30 دقيقة من عدم النشاط",
  "After 1 hour": "بعد ساعة واحدة",
  "At the end of the day": "في نهاية اليوم",
  "Update security policy": "تحديث سياسة الأمان",
  "Ready": "جاهز",
  "Configure": "تهيئة",
  "Reserve a provider, room, and time for the patient.": "احجز مقدم الخدمة والغرفة والوقت للمريض.",
  "Add a new patient": "إضافة مريض جديد",
  "Full name": "الاسم الكامل",
  "Age": "العمر",
  "Gender": "الجنس",
  "Female": "أنثى",
  "Male": "ذكر",
  "Other": "آخر",
  "Important details for the care team…": "تفاصيل مهمة لفريق الرعاية…",
  "Create patient": "إنشاء المريض",
  "Create treatment plan": "إنشاء خطة علاج",
  "Plan title": "عنوان الخطة",
  "Procedures": "الإجراءات",
  "Record a payment": "تسجيل دفعة",
  "Save payment": "حفظ الدفعة",
  "Title": "العنوان",
  "Role": "الدور",
  "Add inventory item": "إضافة صنف مخزون",
  "Track a new clinical supply and its reorder level.":
    "تتبع مستلزماً سريرياً جديداً ومستوى إعادة طلبه.",
  "Item name": "اسم الصنف",
  "Starting stock": "المخزون الابتدائي",
  "Reorder level": "مستوى إعادة الطلب",
  "Unit": "الوحدة",
  "Welcome back": "مرحباً بعودتك",
  "Start your clinic workspace": "ابدأ مساحة عمل عيادتك",
  "Sign in to manage today’s care.": "سجّل الدخول لإدارة رعاية اليوم.",
  "Modern practice management": "إدارة حديثة للعيادة",
  "Clinical care and clinic operations, beautifully together.":
    "الرعاية السريرية وعمليات العيادة معاً بانسجام.",
  "A secure workspace for patient care, scheduling, treatments, payments, and the people behind every healthy smile.":
    "مساحة عمل آمنة لرعاية المرضى والمواعيد والعلاجات والمدفوعات وفريق كل ابتسامة صحية.",
  "Tenant-isolated clinical data": "بيانات سريرية معزولة لكل عيادة",
  "Interactive dental chart": "مخطط أسنان تفاعلي",
  "Realtime team coordination": "تنسيق فوري للفريق",
  "Private X-ray storage": "تخزين خاص للأشعة",
  "Protected by role-based access and PostgreSQL row-level security.":
    "محمي بصلاحيات حسب الدور وأمان PostgreSQL على مستوى الصفوف.",
  "Your full name": "اسمك الكامل",
  "Email address": "عنوان البريد الإلكتروني",
  "Password": "كلمة المرور",
  "At least 8 characters": "8 أحرف على الأقل",
  "Please wait…": "يرجى الانتظار…",
  "Sign in": "تسجيل الدخول",
  "Create account": "إنشاء حساب",
  "Already have an account?": "لديك حساب بالفعل؟",
  "Create an account": "إنشاء حساب",
  "Open interactive demo": "فتح العرض التفاعلي",
  "Secure, encrypted clinic access": "وصول آمن ومشفر إلى العيادة",
  "Supabase credentials are not configured. Use the demo workspace instead.":
    "بيانات اتصال Supabase غير مهيأة. استخدم مساحة العرض بدلاً منها.",
  "Check your email to confirm your account, then sign in to create your clinic workspace.":
    "تحقق من بريدك لتأكيد الحساب، ثم سجّل الدخول لإنشاء مساحة عمل عيادتك.",
  "Application language updated": "تم تحديث لغة التطبيق",
  "Clinic profile saved": "تم حفظ ملف العيادة",
  "Notification preferences saved": "تم حفظ تفضيلات الإشعارات",
  "Security policy updated": "تم تحديث سياسة الأمان",
  "Dental chart saved": "تم حفظ مخطط الأسنان",
  "Payment recorded": "تم تسجيل الدفعة",
  "Inventory item added": "تمت إضافة صنف المخزون",
  "Stock level updated": "تم تحديث مستوى المخزون",
  "Payment report exported": "تم تصدير تقرير المدفوعات",
  "Executive report downloaded": "تم تنزيل التقرير التنفيذي",
  "Pin sidebar": "تثبيت الشريط الجانبي",
  "Unpin sidebar": "إلغاء تثبيت الشريط الجانبي",
  "Create a complete patient profile. You can add clinical records and images afterward.":
    "أنشئ ملفاً كاملاً للمريض. يمكنك إضافة السجلات السريرية والصور لاحقاً.",
  "Clinical note": "ملاحظة سريرية",
  "No known allergies": "لا توجد حساسيات معروفة",
  "None reported": "لم يتم الإبلاغ عن شيء",
  "Next appointment": "الموعد القادم",
  "Not scheduled": "غير مجدول",
  "X-rays & clinical images": "الأشعة والصور السريرية",
  "Private files stored in this patient’s clinic folder":
    "ملفات خاصة محفوظة في مجلد هذا المريض بالعيادة",
  "Reports": "التقارير",
  "Midline": "خط المنتصف",
  "Dental chart & tooth surfaces": "مخطط الأسنان وأسـطحها",
  "Decay / caries": "تسوس",
  "Existing restoration": "ترميم موجود",
  "Planned treatment": "علاج مخطط",
  "Completed treatment": "علاج مكتمل",
  "Other finding": "ملاحظة أخرى",
  "Tooth surfaces": "أسطح السن",
  "Occlusal": "إطباقي",
  "Mesial": "أنسي",
  "Distal": "بعيد",
  "Buccal / Facial": "شدقي / وجهي",
  "Lingual / Palatal": "لساني / حنكي",
  "Mark selected surfaces": "تحديد حالة الأسطح المختارة",
  "Whole-tooth condition": "حالة السن بالكامل",
  "Clear selection": "مسح التحديد",
  "Select one or multiple teeth to chart findings or plan care.":
    "اختر سناً واحداً أو عدة أسنان لتسجيل النتائج أو تخطيط العلاج.",
  "tooth selected": "سن محدد",
  "teeth selected": "أسنان محددة",
  "Close treatment workspace": "إغلاق مساحة خطة العلاج",
  "Add procedure to treatment plan": "إضافة إجراء إلى خطة العلاج",
  "Edit treatment item": "تعديل بند العلاج",
  "The same procedure, teeth, and surfaces update the existing item instead of creating a duplicate.":
    "يؤدي اختيار الإجراء والأسنان والأسطح نفسها إلى تحديث البند الحالي دون إنشاء نسخة مكررة.",
  "Choose procedure…": "اختر إجراءً…",
  "Custom procedure…": "إجراء مخصص…",
  "Custom procedure name": "اسم الإجراء المخصص",
  "Clinical chart state": "حالة المخطط السريري",
  "Treatment status": "حالة العلاج",
  "Planned": "مخطط",
  "Scheduled": "مجدول",
  "Price": "السعر",
  "Final price": "السعر النهائي",
  "Clinical notes": "الملاحظات السريرية",
  "Optional clinical details…": "تفاصيل سريرية اختيارية…",
  "Add to treatment plan": "إضافة إلى خطة العلاج",
  "Update treatment item": "تحديث بند العلاج",
  "Cancel edit": "إلغاء التعديل",
  "Treatment plan items": "بنود خطة العلاج",
  "Teeth": "الأسنان",
  "Surfaces": "الأسطح",
  "Whole tooth": "السن بالكامل",
  "Plan items": "بنود الخطة",
  "Open odontogram & plan": "فتح مخطط الأسنان والخطة",
  "Create & open plan": "إنشاء الخطة وفتحها",
  "Choose patient…": "اختر مريضاً…",
  "Comprehensive treatment plan": "خطة علاج شاملة",
  "Choose a patient, then build the plan from the interactive odontogram.":
    "اختر مريضاً ثم أنشئ الخطة من مخطط الأسنان التفاعلي.",
  "Select teeth on the odontogram and add the first procedure.":
    "اختر الأسنان في المخطط وأضف الإجراء الأول.",
  "Choose a patient and at least one tooth": "اختر مريضاً وسناً واحداً على الأقل",
  "Choose or name a procedure": "اختر إجراءً أو أدخل اسمه",
  "This procedure is configured for one tooth at a time": "هذا الإجراء مهيأ لسن واحد في كل مرة",
  "Select at least one clinically appropriate surface":
    "اختر سطحاً مناسباً سريرياً واحداً على الأقل",
  "Filling": "حشوة",
  "Bridge": "جسر",
  "Veneer": "قشرة تجميلية",
  "Whitening / Cosmetic Treatment": "تبييض / علاج تجميلي",
  "Periodontal Treatment": "علاج دواعم السن",
  "Missing Tooth": "سن مفقود",
  "General": "عام",
  "Cosmetic": "تجميلي",
  "Periodontal": "دواعم الأسنان",
  "Diagnostic": "تشخيصي",
  "yrs": "سنة",
  "years": "سنة",
  "today": "اليوم",
  "items need attention": "أصناف تحتاج إلى إجراء",
  "Provider": "مقدم الخدمة",
  "Mon": "الاثنين",
  "Tue": "الثلاثاء",
  "Wed": "الأربعاء",
  "Thu": "الخميس",
  "Fri": "الجمعة",
  "Sat": "السبت",
  "Sun": "الأحد",
  "Mar": "مار",
  "Apr": "أبر",
  "May": "ماي",
  "Jun": "يون",
  "Jul": "يول",
  "Aug": "أغس",
  "Sep": "سبت",
  "Oct": "أكت",
  "Nov": "نوف",
  "Dec": "ديس",
  "Next 30 days": "الثلاثون يوماً القادمة",
  "Monthly financial performance": "الأداء المالي الشهري",
  "Rate": "المعدل",
  "boxes": "علب",
  "syringes": "محاقن",
  "packs": "حزم",
  "units": "وحدات",
  "claims in review": "مطالبات قيد المراجعة",
  "patients": "مرضى",
  "Patient check-in started": "بدأ تسجيل وصول المريض",
  "Profile changes saved": "تم حفظ تغييرات الملف",
  "Clinical note added": "تمت إضافة الملاحظة السريرية",
  "Notifications marked as read": "تم تعليم الإشعارات كمقروءة",
  "Low stock alert": "تنبيه انخفاض المخزون",
  "Appointment confirmed": "تم تأكيد الموعد",
  "Mark all read": "تعليم الكل كمقروء",
  "Treatment sessions": "جلسات العلاج",
  "Session payment": "دفعة الجلسة",
  "Partially Paid": "مدفوع جزئياً",
  "Unpaid": "غير مدفوع",
  "Paid in Full": "مدفوع بالكامل",
  "Partial Payment": "دفعة جزئية",
  "Not Paid": "غير مدفوع",
  "Pay": "دفع",
  "Record session payment": "تسجيل دفعة الجلسة",
  "Payment status": "حالة الدفع",
  "Expected": "المتوقع",
  "Due": "المستحق",
  "Amount received": "المبلغ المستلم",
  "Reference": "المرجع",
  "Confirm payment": "تأكيد الدفع",
  "Confirm not paid": "تأكيد عدم الدفع",
  "No upcoming session": "لا توجد جلسة قادمة",
  "Expected price per session": "السعر المتوقع لكل جلسة",
  "Distribute evenly": "توزيع بالتساوي",
  "Session total": "إجمالي الجلسات",
  "Total treatment price": "إجمالي سعر العلاج",
  "Complete clinical session": "إكمال الجلسة السريرية",
  "Payment during completion": "الدفع أثناء إكمال الجلسة",
  "Do not collect now": "عدم التحصيل الآن",
  "Collect remaining in full": "تحصيل المتبقي بالكامل",
  "Collect partial amount": "تحصيل مبلغ جزئي",
  "Already paid": "المدفوع مسبقاً",
  "Complete session": "إكمال الجلسة",
  "Purchase order": "طلب شراء",
  "Order date": "تاريخ الطلب",
  "Supplier name": "اسم المورد",
  "Supplier contact": "بيانات المورد",
  "Delivery address": "عنوان التسليم",
  "Select inventory item…": "اختر صنفاً من المخزون…",
  "Manual item": "صنف يدوي",
  "Order notes": "ملاحظات الطلب",
  "Save & preview": "حفظ ومعاينة",
  "Print / Save PDF": "طباعة / حفظ PDF",
  "Deliver to": "التسليم إلى",
  "Prepared by": "أعده",
  "Authorized signature": "التوقيع المعتمد",
  "Choose a valid future date and time": "اختر تاريخاً ووقتاً صالحين في المستقبل",
  "Appointment rescheduled and saved": "تمت إعادة جدولة الموعد وحفظه",
  "Select stock items or add any material manually. Saving this order does not change inventory quantities.":
    "اختر أصناف المخزون أو أضف أي مادة يدوياً. حفظ الطلب لا يغير كميات المخزون.",
  "Session prices must equal the final treatment price.":
    "يجب أن يساوي مجموع أسعار الجلسات السعر النهائي للعلاج.",
  "Treatment final price": "السعر النهائي للعلاج",
  "Quantity": "الكمية",
  "Open supplier": "مورد غير محدد",
  "PURCHASE ORDER": "طلب شراء",
  "Live patient records": "سجلات المرضى المباشرة",
  "Live records": "سجلات مباشرة",
  "Price List": "قائمة الأسعار",
  "Treatment Price List": "قائمة أسعار العلاجات",
  "Central Price List": "قائمة الأسعار المركزية",
  "Add procedure": "إضافة إجراء",
  "Edit procedure": "تعديل الإجراء",
  "Remove procedure": "إزالة الإجراء",
  "Procedure name": "اسم الإجراء",
  "Category": "الفئة",
  "Default price": "السعر الافتراضي",
  "Default sessions": "الجلسات الافتراضية",
  "Supports tooth surfaces": "يدعم أسطح الأسنان",
  "Supports multiple teeth": "يدعم عدة أسنان",
  "Price-history protection is active": "حماية سجل الأسعار مفعّلة",
  "Price changes apply only to future appointments and treatment items. Existing appointments, plans, invoices, payments, and receipts keep their saved price snapshots.":
    "تنطبق تغييرات الأسعار على المواعيد وبنود العلاج المستقبلية فقط. تحتفظ المواعيد والخطط والفواتير والمدفوعات والإيصالات الحالية بلقطات أسعارها المحفوظة.",
  "Set the default used for future bookings and treatment items.":
    "حدد القيمة الافتراضية للحجوزات وبنود العلاج المستقبلية.",
  "Save procedure": "حفظ الإجراء",
  "Search procedures…": "البحث في الإجراءات…",
  "Existing patient": "مريض حالي",
  "Patient name": "اسم المريض",
  "Patient · appointment treatment": "المريض · علاج الموعد",
  "Treatment price": "سعر العلاج",
  "Saved as a price snapshot for this appointment.": "حُفظ كلقطة سعر لهذا الموعد.",
  "Configure the Price List first": "قم بإعداد قائمة الأسعار أولاً",
  "Choose an available doctor and treatment": "اختر طبيباً وعلاجاً متاحين",
  "Create or select a patient first": "أنشئ مريضاً أو اختره أولاً",
  "Appointment and payment balance created": "تم إنشاء الموعد ورصيد الدفع",
  "Requested treatment & appointment": "العلاج المطلوب والموعد",
  "Requested treatment": "العلاج المطلوب",
  "Assigned doctor": "الطبيب المكلّف",
  "Original price": "السعر الأصلي",
  "Not specified": "غير محدد",
  "Not assigned": "غير مكلّف",
  "No appointments recorded for this patient.": "لا توجد مواعيد مسجلة لهذا المريض.",
  "Staff / employee": "موظف",
  "Job title": "المسمى الوظيفي",
  "Enforced access": "الوصول المفروض",
  "Assigned patients only": "المرضى المكلّفون فقط",
  "Clinical information": "المعلومات السريرية",
  "Dental charts": "مخططات الأسنان",
  "Patient treatment plans": "خطط علاج المريض",
  "All patients (view)": "جميع المرضى (عرض)",
  "Patient payments": "مدفوعات المرضى",
  "Printable receipts": "إيصالات قابلة للطباعة",
  "No dental-chart, treatment-plan, profit, revenue-analytics, or Admin settings access.":
    "لا وصول إلى مخطط الأسنان أو خطة العلاج أو الأرباح أو تحليلات الإيرادات أو إعدادات المسؤول.",
  "Team members": "أعضاء الفريق",
  "Add staff": "إضافة موظف",
  "No doctors or staff yet": "لا يوجد أطباء أو موظفون بعد",
  "An administrator can add the clinic team here.": "يمكن للمسؤول إضافة فريق العيادة هنا.",
  "Add doctor or staff member": "إضافة طبيب أو موظف",
  "Name and role are all that is required. This does not send an invitation or create a login account.":
    "الاسم والدور هما كل ما هو مطلوب. لن يؤدي ذلك إلى إرسال دعوة أو إنشاء حساب دخول.",
  "Email address (optional)": "عنوان البريد الإلكتروني (اختياري)",
  "Email (optional)": "البريد الإلكتروني (اختياري)",
  "Adding…": "جارٍ الإضافة…",
  "Add staff member": "إضافة عضو فريق",
  "Staff member added": "تمت إضافة عضو الفريق",
  "Staff member could not be added": "تعذرت إضافة عضو الفريق",
  "Creating…": "جارٍ الإنشاء…",
  "Enter a valid Iraqi mobile number (07XXXXXXXXX or +9647XXXXXXXXX).":
    "أدخل رقم هاتف عراقي صالحاً (07XXXXXXXXX أو +9647XXXXXXXXX).",
  "Report could not be downloaded": "تعذر تنزيل التقرير",
  "Open navigation": "فتح قائمة التنقل",
  "Your clinic session is unavailable. Please sign in again.":
    "جلسة العيادة غير متاحة. يرجى تسجيل الدخول مجدداً.",
  "Workstation user": "مستخدم محطة العمل",
  "Switch workstation user": "تبديل مستخدم محطة العمل",
  "Switch user": "تبديل المستخدم",
  "Switching…": "جارٍ التبديل…",
  "Current": "الحالي",
  "Enter this user’s password. Returning to Admin mode requires the Admin account password.":
    "أدخل كلمة مرور هذا المستخدم. تتطلب العودة إلى وضع المسؤول كلمة مرور حساب المسؤول.",
  "Apply a partial or full payment to an appointment balance.":
    "تطبيق دفعة جزئية أو كاملة على رصيد الموعد.",
  "Amount paid now": "المبلغ المدفوع الآن",
  "Payment recorded and receipt generated": "تم تسجيل الدفعة وإنشاء الإيصال",
  "Clinic currency": "عملة العيادة",
  "Iraqi Dinar (IQD)": "الدينار العراقي (IQD)",
  "US Dollar (USD)": "الدولار الأمريكي (USD)",
  "Clinic currency updated": "تم تحديث عملة العيادة",
  "Forgot password?": "هل نسيت كلمة المرور؟",
  "Reset your password": "إعادة تعيين كلمة المرور",
  "We’ll email you a secure recovery link.": "سنرسل إليك رابط استرداد آمن عبر البريد الإلكتروني.",
  "Send reset link": "إرسال رابط إعادة التعيين",
  "Set your password": "تعيين كلمة المرور",
  "Create the password you will use on this clinic workstation.":
    "أنشئ كلمة المرور التي ستستخدمها في محطة عمل العيادة هذه.",
  "New password": "كلمة المرور الجديدة",
  "Save password": "حفظ كلمة المرور",
};

/** Merged dictionary. Area files win over the legacy entries above. */
const ar: Record<string, string> = {
  ...legacyAr,
  ...arCommon,
  ...arErrors,
  ...arAuth,
  ...arShell,
  ...arPatients,
  ...arAppointments,
  ...arPayments,
  ...arInventory,
  ...arDashboard,
  ...arReports,
  ...arTreatments,
  ...arStaff,
  ...arSettings,
};

const arLookup = new Map<string, string>(Object.entries(ar));

function isAppLanguage(value: unknown): value is AppLanguage {
  return value === "en" || value === "ar";
}

function localeFor(language: AppLanguage): ClinicLocale {
  return language === "ar" ? "ar-IQ" : "en-US";
}

/** The language this workstation saved: the cookie first, then localStorage. Null when neither is set. */
function readWorkstationLanguage(): AppLanguage | null {
  try {
    const prefix = `${LANGUAGE_COOKIE}=`;
    const entry = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix));
    const fromCookie = entry?.slice(prefix.length);
    if (isAppLanguage(fromCookie)) return fromCookie;
  } catch {
    // Cookies are blocked or unavailable. Fall through to localStorage.
  }
  try {
    const fromStorage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isAppLanguage(fromStorage)) return fromStorage;
  } catch {
    // Storage is blocked or unavailable (for example, a private window).
  }
  return null;
}

/** Saves the language for this workstation only. The cookie is what the server reads during SSR. */
function writeWorkstationLanguage(language: AppLanguage) {
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${LANGUAGE_COOKIE}=${language}; Path=/; Max-Age=${LANGUAGE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  } catch {
    // The cookie is unavailable. The choice still applies for this page view.
  }
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Storage is unavailable. The cookie remains the primary store.
  }
}

function readStoredCurrency(): ClinicCurrency | null {
  try {
    const value = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
    return value === "USD" || value === "IQD" ? value : null;
  } catch {
    // Storage is unavailable.
    return null;
  }
}

function writeStoredCurrency(currency: ClinicCurrency) {
  try {
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
  } catch {
    // Storage is unavailable. The database value is authoritative.
  }
}

function formatParam(value: string | number, language: AppLanguage): string {
  if (typeof value === "string") return value;
  return new Intl.NumberFormat(localeFor(language), {
    useGrouping: false,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Looks up the English text in the Arabic dictionary when the language is Arabic, then fills
 * {name} placeholders. Unknown keys return the English text unchanged.
 */
function translate(language: AppLanguage, english: string, params?: TranslationParams): string {
  const translated = language === "ar" ? arLookup.get(english) : undefined;
  const template = translated ? translated : english;
  if (!params) return template;
  return template.replace(PLACEHOLDER_PATTERN, (match, name: string) => {
    const value = Object.prototype.hasOwnProperty.call(params, name) ? params[name] : undefined;
    return value === undefined ? match : formatParam(value, language);
  });
}

/** Converts a date input to a UTC ISO instant. Date-only keys are read as noon in the clinic zone. */
function toInstant(value: DateInput, timeZone: string): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const text = value.trim();
  if (DATE_KEY_PATTERN.test(text)) {
    try {
      return localDateTimeToIso(text, "12:00", timeZone);
    } catch {
      return null;
    }
  }
  const time = Date.parse(text);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function splitOptions(options?: Intl.DateTimeFormatOptions) {
  const source: Intl.DateTimeFormatOptions = options ?? {};
  const { timeZone, ...formatOptions } = source;
  const hasFormatOptions = Object.keys(formatOptions).length > 0;
  return {
    timeZone: resolveClinicTimeZone(timeZone ?? DEFAULT_CLINIC_TIME_ZONE),
    formatOptions: hasFormatOptions ? formatOptions : undefined,
  };
}

function formatDateValue(
  language: AppLanguage,
  value: DateInput,
  options?: Intl.DateTimeFormatOptions,
): string {
  const { timeZone, formatOptions } = splitOptions(options);
  const iso = toInstant(value, timeZone);
  if (!iso) return typeof value === "string" ? value : "";
  try {
    return clinicDateLabel(iso, timeZone, localeFor(language), formatOptions);
  } catch {
    // Invalid formatter options are a caller bug. Show the raw value rather than crash the page.
    return typeof value === "string" ? value : "";
  }
}

function formatTimeValue(
  language: AppLanguage,
  value: DateInput,
  options?: Intl.DateTimeFormatOptions,
): string {
  const { timeZone, formatOptions } = splitOptions(options);
  const iso = toInstant(value, timeZone);
  if (!iso) return typeof value === "string" ? value : "";
  try {
    if (!formatOptions) return clinicTimeLabel(iso, timeZone, localeFor(language));
    return clinicDateLabel(iso, timeZone, localeFor(language), {
      hour: "numeric",
      minute: "2-digit",
      ...formatOptions,
    });
  } catch {
    return typeof value === "string" ? value : "";
  }
}

const PreferencesContext = createContext<ClinicPreferences | null>(null);

export function ClinicPreferencesProvider({
  children,
  initialLanguage,
}: {
  children: ReactNode;
  /** Language read from the cookie during SSR, so the first paint has the right direction. */
  initialLanguage?: AppLanguage;
}) {
  const [language, setLanguageState] = useState<AppLanguage>(initialLanguage ?? "en");
  const [currency, setCurrencyState] = useState<ClinicCurrency>("IQD");
  // True once this workstation has its own saved language. A clinic default load never overrides it.
  const hasWorkstationChoice = useRef(false);
  // The clinic-wide default language, once a load has succeeded.
  const clinicDefault = useRef<AppLanguage | null>(null);
  const currencyRef = useRef<ClinicCurrency>("IQD");

  useEffect(() => {
    let active = true;

    // The saved choice is known before the database load starts, so the load can never win.
    const saved = readWorkstationLanguage();
    hasWorkstationChoice.current = saved !== null;
    const savedCurrency = readStoredCurrency();

    // Applied in a microtask so the effect body does not call setState synchronously.
    queueMicrotask(() => {
      if (!active) return;
      if (saved) {
        writeWorkstationLanguage(saved);
        setLanguageState(saved);
      }
      if (savedCurrency) {
        currencyRef.current = savedCurrency;
        setCurrencyState(savedCurrency);
      }
    });

    void loadClinicPreferences()
      .catch(() => null)
      .then((preferences) => {
        if (!active || !preferences) return;
        clinicDefault.current = preferences.language;
        currencyRef.current = preferences.currency;
        setCurrencyState(preferences.currency);
        writeStoredCurrency(preferences.currency);
        if (!hasWorkstationChoice.current) setLanguageState(preferences.language);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  const setLanguage = useCallback((next: AppLanguage) => {
    hasWorkstationChoice.current = true;
    setLanguageState(next);
    writeWorkstationLanguage(next);
  }, []);

  const setClinicDefaultLanguage = useCallback(
    async (next: AppLanguage): Promise<ActionResult> => {
      let result: ActionResult;
      try {
        result = await persistClinicPreferences(next);
      } catch {
        return { ok: false, error: SAVE_FAILED };
      }
      if (!result.ok) return result;
      clinicDefault.current = next;
      setLanguage(next);
      return result;
    },
    [setLanguage],
  );

  /** The clinic default is needed because saving currency also writes the clinic language. */
  const resolveClinicDefault = useCallback(async (): Promise<AppLanguage | null> => {
    if (clinicDefault.current) return clinicDefault.current;
    // The demo workspace never persists, so any language value is safe there.
    if (!hasSupabaseConfig()) return "en";
    const preferences = await loadClinicPreferences().catch(() => null);
    if (preferences) clinicDefault.current = preferences.language;
    return clinicDefault.current;
  }, []);

  const setCurrency = useCallback(
    async (next: ClinicCurrency): Promise<ActionResult> => {
      const previous = currencyRef.current;
      const rollback = () => {
        currencyRef.current = previous;
        setCurrencyState(previous);
        writeStoredCurrency(previous);
      };
      currencyRef.current = next;
      setCurrencyState(next);
      writeStoredCurrency(next);

      const defaultLanguage = await resolveClinicDefault();
      if (!defaultLanguage) {
        rollback();
        return { ok: false, error: SAVE_FAILED };
      }
      let result: ActionResult;
      try {
        result = await persistClinicPreferences(defaultLanguage, next);
      } catch {
        result = { ok: false, error: SAVE_FAILED };
      }
      if (!result.ok) rollback();
      return result;
    },
    [resolveClinicDefault],
  );

  const isRtl = language === "ar";
  const locale = localeFor(language);

  const value = useMemo<ClinicPreferences>(
    () => ({
      language,
      isRtl,
      locale,
      setLanguage,
      setClinicDefaultLanguage,
      currency,
      setCurrency,
      formatMoney: (amount) =>
        `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amount)} ${currency}`,
      formatCompactMoney: (amount) =>
        `${new Intl.NumberFormat(locale, {
          notation: "compact",
          maximumFractionDigits: 0,
        }).format(amount)} ${currency}`,
      formatDate: (date, options) => formatDateValue(language, date, options),
      formatTime: (time, options) => formatTimeValue(language, time, options),
      t: (english, params) => translate(language, english, params),
    }),
    [currency, isRtl, language, locale, setClinicDefaultLanguage, setCurrency, setLanguage],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function useClinicPreferences(): ClinicPreferences {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("useClinicPreferences must be used inside its provider");
  return value;
}
