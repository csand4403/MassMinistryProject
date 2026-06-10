import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a minister's full name */
export function fullName(minister: { first_name: string; last_name: string }) {
  return `${minister.first_name} ${minister.last_name}`;
}

/** Format a date string "YYYY-MM-DD" to a readable display */
export function formatDate(dateStr: string): string {
  // Parse as local date (avoid UTC shift)
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Returns a short date like "Jun 7" */
export function formatShortDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Returns the day-of-month number from a date string */
export function getDayOfMonth(dateStr: string): number {
  return parseInt(dateStr.split("-")[2], 10);
}
