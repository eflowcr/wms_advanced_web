import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthSession, SECURITY_API_URL } from '@ewms/core/security';
import { SECOND_FACTOR } from './second-factor';

describe('OTP second factor', () => {
  function setup(url: string | undefined) {
    const adopt = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SECURITY_API_URL, useValue: signal(url) },
        { provide: AuthSession, useValue: { adopt } },
      ],
    });
    return {
      adopt,
      factor: TestBed.inject(SECOND_FACTOR),
      http: TestBed.inject(HttpTestingController),
    };
  }

  it('is the default adapter and adopts the reinforced session the server returns', async () => {
    const { adopt, factor, http } = setup('/api/v1/security');
    expect(factor.inputKey).toBe('shell.stepUp.otp');
    const verified = factor.verify(' 123456 ');
    const request = http.expectOne('/api/v1/security/session/step-up');
    expect(request.request.body).toEqual({ factor: 'otp', code: '123456' });
    const grant = {
      accessToken: 't2',
      session: { userId: 'admin', name: 'A', warehouseId: 'A', ownerId: 'X' },
    };
    request.flush(grant);
    await verified;
    expect(adopt).toHaveBeenCalledWith(grant);
    http.verify();
  });

  it('does not validate without a configured URL', async () => {
    const { factor } = setup(undefined);
    await expect(factor.verify('123456')).rejects.toThrow();
  });
});
