import { HttpErrorResponse } from '@angular/common/http';
import { SecurityError, type SecurityErrorCode } from './access';

const VALID_CODES = new Set<SecurityErrorCode>([
  'denied',
  'invalid',
  'duplicate',
  'conflict',
  'lastAdmin',
  'selfEscalation',
  'delegation',
  'selfAssignment',
  'segregation',
  'externalAffiliation',
  'dependency',
  'stepUpCancelled',
  'unavailable',
  'aborted',
]);

function isSecurityErrorCode(value: string): value is SecurityErrorCode {
  return VALID_CODES.has(value as SecurityErrorCode);
}

/** Traduce una respuesta HTTP con RFC 9457 a un SecurityError de la consola. */
export function parseProblemError(err: unknown, signal?: AbortSignal): Error {
  if (signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
    return new SecurityError('aborted');
  }
  if (err instanceof HttpErrorResponse) {
    const body = err.error as Record<string, unknown> | null;
    if (body && typeof body === 'object') {
      const code = body['code'];
      const conflicts = body['conflicts'];
      if (typeof code === 'string' && isSecurityErrorCode(code)) {
        return new SecurityError(
          code,
          Array.isArray(conflicts) ? conflicts.filter((c) => typeof c === 'string') : [],
        );
      }
      const typeStr = body['type'];
      if (typeof typeStr === 'string') {
        const match = typeStr.match(/([a-zA-Z]+)$/);
        if (match && match[1] && isSecurityErrorCode(match[1])) {
          return new SecurityError(match[1]);
        }
      }
    }
    if (err.status === 401 || err.status === 403) return new SecurityError('denied');
    if (err.status === 409) return new SecurityError('conflict');
    if (err.status === 400) return new SecurityError('invalid');
    return new SecurityError('unavailable');
  }
  return err instanceof SecurityError ? err : new SecurityError('unavailable');
}
