// src/lib/dateUtils.ts
// Centralised PH timezone date formatting — use these across all components
// instead of raw date strings to ensure correct Asia/Manila (UTC+8) display.

const PH_LOCALE = 'en-PH';
const PH_TZ     = 'Asia/Manila';

/**
 * Safely parses a date string.
 * DATE-only strings like "2026-05-27" are treated as local midnight
 * to prevent JS from parsing them as UTC and showing the wrong day in PHT.
 */
function toDate(raw: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(raw + 'T00:00:00')
    : new Date(raw);
}

/**
 * "May 26, 2026, 07:33 AM"
 * Use for payment timestamps, transaction dates, notification times.
 */
export function formatDateTime(raw: string | null | undefined): string {
  if (!raw) return '—';
  return toDate(raw).toLocaleString(PH_LOCALE, {
    timeZone: PH_TZ,
    year:     'numeric',
    month:    'short',
    day:      'numeric',
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   true,
  });
}

/**
 * "May 26, 2026"
 * Use for loan dates, due dates, created dates.
 */
export function formatDate(raw: string | null | undefined): string {
  if (!raw) return '—';
  return toDate(raw).toLocaleDateString(PH_LOCALE, {
    timeZone: PH_TZ,
    year:     'numeric',
    month:    'short',
    day:      'numeric',
  });
}

/**
 * "Wednesday, May 27, 2026"
 * Use for Payment Details sheet date row.
 */
export function formatFullDate(raw: string | null | undefined): string {
  if (!raw) return '—';
  return toDate(raw).toLocaleDateString(PH_LOCALE, {
    timeZone: PH_TZ,
    weekday:  'long',
    month:    'long',
    day:      'numeric',
    year:     'numeric',
  });
}

/**
 * "07:33 AM"
 * Use for notification timestamps.
 */
export function formatTime(raw: string | null | undefined): string {
  if (!raw) return '—';
  return toDate(raw).toLocaleTimeString(PH_LOCALE, {
    timeZone: PH_TZ,
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   true,
  });
}

/**
 * "07:33:59 AM"
 * Use for Payment Details sheet time row (includes seconds).
 */
export function formatFullTime(raw: string | null | undefined): string {
  if (!raw) return '—';
  return toDate(raw).toLocaleTimeString(PH_LOCALE, {
    timeZone: PH_TZ,
    hour:     '2-digit',
    minute:   '2-digit',
    second:   '2-digit',
    hour12:   true,
  });
}

/**
 * "3m ago", "2h ago", "3d ago" — falls back to formatDate after 7 days.
 * Use for notification lists, activity feeds.
 */
export function formatRelative(raw: string | null | undefined): string {
  if (!raw) return '—';
  const diff = Date.now() - toDate(raw).getTime();
  const mins = Math.floor(diff / 60_000);
  const hrs  = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins  <  1) return 'Just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hrs   < 24) return `${hrs}h ago`;
  if (days  <  7) return `${days}d ago`;
  return formatDate(raw);
}

/**
 * "Mon, May 26"
 * Use for payment schedule rows, due date lists.
 */
export function formatShortDate(raw: string | null | undefined): string {
  if (!raw) return '—';
  return toDate(raw).toLocaleDateString(PH_LOCALE, {
    timeZone: PH_TZ,
    weekday:  'short',
    month:    'short',
    day:      'numeric',
  });
}

/**
 * "May 2026"
 * Use for grouping transactions/payments by month.
 */
export function formatMonthYear(raw: string | null | undefined): string {
  if (!raw) return '—';
  return toDate(raw).toLocaleDateString(PH_LOCALE, {
    timeZone: PH_TZ,
    month:    'long',
    year:     'numeric',
  });
}

/**
 * Groups an array of records by month (e.g. "May 2026").
 * Expects each record to have a `created_at` or `date` field.
 */
export function groupByMonth<T extends { created_at?: string; date?: string }>(
  items: T[]
): { month: string; records: T[] }[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const raw   = item.created_at ?? item.date ?? '';
    const month = formatMonthYear(raw);
    if (!map.has(month)) map.set(month, []);
    map.get(month)!.push(item);
  }
  return Array.from(map.entries()).map(([month, records]) => ({ month, records }));
}
