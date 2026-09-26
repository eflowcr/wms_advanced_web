import { ErrorHandler, provideBrowserGlobalErrorListeners } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { errorReport, provideEwmsErrorHandling, TELEMETRY, type ErrorReport } from './telemetry';

/**
 * Lo que haría cualquier proveedor real: juntar lo que llega al puerto. Sin el relanzamiento de
 * TestBed, como en producción: relanzado, jsdom lo reporta como un segundo error no capturado.
 */
function capture(): ErrorReport[] {
  const reports: ErrorReport[] = [];
  TestBed.configureTestingModule({
    rethrowApplicationErrors: false,
    providers: [
      provideBrowserGlobalErrorListeners(),
      provideEwmsErrorHandling(),
      { provide: TELEMETRY, useValue: { error: (report: ErrorReport) => reports.push(report) } },
    ],
  });
  return reports;
}

/** Un error cuyo mensaje trae datos de una persona, y una línea que parece un marco pero no lo es. */
function personalError(): TypeError {
  return new TypeError('ana.rodriguez@ewms.test searched "Juan Pérez"\n    at warehouse 0001');
}

describe('the error handler and its telemetry port', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('hands an uncaught error to the port, with its type and its stack and no personal data', () => {
    const reports = capture();

    TestBed.inject(ErrorHandler).handleError(personalError());

    const [report] = reports;
    expect(reports).toHaveLength(1);
    expect(report?.name).toBe('TypeError');
    expect(report?.frames.length).toBeGreaterThan(0);
    const sent = JSON.stringify(reports);
    for (const personal of ['ana.rodriguez', 'ewms.test', 'Juan', 'Pérez', '0001']) {
      expect(sent).not.toContain(personal);
    }
  });

  it('an error nobody catches in the browser reaches the port too', () => {
    const reports = capture();
    TestBed.inject(ErrorHandler);

    window.dispatchEvent(new ErrorEvent('error', { error: personalError() }));

    expect(reports.map((report) => report.name)).toEqual(['TypeError']);
  });

  it('still writes to the console, as Angular always did', () => {
    capture();
    const error = personalError();

    TestBed.inject(ErrorHandler).handleError(error);

    expect(console.error).toHaveBeenCalledWith('ERROR', error);
  });

  it('with no provider the port sends nothing, and does not throw', () => {
    TestBed.configureTestingModule({ providers: [provideEwmsErrorHandling()] });

    expect(() => TestBed.inject(ErrorHandler).handleError(personalError())).not.toThrow();
    expect(() => TestBed.inject(TELEMETRY).error({ name: 'Error', frames: [] })).not.toThrow();
  });
});

describe('errorReport', () => {
  it('keeps the frames of V8, Firefox and Safari and drops every line of text', () => {
    const error = new Error('juan@ewms.test');
    error.stack = [
      'Error: juan@ewms.test',
      'says hello to juan@ewms.test',
      '    at load (http://localhost/chunk-A.js:1:20)',
      '    at http://localhost/main.js:2:10',
      'load@http://localhost/chunk-A.js:1:20',
      '@http://localhost/main.js:2:10',
    ].join('\n');

    expect(errorReport(error)).toEqual({
      name: 'Error',
      frames: [
        'at load (http://localhost/chunk-A.js:1:20)',
        'at http://localhost/main.js:2:10',
        'load@http://localhost/chunk-A.js:1:20',
        '@http://localhost/main.js:2:10',
      ],
    });
  });

  it('says nothing of what was thrown when it is not an Error', () => {
    expect(errorReport('juan@ewms.test')).toEqual({ name: 'NonError', frames: [] });
    expect(errorReport({ email: 'juan@ewms.test' })).toEqual({ name: 'NonError', frames: [] });
  });

  it('an Error without a stack reports its type and no frames', () => {
    const error = new RangeError('x');
    delete error.stack;

    expect(errorReport(error)).toEqual({ name: 'RangeError', frames: [] });
  });
});
