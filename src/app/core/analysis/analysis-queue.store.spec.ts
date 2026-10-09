import { TestBed } from '@angular/core/testing';
import { Database } from '../data/database';
import type { Ticket, TicketAnalysis } from '../data/ticket.model';
import { TicketsStore } from '../tickets/tickets.store';
import { AnalysisQueueStore } from './analysis-queue.store';
import type { AnalysisError } from './analysis.types';

function makeAnalysis(): TicketAnalysis {
  return {
    summary: 'Summary',
    category: 'refund',
    priority: 'high',
    sentiment: 'frustrated',
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

/**
 * Stands in for TicketsStore: just enough surface for the queue to drive
 * (`analyseTicket` + `analysisErrors`), with each ticket's outcomes scripted
 * up front instead of going through the real AnalysisService/Dexie — keeps
 * this test about the queue's own ordering/pause/cancel/retry logic only.
 */
class StubTicketsStore {
  readonly calls: string[] = [];
  private readonly errors = new Map<string, AnalysisError>();
  private readonly scripts = new Map<string, Array<AnalysisError | null>>();

  program(ticketId: string, outcomes: Array<AnalysisError | null>): void {
    this.scripts.set(ticketId, [...outcomes]);
  }

  async analyseTicket(ticket: Ticket): Promise<void> {
    this.calls.push(ticket.id);
    const script = this.scripts.get(ticket.id) ?? [];
    const outcome = script.length > 1 ? script.shift()! : (script[0] ?? null);
    if (outcome) {
      this.errors.set(ticket.id, outcome);
    } else {
      this.errors.delete(ticket.id);
    }
  }

  analysisErrors(): Record<string, AnalysisError> {
    return Object.fromEntries(this.errors);
  }
}

function setup(tickets: Ticket[]) {
  const stubTickets = new StubTicketsStore();
  const stubDatabase = { tickets: { toArray: async () => tickets } } as unknown as Database;

  TestBed.configureTestingModule({
    providers: [
      { provide: Database, useValue: stubDatabase },
      { provide: TicketsStore, useValue: stubTickets },
    ],
  });

  return { store: TestBed.inject(AnalysisQueueStore), stubTickets };
}

describe('AnalysisQueueStore', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('processes unanalysed tickets in order, skipping ones already analysed, pausing ~4s between calls', async () => {
    const already = makeTicket({ id: 'already', analysis: makeAnalysis() });
    const t1 = makeTicket({ id: 't1' });
    const t2 = makeTicket({ id: 't2' });
    const { store, stubTickets } = setup([t1, already, t2]);
    stubTickets.program('t1', [null]);
    stubTickets.program('t2', [null]);
    // "already" is intentionally never programmed — any call to it throws.

    vi.useFakeTimers();
    const done = store.start();

    await vi.advanceTimersByTimeAsync(0);
    expect(stubTickets.calls).toEqual(['t1']);
    expect(store.total()).toBe(2);

    await vi.advanceTimersByTimeAsync(4000);
    expect(stubTickets.calls).toEqual(['t1', 't2']);

    await done;
    expect(store.completed()).toBe(2);
    expect(store.status()).toBe('idle');
  });

  it('cancel stops the queue before the next ticket starts', async () => {
    const t1 = makeTicket({ id: 't1' });
    const t2 = makeTicket({ id: 't2' });
    const { store, stubTickets } = setup([t1, t2]);
    stubTickets.program('t1', [null]);
    stubTickets.program('t2', [null]);

    vi.useFakeTimers();
    const done = store.start();

    await vi.advanceTimersByTimeAsync(0);
    expect(stubTickets.calls).toEqual(['t1']);

    store.cancel();
    await vi.advanceTimersByTimeAsync(4000);
    await done;

    expect(stubTickets.calls).toEqual(['t1']);
    expect(store.status()).toBe('cancelled');
  });

  it('on a rate-limited error, pauses for retryAfter seconds with a live countdown, then retries the same ticket', async () => {
    const t1 = makeTicket({ id: 't1' });
    const { store, stubTickets } = setup([t1]);
    stubTickets.program('t1', [{ kind: 'rate-limited', retryAfter: 3 }, null]);

    vi.useFakeTimers();
    const done = store.start();

    await vi.advanceTimersByTimeAsync(0);
    expect(stubTickets.calls).toEqual(['t1']);
    expect(store.rateLimitCountdown()).toBe(3);

    await vi.advanceTimersByTimeAsync(1000);
    expect(store.rateLimitCountdown()).toBe(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(store.rateLimitCountdown()).toBe(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(store.rateLimitCountdown()).toBeNull();
    expect(stubTickets.calls).toEqual(['t1', 't1']);

    await done;
    expect(store.completed()).toBe(1);
    expect(store.status()).toBe('idle');
  });
});
