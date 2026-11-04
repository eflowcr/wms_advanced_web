import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { AccessContext } from './access';
import { ActiveContext, ContextChangeError, type ContextChangeCode } from './active-context';
import { AuthSession } from './auth-session';
import { SECURITY_API_URL } from './security-api-url';

interface ContextBody {
  readonly warehouse_id?: string;
  readonly owner_id?: string | null;
}

interface SwitchBody {
  readonly active_warehouse_id?: string;
}

/**
 * ActiveContext sobre la API Go: `/auth/contexts` y `/auth/switch-warehouse`. Sin la lista de
 * contextos, la cabecera muestra el almacén como texto y no ofrece cambiarlo.
 */
@Injectable({ providedIn: 'root' })
export class CoreActiveContext extends ActiveContext {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(SECURITY_API_URL);
  private readonly auth = inject(AuthSession);

  async contexts(): Promise<readonly AccessContext[]> {
    const base = this.baseUrl();
    if (!base) return [];
    try {
      const list = await firstValueFrom(
        this.http.get<readonly ContextBody[]>(`${base}/auth/contexts`),
      );
      return (Array.isArray(list) ? list : [])
        .filter((c) => typeof c?.warehouse_id === 'string')
        .map((c) => ({ warehouseId: c.warehouse_id as string, ownerId: c.owner_id ?? '' }));
    } catch {
      return [];
    }
  }

  async switchTo(context: AccessContext): Promise<void> {
    const base = this.baseUrl();
    const session = this.auth.session();
    const token = this.auth.token();
    if (!base || !session || !token) throw new ContextChangeError('unavailable');
    try {
      const reply = await firstValueFrom(
        this.http.post<SwitchBody>(`${base}/auth/switch-warehouse`, {
          target_warehouse_id: context.warehouseId,
        }),
      );
      const warehouseId = reply?.active_warehouse_id ?? context.warehouseId;
      this.auth.adopt({
        accessToken: this.auth.token() ?? token,
        session: { ...session, warehouseId, ownerId: context.ownerId },
      });
    } catch (err) {
      throw new ContextChangeError(refusal(err));
    }
  }
}

function refusal(err: unknown): ContextChangeCode {
  if (!(err instanceof HttpErrorResponse)) return 'unavailable';
  if (err.status === 409) return 'taskInProgress';
  return err.status === 403 || err.status === 400 ? 'denied' : 'unavailable';
}
