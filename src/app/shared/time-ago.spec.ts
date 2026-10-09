import { timeAgo } from './time-ago';

describe('timeAgo', () => {
  const now = new Date('2026-01-08T12:00:00.000Z').getTime();

  it('returns "just now" for timestamps under a minute old', () => {
    expect(timeAgo(new Date(now - 30_000).toISOString(), now)).toBe('just now');
  });

  it('returns minutes for timestamps under an hour old', () => {
    expect(timeAgo(new Date(now - 5 * 60_000).toISOString(), now)).toBe('5m ago');
  });

  it('returns hours for timestamps under a day old', () => {
    expect(timeAgo(new Date(now - 2 * 60 * 60_000).toISOString(), now)).toBe('2h ago');
  });

  it('returns days for timestamps under a week old', () => {
    expect(timeAgo(new Date(now - 3 * 24 * 60 * 60_000).toISOString(), now)).toBe('3d ago');
  });

  it('falls back to a short date beyond a week', () => {
    const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60_000);
    expect(timeAgo(tenDaysAgo.toISOString(), now)).toBe(
      tenDaysAgo.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    );
  });

  it('clamps future timestamps to "just now" instead of a negative duration', () => {
    expect(timeAgo(new Date(now + 60_000).toISOString(), now)).toBe('just now');
  });

  it('defaults to Date.now() when no reference time is passed', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(timeAgo(fiveMinutesAgo)).toBe('5m ago');
  });
});
