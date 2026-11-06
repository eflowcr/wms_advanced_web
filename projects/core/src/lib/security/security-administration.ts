import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, fromEvent, type Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { type Assignment, SecurityError, type SecurityRequest } from './access';
import { parseProblemError } from './problem-error';
import { SECURITY_API_URL } from './security-api-url';

/** Confirmar o retirar una asignación en una revisión de accesos. */
export type ReviewDecision = 'confirm' | 'revoke';
/** Una asignación de la campaña y su decisión: quién (`decidedBy`, un `userId`) y cuándo (ISO). */
export interface ReviewItem extends Assignment {
  readonly decision: ReviewDecision | null;
  readonly decidedBy: string | null;
  readonly decidedAt: string | null;
}
/** Campaña de revisión: las asignaciones vigentes al iniciarla, con fecha límite. */
export interface ReviewCampaign {
  readonly id: string;
  readonly name: string;
  readonly dueDate: string;
  readonly items: readonly ReviewItem[];
  readonly version: number;
}

/**
 * Puerto de la administración que solo usan las pantallas de Seguridad. Separado de
 * SecurityGateway para cargarse con ellas, no al arrancar. Ver vault: Seguridad y usuarios.
 */
@Injectable({ providedIn: 'root', useFactory: () => inject(HttpSecurityAdministration) })
export abstract class SecurityAdministration {
  /** Alta masiva: agrega filas explícitas de una vez, todas o ninguna. */
  abstract addAssignments(
    request: SecurityRequest,
    assignments: readonly Assignment[],
    version: number,
  ): Promise<void>;
  /** Las campañas, con las asignaciones que quien revisa puede decidir. */
  abstract reviews(request: SecurityRequest): Promise<readonly ReviewCampaign[]>;
  abstract startReview(
    request: SecurityRequest,
    campaign: { readonly name: string; readonly dueDate: string },
  ): Promise<void>;
  /** Retirar quita la asignación; el servidor registra autor y fecha. */
  abstract decide(
    request: SecurityRequest,
    campaignId: string,
    assignment: Assignment,
    decision: ReviewDecision,
    version: number,
  ): Promise<void>;
}

/** Adaptador sobre el contrato HTTP propuesto; como el gateway, no afirma identidad. */
@Injectable({ providedIn: 'root' })
export class HttpSecurityAdministration extends SecurityAdministration {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(SECURITY_API_URL);

  addAssignments(
    request: SecurityRequest,
    assignments: readonly Assignment[],
    version: number,
  ): Promise<void> {
    return this.send(request, (base) =>
      this.http.post<void>(`${base}/assignments`, { assignments, version }),
    );
  }

  reviews(request: SecurityRequest): Promise<readonly ReviewCampaign[]> {
    return this.send(request, (base) => this.http.get<ReviewCampaign[]>(`${base}/reviews`));
  }

  startReview(
    request: SecurityRequest,
    campaign: { readonly name: string; readonly dueDate: string },
  ): Promise<void> {
    return this.send(request, (base) => this.http.post<void>(`${base}/reviews`, campaign));
  }

  decide(
    request: SecurityRequest,
    campaignId: string,
    assignment: Assignment,
    decision: ReviewDecision,
    version: number,
  ): Promise<void> {
    const url = (base: string) => `${base}/reviews/${encodeURIComponent(campaignId)}/decisions`;
    return this.send(request, (base) =>
      this.http.post<void>(url(base), { assignment, decision, version }),
    );
  }

  /** Abortar la señal cancela la petición; sin URL configurada no sale ninguna. */
  private async send<T>(
    { signal }: SecurityRequest,
    call: (base: string) => Observable<T>,
  ): Promise<T> {
    if (signal.aborted) throw new SecurityError('aborted');
    const base = this.baseUrl();
    if (!base) throw new SecurityError('unavailable');
    try {
      return await firstValueFrom(call(base).pipe(takeUntil(fromEvent(signal, 'abort'))));
    } catch (err) {
      throw parseProblemError(err, signal);
    }
  }
}
