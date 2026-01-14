import Database from "better-sqlite3";
import { resolve } from "path";
import { existsSync, mkdirSync, copyFileSync, unlinkSync } from "fs";

const DB_PATH = resolve(process.cwd(), "data/app.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    // Ensure data directory exists
    const dataDir = resolve(process.cwd(), "data");
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    initSchema(db);
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function getDbPath(): string {
  return DB_PATH;
}

/**
 * Reset the database: backup existing and create fresh
 * @returns backup file path
 */
export function resetDatabase(): { backupPath: string } {
  // Close existing connection
  closeDb();

  // Create backup with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupPath = `${DB_PATH}.bak.${timestamp}`;

  if (existsSync(DB_PATH)) {
    copyFileSync(DB_PATH, backupPath);
    // Delete the original
    unlinkSync(DB_PATH);
    // Also delete WAL and SHM files if they exist
    const walPath = `${DB_PATH}-wal`;
    const shmPath = `${DB_PATH}-shm`;
    if (existsSync(walPath)) unlinkSync(walPath);
    if (existsSync(shmPath)) unlinkSync(shmPath);
  }

  // Reinitialize with fresh database
  getDb();

  return { backupPath: existsSync(backupPath) ? backupPath : "(no backup - database was empty)" };
}

function initSchema(db: Database.Database): void {
  db.exec(`
    -- ============================================
    -- Ver2.0 Books table: stores book information
    -- ============================================
    CREATE TABLE IF NOT EXISTS books (
      isbn13 TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      authors_json TEXT,
      publisher TEXT,
      published_date TEXT,
      description TEXT,
      cover_url TEXT,
      links_json TEXT,
      source TEXT NOT NULL,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      last_delivered_at TEXT
    );

    -- Index for finding undelivered books
    CREATE INDEX IF NOT EXISTS idx_books_undelivered
      ON books(last_delivered_at) WHERE last_delivered_at IS NULL;

    -- Index for ordering by last_seen
    CREATE INDEX IF NOT EXISTS idx_books_last_seen ON books(last_seen_at);

    -- ============================================
    -- Ver2.0 Book Deliveries table
    -- ============================================
    CREATE TABLE IF NOT EXISTS book_deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_name TEXT NOT NULL,
      delivered_at TEXT NOT NULL,
      isbn13_list_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_book_deliveries_job ON book_deliveries(job_name);

    -- ============================================
    -- Shared tables
    -- ============================================

    -- Job state table: tracks last run times
    CREATE TABLE IF NOT EXISTS job_state (
      job_name TEXT PRIMARY KEY,
      last_success_at TEXT,
      last_run_at TEXT
    );

    -- API usage table: tracks daily API calls
    CREATE TABLE IF NOT EXISTS api_usage (
      date TEXT NOT NULL,
      provider TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (date, provider)
    );
  `);
}
