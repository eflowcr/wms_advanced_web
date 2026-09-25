import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  Button,
  DESIGN_SYSTEM_VERSION,
  DialogService,
  Icon,
  type DialogTone,
  type IconName,
} from '@ewms/design-system';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { DemoFrame } from '../../ui/demo-frame';
import { ANATOMY_COLUMNS, DocTable, type DocColumn } from '../../ui/doc-table';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { Prose } from '../../ui/prose';
import { StateMatrix, type MatrixAxis } from '../../ui/state-matrix';
import { TokenValue } from '../../ui/token-value';

/** Una fila por tono. Todo lo que no es `tone` ni `family` es una clave del diccionario. */
interface ToneRow {
  readonly tone: DialogTone;
  readonly name: string;
  readonly family: string;
  readonly confirmVariant: string;
  readonly backdrop: string;
  /** Lo que dice la confirmación: se traduce al abrir. */
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
}

/**
 * t(showroom.modal.tones.names.danger, showroom.modal.tones.names.warning,
 *   showroom.modal.tones.names.info, showroom.modal.tones.confirm.danger,
 *   showroom.modal.tones.confirm.primary, showroom.modal.tones.backdrop.stays,
 *   showroom.modal.tones.backdrop.closes, showroom.modal.demo.dialogs.danger.title,
 *   showroom.modal.demo.dialogs.danger.body, showroom.modal.demo.dialogs.danger.confirm,
 *   showroom.modal.demo.dialogs.warning.title, showroom.modal.demo.dialogs.warning.body,
 *   showroom.modal.demo.dialogs.warning.confirm, showroom.modal.demo.dialogs.info.title,
 *   showroom.modal.demo.dialogs.info.body, showroom.modal.demo.dialogs.info.confirm)
 */
const TONES: readonly ToneRow[] = [
  {
    tone: 'danger',
    name: 'showroom.modal.tones.names.danger',
    family: 'danger',
    confirmVariant: 'showroom.modal.tones.confirm.danger',
    backdrop: 'showroom.modal.tones.backdrop.stays',
    title: 'showroom.modal.demo.dialogs.danger.title',
    body: 'showroom.modal.demo.dialogs.danger.body',
    confirmLabel: 'showroom.modal.demo.dialogs.danger.confirm',
  },
  {
    tone: 'warning',
    name: 'showroom.modal.tones.names.warning',
    family: 'warning',
    confirmVariant: 'showroom.modal.tones.confirm.primary',
    backdrop: 'showroom.modal.tones.backdrop.closes',
    title: 'showroom.modal.demo.dialogs.warning.title',
    body: 'showroom.modal.demo.dialogs.warning.body',
    confirmLabel: 'showroom.modal.demo.dialogs.warning.confirm',
  },
  {
    tone: 'info',
    name: 'showroom.modal.tones.names.info',
    family: 'neutral',
    confirmVariant: 'showroom.modal.tones.confirm.primary',
    backdrop: 'showroom.modal.tones.backdrop.closes',
    title: 'showroom.modal.demo.dialogs.info.title',
    body: 'showroom.modal.demo.dialogs.info.body',
    confirmLabel: 'showroom.modal.demo.dialogs.info.confirm',
  },
];

/**
 * Clave del botón que cancela, traducida al abrir. Constante y marcador, no el literal en
 * translate(): el extractor lo daría por clave del diccionario raíz.
 * t(showroom.modal.demo.dialogs.cancel)
 */
const CANCEL_LABEL = 'showroom.modal.demo.dialogs.cancel';

/** t(showroom.modal.demo.answer.confirmed, showroom.modal.demo.answer.rejected) */
const ANSWERS = {
  confirmed: 'showroom.modal.demo.answer.confirmed',
  rejected: 'showroom.modal.demo.answer.rejected',
} as const;

/** El encabezado de la columna que nombra el tono, en la tabla y en la matriz. t(showroom.modal.tone) */
const TONE_HEADER = 'showroom.modal.tone';

/**
 * t(showroom.modal.variants.columns.family, showroom.modal.variants.columns.confirm,
 *   showroom.modal.backdrop)
 */
const TONE_COLUMNS: readonly DocColumn[] = [
  { id: 'name', label: TONE_HEADER },
  { id: 'family', label: 'showroom.modal.variants.columns.family' },
  { id: 'confirm', label: 'showroom.modal.variants.columns.confirm' },
  { id: 'backdrop', label: 'showroom.modal.backdrop' },
];

const MATRIX_VARIANTS: readonly MatrixAxis[] = TONES.map((row) => ({
  id: row.tone,
  label: row.name,
}));

/**
 * t(showroom.modal.states.columns.glyph, showroom.modal.states.columns.confirm,
 *   showroom.modal.states.columns.backdrop)
 */
const MATRIX_STATES: readonly MatrixAxis[] = [
  { id: 'glyph', label: 'showroom.modal.states.columns.glyph' },
  { id: 'confirm', label: 'showroom.modal.states.columns.confirm' },
  { id: 'backdrop', label: 'showroom.modal.states.columns.backdrop' },
];

/** Muestras del glifo escritas completas para que Tailwind vea cada clase. */
const GLYPH_SAMPLES: Readonly<Record<string, { name: IconName; color: string }>> = {
  danger: { name: 'alert-triangle', color: 'text-danger' },
  warning: { name: 'alert-triangle', color: 'text-warning' },
  info: { name: 'info-circle', color: 'text-neutral' },
};

/**
 * Verificada contra dialog.service.ts. Las opciones llevan viñeta en vez de repetir
 * options: con el nombre completo la tabla desbordaba y axe marcaba la región con
 * scroll sin acceso por teclado (igual que en Toast).
 * t(showroom.modal.props.confirm, showroom.modal.props.title, showroom.modal.props.body,
 *   showroom.modal.props.tone, showroom.modal.props.confirmLabel, showroom.modal.props.cancelLabel,
 *   showroom.modal.props.open, showroom.modal.props.data, showroom.modal.props.dismissOnBackdrop,
 *   showroom.modal.props.ariaLabelledBy, showroom.modal.props.injector)
 */
const PROPS: readonly PropRow[] = [
  {
    name: 'confirm(opciones)',
    type: '=> Promise<boolean>',
    default: '—',
    description: 'showroom.modal.props.confirm',
  },
  {
    name: '· title',
    type: 'string',
    default: '—',
    description: 'showroom.modal.props.title',
  },
  {
    name: '· body',
    type: 'string',
    default: '—',
    description: 'showroom.modal.props.body',
  },
  {
    name: '· tone',
    type: "'danger' | 'warning' | 'info'",
    default: '—',
    description: 'showroom.modal.props.tone',
  },
  {
    name: '· confirmLabel',
    type: 'string',
    default: '—',
    description: 'showroom.modal.props.confirmLabel',
  },
  {
    name: '· cancelLabel',
    type: 'string',
    default: '—',
    description: 'showroom.modal.props.cancelLabel',
  },
  {
    name: 'open(comp, opciones)',
    type: '=> DialogRef<R, C>',
    default: '—',
    description: 'showroom.modal.props.open',
  },
  {
    name: '· data',
    type: 'D',
    default: 'undefined',
    description: 'showroom.modal.props.data',
  },
  {
    name: '· dismissOnBackdrop',
    type: 'boolean',
    default: 'true',
    description: 'showroom.modal.props.dismissOnBackdrop',
  },
  {
    name: '· ariaLabelledBy',
    type: 'string',
    default: 'undefined',
    description: 'showroom.modal.props.ariaLabelledBy',
  },
  {
    name: '· injector',
    type: 'Injector',
    default: 'undefined',
    description: 'showroom.modal.props.injector',
  },
];

/**
 * t(showroom.modal.anatomy.parts.surface, showroom.modal.anatomy.parts.radius,
 *   showroom.modal.anatomy.parts.elevation, showroom.modal.backdrop,
 *   showroom.modal.anatomy.parts.blur, showroom.modal.anatomy.parts.glyphSize,
 *   showroom.modal.anatomy.parts.glyphDanger, showroom.modal.anatomy.parts.glyphWarning,
 *   showroom.modal.anatomy.parts.glyphInfo, showroom.modal.anatomy.parts.title,
 *   showroom.modal.anatomy.parts.body)
 */
const ANATOMY = [
  { part: 'showroom.modal.anatomy.parts.surface', token: '--color-surface' },
  { part: 'showroom.modal.anatomy.parts.radius', token: '--radius-dialog' },
  { part: 'showroom.modal.anatomy.parts.elevation', token: '--shadow-dialog' },
  { part: 'showroom.modal.backdrop', token: '--color-overlay' },
  { part: 'showroom.modal.anatomy.parts.blur', token: '--backdrop-blur' },
  { part: 'showroom.modal.anatomy.parts.glyphSize', token: '--size-icon-lg' },
  { part: 'showroom.modal.anatomy.parts.glyphDanger', token: '--color-danger-text' },
  { part: 'showroom.modal.anatomy.parts.glyphWarning', token: '--color-warning-text' },
  { part: 'showroom.modal.anatomy.parts.glyphInfo', token: '--color-neutral-text' },
  { part: 'showroom.modal.anatomy.parts.title', token: '--text-h3-size' },
  { part: 'showroom.modal.anatomy.parts.body', token: '--text-p-size' },
] as const;

/** Lo que respondió la última confirmación: la clave del texto y el nombre del tono. */
interface Answer {
  readonly key: string;
  readonly tone: string;
}

/**
 * /design-system/components/dialog: ficha de DialogService. La demo abre diálogos
 * reales; la matriz es una tabla de hechos porque tres modales no se abren a la vez.
 */
@Component({
  selector: 'ewms-showroom-dialog',
  imports: [
    Button,
    Icon,
    DemoFrame,
    DocTable,
    PropTable,
    Prose,
    StateMatrix,
    TokenValue,
    TranslocoPipe,
  ],
  templateUrl: './dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomDialog {
  private readonly dialogs = inject(DialogService);
  private readonly transloco = inject(TranslocoService);

  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly tones = TONES;
  protected readonly toneColumns = TONE_COLUMNS;
  protected readonly toneHeader = TONE_HEADER;
  protected readonly props = PROPS;
  protected readonly anatomy = ANATOMY;
  protected readonly anatomyColumns = ANATOMY_COLUMNS;
  protected readonly matrixVariants = MATRIX_VARIANTS;
  protected readonly matrixStates = MATRIX_STATES;

  /**
   * Respuesta de la última confirmación, para que se vea la promesa. Guarda claves y no texto:
   * la plantilla la traduce, así sigue al idioma. `null` hasta la primera.
   */
  protected readonly lastAnswer = signal<Answer | null>(null);

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

  protected glyphFor(tone: string): { name: IconName; color: string } | null {
    return GLYPH_SAMPLES[tone] ?? null;
  }

  protected rowFor(tone: string): ToneRow {
    return TONES.find((row) => row.tone === tone) ?? TONES[2]!;
  }

  /** La clave del hecho de una celda de la matriz; vacía para una columna que no es un hecho. */
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

  protected isGlyph(stateId: string): boolean {
    return stateId === 'glyph';
  }

  protected async ask(tone: DialogTone): Promise<void> {
    const row = this.rowFor(tone);
    // Se traduce al abrir: el diálogo recibe texto ya escrito (ADR 0008).
    const confirmed = await this.dialogs.confirm({
      tone,
      title: this.transloco.translate(row.title),
      body: this.transloco.translate(row.body),
      confirmLabel: this.transloco.translate(row.confirmLabel),
      cancelLabel: this.transloco.translate(CANCEL_LABEL),
    });
    this.lastAnswer.set({
      key: confirmed ? ANSWERS.confirmed : ANSWERS.rejected,
      tone: row.name,
    });
  }
}
