// Arabic strings for this area. Each key is the English text exactly as it appears in the JSX,
// and each value is its Arabic translation. Placeholders use {name}, for example "{count} patients".
const ar: Record<string, string> = {
  // Section navigation
  "Clinic profile": "ملف العيادة",
  "Application language": "لغة التطبيق",
  "Notifications": "الإشعارات",
  "Security & access": "الأمان والصلاحيات",

  // Clinic profile
  "Clinic name": "اسم العيادة",
  "Phone": "الهاتف",
  "Email": "البريد الإلكتروني",
  "Address": "العنوان",
  "City & ZIP": "المدينة والرمز البريدي",
  "Time zone": "المنطقة الزمنية",
  "Appointment times and today's date use this time zone. Default: {zone}": "تستخدم أوقات المواعيد وتاريخ اليوم هذه المنطقة الزمنية. الافتراضي: {zone}",
  "Choose a valid time zone.": "اختر منطقة زمنية صالحة.",
  "Save changes": "حفظ التغييرات",
  "Saving…": "جارٍ الحفظ…",
  "Clinic profile saved": "تم حفظ ملف العيادة",
  "Clinic profile was not saved. Check the details and try again.": "لم يُحفظ ملف العيادة. تحقق من التفاصيل وحاول مرة أخرى.",

  // Language and currency
  "This workstation": "هذا الجهاز",
  "Changes the language on this computer only. It does not change what other staff see.": "يغيّر اللغة على هذا الجهاز فقط، ولا يغيّر ما يراه باقي الموظفين.",
  "Language": "اللغة",
  "English": "الإنجليزية",
  "Arabic": "العربية",
  "Application language updated": "تم تحديث لغة التطبيق",
  "Clinic default": "الافتراضي للعيادة",
  "Used by workstations that have not chosen a language yet. Only the clinic owner or an administrator can change it.": "تستخدمها الأجهزة التي لم تختر لغة بعد. لا يمكن تغييرها إلا من مالك العيادة أو المسؤول.",
  "Loading clinic default…": "جارٍ تحميل الافتراضي للعيادة…",
  "The clinic default could not be loaded.": "تعذر تحميل الافتراضي للعيادة.",
  "The clinic default could not be saved.": "تعذر حفظ الافتراضي للعيادة.",
  "Clinic default language updated": "تم تحديث اللغة الافتراضية للعيادة",
  "Clinic currency": "عملة العيادة",
  "Iraqi Dinar (IQD)": "الدينار العراقي (IQD)",
  "US Dollar (USD)": "الدولار الأمريكي (USD)",
  "Clinic currency updated": "تم تحديث عملة العيادة",
  "The clinic currency could not be saved.": "تعذر حفظ عملة العيادة.",

  // Notifications (not stored yet)
  "Notification preferences": "تفضيلات الإشعارات",
  "These reminder settings are not connected to the clinic database yet, so changes are not saved.": "إعدادات التذكير هذه غير مرتبطة بقاعدة بيانات العيادة بعد، لذلك لا تُحفظ التغييرات.",
  "Email appointment reminders": "تذكيرات المواعيد بالبريد الإلكتروني",
  "Send patients confirmations and reminders by email": "إرسال تأكيدات وتذكيرات للمرضى بالبريد الإلكتروني",
  "SMS appointment reminders": "تذكيرات المواعيد بالرسائل النصية",
  "Send a text 24 hours before each visit": "إرسال رسالة نصية قبل 24 ساعة من كل زيارة",
  "Low-stock alerts": "تنبيهات انخفاض المخزون",
  "Notify administrators when supplies reach reorder level": "إخطار المسؤولين عندما تصل المستلزمات إلى حد إعادة الطلب",
  "Save preferences": "حفظ التفضيلات",

  // Security (not connected yet)
  "These security settings are not connected yet and cannot be changed from this screen.": "إعدادات الأمان هذه غير مرتبطة بعد ولا يمكن تغييرها من هذه الشاشة.",
  "Multi-factor authentication": "المصادقة متعددة العوامل",
  "Enabled": "مفعّل",
  "Automatic sign-out": "تسجيل الخروج التلقائي",
  "After 30 minutes of inactivity": "بعد 30 دقيقة من عدم النشاط",
  "After 1 hour": "بعد ساعة",
  "At the end of the day": "في نهاية اليوم",
  "Update security policy": "تحديث سياسة الأمان",
};

export default ar;
