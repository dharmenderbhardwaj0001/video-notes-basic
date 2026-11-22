#!/usr/bin/env node
/**
 * Keeps only the newest snapshots in notes/backups/ (5 by default).
 *
 * Every save adds a snapshot, so unreachable old ones pile up. This script
 * can be run by hand, and is also used by:
 *   - server.js (after each write, and every 30 minutes while running)
 *   - scripts/backup-prune-scheduler.js (npm run backups:watch)
 * It has no dependencies so server.js can require it directly.
 *
 * Usage:
 *   node scripts/prune-backups.js           # delete all but the 5 newest
 *   node scripts/prune-backups.js --dry-run # only report what would be deleted
 *   node scripts/prune-backups.js --keep 10 # keep a different number
 */
const fs = require('fs');
const path = require('path');

/** Default number of snapshots to keep in notes/backups/. */
const DEFAULT_KEEP = 5;
const BACKUP_DIR = path.join(__dirname, '..', 'notes', 'backups');

/** Timestamp formats used in snapshot names: "video-notes.<stamp>.json". */
const ISO_STAMP = /(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/;
const COMPACT_STAMP = /(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/;

/** Names that are not snapshots and must never be deleted. */
function isSnapshotName(name) {
  return name.endsWith('.json') && (ISO_STAMP.test(name) || COMPACT_STAMP.test(name));
}

/**
 * When a snapshot was taken, independent of the machine's timezone.
 *
 * Older snapshots embed a UTC ISO stamp, newer ones a local compact stamp.
 * Names are parsed rather than using mtime, because copying the folder can
 * reset mtimes and reorder the whole history.
 */
function snapshotTime(fileName) {
  const iso = fileName.match(ISO_STAMP);
  if (iso) {
    const [, year, month, day, hour, minute, second, milli] = iso;
    return Date.UTC(+year, month - 1, +day, +hour, +minute, +second, +milli);
  }
  const [, year, month, day, hour, minute, second] = fileName.match(COMPACT_STAMP);
  return new Date(+year, month - 1, +day, +hour, +minute, +second).getTime();
}

/** Snapshot files in `backupDir`, ordered oldest first. */
function listBackups(backupDir = BACKUP_DIR) {
  let names;
  try {
    names = fs.readdirSync(backupDir);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  return names
    .filter(isSnapshotName)
    .map(name => ({ name, filePath: path.join(backupDir, name), time: snapshotTime(name) }))
    .sort((a, b) => a.time - b.time || a.name.localeCompare(b.name));
}

/**
 * Deletes every snapshot except the `keep` newest ones.
 *
 * Best-effort like the server's inline pruning: a file that cannot be
 * deleted is reported and skipped instead of aborting the whole run.
 */
function pruneBackups({ backupDir = BACKUP_DIR, keep = DEFAULT_KEEP, dryRun = false } = {}) {
  const backups = listBackups(backupDir);
  const excess = backups.slice(0, Math.max(0, backups.length - keep));
  const deleted = [];
  const failed = [];
  for (const backup of excess) {
    if (dryRun) {
      deleted.push(backup.name);
      continue;
    }
    try {
      // unlinkSync throws ENOENT if the file vanished after it was listed.
      fs.unlinkSync(backup.filePath);
      deleted.push(backup.name);
    } catch (err) {
      failed.push({ name: backup.name, error: err.message });
    }
  }
  const kept = backups.slice(Math.max(0, backups.length - keep)).map(backup => backup.name);
  return { total: backups.length, kept, deleted, failed };
}

module.exports = { BACKUP_DIR, DEFAULT_KEEP, listBackups, pruneBackups, snapshotTime };

if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const keepIndex = args.indexOf('--keep');
  const keep = keepIndex === -1 ? DEFAULT_KEEP : Number(args[keepIndex + 1]);
  if (!Number.isInteger(keep) || keep < 1) {
    console.error(`Invalid --keep value: ${args[keepIndex + 1]} (expected a positive integer)`);
    process.exit(1);
  }

  const result = pruneBackups({ keep, dryRun });
  const verb = dryRun ? 'Would delete' : 'Deleted';
  console.log(
    `[backups] ${result.total} snapshot(s) found, keeping the newest ${keep} in ${BACKUP_DIR}`
  );
  if (result.deleted.length === 0) {
    console.log('[backups] nothing to prune');
  } else {
    console.log(`[backups] ${verb} ${result.deleted.length}:`);
    for (const name of result.deleted) console.log(`  - ${name}`);
  }
  for (const { name, error } of result.failed) {
    console.error(`[backups] could not delete ${name}: ${error}`);
  }
  if (result.failed.length > 0) process.exitCode = 1;
}
