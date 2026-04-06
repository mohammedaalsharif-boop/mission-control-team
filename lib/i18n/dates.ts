/**
 * Date formatting utilities with Hijri calendar support.
 * Uses the built-in Intl API with "islamic-umalqura" calendar for Hijri dates.
 */

type Locale = "en" | "ar";

/** Format a date in short form: "Mar 15" or "١٥ ربيع الأول" */
export function formatDateShort(date: Date | number, locale: Locale): string {
  const d = typeof date === "number" ? new Date(date) : date;
  if (locale === "ar") {
    // Show Hijri date
    return d.toLocaleDateString("ar-SA-u-ca-islamic-umalqura", {
      month: "short",
      day: "numeric",
    });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Format a date in full form: "Wed, Mar 15, 2025" or Hijri equivalent */
export function formatDateFull(date: Date | number, locale: Locale): string {
  const d = typeof date === "number" ? new Date(date) : date;
  if (locale === "ar") {
    return d.toLocaleDateString("ar-SA-u-ca-islamic-umalqura", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Format a date with month and year: "March 2025" or Hijri equivalent */
export function formatDateMonthYear(date: Date | number, locale: Locale): string {
  const d = typeof date === "number" ? new Date(date) : date;
  if (locale === "ar") {
    return d.toLocaleDateString("ar-SA-u-ca-islamic-umalqura", {
      month: "long",
      year: "numeric",
    });
  }
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** Relative time: "just now", "5m ago", "2h ago", "3d ago" — localized */
export function timeAgo(date: Date | number, locale: Locale): string {
  const d = typeof date === "number" ? date : date.getTime();
  const diff = Date.now() - d;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);

  if (locale === "ar") {
    if (mins < 1)   return "الآن";
    if (mins < 60)  return `منذ ${mins} د`;
    if (hours < 24) return `منذ ${hours} س`;
    return `منذ ${days} ي`;
  }

  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

/** Format a date for display alongside Gregorian when in Arabic mode */
export function formatDualDate(date: Date | number, locale: Locale): string {
  const d = typeof date === "number" ? new Date(date) : date;
  if (locale === "ar") {
    const hijri = d.toLocaleDateString("ar-SA-u-ca-islamic-umalqura", {
      month: "short",
      day: "numeric",
    });
    const gregorian = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    return `${hijri} (${gregorian})`;
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
