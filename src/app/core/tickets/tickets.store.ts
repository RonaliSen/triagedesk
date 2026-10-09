import { computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { patchState, signalStore, withComputed, withMethods, withProps, withState } from '@ngrx/signals';
import { liveQuery } from 'dexie';
import { firstValueFrom, from } from 'rxjs';
import type { Category, Priority, Sentiment } from '../../../../shared/analysis';
import { AnalysisService } from '../analysis/analysis.service';
import type { AnalysisError } from '../analysis/analysis.types';
import { Database } from '../data/database';
import type { Ticket, TicketStatus } from '../data/ticket.model';

export type StatusFilter = TicketStatus | 'all';
export type PriorityFilter = Priority | 'all';
export type CategoryFilter = Category | 'all';
export type SentimentFilter = Sentiment | 'all';

interface TicketsState {
  searchTerm: string;
  statusFilter: StatusFilter;
  priorityFilter: PriorityFilter;
  categoryFilter: CategoryFilter;
  sentimentFilter: SentimentFilter;
  notAnalysedOnly: boolean;
  analysingIds: string[];
  analysisErrors: Record<string, AnalysisError>;
}

function withoutKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const { [key]: _removed, ...rest } = record;
  return rest;
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
    priorityFilter: 'all',
    categoryFilter: 'all',
    sentimentFilter: 'all',
    notAnalysedOnly: false,
    analysingIds: [],
    analysisErrors: {},
  }),
  withProps(() => {
    const database = inject(Database);
    const analysisService = inject(AnalysisService);
    return {
      database,
      analysisService,
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
      const priority = store.priorityFilter();
      const category = store.categoryFilter();
      const sentiment = store.sentimentFilter();
      const notAnalysedOnly = store.notAnalysedOnly();
      const term = store.searchTerm().trim().toLowerCase();

      return store._tickets().filter((ticket) => {
        if (status !== 'all' && ticket.status !== status) {
          return false;
        }
        if (notAnalysedOnly && ticket.analysis) {
          return false;
        }
        if (priority !== 'all' && ticket.analysis?.priority !== priority) {
          return false;
        }
        if (category !== 'all' && ticket.analysis?.category !== category) {
          return false;
        }
        if (sentiment !== 'all' && ticket.analysis?.sentiment !== sentiment) {
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
    setPriorityFilter(filter: PriorityFilter): void {
      patchState(store, { priorityFilter: filter });
    },
    setCategoryFilter(filter: CategoryFilter): void {
      patchState(store, { categoryFilter: filter });
    },
    setSentimentFilter(filter: SentimentFilter): void {
      patchState(store, { sentimentFilter: filter });
    },
    setNotAnalysedOnly(value: boolean): void {
      patchState(store, { notAnalysedOnly: value });
    },
    async updateTicket(ticketId: string, changes: Partial<Ticket>, activityText: string): Promise<void> {
      const ticket = store._tickets().find((t) => t.id === ticketId);
      if (!ticket) {
        return;
      }
      const at = new Date().toISOString();
      await store.database.tickets.update(ticketId, {
        ...changes,
        activity: [...ticket.activity, { at, text: activityText }],
      });
    },
    async analyseTicket(ticket: Ticket): Promise<void> {
      if (store.analysingIds().includes(ticket.id)) {
        return;
      }
      patchState(store, {
        analysingIds: [...store.analysingIds(), ticket.id],
        analysisErrors: withoutKey(store.analysisErrors(), ticket.id),
      });
      try {
        const result = await firstValueFrom(store.analysisService.analyse(ticket));
        const analysedAt = new Date().toISOString();
        await store.database.tickets.update(ticket.id, {
          analysis: { ...result, analysedAt },
          activity: [...ticket.activity, { at: analysedAt, text: 'Analysed by AI' }],
        });
      } catch (err) {
        patchState(store, {
          analysisErrors: { ...store.analysisErrors(), [ticket.id]: err as AnalysisError },
        });
      } finally {
        patchState(store, {
          analysingIds: store.analysingIds().filter((id) => id !== ticket.id),
        });
      }
    },
  })),
);
