import { Command } from "commander";
import { resetBooksDelivered, getBookCount, getUndeliveredBookCount } from "../db/dao.js";
import { createInterface } from "readline";

async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "yes");
    });
  });
}

/**
 * Parse duration string to days
 * Supports: 7d, 30d, 1w, 4w, 1m
 */
function parseDurationToDays(duration: string): number | null {
  const match = duration.match(/^(\d+)([dwm])$/i);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case "d":
      return value;
    case "w":
      return value * 7;
    case "m":
      return value * 30;
    default:
      return null;
  }
}

export const mailCommand = new Command("mail")
  .description("Mail delivery management commands");

// vibe mail reset
mailCommand
  .command("reset")
  .description("Reset delivery status for books (make them undelivered)")
  .option("--job <name>", "Reset only books delivered by a specific job")
  .option("--since <duration>", "Reset books delivered within duration (e.g., 7d, 30d, 1w)")
  .option("--yes", "Skip confirmation prompt")
  .action(async (options) => {
    console.log("\n=== Mail Reset ===\n");

    // Show current stats
    const totalBooks = getBookCount();
    const undeliveredBefore = getUndeliveredBookCount();
    const deliveredBefore = totalBooks - undeliveredBefore;

    console.log(`Current status:`);
    console.log(`  Total books: ${totalBooks}`);
    console.log(`  Delivered: ${deliveredBefore}`);
    console.log(`  Undelivered: ${undeliveredBefore}`);

    // Determine reset scope
    let scopeDescription: string;
    let resetOptions: { jobName?: string; sinceDays?: number } | undefined;

    if (options.job) {
      scopeDescription = `books delivered by job "${options.job}"`;
      resetOptions = { jobName: options.job };
    } else if (options.since) {
      const days = parseDurationToDays(options.since);
      if (days === null) {
        console.error(`\nInvalid duration format: ${options.since}`);
        console.error("Use formats like: 7d, 30d, 1w, 4w, 1m");
        process.exit(1);
      }
      scopeDescription = `books delivered in the last ${days} day(s)`;
      resetOptions = { sinceDays: days };
    } else {
      scopeDescription = "ALL delivered books";
    }

    console.log(`\nScope: ${scopeDescription}`);

    if (!options.yes) {
      console.log("\nThis will mark these books as undelivered.");
      console.log("They will be eligible for delivery again.\n");

      const confirmed = await confirm("Are you sure you want to proceed?");
      if (!confirmed) {
        console.log("\nAborted.");
        return;
      }
    }

    console.log("\nResetting delivery status...");

    try {
      const resetCount = resetBooksDelivered(resetOptions);

      const undeliveredAfter = getUndeliveredBookCount();

      console.log(`\nReset complete.`);
      console.log(`  Books reset: ${resetCount}`);
      console.log(`  Undelivered now: ${undeliveredAfter}`);
    } catch (error) {
      console.error(`\nError resetting delivery status: ${error}`);
      process.exit(1);
    }
  });

// vibe mail status
mailCommand
  .command("status")
  .description("Show mail delivery status")
  .action(() => {
    console.log("\n=== Mail Status ===\n");

    try {
      const totalBooks = getBookCount();
      const undeliveredBooks = getUndeliveredBookCount();
      const deliveredBooks = totalBooks - undeliveredBooks;

      console.log(`Books:`);
      console.log(`  Total: ${totalBooks}`);
      console.log(`  Delivered: ${deliveredBooks}`);
      console.log(`  Undelivered: ${undeliveredBooks}`);

      if (undeliveredBooks === 0 && totalBooks > 0) {
        console.log(`\nAll books have been delivered.`);
        console.log(`Use 'vibe mail reset' to make them eligible for redelivery.`);
      } else if (undeliveredBooks > 0) {
        console.log(`\n${undeliveredBooks} book(s) ready for next delivery.`);
      }
    } catch (error) {
      console.error(`\nError reading status: ${error}`);
      process.exit(1);
    }
  });
