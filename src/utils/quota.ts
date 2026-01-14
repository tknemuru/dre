import { getApiUsage, incrementApiUsage } from "../db/dao.js";

function getTodayDateString(timezone: string): string {
  const now = new Date();
  // Format as YYYY-MM-DD in the specified timezone
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

export function getTimezone(): string {
  return process.env.APP_TZ || "Asia/Tokyo";
}

// ============================================
// Google Books API Quota Management (Ver2.0)
// ============================================

const DEFAULT_DAILY_BOOKS_LIMIT = 100;
const PROVIDER_BOOKS = "google_books";

export function getGoogleBooksDailyLimit(): number {
  const envLimit = process.env.DAILY_BOOKS_API_LIMIT;
  if (envLimit) {
    const parsed = parseInt(envLimit, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_DAILY_BOOKS_LIMIT;
}

export function checkGoogleBooksQuota(): { allowed: boolean; current: number; limit: number; date: string } {
  const timezone = getTimezone();
  const date = getTodayDateString(timezone);
  const limit = getGoogleBooksDailyLimit();
  const current = getApiUsage(date, PROVIDER_BOOKS);

  return {
    allowed: current < limit,
    current,
    limit,
    date,
  };
}

export function consumeGoogleBooksQuota(): { success: boolean; current: number; limit: number } {
  const timezone = getTimezone();
  const date = getTodayDateString(timezone);
  const limit = getGoogleBooksDailyLimit();

  // Check before consuming
  const currentBefore = getApiUsage(date, PROVIDER_BOOKS);
  if (currentBefore >= limit) {
    return {
      success: false,
      current: currentBefore,
      limit,
    };
  }

  // Consume quota
  const newCount = incrementApiUsage(date, PROVIDER_BOOKS);

  return {
    success: true,
    current: newCount,
    limit,
  };
}

export function getGoogleBooksQuotaStatus(): string {
  const quota = checkGoogleBooksQuota();
  const remaining = quota.limit - quota.current;
  return `Google Books Quota: ${quota.current}/${quota.limit} used (${remaining} remaining) [${quota.date}]`;
}
