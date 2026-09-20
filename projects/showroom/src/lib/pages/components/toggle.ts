import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { DESIGN_SYSTEM_VERSION, Toggle } from '@ewms/design-system';
import { DemoFrame } from '../../ui/demo-frame';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { StateMatrix, type MatrixAxis } from '../../ui/state-matrix';
import { TokenValue } from '../../ui/token-value';
import { formatBox, isExactly, rectOf, widthOf } from './measure';

const VALUES: readonly MatrixAxis[] = [
  { id: 'off', label: 'Off' },
  { id: 'on', label: 'On' },
];

const STATES: readonly MatrixAxis[] = [
  { id: 'default', label: 'Default' },
  { id: 'hover', label: 'Hover' },
  { id: 'focus', label: 'Focus' },
  { id: 'disabled', label: 'Disabled' },
];

/**
 * The forced states.
 *
 * The track's hover colour depends on whether the switch is on, so the hover
 * utility is chosen per ROW and not per column -- which is itself the thing
 * worth seeing: Off hovers towards a darker border grey, On towards the darker
 * action blue.
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

/** VERIFIED AGAINST toggle.ts. */
const PROPS: readonly PropRow[] = [
  {
    name: 'checked',
    type: 'boolean',
    default: 'false',
    description: 'Siembra el estado. Después manda el formulario, igual que en el Checkbox.',
  },
  {
    name: 'label',
    type: 'string',
    default: "''",
    description: 'Texto visible al lado del switch, ya traducido. Toda la fila es el hit-target.',
  },
  {
    name: 'ariaLabel',
    type: 'string',
    default: "''",
    description: 'El nombre accesible donde no hay lugar para texto visible.',
  },
  {
    name: 'disabled',
    type: 'boolean',
    default: 'false',
    description: 'De FormControlBase, combinado con el del formulario por OR — ver el bloque 8.',
  },
  {
    name: '(checkedChange)',
    type: 'output<boolean>',
    default: '—',
    description:
      'El mismo nombre que el Checkbox, y por la misma razón: (change) es nativo y burbujea.',
  },
];

const ANATOMY = [
  { part: 'Pista apagada', token: '--color-border-strong' },
  { part: 'Pista apagada en hover', token: '--color-border-strong-hover' },
  { part: 'Pista encendida', token: '--color-bg-primary' },
  { part: 'Pista encendida en hover', token: '--color-bg-primary-hover' },
  { part: 'Pista encendida y deshabilitada', token: '--color-bg-primary-disabled' },
  { part: 'Pista apagada y deshabilitada', token: '--color-bg-secondary' },
  { part: 'Pulgar', token: '--color-text-on-primary' },
  { part: 'Texto de la fila deshabilitada', token: '--color-text-disabled' },
  { part: 'Anillo de foco (las dos bandas)', token: '--focus-ring-shadow' },
  { part: 'Color del anillo', token: '--color-focus-ring' },
  { part: 'Radio de la píldora y del pulgar', token: '--radius-full' },
] as const;

/** The three numbers the Toggle ficha fixes, in CSS pixels. */
const TRACK_WIDTH = 44;
const TRACK_HEIGHT = 24;
const THUMB_SIZE = 20;

interface TrackMeasure {
  readonly track: string;
  readonly thumb: string;
  readonly matchesSpec: boolean;
}

/** One row of the preferences demo. Each applies on touch; there is no Save. */
interface Preference {
  readonly id: string;
  readonly label: string;
  readonly on: boolean;
  readonly applied: string;
}

/**
 * /design-system/components/toggle -- the sheet of `ewms-toggle`.
 *
 * The page has to make one distinction land before anything else: this is not
 * a checkbox that looks different. It APPLIES ON TOUCH. Which is why the demo
 * is a preferences panel with no Save button anywhere near it -- a Save button
 * beside a toggle would be the page contradicting its own first paragraph.
 */
@Component({
  selector: 'ewms-showroom-toggle',
  imports: [Toggle, DemoFrame, PropTable, StateMatrix, TokenValue],
  templateUrl: './toggle.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomToggle {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly values = VALUES;
  protected readonly states = STATES;
  protected readonly props = PROPS;
  protected readonly anatomy = ANATOMY;

  protected readonly measure = signal<TrackMeasure>({
    track: '…',
    thumb: '…',
    matchesSpec: false,
  });

  protected readonly preferences = signal<readonly Preference[]>([
    {
      id: 'stock',
      label: 'Alertas de stock bajo',
      on: true,
      applied: 'Aplicado al tocar, sin confirmar.',
    },
    {
      id: 'sap',
      label: 'Sincronización automática con SAP',
      on: false,
      applied: 'Aplicado al tocar, sin confirmar.',
    },
    {
      id: 'compacto',
      label: 'Modo compacto de tabla',
      on: false,
      applied: 'Aplicado al tocar, sin confirmar.',
    },
  ]);

  /** Grows on every flip, which is the proof that nothing waits for a Save. */
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
    /*
     * 44 x 24 with a 20 px thumb. The thumb is measured too: 2 + 20 + 2 is the
     * track's height, and the same 2 px has to be left on the far side after
     * the travel. All three numbers come off the rendered control.
     */
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
