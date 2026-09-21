import { InjectionToken } from '@angular/core';

/**
 * Acciones por nombre, nunca por tecla (RFE-01). Lista cerrada: un `string` abierto
 * dejaría inventar dos nombres para lo mismo. Ver vault: Atajos-de-Teclado.
 */
export type ShortcutAction =
  | 'search'
  | 'create'
  | 'save'
  | 'cancel'
  | 'help';

/**
 * `insideTextFields` y `preventDefault` son de la combinación y se declaran acá: en el
 * motor serían nombres de tecla fuera del mapa.
 */
export interface ShortcutBinding {
  /** `KeyboardEvent.key`. */
  readonly key: string;
  readonly ctrl?: boolean;
  readonly alt?: boolean;
  /** Dispara aun dentro de un campo: la excepción de RFE-04. Ver vault: Atajos-de-Teclado. */
  readonly insideTextFields?: boolean;
  /** Se aplica esté o no registrada la acción (el caso de Ctrl+S). */
  readonly preventDefault?: boolean;
  /** Un `<kbd>` por elemento. Difiere de `key`: la tecla es `n` y se lee `N`. */
  readonly chord: readonly string[];
}

/** Una acción sin atar es un error de compilación. */
export type ShortcutMap = Readonly<Record<ShortcutAction, ShortcutBinding>>;

/** Provisto una vez por aplicación: un único archivo nombra teclas (RFE-01). */
export const EWMS_SHORTCUT_MAP = new InjectionToken<ShortcutMap>('EWMS_SHORTCUT_MAP');

/** Ya traducidos (ADR 0008): una etiqueta por acción; las teclas salen del mapa (RFE-07). */
export interface ShortcutHelpMessages {
  readonly title: string;
  readonly intro: string;
  readonly actionColumn: string;
  readonly keyColumn: string;
  readonly close: string;
  /** Conmutador de WCAG 2.1.4. */
  readonly singleKeyLabel: string;
  readonly singleKeyHint: string;
  /** Marca el atajo apagado en vez de esconder la fila. Ver vault: Atajos-de-Teclado. */
  readonly singleKeyOff: string;
  readonly actions: Readonly<Record<ShortcutAction, string>>;
}

export const EWMS_SHORTCUT_HELP_MESSAGES = new InjectionToken<ShortcutHelpMessages>(
  'EWMS_SHORTCUT_HELP_MESSAGES',
);

/**
 * Carácter imprimible sin modificador (`/` y `?` hoy). Derivado, no declarado: una pistola
 * puede emitirlo, y es la clase de atajo de WCAG 2.2 2.1.4.
 */
export function isSingleCharacter(binding: ShortcutBinding): boolean {
  return binding.key.length === 1 && binding.ctrl !== true && binding.alt !== true;
}

export function matches(binding: ShortcutBinding, event: KeyboardEvent): boolean {
  return (
    event.key === binding.key &&
    event.ctrlKey === (binding.ctrl ?? false) &&
    event.altKey === (binding.alt ?? false) &&
    // Meta nunca es de la aplicación: Command en macOS, menú del sistema en Windows.
    !event.metaKey
  );
}
