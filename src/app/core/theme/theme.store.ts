import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'triagedesk-theme';

function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    // localStorage blocked (private mode, disabled storage, etc.) — ignore and fall back
    return null;
  }
}

function prefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

function getInitialTheme(): Theme {
  return readStoredTheme() ?? (prefersDark() ? 'dark' : 'light');
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // nothing we can do if storage is blocked — theme still applies for this session
  }
}

export const ThemeStore = signalStore(
  { providedIn: 'root' },
  withState<{ theme: Theme }>(() => ({ theme: getInitialTheme() })),
  withComputed(({ theme }) => ({
    isDark: computed(() => theme() === 'dark'),
  })),
  withMethods((store) => ({
    toggleTheme(): void {
      const next: Theme = store.theme() === 'dark' ? 'light' : 'dark';
      patchState(store, { theme: next });
      applyTheme(next);
    },
  })),
  withHooks({
    onInit(store) {
      applyTheme(store.theme());
    },
  }),
);
