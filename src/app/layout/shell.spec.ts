import { BreakpointObserver } from '@angular/cdk/layout';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Database } from '../core/data/database';
import { createTestDatabase } from '../core/data/database.testing';
import { TicketsStore } from '../core/tickets/tickets.store';
import type { Ticket } from '../core/data/ticket.model';
import { waitUntil } from '../../testing/wait-until';
import { Shell } from './shell';

function makeTicket(overrides: Partial<Ticket>): Ticket {
  return {
    id: crypto.randomUUID(),
    customerName: 'Jane Doe',
    customerEmail: 'jane.doe@example.com',
    subject: 'Test ticket',
    message: 'Test message',
    receivedAt: new Date().toISOString(),
    status: 'open',
    activity: [],
    ...overrides,
  };
}

// jsdom doesn't implement matchMedia, so BreakpointObserver always reports
// "no match" here regardless of the real query — fake it when a test
// specifically needs the mobile layout.
class FakeMobileBreakpointObserver {
  isMatched(): boolean {
    return true;
  }
  observe() {
    return of({ matches: true, breakpoints: {} });
  }
}

async function setup(tickets: Ticket[], options: { mobile?: boolean } = {}) {
  const database = createTestDatabase();
  await database.tickets.bulkAdd(tickets);

  await TestBed.configureTestingModule({
    imports: [Shell],
    providers: [
      provideRouter([]),
      { provide: Database, useValue: database },
      ...(options.mobile ? [{ provide: BreakpointObserver, useClass: FakeMobileBreakpointObserver }] : []),
    ],
  }).compileComponents();

  // Wait for the store to actually have the seeded data — via the same
  // root-singleton TicketsStore the Shell will inject — before the
  // component is ever created, so there's no render-time race to guess at.
  const ticketsStore = TestBed.inject(TicketsStore);
  await waitUntil(() => ticketsStore.counts().total === tickets.length);

  const fixture = TestBed.createComponent(Shell);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

describe('Shell', () => {
  it('should link to Dashboard and Tickets', async () => {
    const fixture = await setup([]);
    const links = Array.from(fixture.nativeElement.querySelectorAll('a[mat-list-item]')) as HTMLAnchorElement[];
    const hrefs = links.map((link) => link.getAttribute('href'));
    expect(hrefs).toContain('/');
    expect(hrefs).toContain('/tickets');
  });

  it('should hide the open-ticket badge when there are no open tickets', async () => {
    const fixture = await setup([makeTicket({ status: 'resolved' })]);
    const badgeHost = fixture.nativeElement.querySelector('.mat-badge') as HTMLElement;
    expect(badgeHost.classList.contains('mat-badge-hidden')).toBe(true);
  });

  it('should show the open-ticket count once there are open tickets', async () => {
    const fixture = await setup([makeTicket({ status: 'open' }), makeTicket({ status: 'open' })]);
    const badgeHost = fixture.nativeElement.querySelector('.mat-badge') as HTMLElement;
    expect(badgeHost.classList.contains('mat-badge-hidden')).toBe(false);
    expect(badgeHost.querySelector('.mat-badge-content')?.textContent?.trim()).toBe('2');
  });

  it('should open the mobile drawer when the menu button is clicked', async () => {
    const fixture = await setup([], { mobile: true });
    expect(fixture.componentInstance.mobileMenuOpen()).toBe(false);

    const menuButton = fixture.nativeElement.querySelector('.topbar button') as HTMLButtonElement;
    menuButton.click();

    expect(fixture.componentInstance.mobileMenuOpen()).toBe(true);
  });

  it('should reset demo data only after confirming in the dialog', async () => {
    const fixture = await setup([makeTicket({ status: 'open' })]);
    const ticketsStore = TestBed.inject(TicketsStore);

    const findButtonByText = (root: ParentNode, text: string) =>
      Array.from(root.querySelectorAll('button')).find((button) => button.textContent?.trim().includes(text)) as
        | HTMLButtonElement
        | undefined;

    const resetButton = findButtonByText(fixture.nativeElement, 'Reset demo data');
    resetButton?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    // MatDialog renders into the CDK overlay, attached to document.body —
    // not inside this component's own fixture.
    expect(document.body.textContent).toContain('Reset demo data');
    const cancelButton = findButtonByText(document.body, 'Cancel');
    expect(cancelButton).toBeTruthy();

    // Exact match — a substring match for "Reset" would also hit the
    // original "Reset demo data" trigger button still sitting in the DOM
    // behind the dialog overlay.
    const confirmButton = Array.from(document.body.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Reset',
    );
    confirmButton?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    // The real proof the reset happened: the store settles back at 40 —
    // the full reseeded set — not just that the dialog closed.
    await waitUntil(() => ticketsStore.counts().total === 40);
    expect(ticketsStore.counts().total).toBe(40);
  });
});
