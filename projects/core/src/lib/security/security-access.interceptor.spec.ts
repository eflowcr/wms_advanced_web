import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import type { AccessResult, SecurityGateway } from './access';
import { AccessStore } from './access-store';
import { ACCESS_QUERY, securityAccessInterceptor } from './security-access.interceptor';

describe('securityAccessInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let accessStore: AccessStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([securityAccessInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    accessStore = TestBed.inject(AccessStore);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  const forbid = (url: string) =>
    httpMock.expectOne(url).flush({}, { status: 403, statusText: 'Forbidden' });

  it('lets successful responses through without triggering refresh', async () => {
    const refreshSpy = vi.spyOn(accessStore, 'refresh');
    const promise = firstValueFrom(http.get('/api/test'));
    httpMock.expectOne('/api/test').flush({ ok: true });

    expect(await promise).toEqual({ ok: true });
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('triggers accessStore.refresh on 403 and does not retry the request', async () => {
    const refreshSpy = vi.spyOn(accessStore, 'refresh').mockResolvedValue();
    const promise = firstValueFrom(http.post('/api/action', { data: 1 }));
    forbid('/api/action');

    await expect(promise).rejects.toBeDefined();
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    httpMock.expectNone('/api/action');
  });

  it('does not refresh when the 403 answers the access query itself', async () => {
    const refreshSpy = vi.spyOn(accessStore, 'refresh').mockResolvedValue();
    const context = new HttpContext().set(ACCESS_QUERY, true);
    const promise = firstValueFrom(http.get('/anywhere', { context }));
    forbid('/anywhere');

    await expect(promise).rejects.toBeDefined();
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('recognises the access query by its mark, not by its URL', async () => {
    const refreshSpy = vi.spyOn(accessStore, 'refresh').mockResolvedValue();
    const promise = firstValueFrom(http.get('/api/v1/security/access'));
    forbid('/api/v1/security/access');

    await expect(promise).rejects.toBeDefined();
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it('several 403 in a row reach the gateway once plus one follow-up read', async () => {
    let finish: (result: AccessResult) => void = () => undefined;
    const access = vi
      .fn()
      .mockResolvedValueOnce({ grants: {}, user: null })
      .mockImplementationOnce(
        () =>
          new Promise<AccessResult>((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValue({ grants: {}, user: null });
    const gateway = { access, subscribe: () => () => undefined } as unknown as SecurityGateway;
    await accessStore.connect(gateway, { userId: 'u', warehouseId: 'A', ownerId: 'X' });

    const calls = ['/api/op1', '/api/op2', '/api/op3'].map((url) =>
      firstValueFrom(http.get(url)).catch(() => 'rejected'),
    );
    for (const url of ['/api/op1', '/api/op2', '/api/op3']) forbid(url);
    await Promise.all(calls);
    finish({ grants: {}, user: null });
    await accessStore.refresh();

    expect(access).toHaveBeenCalledTimes(3);
  });

  it('propagates 401 errors without refreshing or retrying', async () => {
    const refreshSpy = vi.spyOn(accessStore, 'refresh');
    const promise = firstValueFrom(http.post('/api/write', {}));
    httpMock.expectOne('/api/write').flush({}, { status: 401, statusText: 'Unauthorized' });

    await expect(promise).rejects.toBeDefined();
    expect(refreshSpy).not.toHaveBeenCalled();
    httpMock.expectNone('/api/write');
  });

  it('passes network errors through untouched', async () => {
    const refreshSpy = vi.spyOn(accessStore, 'refresh');
    const promise = firstValueFrom(http.get('/api/custom-err'));
    httpMock.expectOne('/api/custom-err').error(new ProgressEvent('error'));

    await expect(promise).rejects.toBeDefined();
    expect(refreshSpy).not.toHaveBeenCalled();
  });
});
