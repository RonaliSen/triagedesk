import { ChangeDetectionStrategy, Component, effect, inject, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatOption } from '@angular/material/core';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatPaginator } from '@angular/material/paginator';
import { MatSelect } from '@angular/material/select';
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
import { StatusFilter, TicketsStore } from '../../core/tickets/tickets.store';
import type { Ticket, TicketStatus } from '../../core/data/ticket.model';
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

const DISPLAYED_COLUMNS = ['subject', 'customerName', 'priority', 'category', 'sentiment', 'status', 'receivedAt'];

@Component({
  selector: 'app-tickets-page',
  imports: [
    FormsModule,
    MatCheckbox,
    MatOption,
    MatFormField,
    MatLabel,
    MatInput,
    MatPaginator,
    MatSelect,
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tickets-page.html',
  styleUrl: './tickets-page.scss',
})
export class TicketsPage {
  protected readonly ticketsStore = inject(TicketsStore);
  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly displayedColumns = DISPLAYED_COLUMNS;
  protected readonly dataSource = new MatTableDataSource<Ticket>([]);

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
}
