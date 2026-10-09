import { InjectionToken, isDevMode } from '@angular/core';

// Milestone 5: replace with the real wrangler deploy URL.
const DEPLOYED_WORKER_URL = 'https://REPLACE_ME.workers.dev';

export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  factory: () => (isDevMode() ? 'http://localhost:8787' : DEPLOYED_WORKER_URL),
});
