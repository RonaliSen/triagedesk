import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, TimeoutError, throwError } from 'rxjs';
import { catchError, map, timeout } from 'rxjs/operators';
import { AnalysisResult, AnalysisResultSchema, TicketInput } from '../../../../shared/analysis';
import { API_BASE_URL } from '../config/api-base-url';
import { AnalysisError } from './analysis.types';

const TIMEOUT_MS = 25_000;

@Injectable({ providedIn: 'root' })
export class AnalysisService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  analyse(ticket: TicketInput): Observable<AnalysisResult> {
    if (!navigator.onLine) {
      return throwError(() => ({ kind: 'offline' } satisfies AnalysisError));
    }

    return this.http
      .post(`${this.baseUrl}/analyze`, { subject: ticket.subject, message: ticket.message })
      .pipe(
        timeout(TIMEOUT_MS),
        map((body) => {
          const parsed = AnalysisResultSchema.safeParse(body);
          if (!parsed.success) {
            throw { kind: 'invalid-response' } satisfies AnalysisError;
          }
          return parsed.data;
        }),
        catchError((err: unknown) => throwError(() => toAnalysisError(err))),
      );
  }
}

function toAnalysisError(err: unknown): AnalysisError {
  if (err && typeof err === 'object' && 'kind' in err) {
    return err as AnalysisError;
  }
  if (err instanceof TimeoutError) {
    return { kind: 'timeout' };
  }
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) {
      return { kind: 'offline' };
    }
    if (err.status === 429) {
      const retryAfter = Number(err.headers.get('Retry-After')) || 60;
      return { kind: 'rate-limited', retryAfter };
    }
    if (err.status === 504) {
      return { kind: 'timeout' };
    }
    if (err.status === 400) {
      const message =
        err.error && typeof err.error === 'object' && 'error' in err.error
          ? String((err.error as { error: unknown }).error)
          : 'Invalid ticket';
      return { kind: 'validation', message };
    }
    if (err.status === 502) {
      return { kind: 'invalid-response' };
    }
    return { kind: 'unknown' };
  }
  return { kind: 'unknown' };
}
