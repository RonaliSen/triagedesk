export type TicketStatus = 'open' | 'in-progress' | 'waiting' | 'resolved';

export interface TicketActivityEntry {
  /** ISO timestamp */
  at: string;
  text: string;
}

// priority/category/sentiment stay loosely typed as `string` — Milestone 3
// defines the actual AI-analysis taxonomy; nothing here should guess it.
export interface TicketAnalysis {
  summary: string;
  category: string;
  priority: string;
  sentiment: string;
  suggestedReply: string;
  /** ISO timestamp */
  analysedAt: string;
}

export interface Ticket {
  id: string;
  customerName: string;
  customerEmail: string;
  orderId?: string;
  subject: string;
  message: string;
  /** ISO timestamp */
  receivedAt: string;
  status: TicketStatus;
  analysis?: TicketAnalysis;
  activity: TicketActivityEntry[];
}
