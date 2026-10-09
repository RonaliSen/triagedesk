import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Database } from '../../core/data/database';
import { createTestDatabase } from '../../core/data/database.testing';
import { TicketsStore } from '../../core/tickets/tickets.store';
import type { Ticket } from '../../core/data/ticket.model';
import { waitUntil } from '../../../testing/wait-until';
import { TicketsPage } from './tickets-page';

function makeTicket(overrides: Partial<Ticket>): Ticket {
  return {
    id: 'id-1',
    customerName: 'Jane Doe',
    customerEmail: 'jane.doe@example.com',
    subject: 'Order never arrived',
    message: "It's been a week.\nPlease help as soon as you can.",
    receivedAt: new Date().toISOString(),
    status: 'open',
    activity: [],
    ...overrides,
  };
}

async function setup(tickets: Ticket[]) {
  const database = createTestDatabase();
  await database.tickets.bulkAdd(tickets);

  await TestBed.configureTestingModule({
    imports: [TicketsPage],
    providers: [provideHttpClient(), { provide: Database, useValue: database }],
  }).compileComponents();

  // Wait for the store to actually have the seeded data — via the same
  // root-singleton TicketsStore the page will inject — before the
  // component is ever created, so there's no render-time race to guess at.
  const ticketsStore = TestBed.inject(TicketsStore);
  await waitUntil(() => ticketsStore.counts().total === tickets.length);

  const fixture = TestBed.createComponent(TicketsPage);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

describe('TicketsPage', () => {
  it('renders one row per ticket with subject, first message line, and placeholders', async () => {
    const fixture = await setup([
      makeTicket({ id: 'a', subject: 'Order never arrived', message: 'Line one\nLine two' }),
      makeTicket({ id: 'b', subject: 'Login broken', status: 'resolved' }),
    ]);

    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);

    const firstRowText = rows[0].textContent as string;
    expect(firstRowText).toContain('Order never arrived');
    expect(firstRowText).toContain('Line one');
    expect(firstRowText).not.toContain('Line two');

    const placeholderCells = rows[0].querySelectorAll('.placeholder-cell');
    expect(placeholderCells.length).toBe(3);
    expect(Array.from(placeholderCells).every((cell) => (cell as HTMLElement).textContent?.trim() === '–')).toBe(
      true,
    );
  });

  it('shows the empty state when there are no tickets', async () => {
    const fixture = await setup([]);
    const emptyState = fixture.nativeElement.querySelector('.empty-state');
    expect(emptyState).toBeTruthy();
    expect(emptyState.textContent).toContain('No tickets match');
  });
});
