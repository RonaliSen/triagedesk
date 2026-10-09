import { Clipboard } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatOption } from '@angular/material/core';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSelect } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { liveQuery } from 'dexie';
import { from, map, of, switchMap } from 'rxjs';
import type { Category, Priority, Sentiment } from '../../../../shared/analysis';
import { analysisErrorMessage } from '../../core/analysis/analysis.types';
import { Database } from '../../core/data/database';
import type { Ticket, TicketStatus } from '../../core/data/ticket.model';
import { TicketsStore } from '../../core/tickets/tickets.store';
import { CATEGORY_LABELS, PRIORITY_LABELS, SENTIMENT_LABELS, capitalize } from '../../shared/labels';
import { timeAgo } from '../../shared/time-ago';

const STATUS_OPTIONS: { label: string; value: TicketStatus }[] = [
  { label: 'Open', value: 'open' },
  { label: 'In progress', value: 'in-progress' },
  { label: 'Waiting on customer', value: 'waiting' },
  { label: 'Resolved', value: 'resolved' },
];

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  'in-progress': 'In progress',
  waiting: 'Waiting on customer',
  resolved: 'Resolved',
};

@Component({
  selector: 'app-ticket-detail-panel',
  imports: [
    FormsModule,
    MatButton,
    MatIconButton,
    MatFormField,
    MatLabel,
    MatIcon,
    MatInput,
    MatOption,
    MatProgressSpinner,
    MatSelect,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ticket-detail-panel.html',
  styleUrl: './ticket-detail-panel.scss',
})
export class TicketDetailPanel {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly database = inject(Database);
  private readonly clipboard = inject(Clipboard);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly ticketsStore = inject(TicketsStore);

  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly priorityOptions = PRIORITY_LABELS;
  protected readonly categoryOptions = CATEGORY_LABELS;
  protected readonly sentimentOptions = SENTIMENT_LABELS;

  protected readonly ticketId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: '' },
  );

  protected readonly ticket = toSignal(
    toObservable(this.ticketId).pipe(
      switchMap((id) => (id ? from(liveQuery(() => this.database.tickets.get(id))) : of(undefined))),
    ),
    { initialValue: undefined as Ticket | undefined },
  );

  protected readonly replyDraft = signal('');
  private readonly panelRoot = viewChild<ElementRef<HTMLElement>>('panelRoot');
  private lastLoadedTicketId: string | null = null;

  constructor() {
    effect(() => {
      const ticket = this.ticket();
      if (ticket && ticket.id !== this.lastLoadedTicketId) {
        this.lastLoadedTicketId = ticket.id;
        this.replyDraft.set(ticket.analysis?.suggestedReply ?? '');
        // The component instance (and its scroll position) is reused when
        // switching straight from one ticket's detail to another's.
        const panel = this.panelRoot()?.nativeElement;
        if (panel) {
          panel.scrollTop = 0;
        }
      }
    });
  }

  protected timeAgo(isoDate: string): string {
    return timeAgo(isoDate);
  }

  protected activityNewestFirst(ticket: Ticket) {
    return [...ticket.activity].reverse();
  }

  protected isAnalysing(): boolean {
    return this.ticketsStore.analysingIds().includes(this.ticketId());
  }

  protected analysisError(): string | null {
    const error = this.ticketsStore.analysisErrors()[this.ticketId()];
    return error ? analysisErrorMessage(error) : null;
  }

  protected reanalyse(ticket: Ticket): void {
    void this.ticketsStore.analyseTicket(ticket);
  }

  protected onStatusChange(ticket: Ticket, value: TicketStatus): void {
    void this.ticketsStore.updateTicket(
      ticket.id,
      { status: value },
      `Status changed to ${STATUS_LABELS[value]} by agent`,
    );
  }

  protected onPriorityChange(ticket: Ticket, value: Priority): void {
    if (!ticket.analysis) {
      return;
    }
    void this.ticketsStore.updateTicket(
      ticket.id,
      { analysis: { ...ticket.analysis, priority: value } },
      `Priority changed to ${capitalize(value)} by agent`,
    );
  }

  protected onCategoryChange(ticket: Ticket, value: Category): void {
    if (!ticket.analysis) {
      return;
    }
    void this.ticketsStore.updateTicket(
      ticket.id,
      { analysis: { ...ticket.analysis, category: value } },
      `Category changed to ${capitalize(value)} by agent`,
    );
  }

  protected onSentimentChange(ticket: Ticket, value: Sentiment): void {
    if (!ticket.analysis) {
      return;
    }
    void this.ticketsStore.updateTicket(
      ticket.id,
      { analysis: { ...ticket.analysis, sentiment: value } },
      `Sentiment changed to ${capitalize(value)} by agent`,
    );
  }

  protected copyReply(): void {
    this.clipboard.copy(this.replyDraft());
    this.snackBar.open('Copied to clipboard', 'Dismiss', { duration: 2000 });
  }

  protected markAsSent(ticket: Ticket): void {
    void this.ticketsStore.updateTicket(ticket.id, { status: 'waiting' }, 'Reply marked as sent by agent');
  }

  protected close(): void {
    void this.router.navigate(['..'], { relativeTo: this.route });
  }
}
