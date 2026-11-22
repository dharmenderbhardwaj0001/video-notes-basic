#!/usr/bin/env node
/**
 * Runs the backup cleanup every 30 minutes.
 *
 * Snapshot files are created by the app, but nothing cleans them up unless
 * it is asked to. Use with:
 *
 *   npm run backups:watch
 *
 * It prunes immediately, then every 30 minutes, so notes/backups/ never
 * holds more than the newest 5 snapshots.
 *
 * Configure with environment variables:
 *   BACKUP_PRUNE_INTERVAL_MS  how often to run (default 1800000 = 30 min)
 *   BACKUP_KEEP               how many snapshots to keep (default 5)
 *
 * To run it in the background without a console window on Windows:
 *   start "" /b node scripts\backup-prune-scheduler.js
 */
const path = require('path');
const { BACKUP_DIR, DEFAULT_KEEP, pruneBackups } = require('./prune-backups');

const INTERVAL_MS = Number(process.env.BACKUP_PRUNE_INTERVAL_MS) || 30 * 60 * 1000;
const KEEP = Number(process.env.BACKUP_KEEP) || DEFAULT_KEEP;

function timestamp() {
  return new Date().toISOString();
}

function runOnce() {
  const { total, deleted, failed } = pruneBackups({ keep: KEEP });
  if (failed.length > 0) {
    for (const { name, error } of failed) {
      console.error(`[backups] ${timestamp()} could not delete ${name}: ${error}`);
    }
  }
  if (deleted.length > 0) {
    console.log(
      `[backups] ${timestamp()} deleted ${deleted.length} old snapshot(s), kept ${Math.min(KEEP, total)} in ${BACKUP_DIR}`
    );
  }
}

/** Guards against overlapping runs if a prune ever takes longer than the interval. */
let running = false;

function tick(reason) {
  if (running) return;
  running = true;
  try {
    runOnce();
  } catch (err) {
    // Keep the scheduler alive; a locked file now may be gone next run.
    console.error(`[backups] ${timestamp()} prune failed (${reason}): ${err.message}`);
  } finally {
    running = false;
  }
}

console.log(
  `[backups] ${timestamp()} watching ${BACKUP_DIR} every ${Math.round(INTERVAL_MS / 60000)} minute(s), keeping ${KEEP} snapshot(s)`
);
tick('startup');

setInterval(() => tick('interval'), INTERVAL_MS);

// Ctrl+C should stop the watcher, not wait for the timer.
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
