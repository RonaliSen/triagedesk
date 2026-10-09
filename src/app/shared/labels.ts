import { CATEGORIES, PRIORITIES, SENTIMENTS, type Category, type Priority, type Sentiment } from '../../../shared/analysis';

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function humanizeCategory(value: string): string {
  return capitalize(value.replace(/-/g, ' '));
}

export const PRIORITY_LABELS: { label: string; value: Priority }[] = PRIORITIES.map((value) => ({
  label: capitalize(value),
  value,
}));

export const CATEGORY_LABELS: { label: string; value: Category }[] = CATEGORIES.map((value) => ({
  label: humanizeCategory(value),
  value,
}));

export const SENTIMENT_LABELS: { label: string; value: Sentiment }[] = SENTIMENTS.map((value) => ({
  label: capitalize(value),
  value,
}));
