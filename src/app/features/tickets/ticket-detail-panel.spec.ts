import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { Database } from '../../core/data/database';
import { createTestDatabase } from '../../core/data/database.testing';
import type { Ticket, TicketAnalysis } from '../../core/data/ticket.model';
import { TicketsStore } from '../../core/tickets/tickets.store';
import { waitUntil } from '../../../testing/wait-until';
import { TicketDetailPanel } from './ticket-detail-panel';

function makeAnalysis(overrides: Partial<TicketAnalysis> = {}): TicketAnalysis {
  return {
    summary: 'Summary',
    category: 'refund',
    priority: 'high',
    sentiment: 'frustrated',
    suggestedReply: 'We will issue your refund shortly.',
    analysedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeTicket(overrides: Partial<Ticket>): Ticket {
  return {
    id: 'ticket-1',
    customerName: 'Jane Doe',
    customerEmail: 'jane.doe@example.com',
    subject: 'Refund request',
    message: 'Please refund my order.',
    receivedAt: new Date().toISOString(),
    status: 'open',
    activity: [{ at: new Date().toISOString(), text: 'Ticket received' }],
    ...overrides,
  };
}

async function setup(ticket: Ticket) {
  const database = createTestDatabase();
  await database.tickets.bulkAdd([ticket]);

  const fakeParamMap = { get: (key: string) => (key === 'id' ? ticket.id : null) };

  await TestBed.configureTestingModule({
    imports: [TicketDetailPanel],
    providers: [
      provideHttpClient(),
      { provide: Database, useValue: database },
      { provide: ActivatedRoute, useValue: { paramMap: of(fakeParamMap) } },
      { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
    ],
  }).compileComponents();

  // Handlers go through TicketsStore.updateTicket, which reads the ticket
  // out of its own live list — wait for that list before driving any edits.
  const ticketsStore = TestBed.inject(TicketsStore);
  await waitUntil(() => ticketsStore.counts().total === 1);

  const fixture = TestBed.createComponent(TicketDetailPanel);
  fixture.detectChanges();
  await fixture.whenStable();

  const panel = fixture.componentInstance as unknown as {
    ticket: () => Ticket | undefined;
    onStatusChange: (ticket: Ticket, value: Ticket['status']) => void;
    onPriorityChange: (ticket: Ticket, value: string) => void;
    onCategoryChange: (ticket: Ticket, value: string) => void;
    onSentimentChange: (ticket: Ticket, value: string) => void;
    markAsSent: (ticket: Ticket) => void;
  };

  // The panel's own liveQuery(ticketId) resolves asynchronously — there's no
  // zone.js in this app to make whenStable() wait for it.
  await waitUntil(() => panel.ticket() !== undefined);
  return panel;
}

describe('TicketDetailPanel', () => {
  it('logs activity when the agent changes the status', async () => {
    const panel = await setup(makeTicket({ status: 'open' }));

    panel.onStatusChange(panel.ticket()!, 'in-progress');

    await waitUntil(() => panel.ticket()?.status === 'in-progress');
    expect(panel.ticket()!.activity.at(-1)?.text).toBe('Status changed to In progress by agent');
  });

  it('logs activity when the agent changes priority, category, or sentiment', async () => {
    const panel = await setup(makeTicket({ analysis: makeAnalysis() }));

    panel.onPriorityChange(panel.ticket()!, 'urgent');
    await waitUntil(() => panel.ticket()?.analysis?.priority === 'urgent');
    expect(panel.ticket()!.activity.at(-1)?.text).toBe('Priority changed to Urgent by agent');

    panel.onCategoryChange(panel.ticket()!, 'billing');
    await waitUntil(() => panel.ticket()?.analysis?.category === 'billing');
    expect(panel.ticket()!.activity.at(-1)?.text).toBe('Category changed to Billing by agent');

    panel.onSentimentChange(panel.ticket()!, 'angry');
    await waitUntil(() => panel.ticket()?.analysis?.sentiment === 'angry');
    expect(panel.ticket()!.activity.at(-1)?.text).toBe('Sentiment changed to Angry by agent');
  });

  it('marking a reply as sent moves the ticket to waiting and logs it', async () => {
    const panel = await setup(makeTicket({ analysis: makeAnalysis(), status: 'open' }));

    panel.markAsSent(panel.ticket()!);

    await waitUntil(() => panel.ticket()?.status === 'waiting');
    expect(panel.ticket()!.activity.at(-1)?.text).toBe('Reply marked as sent by agent');
  });
});
