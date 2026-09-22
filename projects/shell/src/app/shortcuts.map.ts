import type { ShortcutMap } from '@ewms/design-system';

/**
 * El único archivo de la aplicación que nombra una tecla (REQ-FE-DS4-001 RFE-01; lo verifica
 * `lint:shortcuts`). Las cuatro acciones de RFE-02 en orden de uso; `help` es del motor.
 */
export const SHORTCUT_MAP: ShortcutMap = {
  /**
   * El atajo más riesgoso: un carácter imprimible que puede venir en un código de barras.
   * RFE-04 lo saca de los campos, RFE-05 de los escaneos, y la ayuda lo apaga (WCAG 2.2 2.1.4).
   */
  search: { key: '/', chord: ['/'] },

  /**
   * Alt y no Ctrl: Ctrl+N abre una ventana y el navegador no la suelta. Alt+N está libre en
   * Chrome sobre Windows; falta comprobarlo con NVDA (§15 del REQ).
   */
  create: { key: 'n', alt: true, chord: ['Alt', 'N'] },

  /**
   * `preventDefault` siempre, haya o no quien registre `save`: el navegador no debe guardar la
   * página a disco mientras la persona cree que guardó su trabajo.
   */
  // `insideTextFields` resuelve una contradicción de RFE-04 (PACQ-02.3): Ctrl+S en un campo
  // guarda el formulario, pero Alt+N en un campo no crea (PACQ-02.5). Por eso es propiedad
  // del atajo y no regla de modificadores; recogido en la v1.1 del REQ.
  save: {
    key: 's',
    ctrl: true,
    preventDefault: true,
    insideTextFields: true,
    chord: ['Ctrl', 'S'],
  },

  /** Única excepción de RFE-04 dentro de un campo: quien cancela suele estar escribiendo en él. */
  cancel: { key: 'Escape', insideTextFields: true, chord: ['Esc'] },

  /**
   * Alt+R y no Alt+F: Alt+F abre el menú de Chrome y de Firefox en Windows. Fuera de un campo,
   * como `create`: en un filtro, Alt+R es del navegador.
   */
  filters: { key: 'r', alt: true, chord: ['Alt', 'R'] },

  /** `?` es Shift+/ y llega como un solo carácter: va sin modificador, como `/`. */
  help: { key: '?', chord: ['?'] },
};
