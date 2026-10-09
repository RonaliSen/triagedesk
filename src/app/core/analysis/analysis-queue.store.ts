import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withProps, withState } from '@ngrx/signals';
import { Database } from '../data/database';
import { TicketsStore } from '../tickets/tickets.store';

interface QueueState {
  status: 'idle' | 'running' | 'cancelled';
  total: number;
  completed: number;
  rateLimitCountdown: number | null;
}

const PAUSE_BETWEEN_CALLS_MS = 4_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const AnalysisQueueStore = signalStore(
  { providedIn: 'root' },
  withState<QueueState>({
    status: 'idle',
    total: 0,
    completed: 0,
    rateLimitCountdown: null,
  }),
  withProps(() => ({
    database: inject(Database),
    ticketsStore: inject(TicketsStore),
  })),
  withComputed((store) => ({
    isRunning: computed(() => store.status() === 'running'),
    progressPercent: computed(() =>
      store.total() === 0 ? 0 : Math.round((store.completed() / store.total()) * 100),
    ),
  })),
  withMethods((store) => ({
    cancel(): void {
      if (store.status() === 'running') {
        patchState(store, { status: 'cancelled', rateLimitCountdown: null });
      }
    },
    async start(): Promise<void> {
      if (store.status() === 'running') {
        return;
      }

      const pending = (await store.database.tickets.toArray()).filter((ticket) => !ticket.analysis);
      patchState(store, { status: 'running', total: pending.length, completed: 0, rateLimitCountdown: null });

      for (let i = 0; i < pending.length; i++) {
        const ticket = pending[i];

        while (true) {
          if (store.status() !== 'running') {
            return;
          }

          await store.ticketsStore.analyseTicket(ticket);
          if (store.status() !== 'running') {
            return;
          }

          const error = store.ticketsStore.analysisErrors()[ticket.id];
          if (error?.kind !== 'rate-limited') {
            break;
          }

          let remaining = error.retryAfter;
          patchState(store, { rateLimitCountdown: remaining });
          while (remaining > 0) {
            if (store.status() !== 'running') {
              return;
            }
            await sleep(1000);
            remaining -= 1;
            patchState(store, { rateLimitCountdown: remaining > 0 ? remaining : null });
          }
        }

        patchState(store, { completed: store.completed() + 1 });

        const isLast = i === pending.length - 1;
        if (!isLast) {
          await sleep(PAUSE_BETWEEN_CALLS_MS);
        }
      }

      if (store.status() === 'running') {
        patchState(store, { status: 'idle' });
      }
    },
  })),
);
