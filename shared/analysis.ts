import { z } from 'zod';

export const CATEGORIES = [
  'billing',
  'delivery',
  'refund',
  'account',
  'product-quality',
  'technical',
  'other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const PRIORITIES = ['urgent', 'high', 'normal', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const SENTIMENTS = ['angry', 'frustrated', 'neutral', 'positive'] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

export const AnalysisResultSchema = z.object({
  summary: z.string().refine((s) => s.trim().split(/\s+/).filter(Boolean).length <= 20, {
    message: 'summary must be 20 words or fewer',
  }),
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
  sentiment: z.enum(SENTIMENTS),
  suggestedReply: z
    .string()
    .refine((s) => s.trim().split(/\s+/).filter(Boolean).length <= 120, {
      message: 'suggestedReply must be 120 words or fewer',
    }),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export const TicketInputSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(1, 'subject is required')
    .max(200, 'subject must be 200 characters or fewer'),
  message: z
    .string()
    .trim()
    .min(1, 'message is required')
    .max(3000, 'message must be 3000 characters or fewer'),
});

export type TicketInput = z.infer<typeof TicketInputSchema>;
