import { describe, expect, it } from 'vitest';
import { AnalysisResultSchema, TicketInputSchema } from '../../shared/analysis';

describe('AnalysisResultSchema', () => {
  const valid = {
    summary: 'Customer reports a late delivery and asks for an update.',
    category: 'delivery',
    priority: 'high',
    sentiment: 'frustrated',
    suggestedReply: 'Thanks for reaching out, I will look into this for you.',
  };

  it('accepts a well-formed AI response', () => {
    expect(AnalysisResultSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an unknown category', () => {
    const result = AnalysisResultSchema.safeParse({ ...valid, category: 'sports' });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown priority', () => {
    const result = AnalysisResultSchema.safeParse({ ...valid, priority: 'medium' });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown sentiment', () => {
    const result = AnalysisResultSchema.safeParse({ ...valid, sentiment: 'happy' });
    expect(result.success).toBe(false);
  });

  it('rejects a summary over 20 words', () => {
    const result = AnalysisResultSchema.safeParse({
      ...valid,
      summary: new Array(21).fill('word').join(' '),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a suggestedReply over 120 words', () => {
    const result = AnalysisResultSchema.safeParse({
      ...valid,
      suggestedReply: new Array(121).fill('word').join(' '),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a response missing a required field', () => {
    const { summary, ...withoutSummary } = valid;
    expect(AnalysisResultSchema.safeParse(withoutSummary).success).toBe(false);
  });
});

describe('TicketInputSchema', () => {
  it('accepts a well-formed ticket', () => {
    const result = TicketInputSchema.safeParse({ subject: 'Late order', message: 'Where is it?' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty subject', () => {
    expect(TicketInputSchema.safeParse({ subject: '', message: 'hi' }).success).toBe(false);
  });

  it('rejects an empty message', () => {
    expect(TicketInputSchema.safeParse({ subject: 'hi', message: '' }).success).toBe(false);
  });

  it('rejects a subject over 200 characters', () => {
    const result = TicketInputSchema.safeParse({ subject: 'a'.repeat(201), message: 'hi' });
    expect(result.success).toBe(false);
  });

  it('rejects a message over 3000 characters', () => {
    const result = TicketInputSchema.safeParse({ subject: 'hi', message: 'a'.repeat(3001) });
    expect(result.success).toBe(false);
  });

  it('accepts the exact boundary lengths', () => {
    const result = TicketInputSchema.safeParse({ subject: 'a'.repeat(200), message: 'a'.repeat(3000) });
    expect(result.success).toBe(true);
  });
});
