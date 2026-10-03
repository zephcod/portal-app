/**
 * Schedule-window rules for client reschedules — same limits the
 * scheduler app enforces on compose (its lib/facebook.ts).
 */

const MIN_SCHEDULE_MS = 10 * 60 * 1000;
const MAX_SCHEDULE_MS = 75 * 24 * 60 * 60 * 1000;

/** Returns an error message, or null if the time is within the window. */
export function validateScheduleTime(unixSeconds: number): string | null {
  const delta = unixSeconds * 1000 - Date.now();
  if (delta < MIN_SCHEDULE_MS)
    return "Scheduled time must be at least 10 minutes from now.";
  if (delta > MAX_SCHEDULE_MS)
    return "Scheduled time can be at most 75 days from now.";
  return null;
}
