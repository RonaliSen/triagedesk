import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { TicketInput } from '../../../../shared/analysis';
import { API_BASE_URL } from '../config/api-base-url';
import { AnalysisService } from './analysis.service';
import type { AnalysisError } from './analysis.types';

const BASE_URL = 'http://test';

const TICKET: TicketInput = { subject: 'Order late', message: 'Where is my order?' };

const VALID_RESULT = {
  summary: 'Customer asking about a late order',
  category: 'delivery',
  priority: 'high',
  sentiment: 'frustrated',
  suggestedReply: 'We are looking into this and will update you shortly.',
};

describe('AnalysisService', () => {
  let service: AnalysisService;
  let httpMock: HttpTestingController;
  let originalOnLine: boolean;

  beforeEach(() => {
    originalOnLine = navigator.onLine;
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: BASE_URL }],
    });
    service = TestBed.inject(AnalysisService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
    httpMock.verify();
  });

  it('posts subject and message and resolves with the parsed analysis on success', async () => {
    const result$ = new Promise((resolve, reject) => {
      service.analyse(TICKET).subscribe({ next: resolve, error: reject });
    });

    const req = httpMock.expectOne(`${BASE_URL}/analyze`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ subject: TICKET.subject, message: TICKET.message });
    req.flush(VALID_RESULT);

    await expect(result$).resolves.toEqual(VALID_RESULT);
  });

  it('maps a 429 response to a rate-limited error with the Retry-After seconds', async () => {
    const error$ = new Promise<AnalysisError>((resolve) => {
      service.analyse(TICKET).subscribe({ error: resolve });
    });

    httpMock
      .expectOne(`${BASE_URL}/analyze`)
      .flush({ error: 'Too many requests' }, { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '42' } });

    await expect(error$).resolves.toEqual({ kind: 'rate-limited', retryAfter: 42 });
  });

  it('maps a 504 response to a timeout error', async () => {
    const error$ = new Promise<AnalysisError>((resolve) => {
      service.analyse(TICKET).subscribe({ error: resolve });
    });

    httpMock.expectOne(`${BASE_URL}/analyze`).flush({ error: 'AI provider timed out' }, { status: 504, statusText: 'Gateway Timeout' });

    await expect(error$).resolves.toEqual({ kind: 'timeout' });
  });

  it('maps a 400 response to a validation error carrying the server message', async () => {
    const error$ = new Promise<AnalysisError>((resolve) => {
      service.analyse(TICKET).subscribe({ error: resolve });
    });

    httpMock
      .expectOne(`${BASE_URL}/analyze`)
      .flush({ error: 'subject is required' }, { status: 400, statusText: 'Bad Request' });

    await expect(error$).resolves.toEqual({ kind: 'validation', message: 'subject is required' });
  });

  it('maps a 502 response to an invalid-response error', async () => {
    const error$ = new Promise<AnalysisError>((resolve) => {
      service.analyse(TICKET).subscribe({ error: resolve });
    });

    httpMock.expectOne(`${BASE_URL}/analyze`).flush({ error: 'Invalid AI response' }, { status: 502, statusText: 'Bad Gateway' });

    await expect(error$).resolves.toEqual({ kind: 'invalid-response' });
  });

  it('maps a response body that fails schema validation to an invalid-response error', async () => {
    const error$ = new Promise<AnalysisError>((resolve) => {
      service.analyse(TICKET).subscribe({ error: resolve });
    });

    httpMock.expectOne(`${BASE_URL}/analyze`).flush({ summary: 'only a summary' });

    await expect(error$).resolves.toEqual({ kind: 'invalid-response' });
  });

  it('maps a network-level failure (status 0) to an offline error', async () => {
    const error$ = new Promise<AnalysisError>((resolve) => {
      service.analyse(TICKET).subscribe({ error: resolve });
    });

    httpMock.expectOne(`${BASE_URL}/analyze`).error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    await expect(error$).resolves.toEqual({ kind: 'offline' });
  });

  it('short-circuits to an offline error without making a request when navigator.onLine is false', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    const error$ = new Promise<AnalysisError>((resolve) => {
      service.analyse(TICKET).subscribe({ error: resolve });
    });

    await expect(error$).resolves.toEqual({ kind: 'offline' });
    httpMock.expectNone(`${BASE_URL}/analyze`);
  });

  it('maps an unmapped error status to an unknown error', async () => {
    const error$ = new Promise<AnalysisError>((resolve) => {
      service.analyse(TICKET).subscribe({ error: resolve });
    });

    httpMock.expectOne(`${BASE_URL}/analyze`).flush({ error: 'boom' }, { status: 500, statusText: 'Internal Server Error' });

    await expect(error$).resolves.toEqual({ kind: 'unknown' });
  });

  it('maps a client-side timeout to a timeout error when the server never responds', async () => {
    vi.useFakeTimers();
    try {
      const error$ = new Promise<AnalysisError>((resolve) => {
        service.analyse(TICKET).subscribe({ error: resolve });
      });

      httpMock.expectOne(`${BASE_URL}/analyze`);
      await vi.advanceTimersByTimeAsync(25_000);

      await expect(error$).resolves.toEqual({ kind: 'timeout' });
    } finally {
      vi.useRealTimers();
    }
  });
});
