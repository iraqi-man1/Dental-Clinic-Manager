import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
const easternArabicDigits = "۰۱۲۳۴۵۶۷۸۹";

function latinizeDigits(value: string) {
  return value.replace(/[٠-٩۰-۹]/g, (digit) => {
    const arabicIndex = arabicDigits.indexOf(digit);
    return String(arabicIndex >= 0 ? arabicIndex : easternArabicDigits.indexOf(digit));
  });
}

/** Normalizes Iraqi mobile numbers to +9647XXXXXXXXX, or returns null when invalid. */
export function normalizeIraqiMobileNumber(value: string) {
  const compact = latinizeDigits(value.trim()).replace(/[\s().-]/g, "");
  const international = compact.startsWith("00964") ? `+${compact.slice(2)}` : compact;

  if (/^07\d{9}$/.test(international)) return `+964${international.slice(1)}`;
  if (/^\+9647\d{9}$/.test(international)) return international;
  return null;
}

export const iraqiMobileValidationMessage =
  "Enter a valid Iraqi mobile number (07XXXXXXXXX or +9647XXXXXXXXX).";
