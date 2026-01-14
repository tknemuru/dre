import { getDb } from "./init.js";

// ============================================
// Types
// ============================================

/**
 * Book entity (Ver2.0)
 */
export interface Book {
  isbn13: string;
  title: string;
  authors_json: string | null;
  publisher: string | null;
  published_date: string | null;
  description: string | null;
  cover_url: string | null;
  links_json: string | null;
  source: string;
  first_seen_at: string;
  last_seen_at: string;
  last_delivered_at: string | null;
}

/**
 * Book input for upsert (without timestamps)
 */
export interface BookInput {
  isbn13: string;
  title: string;
  authors?: string[];
  publisher?: string;
  published_date?: string;
  description?: string;
  cover_url?: string;
  links?: Array<{ label: string; url: string }>;
  source: string;
}

/**
 * Book delivery record (Ver2.0)
 */
export interface BookDelivery {
  id: number;
  job_name: string;
  delivered_at: string;
  isbn13_list_json: string;
}

export interface JobState {
  job_name: string;
  last_success_at: string | null;
  last_run_at: string | null;
}

export interface ApiUsage {
  date: string;
  provider: string;
  count: number;
}

// ============================================
// Books (Ver2.0)
// ============================================

/**
 * Normalize ISBN-13: remove hyphens, convert ISBN-10 to ISBN-13
 */
export function normalizeIsbn13(isbn: string): string | null {
  if (!isbn) return null;

  // Remove hyphens and spaces
  const cleaned = isbn.replace(/[-\s]/g, "");

  // Check if it's ISBN-13
  if (cleaned.length === 13 && /^\d{13}$/.test(cleaned)) {
    return cleaned;
  }

  // Check if it's ISBN-10, convert to ISBN-13
  if (cleaned.length === 10 && /^\d{9}[\dXx]$/.test(cleaned)) {
    return convertIsbn10To13(cleaned);
  }

  return null;
}

/**
 * Convert ISBN-10 to ISBN-13
 */
function convertIsbn10To13(isbn10: string): string {
  // Prepend 978
  const isbn13Base = "978" + isbn10.slice(0, 9);

  // Calculate check digit
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(isbn13Base[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;

  return isbn13Base + checkDigit;
}

/**
 * Upsert a book (insert or update by ISBN-13)
 */
export function upsertBook(input: BookInput): Book {
  const db = getDb();
  const now = new Date().toISOString();

  const isbn13 = normalizeIsbn13(input.isbn13);
  if (!isbn13) {
    throw new Error(`Invalid ISBN: ${input.isbn13}`);
  }

  const authorsJson = input.authors ? JSON.stringify(input.authors) : null;
  const linksJson = input.links ? JSON.stringify(input.links) : null;

  const existing = db
    .prepare("SELECT * FROM books WHERE isbn13 = ?")
    .get(isbn13) as Book | undefined;

  if (existing) {
    // Update existing book
    db.prepare(
      `UPDATE books SET
        title = ?,
        authors_json = COALESCE(?, authors_json),
        publisher = COALESCE(?, publisher),
        published_date = COALESCE(?, published_date),
        description = COALESCE(?, description),
        cover_url = COALESCE(?, cover_url),
        links_json = COALESCE(?, links_json),
        last_seen_at = ?
       WHERE isbn13 = ?`
    ).run(
      input.title,
      authorsJson,
      input.publisher || null,
      input.published_date || null,
      input.description || null,
      input.cover_url || null,
      linksJson,
      now,
      isbn13
    );

    return {
      ...existing,
      title: input.title,
      authors_json: authorsJson ?? existing.authors_json,
      publisher: input.publisher ?? existing.publisher,
      published_date: input.published_date ?? existing.published_date,
      description: input.description ?? existing.description,
      cover_url: input.cover_url ?? existing.cover_url,
      links_json: linksJson ?? existing.links_json,
      last_seen_at: now,
    };
  } else {
    // Insert new book
    db.prepare(
      `INSERT INTO books (
        isbn13, title, authors_json, publisher, published_date,
        description, cover_url, links_json, source,
        first_seen_at, last_seen_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      isbn13,
      input.title,
      authorsJson,
      input.publisher || null,
      input.published_date || null,
      input.description || null,
      input.cover_url || null,
      linksJson,
      input.source,
      now,
      now
    );

    return {
      isbn13,
      title: input.title,
      authors_json: authorsJson,
      publisher: input.publisher || null,
      published_date: input.published_date || null,
      description: input.description || null,
      cover_url: input.cover_url || null,
      links_json: linksJson,
      source: input.source,
      first_seen_at: now,
      last_seen_at: now,
      last_delivered_at: null,
    };
  }
}

/**
 * Get book by ISBN-13
 */
export function getBookByIsbn(isbn13: string): Book | undefined {
  const db = getDb();
  const normalized = normalizeIsbn13(isbn13);
  if (!normalized) return undefined;

  return db.prepare("SELECT * FROM books WHERE isbn13 = ?").get(normalized) as
    | Book
    | undefined;
}

/**
 * List undelivered books (last_delivered_at IS NULL)
 */
export function listUndeliveredBooks(limit: number = 100): Book[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM books
       WHERE last_delivered_at IS NULL
       ORDER BY first_seen_at DESC
       LIMIT ?`
    )
    .all(limit) as Book[];
}

/**
 * List recent books (for fallback when no undelivered)
 */
export function listRecentBooks(limit: number = 10): Book[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM books
       ORDER BY last_seen_at DESC
       LIMIT ?`
    )
    .all(limit) as Book[];
}

/**
 * Select books for mail (未配信優先 + フォールバック)
 */
export function selectBooksForMail(
  mailLimit: number,
  fallbackLimit: number
): { books: Book[]; isFallback: boolean } {
  const undelivered = listUndeliveredBooks(mailLimit);

  if (undelivered.length > 0) {
    return { books: undelivered, isFallback: false };
  }

  // Fallback: recent books (including delivered)
  const recent = listRecentBooks(fallbackLimit);
  return { books: recent, isFallback: true };
}

/**
 * Mark books as delivered
 */
export function markBooksDelivered(isbn13List: string[]): void {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(
    "UPDATE books SET last_delivered_at = ? WHERE isbn13 = ?"
  );

  const transaction = db.transaction((list: string[]) => {
    for (const isbn13 of list) {
      const normalized = normalizeIsbn13(isbn13);
      if (normalized) {
        stmt.run(now, normalized);
      }
    }
  });

  transaction(isbn13List);
}

/**
 * Create book delivery record
 */
export function createBookDelivery(
  jobName: string,
  isbn13List: string[]
): BookDelivery {
  const db = getDb();
  const now = new Date().toISOString();
  const isbn13ListJson = JSON.stringify(isbn13List);

  const result = db
    .prepare(
      `INSERT INTO book_deliveries (job_name, delivered_at, isbn13_list_json)
       VALUES (?, ?, ?)`
    )
    .run(jobName, now, isbn13ListJson);

  return {
    id: result.lastInsertRowid as number,
    job_name: jobName,
    delivered_at: now,
    isbn13_list_json: isbn13ListJson,
  };
}

/**
 * Reset delivery status for books
 */
export function resetBooksDelivered(options?: {
  jobName?: string;
  sinceDays?: number;
}): number {
  const db = getDb();

  if (options?.jobName) {
    // Reset only books delivered by a specific job
    const deliveries = db
      .prepare(
        "SELECT isbn13_list_json FROM book_deliveries WHERE job_name = ?"
      )
      .all(options.jobName) as { isbn13_list_json: string }[];

    const isbn13Set = new Set<string>();
    for (const d of deliveries) {
      const list = JSON.parse(d.isbn13_list_json) as string[];
      list.forEach((isbn) => isbn13Set.add(isbn));
    }

    if (isbn13Set.size === 0) return 0;

    const placeholders = Array(isbn13Set.size).fill("?").join(",");
    const result = db
      .prepare(
        `UPDATE books SET last_delivered_at = NULL
         WHERE isbn13 IN (${placeholders})`
      )
      .run(...isbn13Set);

    return result.changes;
  } else if (options?.sinceDays) {
    // Reset books delivered within the last N days
    const result = db
      .prepare(
        `UPDATE books SET last_delivered_at = NULL
         WHERE last_delivered_at >= datetime('now', ?)`
      )
      .run(`-${options.sinceDays} days`);

    return result.changes;
  } else {
    // Reset all
    const result = db
      .prepare("UPDATE books SET last_delivered_at = NULL")
      .run();

    return result.changes;
  }
}

/**
 * Get total book count
 */
export function getBookCount(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as count FROM books").get() as {
    count: number;
  };
  return row.count;
}

/**
 * Get undelivered book count
 */
export function getUndeliveredBookCount(): number {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT COUNT(*) as count FROM books WHERE last_delivered_at IS NULL"
    )
    .get() as { count: number };
  return row.count;
}

// ============================================
// Helper functions for Book entity
// ============================================

/**
 * Parse authors from JSON
 */
export function getBookAuthors(book: Book): string[] {
  if (!book.authors_json) return [];
  try {
    return JSON.parse(book.authors_json);
  } catch {
    return [];
  }
}

/**
 * Parse links from JSON
 */
export function getBookLinks(book: Book): Array<{ label: string; url: string }> {
  if (!book.links_json) return [];
  try {
    return JSON.parse(book.links_json);
  } catch {
    return [];
  }
}

// ============================================
// Job State
// ============================================

export function getJobState(jobName: string): JobState | undefined {
  const db = getDb();
  return db
    .prepare("SELECT * FROM job_state WHERE job_name = ?")
    .get(jobName) as JobState | undefined;
}

export function updateJobState(
  jobName: string,
  updates: { last_success_at?: string; last_run_at?: string }
): void {
  const db = getDb();

  const existing = getJobState(jobName);
  if (!existing) {
    db.prepare(
      `INSERT INTO job_state (job_name, last_success_at, last_run_at)
       VALUES (?, ?, ?)`
    ).run(jobName, updates.last_success_at || null, updates.last_run_at || null);
  } else {
    const sets: string[] = [];
    const values: (string | null)[] = [];

    if (updates.last_success_at !== undefined) {
      sets.push("last_success_at = ?");
      values.push(updates.last_success_at);
    }
    if (updates.last_run_at !== undefined) {
      sets.push("last_run_at = ?");
      values.push(updates.last_run_at);
    }

    if (sets.length > 0) {
      values.push(jobName);
      db.prepare(`UPDATE job_state SET ${sets.join(", ")} WHERE job_name = ?`).run(
        ...values
      );
    }
  }
}

// ============================================
// API Usage
// ============================================

export function getApiUsage(date: string, provider: string): number {
  const db = getDb();
  const row = db
    .prepare("SELECT count FROM api_usage WHERE date = ? AND provider = ?")
    .get(date, provider) as { count: number } | undefined;
  return row?.count ?? 0;
}

export function incrementApiUsage(date: string, provider: string): number {
  const db = getDb();

  db.prepare(
    `INSERT INTO api_usage (date, provider, count) VALUES (?, ?, 1)
     ON CONFLICT(date, provider) DO UPDATE SET count = count + 1`
  ).run(date, provider);

  return getApiUsage(date, provider);
}
