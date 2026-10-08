import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type Assignment, SecurityError, type SecurityRequest } from './access';
import { SecurityAdministration } from './security-administration';
import { SECURITY_API_URL } from './security-api-url';

const actor = { userId: 'admin', warehouseId: 'A', ownerId: 'X' };
const rows: readonly Assignment[] = [
  { userId: 'u1', profileId: 'read', warehouseId: 'A', ownerId: 'X', validUntil: '2026-12-31' },
  { userId: 'u2', profileId: 'read', warehouseId: 'A', ownerId: 'X', validUntil: '2026-12-31' },
];

function setup(url: string | null = '/api/v1/security') {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: SECURITY_API_URL, useValue: signal(url ?? undefined) },
    ],
  });
  return {
    admin: TestBed.inject(SecurityAdministration),
    http: TestBed.inject(HttpTestingController),
  };
}

describe('SecurityAdministration over HTTP', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('posts the explicit rows of a bulk assignment once, without the actor', async () => {
    const { admin, http } = setup();
    const request: SecurityRequest = { actor, signal: new AbortController().signal };
    const promise = admin.addAssignments(request, rows, 4);
    const mock = http.expectOne('/api/v1/security/assignments');
    expect(mock.request.method).toBe('POST');
    expect(mock.request.body).toEqual({ assignments: rows, version: 4 });
    expect(mock.request.params.keys()).toEqual([]);
    mock.flush(null);
    await promise;
    http.verify();
  });

  it('translates a rejection with its conflicts and cancels on abort', async () => {
    const { admin, http } = setup();
    const promise = admin.addAssignments({ actor, signal: new AbortController().signal }, rows, 4);
    http.expectOne('/api/v1/security/assignments').flush(
      { code: 'segregation', conflicts: ['admin', 'audit'] },
      { status: 409, statusText: 'Conflict' },
    );
    const error = (await promise.catch((e: unknown) => e)) as SecurityError;
    expect(error.code).toBe('segregation');
    expect(error.conflicts).toEqual(['admin', 'audit']);

    const controller = new AbortController();
    const pending = admin.addAssignments({ actor, signal: controller.signal }, rows, 4);
    const mock = http.expectOne('/api/v1/security/assignments');
    controller.abort();
    await expect(pending).rejects.toEqual(new SecurityError('aborted'));
    expect(mock.cancelled).toBe(true);
    http.verify();
  });

  it('sends nothing without a configured URL', async () => {
    const { admin, http } = setup(null);
    await expect(
      admin.addAssignments({ actor, signal: new AbortController().signal }, rows, 4),
    ).rejects.toEqual(new SecurityError('unavailable'));
    http.verify();
  });
});
