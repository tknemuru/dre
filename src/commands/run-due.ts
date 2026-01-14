import { Command } from "commander";
import {
  loadJobsConfig,
  Job,
  getJobQueries,
} from "../config/jobs.js";
import {
  getJobState,
  updateJobState,
  upsertBook,
  selectBooksForMail,
  Book,
} from "../db/dao.js";
import { createGoogleBooksCollector } from "../collectors/google-books.js";
import { CollectorError } from "../collectors/index.js";
import { getGoogleBooksQuotaStatus } from "../utils/quota.js";
import { sendBookDigestEmail, MailerError } from "../services/mailer.js";

const DUE_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

function log(level: "INFO" | "WARN" | "ERROR", message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`);
}

function isJobDue(jobName: string): boolean {
  const state = getJobState(jobName);
  if (!state?.last_success_at) {
    return true; // Never run before
  }

  const lastSuccess = new Date(state.last_success_at).getTime();
  const now = Date.now();
  return now - lastSuccess >= DUE_INTERVAL_MS;
}

/**
 * Ver2.0 Book Pipeline
 * Flow: collect -> select -> mail
 */
async function runJobV2(
  job: Job,
  defaults: { mail_limit: number; max_per_run: number; fallback_limit: number }
): Promise<{ jobName: string; books: Book[] } | null> {
  const jobName = job.name;
  log("INFO", `Processing job: ${jobName}`);

  // Update last_run_at
  updateJobState(jobName, { last_run_at: new Date().toISOString() });

  // Get effective settings
  const queries = getJobQueries(job);
  const maxPerRun = job.max_per_run ?? defaults.max_per_run;

  try {
    // 1. Collect books
    log("INFO", `Collecting books for queries: ${JSON.stringify(queries)}`);
    log("INFO", `max_per_run=${maxPerRun}`);

    const collector = createGoogleBooksCollector();
    const collectResult = await collector.collect(queries, maxPerRun);

    log(
      "INFO",
      `Collected ${collectResult.totalBooks} book(s), skipped ${collectResult.totalSkipped} (no ISBN)`
    );

    // Upsert collected books to database
    let upsertedCount = 0;
    for (const queryResult of collectResult.results) {
      for (const bookInput of queryResult.books) {
        try {
          upsertBook(bookInput);
          upsertedCount++;
        } catch (error) {
          log("WARN", `Failed to upsert book ${bookInput.isbn13}: ${error}`);
        }
      }
    }
    log("INFO", `Upserted ${upsertedCount} book(s) to database`);

    // Mark success
    updateJobState(jobName, { last_success_at: new Date().toISOString() });

    // Return empty for now - selection happens after all jobs complete
    return {
      jobName,
      books: [],
    };
  } catch (error) {
    if (error instanceof CollectorError) {
      log("ERROR", `Collector error for ${jobName}: ${error.message}`);
    } else {
      log("ERROR", `Error processing ${jobName}: ${error}`);
    }
    return null;
  }
}

export const runDueCommand = new Command("run-due")
  .description("Run all due jobs and send book digest email")
  .option("--dry-run", "Check which jobs are due without running them")
  .option("--force", "Run all enabled jobs regardless of due status")
  .option("--force-mail", "Force send email even with 0 books (for testing)")
  .action(async (options) => {
    log("INFO", "Starting vibe run-due (Ver2.0 - Book Collection Mode)");
    log("INFO", getGoogleBooksQuotaStatus());

    try {
      const config = loadJobsConfig();
      const enabledJobs = config.jobs.filter((j) => j.enabled);

      if (enabledJobs.length === 0) {
        log("WARN", "No enabled jobs found");
        return;
      }

      log("INFO", `Found ${enabledJobs.length} enabled job(s)`);

      // Check which jobs are due
      const dueJobs = options.force
        ? enabledJobs
        : enabledJobs.filter((j) => isJobDue(j.name));

      if (dueJobs.length === 0) {
        log("INFO", "No jobs are due at this time");
        return;
      }

      log("INFO", `${dueJobs.length} job(s) are due: ${dueJobs.map((j) => j.name).join(", ")}`);

      if (options.dryRun) {
        log("INFO", "Dry run - not executing jobs");
        return;
      }

      // Get defaults from config
      const defaults = {
        mail_limit: config.defaults.mail_limit,
        max_per_run: config.defaults.max_per_run,
        fallback_limit: config.defaults.fallback_limit,
      };

      // Process each due job (collect books)
      const results: { jobName: string; books: Book[] }[] = [];
      for (const job of dueJobs) {
        const result = await runJobV2(job, defaults);
        if (result) {
          results.push(result);
        }
      }

      // Select books for mail (after all jobs completed)
      log("INFO", `Selecting books: mail_limit=${defaults.mail_limit}, fallback_limit=${defaults.fallback_limit}`);
      const selection = selectBooksForMail(defaults.mail_limit, defaults.fallback_limit);

      if (selection.isFallback) {
        log("INFO", `Using fallback: ${selection.books.length} recent book(s) (no undelivered books)`);
      } else {
        log("INFO", `Selected ${selection.books.length} undelivered book(s)`);
      }

      // Send mail
      if (selection.books.length > 0 || options.forceMail) {
        try {
          await sendBookDigestEmail(selection.books, "combined");
          log("INFO", `Email sent with ${selection.books.length} book(s)`);
        } catch (error) {
          if (error instanceof MailerError) {
            log("ERROR", `Mailer error: ${error.message}`);
          } else {
            throw error;
          }
        }
      } else {
        log("INFO", "No books to send");
      }

      log("INFO", getGoogleBooksQuotaStatus());
      log("INFO", "Completed vibe run-due");
    } catch (error) {
      log("ERROR", `Fatal error: ${error}`);
      log("ERROR", "Run 'vibe doctor' to diagnose configuration issues");
      process.exit(1);
    }
  });
