import { Book, BookInput } from "../db/dao.js";

/**
 * Result from a single query collection
 */
export interface CollectorQueryResult {
  query: string;
  books: BookInput[];
  skipped: number; // Items skipped (no ISBN, etc.)
}

/**
 * Result from a collector run
 */
export interface CollectorResult {
  source: string;
  results: CollectorQueryResult[];
  totalBooks: number;
  totalSkipped: number;
}

/**
 * Collector interface for book collection from various sources
 */
export interface Collector {
  /**
   * Source name (e.g., "google_books")
   */
  readonly source: string;

  /**
   * Collect books for given queries
   * @param queries Search queries
   * @param maxPerRun Maximum books to collect per run
   * @returns Collection result
   */
  collect(queries: string[], maxPerRun: number): Promise<CollectorResult>;
}

/**
 * Collector error class
 */
export class CollectorError extends Error {
  constructor(
    message: string,
    public readonly source: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "CollectorError";
  }
}
