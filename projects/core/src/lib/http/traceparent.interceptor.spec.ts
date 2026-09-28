import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { newTraceparent, TRACEPARENT, traceparentInterceptor } from './traceparent.interceptor';

/** W3C Trace Context, versión 00: traza de 16 bytes, padre de 8, banderas. */
const W3C = /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/;

describe('traceparent', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([traceparentInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('every request to its own origin leaves with a valid W3C traceparent', () => {
    http.get('i18n/es.json').subscribe();
    http.post('api/anything', {}).subscribe();

    const headers = backend.match(() => true).map((request) => request.request.headers);
    expect(headers).toHaveLength(2);
    for (const header of headers) {
      expect(header.get(TRACEPARENT)).toMatch(W3C);
    }
    // Una traza por petición: dos pedidos no comparten identificador.
    const [first, second] = headers;
    expect(first?.get(TRACEPARENT)).not.toBe(second?.get(TRACEPARENT));
  });

  it('a request to another origin leaves without one', () => {
    http.get('https://other.example/api/anything').subscribe();
    http.get('//other.example/api/anything').subscribe();

    const requests = backend.match(() => true);
    expect(requests).toHaveLength(2);
    for (const request of requests) {
      expect(request.request.headers.has(TRACEPARENT)).toBe(false);
    }
  });

  it('a relative request and an absolute one to its own origin both carry it', () => {
    http.get('api/anything').subscribe();
    http.get(`${location.origin}/api/anything`).subscribe();

    const headers = backend.match(() => true).map((request) => request.request.headers);
    expect(headers).toHaveLength(2);
    for (const header of headers) {
      expect(header.get(TRACEPARENT)).toMatch(W3C);
    }
  });

  it('a request that already carries one keeps it', () => {
    const upstream = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';
    http.get('api/anything', { headers: { [TRACEPARENT]: upstream } }).subscribe();

    expect(backend.expectOne('api/anything').request.headers.get(TRACEPARENT)).toBe(upstream);
  });
});

describe('newTraceparent', () => {
  it('never answers an all-zero identifier, which W3C declares invalid', () => {
    const draws = [new Uint8Array(16), new Uint8Array(16).fill(1), new Uint8Array(8), new Uint8Array(8).fill(2)];
    const random = () => draws.shift() ?? new Uint8Array(0);

    expect(newTraceparent(random)).toBe(`00-${'01'.repeat(16)}-${'02'.repeat(8)}-00`);
  });

  it('says the browser records nothing: the sampled flag is off', () => {
    expect(newTraceparent().endsWith('-00')).toBe(true);
  });
});
