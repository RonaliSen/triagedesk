import { computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { patchState, signalStore, withComputed, withMethods, withProps, withState } from '@ngrx/signals';
import { liveQuery } from 'dexie';
import { from } from 'rxjs';
import { Database } from '../data/database';
import type { Ticket, TicketStatus } from '../data/ticket.model';

export type StatusFilter = TicketStatus | 'all';

interface TicketsState {
  searchTerm: string;
  statusFilter: StatusFilter;
  notAnalysedOnly: boolean;
}

function matchesSearch(ticket: Ticket, term: string): boolean {
  return (
    ticket.subject.toLowerCase().includes(term) ||
    ticket.customerName.toLowerCase().includes(term) ||
    ticket.message.toLowerCase().includes(term)
  );
}

export const TicketsStore = signalStore(
  { providedIn: 'root' },
  withState<TicketsState>({
    searchTerm: '',
    statusFilter: 'all',
    notAnalysedOnly: false,
  }),
  withProps(() => {
    const database = inject(Database);
    return {
      // Underscore = internal; read `filteredTickets`/`counts` instead.
      // liveQuery re-runs the query (and this signal updates) on every
      // Dexie write, anywhere in the app — no manual refetching needed.
      _tickets: toSignal(from(liveQuery(() => database.tickets.toArray())), {
        initialValue: [] as Ticket[],
      }),
    };
  }),
  withComputed((store) => ({
    filteredTickets: computed(() => {
      const status = store.statusFilter();
      const notAnalysedOnly = store.notAnalysedOnly();
      const term = store.searchTerm().trim().toLowerCase();

      return store._tickets().filter((ticket) => {
        if (status !== 'all' && ticket.status !== status) {
          return false;
        }
        if (notAnalysedOnly && ticket.analysis) {
          return false;
        }
        if (term && !matchesSearch(ticket, term)) {
          return false;
        }
        return true;
      });
    }),
    counts: computed(() => {
      const tickets = store._tickets();
      return {
        total: tickets.length,
        open: tickets.filter((t) => t.status === 'open').length,
        inProgress: tickets.filter((t) => t.status === 'in-progress').length,
        waiting: tickets.filter((t) => t.status === 'waiting').length,
        resolved: tickets.filter((t) => t.status === 'resolved').length,
        notAnalysed: tickets.filter((t) => !t.analysis).length,
      };
    }),
  })),
  withMethods((store) => ({
    setSearchTerm(term: string): void {
      patchState(store, { searchTerm: term });
    },
    setStatusFilter(filter: StatusFilter): void {
      patchState(store, { statusFilter: filter });
    },
    setNotAnalysedOnly(value: boolean): void {
      patchState(store, { notAnalysedOnly: value });
    },
  })),
);
