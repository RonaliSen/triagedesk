// Also installed globally in src/test-setup.ts (required there — Dexie
// snapshots globalThis.indexedDB once, the first time it's imported). Kept
// here too as a safety net for anything that imports this helper outside
// that configured test runner.
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { createSeedTickets } from './seed-tickets';
import type { Ticket } from './ticket.model';
import type { Database } from './database';

let counter = 0;

/**
 * A real Dexie instance backed by fake-indexeddb, not a hand-rolled plain
 * object — Dexie's liveQuery only tracks reads on real tables, so a plain
 * object standing in for the Database silently never emits anything
 * (confirmed: no error, no value, it just hangs). Each call gets its own
 * uniquely-named database so tests never leak data into each other.
 */
export function createTestDatabase(): Database {
  class TestDatabase extends Dexie {
    readonly tickets: Dexie.Table<Ticket, string>;

    constructor() {
      super(`test-db-${counter++}`);
      this.version(1).stores({
        tickets:
          'id, status, receivedAt, analysis.category, analysis.priority, analysis.sentiment, analysis.analysedAt',
      });
      this.tickets = this.table('tickets');
    }

    async resetDemoData(): Promise<void> {
      await this.tickets.clear();
      await this.tickets.bulkAdd(createSeedTickets());
    }
  }

  // Database has a private `seedIfEmpty` method, which makes it structurally
  // incompatible with any other class by TS's rules even though the public
  // shape matches exactly — this cast is only needed because of that.
  return new TestDatabase() as unknown as Database;
}
