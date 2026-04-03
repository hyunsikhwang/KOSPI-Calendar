import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number, decimals: number = 2) {
  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function getKSTDate(date: Date = new Date()) {
  // Get current time in UTC
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  // KST is UTC+9
  const kstOffset = 9 * 60 * 60000;
  return new Date(utc + kstOffset);
}
