import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import { ClinicPreferencesProvider } from "@/lib/clinic-preferences";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BrightSmile · Dental Clinic Manager",
  description:
    "Modern multi-tenant dental practice management for clinical care, scheduling, and finance.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cairo.variable} suppressHydrationWarning>
      <body>
        <ClinicPreferencesProvider>{children}</ClinicPreferencesProvider>
      </body>
    </html>
  );
}
