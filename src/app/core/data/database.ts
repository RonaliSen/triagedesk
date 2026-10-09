import { Injectable } from '@angular/core';
import Dexie, { type EntityTable } from 'dexie';
import { createSeedTickets } from './seed-tickets';
import type { Ticket } from './ticket.model';

/**
 * Angular's DI lets tests swap this out — provide a fake under the same
 * `Database` token (e.g. `{ provide: Database, useValue: fakeDb }`) instead
 * of touching real IndexedDB.
 */
@Injectable({ providedIn: 'root' })
export class Database extends Dexie {
  readonly tickets: EntityTable<Ticket, 'id'>;

  constructor() {
    super('triagedesk');
    this.version(1).stores({
      tickets: 'id, status, receivedAt, analysis.category, analysis.priority, analysis.sentiment, analysis.analysedAt',
    });
    this.tickets = this.table('tickets');
    void this.seedIfEmpty();
  }

  private async seedIfEmpty(): Promise<void> {
    const count = await this.tickets.count();
    if (count === 0) {
      await this.tickets.bulkAdd(createSeedTickets());
    }
  }

  async resetDemoData(): Promise<void> {
    await this.tickets.clear();
    await this.tickets.bulkAdd(createSeedTickets());
  }
}
