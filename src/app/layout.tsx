import type { Metadata } from "next";
import { Cairo, Aref_Ruqaa } from "next/font/google";
import { ClinicPreferencesProvider } from "@/lib/clinic-preferences";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

const arefRuqaa = Aref_Ruqaa({ subsets: ["arabic", "latin"], weight: ["400", "700"], variable: "--font-aref-ruqaa", display: "swap" });

export const metadata: Metadata = {
  title: "نرجس",
  description:
    "Modern multi-tenant dental practice management for clinical care, scheduling, and finance.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${cairo.variable} ${arefRuqaa.variable}`} suppressHydrationWarning>
      <body>
        <ClinicPreferencesProvider>{children}</ClinicPreferencesProvider>
      </body>
    </html>
  );
}
