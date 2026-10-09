const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * `now` defaults to `Date.now()` but can be passed explicitly so tests get a
 * deterministic result instead of a value that depends on when they run.
 */
export function timeAgo(isoDate: string, now: number = Date.now()): string {
  const diffMs = Math.max(0, now - new Date(isoDate).getTime());

  if (diffMs < MINUTE) {
    return 'just now';
  }
  if (diffMs < HOUR) {
    return `${Math.floor(diffMs / MINUTE)}m ago`;
  }
  if (diffMs < DAY) {
    return `${Math.floor(diffMs / HOUR)}h ago`;
  }
  if (diffMs < WEEK) {
    return `${Math.floor(diffMs / DAY)}d ago`;
  }
  return new Date(isoDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
