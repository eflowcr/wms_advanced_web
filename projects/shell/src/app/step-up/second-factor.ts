import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AuthSession, SECURITY_API_URL, type SessionGrant } from '@ewms/core/security';
import { firstValueFrom } from 'rxjs';
import type { SecondFactor } from './second-factor.token';

/** t(shell.stepUp.otp) */
/** El primer adaptador: un código de un solo uso, validado por el Security Core. */
@Injectable({ providedIn: 'root' })
export class OtpFactor implements SecondFactor {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(SECURITY_API_URL);
  private readonly auth = inject(AuthSession);
  readonly inputKey = 'shell.stepUp.otp';

  async verify(code: string): Promise<void> {
    const base = this.baseUrl();
    if (!base) throw new Error('unavailable');
    const body = { factor: 'otp', code: code.trim() };
    this.auth.adopt(
      await firstValueFrom(this.http.post<SessionGrant>(`${base}/session/step-up`, body)),
    );
  }
}
