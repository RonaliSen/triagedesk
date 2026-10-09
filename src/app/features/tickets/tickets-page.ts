import { ChangeDetectionStrategy, Component, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatOption } from '@angular/material/core';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatPaginator } from '@angular/material/paginator';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSelect } from '@angular/material/select';
import { MatSidenav, MatSidenavContainer, MatSidenavContent } from '@angular/material/sidenav';
import { MatSort, MatSortHeader } from '@angular/material/sort';
import {
  MatCell,
  MatCellDef,
  MatColumnDef,
  MatHeaderCell,
  MatHeaderCellDef,
  MatHeaderRow,
  MatHeaderRowDef,
  MatNoDataRow,
  MatRow,
  MatRowDef,
  MatTable,
  MatTableDataSource,
} from '@angular/material/table';
import { Router, RouterOutlet } from '@angular/router';
import { AnalysisQueueStore } from '../../core/analysis/analysis-queue.store';
import { analysisErrorMessage } from '../../core/analysis/analysis.types';
import { CategoryFilter, PriorityFilter, SentimentFilter, StatusFilter, TicketsStore } from '../../core/tickets/tickets.store';
import type { Ticket, TicketStatus } from '../../core/data/ticket.model';
import { CATEGORY_LABELS, PRIORITY_LABELS, SENTIMENT_LABELS, capitalize, humanizeCategory } from '../../shared/labels';
import { timeAgo } from '../../shared/time-ago';

const STATUS_OPTIONS: { label: string; value: StatusFilter }[] = [
  { label: 'All statuses', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'In Progress', value: 'in-progress' },
  { label: 'Waiting', value: 'waiting' },
  { label: 'Resolved', value: 'resolved' },
];

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  'in-progress': 'In Progress',
  waiting: 'Waiting',
  resolved: 'Resolved',
};

const PRIORITY_OPTIONS: { label: string; value: PriorityFilter }[] = [
  { label: 'All priorities', value: 'all' },
  ...PRIORITY_LABELS,
];

const CATEGORY_OPTIONS: { label: string; value: CategoryFilter }[] = [
  { label: 'All categories', value: 'all' },
  ...CATEGORY_LABELS,
];

const SENTIMENT_OPTIONS: { label: string; value: SentimentFilter }[] = [
  { label: 'All sentiments', value: 'all' },
  ...SENTIMENT_LABELS,
];

const DISPLAYED_COLUMNS = [
  'subject',
  'customerName',
  'priority',
  'category',
  'sentiment',
  'status',
  'receivedAt',
  'actions',
];

@Component({
  selector: 'app-tickets-page',
  imports: [
    FormsModule,
    MatButton,
    MatCheckbox,
    MatOption,
    MatFormField,
    MatLabel,
    MatInput,
    MatPaginator,
    MatProgressBar,
    MatProgressSpinner,
    MatSelect,
    MatSidenav,
    MatSidenavContainer,
    MatSidenavContent,
    MatSort,
    MatSortHeader,
    MatCell,
    MatCellDef,
    MatColumnDef,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatNoDataRow,
    MatRow,
    MatRowDef,
    MatTable,
    RouterOutlet,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tickets-page.html',
  styleUrl: './tickets-page.scss',
})
export class TicketsPage {
  protected readonly ticketsStore = inject(TicketsStore);
  protected readonly queueStore = inject(AnalysisQueueStore);
  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly priorityOptions = PRIORITY_OPTIONS;
  protected readonly categoryOptions = CATEGORY_OPTIONS;
  protected readonly sentimentOptions = SENTIMENT_OPTIONS;
  protected readonly displayedColumns = DISPLAYED_COLUMNS;
  protected readonly dataSource = new MatTableDataSource<Ticket>([]);

  private readonly router = inject(Router);

  protected readonly panelOpen = signal(false);
  private lastOpenedTicketId: string | null = null;

  private readonly sort = viewChild(MatSort);
  private readonly paginator = viewChild(MatPaginator);

  constructor() {
    effect(() => {
      this.dataSource.data = this.ticketsStore.filteredTickets();
    });
    effect(() => {
      const sort = this.sort();
      const paginator = this.paginator();
      if (sort) {
        this.dataSource.sort = sort;
      }
      if (paginator) {
        this.dataSource.paginator = paginator;
      }
    });
  }

  protected firstLine(message: string): string {
    return message.split('\n')[0];
  }

  protected timeAgo(isoDate: string): string {
    return timeAgo(isoDate);
  }

  protected statusLabel(status: TicketStatus): string {
    return STATUS_LABELS[status];
  }

  protected categoryLabel(category: string): string {
    return humanizeCategory(category);
  }

  protected sentimentLabel(sentiment: string): string {
    return capitalize(sentiment);
  }

  protected priorityLabel(priority: string): string {
    return capitalize(priority);
  }

  protected isAnalysing(ticketId: string): boolean {
    return this.ticketsStore.analysingIds().includes(ticketId);
  }

  protected analysisErrorFor(ticketId: string): string | null {
    const error = this.ticketsStore.analysisErrors()[ticketId];
    return error ? analysisErrorMessage(error) : null;
  }

  protected analyse(ticket: Ticket): void {
    void this.ticketsStore.analyseTicket(ticket);
  }

  protected startAnalyseAll(): void {
    void this.queueStore.start();
  }

  protected cancelAnalyseAll(): void {
    this.queueStore.cancel();
  }

  protected openTicket(ticket: Ticket): void {
    this.lastOpenedTicketId = ticket.id;
    void this.router.navigate(['/tickets', ticket.id]);
  }

  // Backdrop click / native Escape on the sidenav itself (mode="over") —
  // routes back so the panel's own close path stays the single source of
  // truth; harmless no-op if we're already navigating away.
  protected closeDetailPanel(): void {
    void this.router.navigate(['/tickets']);
  }

  protected onPanelClosed(): void {
    const id = this.lastOpenedTicketId;
    if (!id) {
      return;
    }
    const row = document.querySelector<HTMLElement>(`tr[data-ticket-id="${id}"]`);
    row?.focus();
  }
}
