"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AppLanguage, ClinicCurrency } from "@/lib/types";
import {
  loadClinicPreferences,
  persistClinicPreferences,
} from "@/lib/supabase/clinic-data";

const ar: Record<string, string> = {
  "Clinic overview": "نظرة عامة على العيادة",
  "Demo workspace": "مساحة عمل تجريبية",
  "Recorded payments": "المدفوعات المسجلة",
  "All time": "كل الفترات",
  "Total collected": "إجمالي المبالغ المحصلة",
  "Clinic workspace": "مساحة عمل العيادة",
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
  "BrightSmile": "برايت سمايل",
  "Dental Studio": "مركز طب الأسنان",
  "San Francisco Clinic": "عيادة سان فرانسيسكو",
  "Workspace": "مساحة العمل",
  "Overview": "نظرة عامة",
  "Appointments": "المواعيد",
  "Patients": "المرضى",
  "Treatment plans": "خطط العلاج",
  "Clinical records": "السجلات السريرية",
  "Management": "الإدارة",
  "Payments": "المدفوعات",
  "Doctors & staff": "الأطباء والموظفون",
  "Inventory": "المخزون",
  "Reports & analytics": "التقارير والتحليلات",
  "Clinic settings": "إعدادات العيادة",
  "Owner · Dentist": "المالك · طبيب أسنان",
  "Owner": "المالك",
  "Good morning, Maya": "صباح الخير، مايا",
  "Here’s what’s happening at BrightSmile today.":
    "إليك ما يحدث اليوم في برايت سمايل.",
  "Live workspace": "مساحة عمل مباشرة",
  "Today’s appointments": "مواعيد اليوم",
  "Total patients": "إجمالي المرضى",
  "Revenue this month": "إيرادات هذا الشهر",
  "Outstanding": "المبالغ المستحقة",
  "Active treatments": "العلاجات النشطة",
  "Revenue overview": "نظرة عامة على الإيرادات",
  "Income compared with operating expenses":
    "مقارنة الدخل بالمصروفات التشغيلية",
  "Last 6 months": "آخر 6 أشهر",
  "This year": "هذا العام",
  "Net revenue": "صافي الإيرادات",
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
  "Recalls due": "مراجعات مستحقة",
  "Rebooked": "أُعيد حجزها",
  "Payment received": "تم استلام دفعة",
  "Treatment completed": "اكتمل العلاج",
  "Appointment booked": "تم حجز موعد",
  "New patient added": "تمت إضافة مريض جديد",
  "Complete clinical profiles and treatment history.":
    "ملفات سريرية كاملة وسجل العلاج.",
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
  "Last payment": "آخر دفعة",
  "Interactive odontogram": "مخطط الأسنان التفاعلي",
  "Universal numbering system · adult dentition":
    "نظام الترقيم العالمي · أسنان البالغين",
  "Save chart": "حفظ المخطط",
  "Select a tooth to record a condition or treatment.":
    "اختر سناً لتسجيل الحالة أو العلاج.",
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
  "Coordinate schedules, rooms, and care teams.":
    "تنسيق الجداول والغرف وفرق الرعاية.",
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
  "Track proposed and active courses of care.":
    "متابعة خطط الرعاية المقترحة والنشطة.",
  "New treatment plan": "خطة علاج جديدة",
  "Active plans": "الخطط النشطة",
  "Proposed value": "قيمة المقترحات",
  "Completed this month": "المكتمل هذا الشهر",
  "Treatment progress": "تقدم العلاج",
  "Plan value": "قيمة الخطة",
  "Sessions": "الجلسات",
  "Next visit": "الزيارة القادمة",
  "View details": "عرض التفاصيل",
  "Record session": "تسجيل جلسة",
  "Invoices, installments, balances, and receipts.":
    "الفواتير والأقساط والأرصدة والإيصالات.",
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
  "Treatment total": "إجمالي العلاج",
  "Discount": "الخصم",
  "Amount paid": "المبلغ المدفوع",
  "Remaining balance": "الرصيد المتبقي",
  "Centralized, secure clinical documentation.":
    "توثيق سريري مركزي وآمن.",
  "New record": "سجل جديد",
  "Record summary": "ملخص السجلات",
  "Manage your care team and access roles.":
    "إدارة فريق الرعاية وصلاحيات الوصول.",
  "Manage roles": "إدارة الأدوار",
  "Team schedule": "جدول الفريق",
  "Invite team member": "دعوة عضو فريق",
  "Monitor clinical supplies and reorder levels.":
    "متابعة المستلزمات السريرية ومستويات إعادة الطلب.",
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
  "Performance insights across the clinic.": "رؤى أداء شاملة للعيادة.",
  "Download report": "تنزيل التقرير",
  "Gross production": "إجمالي الإنتاج",
  "Net collection": "صافي التحصيل",
  "New patients": "المرضى الجدد",
  "Chair utilization": "استخدام الكرسي",
  "Production & expenses": "الإنتاج والمصروفات",
  "Procedure mix": "توزيع الإجراءات",
  "Patient acquisition": "اكتساب المرضى",
  "Provider performance": "أداء مقدمي الخدمة",
  "Identity, operations, notifications, and security.":
    "الهوية والعمليات والإشعارات والأمان.",
  "Clinic profile": "ملف العيادة",
  "Notifications": "الإشعارات",
  "Security & access": "الأمان والوصول",
  "Billing & plan": "الفوترة والخطة",
  "Data & integrations": "البيانات والتكاملات",
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
  "Search clinical records…": "البحث في السجلات السريرية…",
  "Search inventory…": "البحث في المخزون…",
  "Search patients, invoices, appointments…":
    "البحث عن المرضى والفواتير والمواعيد…",
  "All": "الكل",
  "On hold": "معلق",
  "None": "لا يوجد",
  "View receipt": "عرض الإيصال",
  "All records": "كل السجلات",
  "Procedure note": "ملاحظة إجراء",
  "Endodontic": "علاج الجذور",
  "Imaging": "التصوير",
  "Medical": "طبي",
  "HIPAA-ready records": "سجلات متوافقة مع معايير الخصوصية",
  "Tenant isolated & audited": "عزل وتدقيق بيانات العيادة",
  "Row-level data access": "وصول محمي على مستوى الصفوف",
  "Private file storage": "تخزين خاص للملفات",
  "Author & timestamp trail": "سجل المؤلف والوقت",
  "Role-based permissions": "صلاحيات حسب الدور",
  "Procedure notes": "ملاحظات الإجراءات",
  "Medical documents": "المستندات الطبية",
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
  "Across 6 categories": "ضمن 6 فئات",
  "Action required": "إجراء مطلوب",
  "30-day availability": "توفر لمدة 30 يوماً",
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
  "Orthodontic": "تقويم الأسنان",
  "Referrals": "الإحالات",
  "Google": "غوغل",
  "Social": "وسائل التواصل",
  "Walk-in": "زيارة مباشرة",
  "Last 90 days": "آخر 90 يوماً",
  "All providers": "كل مقدمي الخدمة",
  "Application language": "لغة التطبيق",
  "Choose the language used throughout this clinic workspace.":
    "اختر اللغة المستخدمة في مساحة عمل العيادة بالكامل.",
  "Information shown on receipts, reminders, and patient communications.":
    "المعلومات الظاهرة في الإيصالات والتذكيرات ورسائل المرضى.",
  "Change logo": "تغيير الشعار",
  "PNG or SVG · max 2 MB": "PNG أو SVG · بحد أقصى 2 ميغابايت",
  "Website": "الموقع الإلكتروني",
  "City & ZIP": "المدينة والرمز البريدي",
  "Notification preferences": "تفضيلات الإشعارات",
  "Choose how the clinic and patients receive updates.":
    "اختر طريقة تلقي العيادة والمرضى للتحديثات.",
  "Email appointment reminders": "تذكيرات المواعيد بالبريد الإلكتروني",
  "Send patients confirmations and reminders by email":
    "إرسال التأكيدات والتذكيرات للمرضى بالبريد الإلكتروني",
  "SMS appointment reminders": "تذكيرات المواعيد بالرسائل النصية",
  "Send a text 24 hours before each visit":
    "إرسال رسالة نصية قبل كل زيارة بـ24 ساعة",
  "Low-stock alerts": "تنبيهات انخفاض المخزون",
  "Notify administrators when supplies reach reorder level":
    "إخطار المديرين عند وصول المستلزمات إلى مستوى إعادة الطلب",
  "Save preferences": "حفظ التفضيلات",
  "Multi-factor authentication": "المصادقة متعددة العوامل",
  "Required for owners and administrators": "مطلوبة للمالكين والمديرين",
  "Enabled": "مفعلة",
  "Automatic sign-out": "تسجيل الخروج التلقائي",
  "After 30 minutes of inactivity": "بعد 30 دقيقة من عدم النشاط",
  "After 1 hour": "بعد ساعة واحدة",
  "At the end of the day": "في نهاية اليوم",
  "Update security policy": "تحديث سياسة الأمان",
  "Billing & subscription": "الفوترة والاشتراك",
  "Professional plan": "الخطة الاحترافية",
  "/ month": "/ شهرياً",
  "Unlimited patients, up to 15 staff, clinical storage, reporting, realtime updates, and priority support.":
    "مرضى غير محدودين وما يصل إلى 15 موظفاً وتخزين سريري وتقارير وتحديثات فورية ودعم ذو أولوية.",
  "Manage subscription": "إدارة الاشتراك",
  "Database status and connected clinic services.":
    "حالة قاعدة البيانات وخدمات العيادة المتصلة.",
  "Supabase database": "قاعدة بيانات Supabase",
  "Connected · Realtime enabled": "متصلة · التحديث الفوري مفعل",
  "Private clinical storage": "التخزين السريري الخاص",
  "Configured · RLS protected": "مهيأ · محمي بسياسات RLS",
  "Insurance clearinghouse": "مركز معالجة التأمين",
  "Not connected": "غير متصل",
  "Accounting export": "تصدير المحاسبة",
  "Ready": "جاهز",
  "Configure": "تهيئة",
  "Reserve a provider, room, and time for the patient.":
    "احجز مقدم الخدمة والغرفة والوقت للمريض.",
  "e.g. Comprehensive exam": "مثال: فحص شامل",
  "Add a new patient": "إضافة مريض جديد",
  "Create a complete profile before the first visit.":
    "أنشئ ملفاً كاملاً قبل الزيارة الأولى.",
  "Full name": "الاسم الكامل",
  "Age": "العمر",
  "Gender": "الجنس",
  "Female": "أنثى",
  "Male": "ذكر",
  "Other": "آخر",
  "Phone number": "رقم الهاتف",
  "Allergies (comma separated)": "الحساسيات (مفصولة بفواصل)",
  "Important details for the care team…": "تفاصيل مهمة لفريق الرعاية…",
  "Create patient": "إنشاء المريض",
  "Create treatment plan": "إنشاء خطة علاج",
  "Build a phased course of care with pricing and sessions.":
    "أنشئ مسار علاج مرحلياً مع الأسعار والجلسات.",
  "Plan title": "عنوان الخطة",
  "Procedures": "الإجراءات",
  "Total price": "السعر الإجمالي",
  "Number of sessions": "عدد الجلسات",
  "Record a payment": "تسجيل دفعة",
  "Apply payment, discount, and method to a new invoice.":
    "طبّق الدفعة والخصم وطريقة الدفع على فاتورة جديدة.",
  "Total cost": "التكلفة الإجمالية",
  "Paid now": "المدفوع الآن",
  "Save payment": "حفظ الدفعة",
  "Add clinical record": "إضافة سجل سريري",
  "Document a procedure, finding, image, or medical update.":
    "وثّق إجراءً أو نتيجة أو صورة أو تحديثاً طبياً.",
  "Record type": "نوع السجل",
  "Title": "العنوان",
  "Procedure and tooth number": "الإجراء ورقم السن",
  "Clinical details": "التفاصيل السريرية",
  "Save record": "حفظ السجل",
  "Send access to a clinician or operational team member.":
    "أرسل صلاحية الوصول إلى عضو سريري أو تشغيلي.",
  "Role": "الدور",
  "Send invitation": "إرسال الدعوة",
  "Role permissions": "صلاحيات الدور",
  "Control what each clinic role can view and change.":
    "تحكم فيما يستطيع كل دور في العيادة عرضه وتغييره.",
  "Save permissions": "حفظ الصلاحيات",
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
  "Create your secure BrightSmile account.": "أنشئ حساب برايت سمايل الآمن.",
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
  "New to BrightSmile?": "جديد في برايت سمايل؟",
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
  "Clinical record added": "تمت إضافة السجل السريري",
  "Treatment plan created": "تم إنشاء خطة العلاج",
  "Session recorded": "تم تسجيل الجلسة",
  "Dental chart saved": "تم حفظ مخطط الأسنان",
  "Appointment scheduled": "تمت جدولة الموعد",
  "Payment recorded": "تم تسجيل الدفعة",
  "Inventory item added": "تمت إضافة صنف المخزون",
  "Stock level updated": "تم تحديث مستوى المخزون",
  "Purchase order draft created": "تم إنشاء مسودة طلب الشراء",
  "Payment report exported": "تم تصدير تقرير المدفوعات",
  "Inventory CSV exported": "تم تصدير ملف CSV للمخزون",
  "Executive report downloaded": "تم تنزيل التقرير التنفيذي",
  "Close navigation": "إغلاق التنقل",
  "Pin sidebar": "تثبيت الشريط الجانبي",
  "Unpin sidebar": "إلغاء تثبيت الشريط الجانبي",
  "Close toast": "إغلاق الإشعار",
  "Protect clinical data and control session behavior.":
    "احمِ البيانات السريرية وتحكم في سلوك الجلسات.",
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
  "Outline procedures, expected sessions, and financial value.":
    "حدد الإجراءات والجلسات المتوقعة والقيمة المالية.",
  "Create plan": "إنشاء الخطة",
  "Create a timestamped entry in the patient’s secure chart.":
    "أنشئ إدخالاً مؤرخاً في سجل المريض الآمن.",
  "Clinical narrative": "السرد السريري",
  "They’ll receive a secure invitation to join this clinic.":
    "سيتلقى دعوة آمنة للانضمام إلى هذه العيادة.",
  "Work email": "بريد العمل الإلكتروني",
  "Front Desk": "الاستقبال",
  "Permissions shown for Clinic Administrator. Owner access cannot be restricted.":
    "الصلاحيات المعروضة لمدير العيادة. لا يمكن تقييد وصول المالك.",
  "Billing & payments": "الفوترة والمدفوعات",
  "Reports": "التقارير",
  "Invited team member": "عضو فريق مدعو",
  "Invitation sent": "تم إرسال الدعوة",
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
  "This procedure is configured for one tooth at a time":
    "هذا الإجراء مهيأ لسن واحد في كل مرة",
  "Select at least one clinically appropriate surface":
    "اختر سطحاً مناسباً سريرياً واحداً على الأقل",
  "Treatment item added": "تمت إضافة بند العلاج",
  "Treatment item updated": "تم تحديث بند العلاج",
  "Configured for multiple teeth and tooth surfaces.":
    "مهيأ لعدة أسنان ولأسطح الأسنان.",
  "Configured for multiple teeth.": "مهيأ لعدة أسنان.",
  "Configured for one tooth and tooth surfaces.":
    "مهيأ لسن واحد ولأسطح الأسنان.",
  "Configured for one tooth.": "مهيأ لسن واحد.",
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
  "Current condition": "الحالة الحالية",
  "Current condition:": "الحالة الحالية:",
  "Tooth #": "السن رقم ",
  "Invalid login credentials": "بيانات تسجيل الدخول غير صحيحة",
  "Email not confirmed": "لم يتم تأكيد البريد الإلكتروني",
  "User already registered": "المستخدم مسجل بالفعل",
  "Password should be at least 6 characters":
    "يجب ألا تقل كلمة المرور عن 6 أحرف",
  "scheduled visits · 3 treatment rooms": "زيارات مجدولة · 3 غرف علاج",
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
  "MON": "الاثنين",
  "TUE": "الثلاثاء",
  "WED": "الأربعاء",
  "THU": "الخميس",
  "FRI": "الجمعة",
  "SAT": "السبت",
  "SUN": "الأحد",
  "Jan": "ينا",
  "Feb": "فبر",
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
  "Logo uploader opened": "تم فتح أداة رفع الشعار",
  "Billing portal opened": "تم فتح بوابة الفوترة",
  "Team schedule opened for this week": "تم فتح جدول الفريق لهذا الأسبوع",
  "Staff invitation sent": "تم إرسال دعوة الموظف",
  "Role permissions updated": "تم تحديث صلاحيات الدور",
  "Patient check-in started": "بدأ تسجيل وصول المريض",
  "Profile changes saved": "تم حفظ تغييرات الملف",
  "Clinical note added": "تمت إضافة الملاحظة السريرية",
  "Clinic data updated in real time": "تم تحديث بيانات العيادة فورياً",
  "Notifications marked as read": "تم تعليم الإشعارات كمقروءة",
  "Low stock alert": "تنبيه انخفاض المخزون",
  "3 supplies are below reorder level": "3 مستلزمات دون مستوى إعادة الطلب",
  "Appointment confirmed": "تم تأكيد الموعد",
  "Mark all read": "تعليم الكل كمقروء",
  "Thank you for choosing BrightSmile. This receipt was generated electronically.":
    "شكراً لاختياركم برايت سمايل. تم إنشاء هذا الإيصال إلكترونياً.",
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
  "Drag to reschedule": "اسحب لإعادة الجدولة",
  "Choose a valid future date and time": "اختر تاريخاً ووقتاً صالحين في المستقبل",
  "Appointment rescheduled and saved": "تمت إعادة جدولة الموعد وحفظه",
  "Drag an appointment to another day or time. Completed and cancelled visits stay locked.":
    "اسحب الموعد إلى يوم أو وقت آخر. تبقى المواعيد المكتملة والملغاة مقفلة.",
  "Select stock items or add any material manually. Saving this order does not change inventory quantities.":
    "اختر أصناف المخزون أو أضف أي مادة يدوياً. حفظ الطلب لا يغير كميات المخزون.",
  "Session prices must equal the final treatment price.": "يجب أن يساوي مجموع أسعار الجلسات السعر النهائي للعلاج.",
  "Treatment final price": "السعر النهائي للعلاج",
  "Quantity": "الكمية",
  "Open supplier": "مورد غير محدد",
  "PURCHASE ORDER": "طلب شراء",
  "Live patient records": "سجلات المرضى المباشرة",
  "Live records": "سجلات مباشرة",
  "Price List": "قائمة الأسعار",
  "Treatment Price List": "قائمة أسعار العلاجات",
  "Manage current procedure prices without changing historical records.": "إدارة أسعار الإجراءات الحالية دون تغيير السجلات التاريخية.",
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
  "Price changes apply only to future appointments and treatment items. Existing appointments, plans, invoices, payments, and receipts keep their saved price snapshots.": "تنطبق تغييرات الأسعار على المواعيد وبنود العلاج المستقبلية فقط. تحتفظ المواعيد والخطط والفواتير والمدفوعات والإيصالات الحالية بلقطات أسعارها المحفوظة.",
  "Set the default used for future bookings and treatment items.": "حدد القيمة الافتراضية للحجوزات وبنود العلاج المستقبلية.",
  "Save procedure": "حفظ الإجراء",
  "No procedures found. The administrator can configure the clinic Price List here.": "لم يتم العثور على إجراءات. يمكن للمسؤول إعداد قائمة أسعار العيادة هنا.",
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
  "Drag an appointment to another day or 30-minute time slot. Simultaneous visits remain separate; completed and cancelled visits stay locked.": "اسحب الموعد إلى يوم آخر أو فترة زمنية مدتها 30 دقيقة. تبقى الزيارات المتزامنة منفصلة، وتبقى الزيارات المكتملة والملغاة مقفلة.",
  "Requested treatment & appointment": "العلاج المطلوب والموعد",
  "Requested treatment": "العلاج المطلوب",
  "Assigned doctor": "الطبيب المكلّف",
  "Original price": "السعر الأصلي",
  "Not specified": "غير محدد",
  "Not assigned": "غير مكلّف",
  "No appointments recorded for this patient.": "لا توجد مواعيد مسجلة لهذا المريض.",
  "Treatment Plans": "خطط العلاج",
  "Create doctor or staff account": "إنشاء حساب طبيب أو موظف",
  "Staff / employee": "موظف",
  "Team accounts": "حسابات الفريق",
  "Each person receives an individual Supabase account and role-isolated workspace.": "يتلقى كل شخص حساب Supabase فردياً ومساحة عمل معزولة حسب الدور.",
  "An invitation email lets the person set a private password. Accounts are never shared.": "تتيح رسالة الدعوة للشخص تعيين كلمة مرور خاصة. لا تتم مشاركة الحسابات أبداً.",
  "Job title": "المسمى الوظيفي",
  "Enforced access": "الوصول المفروض",
  "Assigned patients only": "المرضى المكلّفون فقط",
  "Clinical information": "المعلومات السريرية",
  "Dental charts": "مخططات الأسنان",
  "Patient treatment plans": "خطط علاج المريض",
  "All patients (view)": "جميع المرضى (عرض)",
  "Patient payments": "مدفوعات المرضى",
  "Printable receipts": "إيصالات قابلة للطباعة",
  "No dental-chart, treatment-plan, profit, revenue-analytics, or Admin settings access.": "لا وصول إلى مخطط الأسنان أو خطة العلاج أو الأرباح أو تحليلات الإيرادات أو إعدادات المسؤول.",
  "Account invitation sent": "تم إرسال دعوة الحساب",
  "No doctor or staff accounts yet": "لا توجد حسابات أطباء أو موظفين بعد",
  "The administrator can invite the clinic team.": "يمكن للمسؤول دعوة فريق العيادة.",
  "Team members": "أعضاء الفريق",
  "Create staff records immediately. Login access can be linked separately when needed.": "أنشئ سجلات الموظفين فوراً. يمكن ربط صلاحية تسجيل الدخول بشكل منفصل عند الحاجة.",
  "Add staff": "إضافة موظف",
  "No login account": "لا يوجد حساب دخول",
  "No doctors or staff yet": "لا يوجد أطباء أو موظفون بعد",
  "An administrator can add the clinic team here.": "يمكن للمسؤول إضافة فريق العيادة هنا.",
  "Add doctor or staff member": "إضافة طبيب أو موظف",
  "Name and role are all that is required. This does not send an invitation or create a login account.": "الاسم والدور هما كل ما هو مطلوب. لن يؤدي ذلك إلى إرسال دعوة أو إنشاء حساب دخول.",
  "Email address (optional)": "عنوان البريد الإلكتروني (اختياري)",
  "Email (optional)": "البريد الإلكتروني (اختياري)",
  "Adding…": "جارٍ الإضافة…",
  "Add staff member": "إضافة عضو فريق",
  "Staff member added": "تمت إضافة عضو الفريق",
  "Staff member could not be added": "تعذرت إضافة عضو الفريق",
  "Creating…": "جارٍ الإنشاء…",
  "Enter a valid Iraqi mobile number (07XXXXXXXXX or +9647XXXXXXXXX).": "أدخل رقم هاتف عراقي صالحاً (07XXXXXXXXX أو +9647XXXXXXXXX).",
  "Report could not be downloaded": "تعذر تنزيل التقرير",
  "Open navigation": "فتح قائمة التنقل",
  "Your clinic session is unavailable. Please sign in again.": "جلسة العيادة غير متاحة. يرجى تسجيل الدخول مجدداً.",
  "Workstation user": "مستخدم محطة العمل",
  "Switch workstation user": "تبديل مستخدم محطة العمل",
  "Switch user": "تبديل المستخدم",
  "Switching…": "جارٍ التبديل…",
  "Current": "الحالي",
  "Enter this user’s password. Returning to Admin mode requires the Admin account password.": "أدخل كلمة مرور هذا المستخدم. تتطلب العودة إلى وضع المسؤول كلمة مرور حساب المسؤول.",
  "Apply a partial or full payment to an appointment balance.": "تطبيق دفعة جزئية أو كاملة على رصيد الموعد.",
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
  "Create the password you will use on this clinic workstation.": "أنشئ كلمة المرور التي ستستخدمها في محطة عمل العيادة هذه.",
  "New password": "كلمة المرور الجديدة",
  "Save password": "حفظ كلمة المرور",
};

function translateValue(value: string) {
  const trimmed = value.trim();
  if (ar[trimmed]) return value.replace(trimmed, ar[trimmed]);
  const translated = value
    .replace(/(\d+) scheduled visits/g, "$1 زيارة مجدولة")
    .replace(/(\d+) treatment rooms/g, "$1 غرف علاج")
    .replace(/(\d+) open invoices/g, "$1 فاتورة مفتوحة")
    .replace(/(\d+) confirmed/g, "$1 مؤكدة")
    .replace(/(\d+) new this month/g, "$1 جديد هذا الشهر")
    .replace(/(\d+) finishing soon/g, "$1 ستنتهي قريباً")
    .replace(/(\d+) items need attention/g, "$1 أصناف تحتاج إلى إجراء")
    .replace(/(\d+) claims in review/g, "$1 مطالبات قيد المراجعة")
    .replace(/(\d+) patients/g, "$1 مرضى")
    .replace(/Session (\d+)/g, "الجلسة $1")
    .replace(/(\d+)\/(\d+) completed/g, "$1/$2 مكتملة")
    .replace(/(\d+) remaining/g, "$1 متبقية")
    .replace(/(\d+) invoices/g, "$1 فواتير")
    .replace(/(\d+) sessions remaining/g, "$1 جلسات متبقية")
    .replace(/(\d+) scheduled/g, "$1 مجدولة")
    .replace(/(\d+) today/g, "$1 اليوم")
    .replace(/(\d+) yrs/g, "$1 سنة")
    .replace(/(\d+) min/g, "$1 دقيقة")
    .replace(/(\d+) hrs?/g, "$1 ساعة")
    .replace(/this week/g, "هذا الأسبوع")
    .replace(/from July/g, "مقارنة بيوليو")
    .replace(/vs Jul/g, "مقارنة بيوليو")
    .replace(/(\d+(?:\.\d+)?)% rate/g, "معدل $1%")
    .replace(/Room (\d+)/g, "الغرفة $1")
    .replace(/AM/g, "ص")
    .replace(/PM/g, "م")
    .replace(/\bMonday\b/g, "الاثنين")
    .replace(/\bTuesday\b/g, "الثلاثاء")
    .replace(/\bWednesday\b/g, "الأربعاء")
    .replace(/\bThursday\b/g, "الخميس")
    .replace(/\bFriday\b/g, "الجمعة")
    .replace(/\bSaturday\b/g, "السبت")
    .replace(/\bSunday\b/g, "الأحد")
    .replace(/\bJanuary\b/g, "يناير")
    .replace(/\bFebruary\b/g, "فبراير")
    .replace(/\bMarch\b/g, "مارس")
    .replace(/\bApril\b/g, "أبريل")
    .replace(/\bMay\b/g, "مايو")
    .replace(/\bJune\b/g, "يونيو")
    .replace(/\bJuly\b/g, "يوليو")
    .replace(/\bAugust\b/g, "أغسطس")
    .replace(/\bSeptember\b/g, "سبتمبر")
    .replace(/\bOctober\b/g, "أكتوبر")
    .replace(/\bNovember\b/g, "نوفمبر")
    .replace(/\bDecember\b/g, "ديسمبر")
    .replace(/\bJan\b/g, "ينا")
    .replace(/\bFeb\b/g, "فبر")
    .replace(/\bMar\b/g, "مار")
    .replace(/\bApr\b/g, "أبر")
    .replace(/\bJun\b/g, "يون")
    .replace(/\bJul\b/g, "يول")
    .replace(/\bAug\b/g, "أغس")
    .replace(/\bSep\b/g, "سبت")
    .replace(/\bOct\b/g, "أكت")
    .replace(/\bNov\b/g, "نوف")
    .replace(/\bDec\b/g, "ديس")
    .replace(/(.+) added to patients/g, "تمت إضافة $1 إلى المرضى")
    .replace(/Tooth (\d+), (.+)/g, "السن $1، $2")
    .replace(/Tooth #(\d+)/g, "السن رقم $1")
    .replace(/Current condition: (.+)/g, "الحالة الحالية: $1")
    .replace(/Today · just now/g, "اليوم · الآن")
    .replace(/New patient/g, "مريض جديد");
  return /(?:يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر|ينا|فبر|مار|أبر|ماي|يون|يول|أغس|سبت|أكت|نوف|ديس)\s+\d/.test(translated)
    ? translated.replace(/\d/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)])
    : translated;
}

const originalText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();
const lastLocalizedText = new WeakMap<Text, string>();
const lastLocalizedAttributes = new WeakMap<Element, Map<string, string>>();

function localizeDocument(language: AppLanguage) {
  const root = document.body;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  while (node) {
    const parent = node.parentElement;
    if (
      parent &&
      !["SCRIPT", "STYLE"].includes(parent.tagName) &&
      !parent.closest("[data-no-translate]")
    ) {
      const current = node.nodeValue ?? "";
      let english = originalText.get(node) ?? current;
      const lastApplied = lastLocalizedText.get(node);
      if (lastApplied !== undefined && current !== lastApplied) {
        english = current;
        originalText.set(node, current);
      } else if (!originalText.has(node)) {
        originalText.set(node, english);
      }
      const next = language === "ar" ? translateValue(english) : english;
      if (node.nodeValue !== next) node.nodeValue = next;
      lastLocalizedText.set(node, next);
    }
    node = walker.nextNode() as Text | null;
  }
  root.querySelectorAll("[placeholder],[title],[aria-label]").forEach((element) => {
    if (element.closest("[data-no-translate]")) return;
    const saved = originalAttributes.get(element) ?? new Map<string, string>();
    const applied =
      lastLocalizedAttributes.get(element) ?? new Map<string, string>();
    ["placeholder", "title", "aria-label"].forEach((attribute) => {
      const current = element.getAttribute(attribute);
      if (current && applied.has(attribute) && current !== applied.get(attribute))
        saved.set(attribute, current);
      else if (current && !saved.has(attribute)) saved.set(attribute, current);
      const english = saved.get(attribute);
      if (english) {
        const next = language === "ar" ? translateValue(english) : english;
        element.setAttribute(attribute, next);
        applied.set(attribute, next);
      }
    });
    originalAttributes.set(element, saved);
    lastLocalizedAttributes.set(element, applied);
  });
}

type PreferencesContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  currency: ClinicCurrency;
  setCurrency: (currency: ClinicCurrency) => void;
  formatMoney: (value: number) => string;
  formatCompactMoney: (value: number) => string;
  t: (english: string) => string;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function ClinicPreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [language, setLanguageState] = useState<AppLanguage>("en");
  const [currency, setCurrencyState] = useState<ClinicCurrency>("IQD");

  useEffect(() => {
    queueMicrotask(() => {
      const savedLanguage = localStorage.getItem("clinic-language");
      if (savedLanguage === "en" || savedLanguage === "ar")
        setLanguageState(savedLanguage);
      const savedCurrency = localStorage.getItem("clinic-currency");
      if (savedCurrency === "USD" || savedCurrency === "IQD") setCurrencyState(savedCurrency);
    });
    void loadClinicPreferences().then((preferences) => {
      if (!preferences) return;
      setLanguageState(preferences.language);
      setCurrencyState(preferences.currency);
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    let scheduled = false;
    const apply = () => {
      scheduled = false;
      observer.disconnect();
      localizeDocument(language);
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["placeholder", "title", "aria-label"],
      });
    };
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(apply);
    });
    apply();
    return () => observer.disconnect();
  }, [language]);

  const save = useCallback((nextLanguage: AppLanguage, nextCurrency: ClinicCurrency) => {
    localStorage.setItem("clinic-language", nextLanguage);
    localStorage.setItem("clinic-currency", nextCurrency);
    void persistClinicPreferences(nextLanguage, nextCurrency);
  }, []);

  const setLanguage = useCallback(
    (next: AppLanguage) => {
      setLanguageState(next);
      save(next, currency);
    },
    [currency, save],
  );

  const setCurrency = useCallback((next: ClinicCurrency) => {
    setCurrencyState(next);
    save(language, next);
  }, [language, save]);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      language,
      setLanguage,
      currency,
      setCurrency,
      formatMoney: (amount) => `${new Intl.NumberFormat(language === "ar" ? "ar-IQ" : "en-US", {
        maximumFractionDigits: 0,
      }).format(amount)} ${currency}`,
      formatCompactMoney: (amount) => `${new Intl.NumberFormat(language === "ar" ? "ar-IQ" : "en-US", {
        notation: "compact", maximumFractionDigits: 0,
      }).format(amount)} ${currency}`,
      t: (english) => (language === "ar" ? translateValue(english) : english),
    }),
    [currency, language, setCurrency, setLanguage],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function useClinicPreferences() {
  const value = useContext(PreferencesContext);
  if (!value)
    throw new Error("useClinicPreferences must be used inside its provider");
  return value;
}
