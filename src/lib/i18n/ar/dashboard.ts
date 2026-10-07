// Arabic strings for this area. Each key is the English text exactly as it appears in the JSX,
// and each value is its Arabic translation. Placeholders use {name}, for example "{count} patients".
// Counts use label-style Arabic ("الفواتير المسجلة: {count}") so that no plural agreement is needed.
const ar: Record<string, string> = {
  // Stat cards
  "Today’s appointments": "مواعيد اليوم",
  "{count} confirmed": "المؤكدة: {count}",
  "Total patients": "إجمالي المرضى",
  "Live patient records": "سجلات المرضى المباشرة",
  "Total collected": "إجمالي المبالغ المحصلة",
  "1 invoice": "فاتورة واحدة",
  "{count} invoices": "عدد الفواتير: {count}",
  "Outstanding": "المبالغ المستحقة",
  "1 open invoice": "فاتورة مفتوحة واحدة",
  "{count} open invoices": "الفواتير المفتوحة: {count}",
  "Active treatments": "العلاجات النشطة",
  "1 session remaining": "جلسة متبقية واحدة",
  "{count} sessions remaining": "الجلسات المتبقية: {count}",

  // Revenue overview
  "Revenue overview": "نظرة عامة على الإيرادات",
  "Recorded payments": "المدفوعات المسجلة",
  "All time": "كل الفترات",
  "1 live invoice": "فاتورة مسجلة واحدة",
  "{count} live invoices": "الفواتير المسجلة: {count}",
  "No financial activity yet": "لا يوجد نشاط مالي حتى الآن",

  // Today's schedule
  "Today’s schedule": "جدول اليوم",
  "View calendar": "عرض التقويم",
  "No appointments today": "لا توجد مواعيد اليوم",
  "Confirmed": "مؤكد",
  "Checked in": "تم تسجيل الوصول",
  "In treatment": "قيد العلاج",
  "Completed": "مكتمل",
  "Pending": "قيد الانتظار",
  "Cancelled": "ملغى",

  // Treatment pipeline
  "Treatment pipeline": "مسار العلاج",
  "Planned": "مخطط له",
  "In progress": "قيد التنفيذ",

  // Patient care
  "Patient care": "رعاية المرضى",
  "Recall and retention": "المراجعة والاستبقاء",
  "Retention": "الاستبقاء",
  "Active patients": "المرضى النشطون",
  "Completed visits": "الزيارات المكتملة",

  // Recent activity
  "Recent activity": "النشاط الأخير",
  "Payment received": "تم استلام دفعة",
  "Appointment booked": "تم حجز موعد",
  "No recent activity": "لا يوجد نشاط حديث",
  "Payments and appointment updates will appear here.": "ستظهر المدفوعات وتحديثات المواعيد هنا.",
};

export default ar;
