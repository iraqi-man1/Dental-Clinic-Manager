import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Cairo, Aref_Ruqaa } from "next/font/google";
import { ClinicPreferencesProvider } from "@/lib/clinic-preferences";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

const arefRuqaa = Aref_Ruqaa({ subsets: ["arabic", "latin"], weight: ["400", "700"], variable: "--font-aref-ruqaa", display: "swap" });

// The workstation's language choice is stored in this cookie by the preferences provider.
const LANGUAGE_COOKIE = "nargis-lang";

async function readLanguage(): Promise<"en" | "ar"> {
  const cookieStore = await cookies();
  return cookieStore.get(LANGUAGE_COOKIE)?.value === "ar" ? "ar" : "en";
}

export async function generateMetadata(): Promise<Metadata> {
  const language = await readLanguage();
  return {
    title: "نرجس",
    description:
      language === "ar"
        ? "نظام إدارة عيادات الأسنان متعدد العيادات للرعاية السريرية والمواعيد والمالية."
        : "Modern multi-tenant dental practice management for clinical care, scheduling, and finance.",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const language = await readLanguage();
  return (
    <html
      lang={language}
      dir={language === "ar" ? "rtl" : "ltr"}
      className={`${cairo.variable} ${arefRuqaa.variable}`}
      suppressHydrationWarning
    >
      <body>
        <ClinicPreferencesProvider initialLanguage={language}>{children}</ClinicPreferencesProvider>
      </body>
    </html>
  );
}
