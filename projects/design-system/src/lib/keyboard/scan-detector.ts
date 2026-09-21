/**
 * Único lugar que distingue persona de pistola (5-20 ms por carácter contra ~120 ms).
 * Sin framework y con el reloj como argumento. Ver vault: Atajos-de-Teclado.
 */

/** Dos no alcanzan («SK» con las dos manos); un código de barras nunca tiene dos caracteres. */
export const SCAN_MIN_KEYSTROKES = 4;

/** Se lee con tokens/read-token.ts. */
export const SCAN_THRESHOLD_TOKEN = '--threshold-scan-keystroke';

/** `key`: un atajo puede actuar. `burst`: ráfaga abierta, nada actúa. `scan`: cerró con Enter. */
export type ScanVerdict =
  | { readonly kind: 'key' }
  | { readonly kind: 'burst' }
  | { readonly kind: 'scan'; readonly code: string };

const KEY: ScanVerdict = { kind: 'key' };
const BURST: ScanVerdict = { kind: 'burst' };

/** Una instancia por superficie que escucha: dos campos son dos ráfagas independientes. */
export class ScanDetector {
  private run: string[] = [];
  private lastKeystroke = 0;

  /**
   * @param threshold Ms de `--threshold-scan-keystroke`, o null: sin umbral nunca hay escaneo
   *   y no hay número de reserva (ver read-token.ts).
   * @param now Inyectable para que la prueba simule tiempos.
   */
  accept(event: KeyboardEvent, threshold: number | null, now: number = Date.now()): ScanVerdict {
    if (event.key === 'Enter') {
      const code = this.run.join('');
      const long = this.run.length >= SCAN_MIN_KEYSTROKES;
      this.reset();
      return long && threshold !== null ? { kind: 'scan', code } : KEY;
    }

    // Una pistola no manda teclas con nombre ni modificadores: cualquiera de ellas corta la
    // ráfaga (mantener la flecha abajo imitaba un escaneo). Ver vault: Search-Select.
    if (event.key.length !== 1 || event.ctrlKey || event.altKey || event.metaKey) {
      this.reset();
      return KEY;
    }

    if (threshold === null) {
      this.reset();
      return KEY;
    }

    const gap = now - this.lastKeystroke;
    this.lastKeystroke = now;
    // Un hueco lento reinicia la ráfaga: una pausa no acumula, y el código escaneado es
    // solo lo de la ráfaga.
    this.run = gap <= threshold ? [...this.run, event.key] : [event.key];

    return this.run.length >= SCAN_MIN_KEYSTROKES ? BURST : KEY;
  }

  /** Para decidir sin darle una tecla (lo usa el selector con búsqueda ante Enter). */
  get length(): number {
    return this.run.length;
  }

  /** Se llama cuando la superficie pierde el foco. */
  reset(): void {
    this.run = [];
    this.lastKeystroke = 0;
  }
}
