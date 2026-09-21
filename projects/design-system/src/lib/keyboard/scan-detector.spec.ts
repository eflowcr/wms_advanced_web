import { ScanDetector, SCAN_MIN_KEYSTROKES, type ScanVerdict } from './scan-detector';

/**
 * Reloj simulado: umbral y tiempo son argumentos, así que nada duerme ni es inestable.
 * REQ-FE-DS4-001 RFE-05 y PACQ-03.1 a 03.4.
 */

const THRESHOLD = 50;

function key(k: string, modifiers: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return { key: k, ctrlKey: false, altKey: false, metaKey: false, ...modifiers } as KeyboardEvent;
}

/** El reloj arranca lejos de cero: empezar en 0 ocultaría el primer hueco enorme, que es correcto. */
function type(
  detector: ScanDetector,
  text: string,
  gap: number,
  start = 10_000,
): readonly ScanVerdict[] {
  return [...text].map((char, index) => detector.accept(key(char), THRESHOLD, start + index * gap));
}

describe('ScanDetector', () => {
  let detector: ScanDetector;

  beforeEach(() => {
    detector = new ScanDetector();
  });

  describe('a gun', () => {
    it('PACQ-03.1: a fast run closed by Enter is one scan carrying the whole code', () => {
      type(detector, 'EXP-000123', 5);
      const verdict = detector.accept(key('Enter'), THRESHOLD, 10_100);

      expect(verdict).toEqual({ kind: 'scan', code: 'EXP-000123' });
    });

    it('PACQ-03.2: a code CONTAINING a shortcut character never lets it through', () => {
      // El caso por el que existe el requisito: `/` es el atajo de búsqueda.
      const verdicts = type(detector, 'AB/CD/EF', 5);

      // Desde el cuarto carácter todo es ráfaga, las dos barras incluidas.
      expect(verdicts.slice(SCAN_MIN_KEYSTROKES - 1).every((v) => v.kind === 'burst')).toBe(true);
      expect(detector.accept(key('Enter'), THRESHOLD, 10_100)).toEqual({
        kind: 'scan',
        code: 'AB/CD/EF',
      });
    });

    it('a code that BEGINS with a shortcut character still arrives whole', () => {
      // El primer carácter vuelve como `key`; al atajo lo frena la espera del motor
      // (keyboard-shortcuts.spec.ts). Acá se prueba que el código llega entero.
      const verdicts = type(detector, '/XY9012', 5);

      expect(verdicts[0]).toEqual({ kind: 'key' });
      expect(detector.accept(key('Enter'), THRESHOLD, 10_100)).toEqual({
        kind: 'scan',
        code: '/XY9012',
      });
    });

    it('exactly at the threshold counts as fast, one millisecond over does not', () => {
      type(detector, 'ABCD', THRESHOLD);
      expect(detector.accept(key('Enter'), THRESHOLD, 99_999)).toEqual({
        kind: 'scan',
        code: 'ABCD',
      });

      const slow = new ScanDetector();
      type(slow, 'ABCD', THRESHOLD + 1);
      expect(slow.accept(key('Enter'), THRESHOLD, 99_999)).toEqual({ kind: 'key' });
    });
  });

  describe('a person', () => {
    it('PACQ-03.3: typing fast and pressing Enter is not a scan', () => {
      // 150 ms entre teclas: rápido, y lejos de una pistola.
      type(detector, 'SKU-881', 150);

      expect(detector.accept(key('Enter'), THRESHOLD, 20_000)).toEqual({ kind: 'key' });
    });

    it('PACQ-03.4: a fast run that does NOT end in Enter is never a scan', () => {
      const verdicts = type(detector, 'ABCDEF', 5);

      expect(verdicts.some((v) => v.kind === 'scan')).toBe(false);
      expect(detector.accept(key('Tab'), THRESHOLD, 10_100)).toEqual({ kind: 'key' });
      expect(detector.length).toBe(0);
    });

    it('one slow gap starts the run over, and the code carries only what came after', () => {
      type(detector, 'XY', 5);
      // La pausa: lo anterior es otra ráfaga.
      detector.accept(key('Z'), THRESHOLD, 50_000);
      type(detector, 'ABC', 5, 50_005);

      expect(detector.accept(key('Enter'), THRESHOLD, 50_100)).toEqual({
        kind: 'scan',
        code: 'ZABC',
      });
    });

    it('holding an arrow key does not build a run', () => {
      // La regresión de origen: la repetición de tecla (~30 ms) armaba una ráfaga y el
      // Enter de «elegir esta fila» se leía como escaneo. Ver vault: Search-Select.
      for (let i = 0; i < 10; i += 1) {
        expect(detector.accept(key('ArrowDown'), THRESHOLD, 10_000 + i * 30)).toEqual({
          kind: 'key',
        });
      }

      expect(detector.accept(key('Enter'), THRESHOLD, 10_400)).toEqual({ kind: 'key' });
    });

    it('a modifier breaks the run: a gun sends neither Ctrl nor Alt', () => {
      type(detector, 'ABC', 5);
      detector.accept(key('s', { ctrlKey: true }), THRESHOLD, 10_020);
      type(detector, 'DE', 5, 10_025);

      expect(detector.accept(key('Enter'), THRESHOLD, 10_100)).toEqual({ kind: 'key' });
    });
  });

  describe('with no threshold declared', () => {
    it('classifies nothing as a scan, and says so by returning ordinary keys', () => {
      // Sin tokens.css la superficie anda pero nunca resuelve un escaneo: sin número de reserva.
      const verdicts = type(detector, 'EXP-000123', 5).map((v) => v.kind);
      const withoutThreshold = [...'EXP-000123'].map(
        (char, index) => detector.accept(key(char), null, 20_000 + index * 5).kind,
      );

      expect(verdicts).toContain('burst');
      expect(withoutThreshold.every((kind) => kind === 'key')).toBe(true);
      expect(detector.accept(key('Enter'), null, 20_100)).toEqual({ kind: 'key' });
    });
  });

  it('reset forgets the open run', () => {
    type(detector, 'ABCD', 5);
    expect(detector.length).toBe(SCAN_MIN_KEYSTROKES);

    detector.reset();

    expect(detector.length).toBe(0);
    expect(detector.accept(key('Enter'), THRESHOLD, 10_100)).toEqual({ kind: 'key' });
  });
});
