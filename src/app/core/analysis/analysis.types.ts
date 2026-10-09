export type AnalysisError =
  | { kind: 'rate-limited'; retryAfter: number }
  | { kind: 'timeout' }
  | { kind: 'invalid-response' }
  | { kind: 'offline' }
  | { kind: 'validation'; message: string }
  | { kind: 'unknown' };

export function analysisErrorMessage(error: AnalysisError): string {
  switch (error.kind) {
    case 'rate-limited':
      // No live countdown here (unlike the queue's own rate-limit UI) — a
      // fixed "in Ns" would go stale the moment the user doesn't act on it.
      return 'Rate limit reached — wait a moment and try again';
    case 'timeout':
      return 'Analysis timed out — try again';
    case 'invalid-response':
      return 'AI returned an unreadable response — try again';
    case 'offline':
      return "You're offline — check your connection and try again";
    case 'validation':
      return error.message;
    case 'unknown':
      return 'Something went wrong — try again';
  }
}
