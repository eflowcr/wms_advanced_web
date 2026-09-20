import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Button, DESIGN_SYSTEM_VERSION, DialogService, type DialogTone } from '@ewms/design-system';
import { DemoFrame } from '../../ui/demo-frame';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { StateMatrix, type MatrixAxis } from '../../ui/state-matrix';
import { TokenValue } from '../../ui/token-value';

interface ToneRow {
  readonly tone: DialogTone;
  readonly name: string;
  readonly family: string;
  readonly confirmVariant: string;
  readonly backdrop: string;
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
}

const TONES: readonly ToneRow[] = [
  {
    tone: 'danger',
    name: 'Danger',
    family: 'danger',
    confirmVariant: 'Danger',
    backdrop: 'No cierra',
    title: 'Eliminar la expedición EXP-0412',
    body: 'Se van a soltar 34 bultos ya asignados a tres rutas. No se puede deshacer.',
    confirmLabel: 'Eliminar',
  },
  {
    tone: 'warning',
    name: 'Warning',
    family: 'warning',
    confirmVariant: 'Primary',
    backdrop: 'Cierra',
    title: 'Cerrar el conteo con diferencias',
    body: 'Quedan 7 ubicaciones con diferencia sin justificar. El ajuste se aplica igual.',
    confirmLabel: 'Cerrar el conteo',
  },
  {
    tone: 'info',
    name: 'Info',
    family: 'neutral',
    confirmVariant: 'Primary',
    backdrop: 'Cierra',
    title: 'Publicar la orden de picking',
    body: 'Se van a generar 18 tareas para el turno de la tarde.',
    confirmLabel: 'Publicar',
  },
];

const MATRIX_VARIANTS: readonly MatrixAxis[] = TONES.map((row) => ({
  id: row.tone,
  label: row.name,
}));

const MATRIX_STATES: readonly MatrixAxis[] = [
  { id: 'halo', label: 'Zona de icono' },
  { id: 'confirm', label: 'Botón de confirmar' },
  { id: 'backdrop', label: 'Click en el backdrop' },
];

/** The halo samples, written out in full so Tailwind sees every class. */
const HALO_SAMPLES: Readonly<Record<string, string>> = {
  danger: 'bg-danger-surface border-danger shadow-(--shadow-halo-danger)',
  warning: 'bg-warning-surface border-warning shadow-(--shadow-halo-warning)',
  info: 'bg-neutral-surface border-neutral shadow-(--shadow-halo-neutral)',
};

/**
 * VERIFIED AGAINST dialog.service.ts.
 *
 * The option rows are prefixed with a bullet rather than repeating the word
 * `options`, and the reason is a failure rather than taste: written in full,
 * the first column's longest word could not be broken, the table grew past its
 * column, and `overflow-x-auto` turned into a scrolling region. Chrome makes a
 * scrollable region a tab stop of its own and axe reports it as one without
 * keyboard access -- two failures, one cause, neither about the dialog. The
 * Toast sheet hit the same wall first.
 */
const PROPS: readonly PropRow[] = [
  {
    name: 'confirm(opciones)',
    type: '=> Promise<boolean>',
    default: '—',
    description:
      'Pregunta de sí o no. Resuelve true sólo si se pulsó confirmar; Escape, backdrop y Cancelar resuelven false.',
  },
  {
    name: '· title',
    type: 'string',
    default: '— (requerido)',
    description: 'El titular. Nombra el diálogo: es a donde apunta aria-labelledby.',
  },
  {
    name: '· body',
    type: 'string',
    default: '— (requerido)',
    description: 'El cuerpo. Lo describe: es a donde apunta aria-describedby.',
  },
  {
    name: '· tone',
    type: "'danger' | 'warning' | 'info'",
    default: '— (requerido)',
    description:
      'Elige el halo, la variante del botón de confirmar y si el backdrop cierra. Info se pinta neutral.',
  },
  {
    name: '· confirmLabel',
    type: 'string',
    default: '— (requerido)',
    description: 'El texto del botón que confirma. Ya traducido.',
  },
  {
    name: '· cancelLabel',
    type: 'string',
    default: '— (requerido)',
    description: 'El texto del botón que cancela. Va primero en el DOM, para que el teclado caiga ahí.',
  },
  {
    name: 'open(comp, opciones)',
    type: '=> DialogRef<R, C>',
    default: '—',
    description:
      'La variante formulario. Devuelve la referencia del CDK, no una promesa: no es una pregunta.',
  },
  {
    name: '· data',
    type: 'D',
    default: 'undefined',
    description: 'Lo que el componente recibe por DIALOG_DATA.',
  },
  {
    name: '· dismissOnBackdrop',
    type: 'boolean',
    default: 'true',
    description: 'Sólo gobierna el backdrop. Escape cierra siempre, sin excepción.',
  },
  {
    name: '· ariaLabelledBy',
    type: 'string',
    default: 'undefined',
    description: 'El id del encabezado dentro del componente. Preferible a ariaLabel.',
  },
];

const ANATOMY = [
  { part: 'Fondo de la caja', token: '--color-surface' },
  { part: 'Radio de la caja', token: '--radius-dialog' },
  { part: 'Elevación de la caja', token: '--shadow-dialog' },
  { part: 'Backdrop', token: '--color-overlay' },
  { part: 'Desenfoque del backdrop', token: '--backdrop-blur' },
  { part: 'Diámetro de la zona de icono', token: '--size-dialog-icon' },
  { part: 'Halo de Danger', token: '--shadow-halo-danger' },
  { part: 'Halo de Warning', token: '--shadow-halo-warning' },
  { part: 'Halo de Info — neutral, nunca azul', token: '--shadow-halo-neutral' },
  { part: 'Título', token: '--text-h3-size' },
  { part: 'Cuerpo', token: '--text-p-size' },
] as const;

/**
 * /design-system/components/dialog -- the sheet of `DialogService`.
 *
 * THE DEMO OPENS REAL DIALOGS. There is no picture of one on this page: a
 * dialog is a focus trap, a backdrop and a promise, and none of those is
 * visible in a still. The matrix underneath is a table of facts for the same
 * reason -- three modal dialogs cannot be held open side by side.
 */
@Component({
  selector: 'ewms-showroom-dialog',
  imports: [Button, DemoFrame, PropTable, StateMatrix, TokenValue],
  templateUrl: './dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomDialog {
  private readonly dialogs = inject(DialogService);

  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly tones = TONES;
  protected readonly props = PROPS;
  protected readonly anatomy = ANATOMY;
  protected readonly matrixVariants = MATRIX_VARIANTS;
  protected readonly matrixStates = MATRIX_STATES;

  /** What the last confirmation answered, so the promise is visible. */
  protected readonly lastAnswer = signal('(todavía ninguna)');

  protected readonly snippet = [
    'private readonly dialogs = inject(DialogService);',
    '',
    'async eliminar(expedicion: Expedicion): Promise<void> {',
    '  const confirmado = await this.dialogs.confirm({',
    "    tone: 'danger',",
    "    title: this.transloco.translate('expediciones.eliminar.titulo'),",
    "    body: this.transloco.translate('expediciones.eliminar.cuerpo'),",
    "    confirmLabel: this.transloco.translate('comun.eliminar'),",
    "    cancelLabel: this.transloco.translate('comun.cancelar'),",
    '  });',
    '  if (!confirmado) {',
    '    return;',
    '  }',
    '  await this.expediciones.eliminar(expedicion.id);',
    '}',
  ].join('\n');

  protected haloClasses(tone: string): string {
    return HALO_SAMPLES[tone] ?? '';
  }

  protected rowFor(tone: string): ToneRow {
    return TONES.find((row) => row.tone === tone) ?? TONES[2]!;
  }

  protected fact(tone: string, stateId: string): string {
    const row = this.rowFor(tone);
    switch (stateId) {
      case 'confirm':
        return row.confirmVariant;
      case 'backdrop':
        return row.backdrop;
      default:
        return '';
    }
  }

  protected isHalo(stateId: string): boolean {
    return stateId === 'halo';
  }

  protected async ask(tone: DialogTone): Promise<void> {
    const row = this.rowFor(tone);
    const confirmed = await this.dialogs.confirm({
      tone,
      title: row.title,
      body: row.body,
      confirmLabel: row.confirmLabel,
      cancelLabel: 'Cancelar',
    });
    this.lastAnswer.set(
      confirmed ? `${row.name}: confirmado (true)` : `${row.name}: no confirmado (false)`,
    );
  }
}
