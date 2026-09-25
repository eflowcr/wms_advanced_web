import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { DESIGN_SYSTEM_VERSION, Toggle } from '@ewms/design-system';
import { TranslocoPipe } from '@jsverse/transloco';
import { DemoFrame } from '../../ui/demo-frame';
import { ANATOMY_COLUMNS, DocTable } from '../../ui/doc-table';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { Prose } from '../../ui/prose';
import { StateMatrix, type MatrixAxis } from '../../ui/state-matrix';
import { TokenValue } from '../../ui/token-value';
import { formatBox, isExactly, rectOf, widthOf } from './measure';

/** t(showroom.toggle.states.off, showroom.toggle.states.on) */
const VALUES: readonly MatrixAxis[] = [
  { id: 'off', label: 'showroom.toggle.states.off' },
  { id: 'on', label: 'showroom.toggle.states.on' },
];

/**
 * t(showroom.common.states.default, showroom.common.states.hover, showroom.common.states.focus,
 *   showroom.common.states.disabled)
 */
const STATES: readonly MatrixAxis[] = [
  { id: 'default', label: 'showroom.common.states.default' },
  { id: 'hover', label: 'showroom.common.states.hover' },
  { id: 'focus', label: 'showroom.common.states.focus' },
  { id: 'disabled', label: 'showroom.common.states.disabled' },
];

/** t(showroom.toggle.states.rowHeader) */
const ROW_HEADER = 'showroom.toggle.states.rowHeader';

/**
 * El hover de la pista depende de si está encendido, así que se elige por fila: Off
 * va a un gris de borde más oscuro, On a un azul de acción más oscuro.
 */
const FOCUS_RING = '[&_input]:shadow-(--focus-ring-shadow)';

const FORCED: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  hover: {
    off: '[&_input]:bg-(--color-border-strong-hover)',
    on: '[&_input]:bg-(--color-bg-primary-hover)',
  },
  focus: {
    off: FOCUS_RING,
    on: FOCUS_RING,
  },
};

/**
 * Verificada contra toggle.ts.
 * t(showroom.toggle.props.checked, showroom.toggle.props.label, showroom.toggle.props.ariaLabel,
 *   showroom.toggle.props.disabled, showroom.toggle.props.checkedChange)
 */
const PROPS: readonly PropRow[] = [
  {
    name: 'checked',
    type: 'boolean',
    default: 'false',
    description: 'showroom.toggle.props.checked',
  },
  {
    name: 'label',
    type: 'string',
    default: "''",
    description: 'showroom.toggle.props.label',
  },
  {
    name: 'ariaLabel',
    type: 'string',
    default: "''",
    description: 'showroom.toggle.props.ariaLabel',
  },
  {
    name: 'disabled',
    type: 'boolean',
    default: 'false',
    description: 'showroom.toggle.props.disabled',
  },
  {
    name: '(checkedChange)',
    type: 'output<boolean>',
    default: '—',
    description: 'showroom.toggle.props.checkedChange',
  },
];

/**
 * t(showroom.toggle.anatomy.parts.offTrack, showroom.toggle.anatomy.parts.offTrackHover,
 *   showroom.toggle.anatomy.parts.onTrack, showroom.toggle.anatomy.parts.onTrackHover,
 *   showroom.toggle.anatomy.parts.onTrackDisabled, showroom.toggle.anatomy.parts.offTrackDisabled,
 *   showroom.toggle.anatomy.parts.thumb, showroom.toggle.anatomy.parts.disabledText,
 *   showroom.toggle.anatomy.parts.focusRing, showroom.toggle.anatomy.parts.ringColour,
 *   showroom.toggle.anatomy.parts.radius)
 */
const ANATOMY = [
  { part: 'showroom.toggle.anatomy.parts.offTrack', token: '--color-border-strong' },
  { part: 'showroom.toggle.anatomy.parts.offTrackHover', token: '--color-border-strong-hover' },
  { part: 'showroom.toggle.anatomy.parts.onTrack', token: '--color-bg-primary' },
  { part: 'showroom.toggle.anatomy.parts.onTrackHover', token: '--color-bg-primary-hover' },
  { part: 'showroom.toggle.anatomy.parts.onTrackDisabled', token: '--color-bg-primary-disabled' },
  { part: 'showroom.toggle.anatomy.parts.offTrackDisabled', token: '--color-bg-secondary' },
  { part: 'showroom.toggle.anatomy.parts.thumb', token: '--color-text-on-primary' },
  { part: 'showroom.toggle.anatomy.parts.disabledText', token: '--color-text-disabled' },
  { part: 'showroom.toggle.anatomy.parts.focusRing', token: '--focus-ring-shadow' },
  { part: 'showroom.toggle.anatomy.parts.ringColour', token: '--color-focus-ring' },
  { part: 'showroom.toggle.anatomy.parts.radius', token: '--radius-full' },
] as const;

/** Los tres números que fija la ficha Toggle, en píxeles CSS. */
const TRACK_WIDTH = 44;
const TRACK_HEIGHT = 24;
const THUMB_SIZE = 20;

interface TrackMeasure {
  readonly track: string;
  readonly thumb: string;
  readonly matchesSpec: boolean;
}

/** Fila de la demo de preferencias. Se aplica al tocar; no hay Guardar. `label` es la clave. */
interface Preference {
  readonly id: string;
  readonly label: string;
  readonly on: boolean;
}

/**
 * Las filas con que arranca la demo.
 * t(showroom.toggle.demo.preferences.stock, showroom.toggle.demo.preferences.sap,
 *   showroom.toggle.demo.preferences.compact)
 */
const PREFERENCES: readonly Preference[] = [
  { id: 'stock', label: 'showroom.toggle.demo.preferences.stock', on: true },
  { id: 'sap', label: 'showroom.toggle.demo.preferences.sap', on: false },
  { id: 'compacto', label: 'showroom.toggle.demo.preferences.compact', on: false },
];

/**
 * /design-system/components/toggle: ficha de ewms-toggle. No es un checkbox con otro
 * aspecto: se aplica al tocar, por eso la demo es un panel de preferencias sin Guardar.
 */
@Component({
  selector: 'ewms-showroom-toggle',
  imports: [Toggle, DemoFrame, DocTable, PropTable, Prose, StateMatrix, TokenValue, TranslocoPipe],
  templateUrl: './toggle.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomToggle {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly values = VALUES;
  protected readonly states = STATES;
  protected readonly rowHeader = ROW_HEADER;
  protected readonly props = PROPS;
  protected readonly anatomy = ANATOMY;
  protected readonly anatomyColumns = ANATOMY_COLUMNS;

  protected readonly measure = signal<TrackMeasure>({
    track: '…',
    thumb: '…',
    matchesSpec: false,
  });

  protected readonly preferences = signal<readonly Preference[]>(PREFERENCES);

  /** Crece con cada cambio: prueba de que nada espera a un Guardar. */
  protected readonly applied = signal(0);

  protected readonly snippet = [
    '<!-- se aplica al tocar: no hay botón Guardar en esta pantalla -->',
    '<ewms-toggle',
    "  [label]=\"'preferencias.alertasStock' | transloco\"",
    '  [checked]="preferencias().alertasStock"',
    '  (checkedChange)="guardarPreferencia(\'alertasStock\', $event)"',
    '/>',
  ].join('\n');

  constructor() {
    // 44 x 24 con perilla de 20 px: 2 + 20 + 2 es el alto de la pista, y tras el
    // recorrido deben quedar los mismos 2 px del otro lado. Todo se mide.
    afterNextRender(() => {
      const root = this.host.nativeElement;
      const track = rectOf(root, '[data-measure-track] input');
      const thumb = rectOf(root, '[data-measure-track] span[aria-hidden="true"]');
      this.measure.set({
        track: formatBox(track),
        thumb: formatBox(thumb),
        matchesSpec: isExactly(track, TRACK_WIDTH, TRACK_HEIGHT) && widthOf(thumb) === THUMB_SIZE,
      });
    });
  }

  protected forced(value: string, state: string): string {
    return FORCED[state]?.[value] ?? '';
  }

  protected isOn(value: string): boolean {
    return value === 'on';
  }

  protected flip(id: string, on: boolean): void {
    this.preferences.update((rows) => rows.map((row) => (row.id === id ? { ...row, on } : row)));
    this.applied.update((count) => count + 1);
  }
}
