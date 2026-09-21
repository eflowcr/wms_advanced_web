/**
 * El único lugar que distingue una persona de una pistola de códigos.
 *
 * Un lector se presenta al sistema como teclado: emite los caracteres uno a uno
 * y cierra con Enter, a 5-20 ms por carácter contra los ~120 ms de alguien muy
 * rápido. `--threshold-scan-keystroke` es dónde se traza la raya, y es un token
 * porque todavía no se sabe qué modelo habrá en el depósito (RFE-06).
 * Sin framework adentro, con el reloj como argumento, para que ni el motor de
 * atajos ni `ewms-search-select` puedan cambiarla por su cuenta.
 */

/**
 * Cuántas teclas seguidas bajo el umbral hacen falta para que una ráfaga cuente
 * como escaneo. Dos no alcanzan: dos teclas rápidas pasan al tipear «SK» con las
 * dos manos. Un código de barras nunca tiene dos caracteres, así que pedir cuatro
 * no le cuesta nada a un escaneo real.
 */
export const SCAN_MIN_KEYSTROKES = 4;

/** El token del que los consumidores sacan el umbral. Ver tokens/read-token.ts. */
export const SCAN_THRESHOLD_TOKEN = '--threshold-scan-keystroke';

/**
 * Qué resultó ser una tecla. `burst` es «pertenece a una ráfaga abierta, no
 * actúes»; `scan` es «la ráfaga cerró con Enter y acá está el código entero».
 */
export type ScanVerdict =
  /** Una tecla común. Un atajo puede actuar sobre ella. */
  | { readonly kind: 'key' }
  /** Dentro de una ráfaga con velocidad de pistola. NADA puede actuar. */
  | { readonly kind: 'burst' }
  /** Una ráfaga que califica cerró con Enter. El código está completo. */
  | { readonly kind: 'scan'; readonly code: string };

const KEY: ScanVerdict = { kind: 'key' };
const BURST: ScanVerdict = { kind: 'burst' };

/**
 * Una ráfaga de teclas, medida. Una instancia por superficie que escucha: dos
 * campos en una pantalla son dos ráfagas independientes y no pueden compartirla.
 */
export class ScanDetector {
  /** Los caracteres de la ráfaga abierta, en orden. */
  private run: string[] = [];
  /** Cuándo llegó la última tecla imprimible de la ráfaga. */
  private lastKeystroke = 0;

  /**
   * Mete un keydown en la ráfaga y dice qué fue.
   *
   * @param threshold Milisegundos, de `--threshold-scan-keystroke`, o `null` si la
   *   hoja no lo declara. Sin umbral nada se puede clasificar como escaneo: la
   *   superficie sigue andando, solo que nunca resuelve uno. Acá no vive ningún
   *   número de reserva, por la razón que da read-token.ts.
   * @param now El reloj, inyectable para que la prueba simule tiempos en vez de
   *   dormir. `Date.now()` en producción.
   */
  accept(event: KeyboardEvent, threshold: number | null, now: number = Date.now()): ScanVerdict {
    if (event.key === 'Enter') {
      const code = this.run.join('');
      const long = this.run.length >= SCAN_MIN_KEYSTROKES;
      this.reset();
      return long && threshold !== null ? { kind: 'scan', code } : KEY;
    }

    /*
     * UNA PISTOLA NO MANDA MODIFICADORES NI TECLAS CON NOMBRE, y las dos mitades
     * importan.
     *
     * `key.length !== 1` atrapa ArrowDown, Escape, Tab y Shift: una ráfaga con una
     * de esas era una persona, así que se rompe. Lo encontró la caminata E2E de la
     * página del selector, donde MANTENER la flecha abajo repite cada 30 y pico de
     * milisegundos y llegaba al Enter con cara de escaneo.
     * El modificador es el mismo argumento un nivel arriba: nada que emita un lector
     * va con Ctrl o Alt, así que una combinación es prueba de persona, y Alt+N y
     * Ctrl+S nunca tienen que esperar para estar seguros.
     */
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
    // Un solo hueco lento empieza la ráfaga de nuevo. Eso evita que quien tipea
    // rápido, hace una pausa y sigue acumule una ráfaga larga a través de la pausa,
    // y es por qué el código que sale de un escaneo son los caracteres de la ráfaga
    // y no todo lo tipeado desde que cargó la página.
    this.run = gap <= threshold ? [...this.run, event.key] : [event.key];

    return this.run.length >= SCAN_MIN_KEYSTROKES ? BURST : KEY;
  }

  /**
   * Cuántos caracteres tiene la ráfaga abierta. Lo lee un consumidor que necesita
   * decidir algo sin darle una tecla: hay uno, y es el selector con búsqueda
   * decidiendo si su Enter cierra un escaneo o elige la fila activa.
   */
  get length(): number {
    return this.run.length;
  }

  /** Olvida la ráfaga abierta. Se llama cuando la superficie pierde el foco. */
  reset(): void {
    this.run = [];
    this.lastKeystroke = 0;
  }
}
