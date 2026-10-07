// Arabic strings for this area. Each key is the English text exactly as it appears in the JSX,
// and each value is its Arabic translation. Placeholders use {name}, for example "{count} patients".
const ar: Record<string, string> = {
  // Calendar toolbar and views
  "Today": "اليوم",
  "Previous period": "الفترة السابقة",
  "Next period": "الفترة التالية",
  "Search schedule…": "ابحث في الجدول…",
  "Day": "يوم",
  "Week": "أسبوع",
  "Month": "شهر",
  "Agenda": "قائمة المواعيد",
  "Clinic calendar": "تقويم العيادة",
  "Visits in this view": "الزيارات في هذا العرض",
  "Choose a visit to see details": "اختر زيارة لعرض التفاصيل",
  "A little breathing room": "وقت متاح في جدولك",
  "No appointments match this period. Try another date or clear your search.":
    "لا توجد مواعيد مطابقة لهذه الفترة. جرّب تاريخاً آخر أو امسح البحث.",
  "Outside calendar hours": "خارج ساعات التقويم",
  "Select a visit to review or reschedule it. You can also drag cards between time slots.":
    "اختر زيارة لمراجعتها أو تغيير موعدها. يمكنك أيضاً سحب البطاقات بين الفترات الزمنية.",
  "Select a visit to review its details.": "اختر زيارة لمراجعة تفاصيلها.",

  // Appointment status labels
  "Confirmed": "مؤكد",
  "Checked in": "تم تسجيل الوصول",
  "In treatment": "قيد العلاج",
  "Completed": "مكتمل",
  "Pending": "قيد الانتظار",
  "Cancelled": "ملغى",

  // Appointment details dialog
  "Appointment details": "تفاصيل الموعد",
  "Review the visit details and scheduled time.": "راجع تفاصيل الزيارة والوقت المحدد.",
  "Doctor": "الطبيب",
  "Treatment price": "سعر العلاج",
  "Scheduled": "الموعد المحدد",
  "Date": "التاريخ",
  "Start time": "وقت البدء",
  "End time": "وقت الانتهاء",
  "The visit duration stays the same when rescheduling.": "تبقى مدة الزيارة كما هي عند تغيير موعدها.",
  "Close": "إغلاق",
  "Save schedule": "حفظ الموعد",
  "Saving…": "جارٍ الحفظ…",
  "Appointment rescheduled and saved": "تمت إعادة جدولة الموعد وحفظه",

  // New appointment dialog
  "New appointment": "موعد جديد",
  "Schedule appointment": "جدولة موعد",
  "Reserve a provider, room, and time for the patient.": "احجز الطبيب والغرفة والوقت للمريض.",
  "Existing patient": "مريض حالي",
  "New patient": "مريض جديد",
  "Patient": "المريض",
  "Patient name": "اسم المريض",
  "Phone": "الهاتف",
  "Email (optional)": "البريد الإلكتروني (اختياري)",
  "Procedure": "الإجراء",
  "Configure the Price List first": "قم بإعداد قائمة الأسعار أولاً",
  "Saved as a price snapshot for this appointment.": "يُحفظ كنسخة من السعر لهذا الموعد.",
  "Room": "الغرفة",
  "Room 1": "الغرفة 1",
  "Room 2": "الغرفة 2",
  "Room 3": "الغرفة 3",
  "Scheduling…": "جارٍ الجدولة…",
  "Cancel": "إلغاء",

  // Validation and feedback
  "Choose an available doctor and treatment": "اختر طبيباً وعلاجاً متاحين",
  "Create or select a patient first": "أنشئ مريضاً أو اختره أولاً",
  "Choose a valid future date and time": "اختر تاريخاً ووقتاً صالحين في المستقبل",
  "The end time must be after the start time": "يجب أن يكون وقت الانتهاء بعد وقت البدء",
  "Completed or cancelled appointments cannot be moved": "لا يمكن نقل المواعيد المكتملة أو الملغاة",
  "Enter a valid Iraqi mobile number (07XXXXXXXXX or +9647XXXXXXXXX).":
    "أدخل رقم جوال عراقيًا صالحًا (07XXXXXXXXX أو +9647XXXXXXXXX).",
};

export default ar;
