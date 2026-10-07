// Arabic strings for this area. Each key is the English text exactly as it appears in the JSX,
// and each value is its Arabic translation. Placeholders use {name}, for example "{count} patients".
// Role and status labels are display text only. The stored values stay in English.
const ar: Record<string, string> = {
  // Summary cards and header
  "Team members": "أعضاء الفريق",
  "Doctors": "الأطباء",
  "Staff": "الموظفون",
  "Doctors & staff": "الأطباء والموظفون",
  "Add staff": "إضافة موظف",
  "Add staff member": "إضافة عضو الفريق",
  "Add doctor or staff member": "إضافة طبيب أو موظف",
  "Name and role are all that is required. This does not send an invitation or create a login account.": "الاسم والدور هما المطلوبان فقط. لا يُرسل هذا دعوة ولا ينشئ حساب دخول.",
  "Adding…": "جارٍ الإضافة…",
  "Staff member added": "تمت إضافة عضو الفريق",

  // Search and filter
  "Search team": "البحث في الفريق",
  "Search team…": "البحث في الفريق…",
  "Filter by role": "التصفية حسب الدور",
  "All roles": "كل الأدوار",
  "Clear filters": "مسح الفلاتر",
  "No team members found": "لم يُعثر على أعضاء في الفريق",
  "Try another name or choose a different role.": "جرّب اسماً آخر أو اختر دوراً مختلفاً.",
  "No doctors or staff yet": "لا يوجد أطباء أو موظفون بعد",
  "An administrator can add the clinic team here.": "يمكن للمسؤول إضافة فريق العيادة من هنا.",

  // Member card
  "General dentistry": "طب الأسنان العام",
  "Clinic team": "فريق العيادة",
  "Email not recorded": "لم يُسجَّل البريد الإلكتروني",
  "Login connected": "الدخول مرتبط",
  "Staff record only": "سجل موظف فقط",

  // Add dialog
  "Doctor": "طبيب",
  "Staff / employee": "موظف",
  "Full name": "الاسم الكامل",
  "Email address (optional)": "البريد الإلكتروني (اختياري)",
  "Specialty": "التخصص",
  "Job title": "المسمى الوظيفي",
  "Enforced access": "صلاحيات الوصول المطبقة",
  "No dental-chart, treatment-plan, profit, revenue-analytics, or Admin settings access.": "لا صلاحية للوصول إلى مخطط الأسنان أو خطط العلاج أو الأرباح أو تحليلات الإيرادات أو إعدادات المسؤول.",
  "Cancel": "إلغاء",

  // Role names
  "Owner": "المالك",
  "Admin": "المدير",
  "Dentist": "طبيب أسنان",
  "Dental hygienist": "أخصائي تنظيف الأسنان",
  "Dental assistant": "مساعد أسنان",
  "Front desk": "الاستقبال",
  "Billing": "الفوترة",
  "Viewer": "مشاهد",

  // Member status
  "Invited": "مدعو",
  "Active": "نشط",
  "Suspended": "موقوف",

  // Enforced access lists
  "Assigned patients only": "المرضى المسندون فقط",
  "Clinical information": "المعلومات السريرية",
  "Dental charts": "مخططات الأسنان",
  "Patient treatment plans": "خطط علاج المرضى",
  "All patients (view)": "جميع المرضى (عرض)",
  "Appointments": "المواعيد",
  "Patient payments": "مدفوعات المرضى",
  "Printable receipts": "إيصالات قابلة للطباعة",
};

export default ar;
