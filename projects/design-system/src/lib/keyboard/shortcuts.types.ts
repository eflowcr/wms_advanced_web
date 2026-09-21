import { InjectionToken } from '@angular/core';

/**
 * Las acciones globales, POR NOMBRE: una pantalla registra `create`, nunca
 * `Alt+N` (RFE-01). La lista es cerrada a propósito: un `string` abierto dejaría
 * inventar `nuevo` y `new` para lo mismo, que es la deriva que el mapa evita.
 */
export type ShortcutAction =
  /** Pone el foco en el campo de búsqueda de la pantalla. */
  | 'search'
  /** Empieza a crear un registro nuevo. */
  | 'create'
  /** Guarda el formulario activo. */
  | 'save'
  /** Cancela lo que está en curso, o cierra la capa abierta. */
  | 'cancel'
  /** Abre la lista de atajos. */
  | 'help';

/**
 * Un atajo: qué tecla, qué modificadores, y los dos comportamientos que son
 * propiedad de la COMBINACIÓN y no opinión del motor. `insideTextFields` y
 * `preventDefault` se declaran acá porque escritos dentro del motor serían un
 * nombre de tecla fuera del mapa, y el mapa dejaría de ser el único lugar.
 */
export interface ShortcutBinding {
  /** El `KeyboardEvent.key`, tal cual lo reporta el navegador. */
  readonly key: string;
  readonly ctrl?: boolean;
  readonly alt?: boolean;
  /**
   * Dispara aun con el foco dentro de un campo. La única excepción de RFE-04, y
   * no es comodidad: la mitad de las veces que alguien quiere cancelar, el foco
   * está en el campo que está llenando.
   */
  readonly insideTextFields?: boolean;
  /**
   * La respuesta del navegador a esta combinación no puede correr. Se aplica ESTÉ
   * O NO registrada la acción, que es el punto de Ctrl+S.
   */
  readonly preventDefault?: boolean;
  /**
   * Cómo se escribe la combinación en pantalla, un `<kbd>` por elemento. Aparte
   * de `key` porque de verdad difieren: la tecla es `n` y lo que se lee es `N`.
   */
  readonly chord: readonly string[];
}

/** Todas las acciones atadas. Una que falte es un error de compilación. */
export type ShortcutMap = Readonly<Record<ShortcutAction, ShortcutBinding>>;

/**
 * EL MAPA, PROVISTO UNA VEZ POR APLICACIÓN. La librería define la forma y no
 * implementa ninguna, como `EWMS_TABLE_MESSAGES`. Así cada aplicación tiene UN
 * archivo que nombra teclas (RFE-01), y el shell y el showroom pueden diferir.
 */
export const EWMS_SHORTCUT_MAP = new InjectionToken<ShortcutMap>('EWMS_SHORTCUT_MAP');

/**
 * Los textos del diálogo de ayuda, ya traducidos (ADR 0008). Se provee una
 * etiqueta por ACCIÓN y las teclas salen del mapa: agregar un atajo es una línea
 * en el mapa y una etiqueta acá, y el diálogo cambia solo (RFE-07).
 */
export interface ShortcutHelpMessages {
  readonly title: string;
  /** Una frase bajo el título, antes de la tabla. */
  readonly intro: string;
  readonly actionColumn: string;
  readonly keyColumn: string;
  readonly close: string;
  /** La etiqueta del conmutador de WCAG 2.1.4. */
  readonly singleKeyLabel: string;
  /** Por qué está ese conmutador, en una frase. */
  readonly singleKeyHint: string;
  /**
   * Se muestra junto a un atajo de un carácter mientras el conmutador está
   * apagado. La fila no se esconde: un atajo que desaparece deja a alguien
   * dudando si lo imaginó, y la lista es cómo se descubre qué lo silenció.
   */
  readonly singleKeyOff: string;
  /** Qué hace cada acción, en el idioma de quien lee. */
  readonly actions: Readonly<Record<ShortcutAction, string>>;
}

export const EWMS_SHORTCUT_HELP_MESSAGES = new InjectionToken<ShortcutHelpMessages>(
  'EWMS_SHORTCUT_HELP_MESSAGES',
);

/**
 * Si este atajo es un carácter imprimible pelado -`/` y `?` hoy-. DERIVADO y no
 * declarado, porque es un hecho de la combinación: una tecla que produce un
 * carácter sin modificador es una que alguien pulsa haciendo otra cosa, y una
 * que una pistola puede emitir. WCAG 2.2 2.1.4 va exactamente de esta clase.
 */
export function isSingleCharacter(binding: ShortcutBinding): boolean {
  return binding.key.length === 1 && binding.ctrl !== true && binding.alt !== true;
}

/** Si este keydown es el atajo, modificadores incluidos. */
export function matches(binding: ShortcutBinding, event: KeyboardEvent): boolean {
  return (
    event.key === binding.key &&
    event.ctrlKey === (binding.ctrl ?? false) &&
    event.altKey === (binding.alt ?? false) &&
    // Nunca lo reclama un atajo global: en macOS es Command y en Windows abre el
    // menú del sistema. Ninguno de los dos es de la aplicación.
    !event.metaKey
  );
}
