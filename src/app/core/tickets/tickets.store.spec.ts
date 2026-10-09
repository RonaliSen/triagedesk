import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Database } from '../data/database';
import { createTestDatabase } from '../data/database.testing';
import type { Ticket, TicketAnalysis } from '../data/ticket.model';
import { waitUntil } from '../../../testing/wait-until';
import { TicketsStore } from './tickets.store';

function makeAnalysis(): TicketAnalysis {
  return {
    summary: 'Summary',
    category: 'refund',
    priority: 'high',
    sentiment: 'negative',
    suggestedReply: 'Suggested reply',
    analysedAt: new Date().toISOString(),
  };
}

function makeTicket(overrides: Partial<Ticket>): Ticket {
  return {
    id: crypto.randomUUID(),
    customerName: 'Jane Doe',
    customerEmail: 'jane.doe@example.com',
    subject: 'Order issue',
    message: 'Something went wrong with my order.',
    receivedAt: new Date().toISOString(),
    status: 'open',
    activity: [],
    ...overrides,
  };
}

async function setupStore(tickets: Ticket[]) {
  const database = createTestDatabase();
  await database.tickets.bulkAdd(tickets);

  TestBed.configureTestingModule({
    providers: [provideHttpClient(), { provide: Database, useValue: database }],
  });

  const store = TestBed.inject(TicketsStore);
  // No zone.js in this app, and no fixture/detectChanges() here to piggy
  // back on — wait for Dexie's open-then-query chain behind
  // liveQuery/toSignal to actually deliver the seeded rows, rather than
  // guessing how many macrotask ticks that takes.
  await waitUntil(() => store.counts().total === tickets.length);
  return store;
}

describe('TicketsStore', () => {
  it('returns every ticket when no filters are applied', async () => {
    const store = await setupStore([makeTicket({ subject: 'A' }), makeTicket({ subject: 'B' })]);
    expect(store.filteredTickets().length).toBe(2);
  });

  it('filters by search term across subject, customer name, and message', async () => {
    const store = await setupStore([
      makeTicket({ subject: 'Late delivery', customerName: 'Alice', message: 'Package is late' }),
      makeTicket({ subject: 'Login broken', customerName: 'Bob', message: 'Cannot log in' }),
    ]);

    store.setSearchTerm('late');
    expect(store.filteredTickets().map((t) => t.subject)).toEqual(['Late delivery']);

    store.setSearchTerm('bob');
    expect(store.filteredTickets().map((t) => t.customerName)).toEqual(['Bob']);

    store.setSearchTerm('cannot log in');
    expect(store.filteredTickets().map((t) => t.subject)).toEqual(['Login broken']);

    store.setSearchTerm('nothing matches this');
    expect(store.filteredTickets()).toEqual([]);
  });

  it('search is case-insensitive and ignores surrounding whitespace', async () => {
    const store = await setupStore([makeTicket({ subject: 'Damaged Product' })]);
    store.setSearchTerm('  DAMAGED  ');
    expect(store.filteredTickets().length).toBe(1);
  });

  it('filters by status', async () => {
    const store = await setupStore([
      makeTicket({ status: 'open' }),
      makeTicket({ status: 'resolved' }),
      makeTicket({ status: 'resolved' }),
    ]);

    store.setStatusFilter('resolved');
    expect(store.filteredTickets().length).toBe(2);
    expect(store.filteredTickets().every((t) => t.status === 'resolved')).toBe(true);

    store.setStatusFilter('all');
    expect(store.filteredTickets().length).toBe(3);
  });

  it('filters to not-analysed tickets only', async () => {
    const store = await setupStore([makeTicket({ analysis: makeAnalysis() }), makeTicket({})]);

    store.setNotAnalysedOnly(true);
    expect(store.filteredTickets().length).toBe(1);
    expect(store.filteredTickets()[0].analysis).toBeUndefined();

    store.setNotAnalysedOnly(false);
    expect(store.filteredTickets().length).toBe(2);
  });

  it('combines search, status, and not-analysed filters together', async () => {
    const store = await setupStore([
      makeTicket({ subject: 'Late delivery', status: 'open' }),
      makeTicket({ subject: 'Late refund', status: 'resolved' }),
      makeTicket({ subject: 'Late damaged item', status: 'open', analysis: makeAnalysis() }),
    ]);

    store.setSearchTerm('late');
    store.setStatusFilter('open');
    store.setNotAnalysedOnly(true);

    const result = store.filteredTickets();
    expect(result.map((t) => t.subject)).toEqual(['Late delivery']);
  });

  it('computes counts by status and not-analysed, independent of active filters', async () => {
    const store = await setupStore([
      makeTicket({ status: 'open' }),
      makeTicket({ status: 'open' }),
      makeTicket({ status: 'in-progress' }),
      makeTicket({ status: 'waiting' }),
      makeTicket({ status: 'resolved' }),
      makeTicket({ status: 'resolved', analysis: makeAnalysis() }),
    ]);

    // Counts reflect the whole table, not the current filter selection.
    store.setStatusFilter('open');

    expect(store.counts()).toEqual({
      total: 6,
      open: 2,
      inProgress: 1,
      waiting: 1,
      resolved: 2,
      notAnalysed: 5,
    });
  });
});
