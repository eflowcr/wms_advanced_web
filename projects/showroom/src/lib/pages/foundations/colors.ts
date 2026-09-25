import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { DemoFrame } from '../../ui/demo-frame';
import { DocTable, type DocColumn } from '../../ui/doc-table';
import { Prose } from '../../ui/prose';
import { TokenReader } from '../../ui/token-reader';
import { TokenValue } from '../../ui/token-value';
import { AA_NON_TEXT, AA_TEXT, formatRatio, verdict, type ContrastVerdict } from '../../ui/tokens';

/** Familia de primitivos, leída en vivo para que un tono nuevo aparezca solo. */
interface ToneRamp {
  readonly family: string;
  readonly names: readonly string[];
}

/** Semánticos agrupados por rol; el agrupamiento es intención, no valor. */
interface RoleGroup {
  readonly id: string;
  /** Clave del diccionario. */
  readonly title: string;
  /** Clave del diccionario. */
  readonly note: string;
  readonly tokens: readonly string[];
}

/** Par que verifica el catálogo, con el umbral contra el que se juzga. */
interface ContrastPair {
  readonly foreground: string;
  readonly background: string;
  readonly minimum: number;
  /** WCAG 1.4.3 exime al control deshabilitado y un divisor decorativo no es control: otra pregunta, no una falla suave. */
  readonly exempt: boolean;
  /** Clave del diccionario. */
  readonly note: string;
}

interface ContrastResult extends ContrastPair {
  readonly ratio: string;
  readonly verdict: ContrastVerdict;
}

const FAMILIES = ['navy', 'blue', 'red', 'orange', 'green'];

/**
 * t(showroom.colors.semantic.roles.brand.title, showroom.colors.semantic.roles.brand.note,
 *   showroom.colors.semantic.roles.text.title, showroom.colors.semantic.roles.text.note,
 *   showroom.colors.semantic.roles.surfaces.title, showroom.colors.semantic.roles.surfaces.note,
 *   showroom.colors.semantic.roles.borders.title, showroom.colors.semantic.roles.borders.note,
 *   showroom.colors.semantic.roles.action.title, showroom.colors.semantic.roles.action.note,
 *   showroom.colors.semantic.roles.dangerButton.title,
 *   showroom.colors.semantic.roles.dangerButton.note,
 *   showroom.colors.semantic.roles.families.title, showroom.colors.semantic.roles.families.note,
 *   showroom.colors.semantic.roles.states.title, showroom.colors.semantic.roles.states.note)
 */
const ROLES: readonly RoleGroup[] = [
  {
    id: 'brand',
    title: 'showroom.colors.semantic.roles.brand.title',
    note: 'showroom.colors.semantic.roles.brand.note',
    tokens: ['--color-brand-navy', '--color-brand-blue'],
  },
  {
    id: 'text',
    title: 'showroom.colors.semantic.roles.text.title',
    note: 'showroom.colors.semantic.roles.text.note',
    tokens: [
      '--color-text-primary',
      '--color-text-secondary',
      '--color-text-disabled',
      '--color-text-on-dark',
      '--color-text-on-primary',
    ],
  },
  {
    id: 'surfaces',
    title: 'showroom.colors.semantic.roles.surfaces.title',
    note: 'showroom.colors.semantic.roles.surfaces.note',
    tokens: [
      '--color-canvas',
      '--color-surface',
      '--color-bg-secondary',
      '--color-bg-secondary-hover',
    ],
  },
  {
    id: 'borders',
    title: 'showroom.colors.semantic.roles.borders.title',
    note: 'showroom.colors.semantic.roles.borders.note',
    tokens: ['--color-border', '--color-border-strong', '--color-border-strong-hover'],
  },
  {
    id: 'action',
    title: 'showroom.colors.semantic.roles.action.title',
    note: 'showroom.colors.semantic.roles.action.note',
    tokens: [
      '--color-bg-primary',
      '--color-bg-primary-hover',
      '--color-bg-primary-active',
      '--color-bg-primary-disabled',
      '--color-ghost-hover',
    ],
  },
  {
    id: 'danger-button',
    title: 'showroom.colors.semantic.roles.dangerButton.title',
    note: 'showroom.colors.semantic.roles.dangerButton.note',
    tokens: [
      '--color-bg-danger',
      '--color-bg-danger-hover',
      '--color-bg-danger-active',
      '--color-bg-danger-disabled',
    ],
  },
  {
    id: 'families',
    title: 'showroom.colors.semantic.roles.families.title',
    note: 'showroom.colors.semantic.roles.families.note',
    tokens: [
      '--color-danger-solid',
      '--color-danger-surface',
      '--color-danger-border',
      '--color-danger-text',
      '--color-warning-solid',
      '--color-warning-surface',
      '--color-warning-border',
      '--color-warning-text',
      '--color-success-solid',
      '--color-success-surface',
      '--color-success-border',
      '--color-success-text',
      '--color-neutral-solid',
      '--color-neutral-surface',
      '--color-neutral-border',
      '--color-neutral-text',
    ],
  },
  {
    id: 'states',
    title: 'showroom.colors.semantic.roles.states.title',
    note: 'showroom.colors.semantic.roles.states.note',
    tokens: [
      '--color-focus-ring',
      '--color-focus-ring-on-dark',
      '--color-row-selected',
      '--color-overlay',
    ],
  },
];

// Qué pares medir es intención de diseño y se escribe acá; cuánto dan sale de los tokens
// computados. Si un token rompe un contraste, la tabla lo dice en la próxima recarga.
/**
 * t(showroom.colors.contrast.notes.primaryOnSurface,
 *   showroom.colors.contrast.notes.primaryOnCanvas, showroom.colors.contrast.notes.activeOption,
 *   showroom.colors.contrast.notes.caption, showroom.colors.contrast.notes.secondaryWorst,
 *   showroom.colors.contrast.notes.secondaryOnSecondary, showroom.colors.contrast.notes.navyBars,
 *   showroom.colors.contrast.notes.primaryButton, showroom.colors.contrast.notes.primaryHover,
 *   showroom.colors.contrast.notes.primaryActive, showroom.colors.contrast.notes.dangerButton,
 *   showroom.colors.contrast.notes.onDangerSolid, showroom.colors.contrast.notes.onWarningSolid,
 *   showroom.colors.contrast.notes.onSuccessSolid, showroom.colors.contrast.notes.familyText,
 *   showroom.colors.contrast.notes.neutralBadge, showroom.colors.contrast.notes.controlBorder,
 *   showroom.colors.contrast.notes.controlBorderOnCanvas,
 *   showroom.colors.contrast.notes.controlBorderHover,
 *   showroom.colors.contrast.notes.controlBorderHoverWorst,
 *   showroom.colors.contrast.notes.focusRing, showroom.colors.contrast.notes.focusRingOnCanvas,
 *   showroom.colors.contrast.notes.focusRingOnDark, showroom.colors.contrast.notes.divider,
 *   showroom.colors.contrast.notes.disabledPrimary, showroom.colors.contrast.notes.disabledDanger,
 *   showroom.colors.contrast.notes.disabledOnSecondary, showroom.colors.contrast.notes.toggleThumb)
 */
const PAIRS: readonly ContrastPair[] = [
  {
    foreground: '--color-text-primary',
    background: '--color-surface',
    minimum: AA_TEXT,
    exempt: false,
    note: 'showroom.colors.contrast.notes.primaryOnSurface',
  },
  {
    foreground: '--color-text-primary',
    background: '--color-canvas',
    minimum: AA_TEXT,
    exempt: false,
    note: 'showroom.colors.contrast.notes.primaryOnCanvas',
  },
  {
    foreground: '--color-text-primary',
    background: '--color-ghost-hover',
    minimum: AA_TEXT,
    exempt: false,
    note: 'showroom.colors.contrast.notes.activeOption',
  },
  {
    foreground: '--color-text-secondary',
    background: '--color-surface',
    minimum: AA_TEXT,
    exempt: false,
    note: 'showroom.colors.contrast.notes.caption',
  },
  {
    foreground: '--color-text-secondary',
    background: '--color-canvas',
    minimum: AA_TEXT,
    exempt: false,
    note: 'showroom.colors.contrast.notes.secondaryWorst',
  },
  {
    foreground: '--color-text-secondary',
    background: '--color-bg-secondary',
    minimum: AA_TEXT,
    exempt: false,
    note: 'showroom.colors.contrast.notes.secondaryOnSecondary',
  },
  {
    foreground: '--color-text-on-dark',
    background: '--color-brand-navy',
    minimum: AA_TEXT,
    exempt: false,
    note: 'showroom.colors.contrast.notes.navyBars',
  },
  {
    foreground: '--color-text-on-primary',
    background: '--color-bg-primary',
    minimum: AA_TEXT,
    exempt: false,
    note: 'showroom.colors.contrast.notes.primaryButton',
  },
  {
    foreground: '--color-text-on-primary',
    background: '--color-bg-primary-hover',
    minimum: AA_TEXT,
    exempt: false,
    note: 'showroom.colors.contrast.notes.primaryHover',
  },
  {
    foreground: '--color-text-on-primary',
    background: '--color-bg-primary-active',
    minimum: AA_TEXT,
    exempt: false,
    note: 'showroom.colors.contrast.notes.primaryActive',
  },
  {
    foreground: '--color-text-on-primary',
    background: '--color-bg-danger',
    minimum: AA_TEXT,
    exempt: false,
    note: 'showroom.colors.contrast.notes.dangerButton',
  },
  {
    foreground: '--color-text-on-primary',
    background: '--color-danger-solid',
    minimum: AA_TEXT,
    exempt: false,
    note: 'showroom.colors.contrast.notes.onDangerSolid',
  },
  {
    foreground: '--color-text-on-primary',
    background: '--color-warning-solid',
    minimum: AA_TEXT,
    exempt: false,
    note: 'showroom.colors.contrast.notes.onWarningSolid',
  },
  {
    foreground: '--color-text-on-primary',
    background: '--color-success-solid',
    minimum: AA_TEXT,
    exempt: false,
    note: 'showroom.colors.contrast.notes.onSuccessSolid',
  },
  {
    foreground: '--color-danger-text',
    background: '--color-danger-surface',
    minimum: AA_TEXT,
    exempt: false,
    note: 'showroom.colors.contrast.notes.familyText',
  },
  {
    foreground: '--color-warning-text',
    background: '--color-warning-surface',
    minimum: AA_TEXT,
    exempt: false,
    note: 'showroom.colors.contrast.notes.familyText',
  },
  {
    foreground: '--color-success-text',
    background: '--color-success-surface',
    minimum: AA_TEXT,
    exempt: false,
    note: 'showroom.colors.contrast.notes.familyText',
  },
  {
    foreground: '--color-neutral-text',
    background: '--color-neutral-surface',
    minimum: AA_TEXT,
    exempt: false,
    note: 'showroom.colors.contrast.notes.neutralBadge',
  },
  {
    foreground: '--color-border-strong',
    background: '--color-surface',
    minimum: AA_NON_TEXT,
    exempt: false,
    note: 'showroom.colors.contrast.notes.controlBorder',
  },
  {
    foreground: '--color-border-strong',
    background: '--color-canvas',
    minimum: AA_NON_TEXT,
    exempt: false,
    note: 'showroom.colors.contrast.notes.controlBorderOnCanvas',
  },
  {
    foreground: '--color-border-strong-hover',
    background: '--color-surface',
    minimum: AA_NON_TEXT,
    exempt: false,
    note: 'showroom.colors.contrast.notes.controlBorderHover',
  },
  {
    foreground: '--color-border-strong-hover',
    background: '--color-bg-secondary',
    minimum: AA_NON_TEXT,
    exempt: false,
    note: 'showroom.colors.contrast.notes.controlBorderHoverWorst',
  },
  {
    foreground: '--color-focus-ring',
    background: '--color-surface',
    minimum: AA_NON_TEXT,
    exempt: false,
    note: 'showroom.colors.contrast.notes.focusRing',
  },
  {
    foreground: '--color-focus-ring',
    background: '--color-canvas',
    minimum: AA_NON_TEXT,
    exempt: false,
    note: 'showroom.colors.contrast.notes.focusRingOnCanvas',
  },
  {
    foreground: '--color-focus-ring-on-dark',
    background: '--color-brand-navy',
    minimum: AA_NON_TEXT,
    exempt: false,
    note: 'showroom.colors.contrast.notes.focusRingOnDark',
  },
  {
    foreground: '--color-border',
    background: '--color-surface',
    minimum: AA_NON_TEXT,
    exempt: true,
    note: 'showroom.colors.contrast.notes.divider',
  },
  {
    foreground: '--color-text-disabled',
    background: '--color-bg-primary-disabled',
    minimum: AA_TEXT,
    exempt: true,
    note: 'showroom.colors.contrast.notes.disabledPrimary',
  },
  {
    foreground: '--color-text-disabled',
    background: '--color-bg-danger-disabled',
    minimum: AA_TEXT,
    exempt: true,
    note: 'showroom.colors.contrast.notes.disabledDanger',
  },
  {
    foreground: '--color-text-disabled',
    background: '--color-bg-secondary',
    minimum: AA_TEXT,
    exempt: true,
    note: 'showroom.colors.contrast.notes.disabledOnSecondary',
  },
  {
    foreground: '--color-text-on-primary',
    background: '--color-bg-primary-disabled',
    minimum: AA_NON_TEXT,
    exempt: true,
    note: 'showroom.colors.contrast.notes.toggleThumb',
  },
];

/**
 * t(showroom.colors.contrast.columns.sample, showroom.colors.contrast.columns.foreground,
 *   showroom.colors.contrast.columns.background, showroom.colors.contrast.columns.ratio,
 *   showroom.colors.contrast.columns.minimum, showroom.colors.contrast.columns.verdict,
 *   showroom.colors.contrast.columns.note)
 */
const CONTRAST_COLUMNS: readonly DocColumn[] = [
  { id: 'sample', label: 'showroom.colors.contrast.columns.sample' },
  { id: 'foreground', label: 'showroom.colors.contrast.columns.foreground' },
  { id: 'background', label: 'showroom.colors.contrast.columns.background' },
  { id: 'ratio', label: 'showroom.colors.contrast.columns.ratio' },
  { id: 'minimum', label: 'showroom.colors.contrast.columns.minimum' },
  { id: 'verdict', label: 'showroom.colors.contrast.columns.verdict' },
  { id: 'note', label: 'showroom.colors.contrast.columns.note' },
];

/**
 * t(showroom.colors.contrast.verdicts.pass, showroom.colors.contrast.verdicts.fail,
 *   showroom.colors.contrast.verdicts.exempt)
 */
const VERDICT_LABELS: Readonly<Record<ContrastVerdict, string>> = {
  pass: 'showroom.colors.contrast.verdicts.pass',
  fail: 'showroom.colors.contrast.verdicts.fail',
  exempt: 'showroom.colors.contrast.verdicts.exempt',
};

/**
 * Las dos capas de color y si pasan contraste. Los primitivos se leen de la hoja en vivo;
 * los grupos semánticos se escriben porque agrupar por rol es un juicio, no un hecho del archivo.
 */
@Component({
  selector: 'ewms-showroom-colors',
  imports: [DemoFrame, DocTable, Prose, TokenValue, TranslocoPipe],
  templateUrl: './colors.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomColors {
  private readonly reader = inject(TokenReader);

  protected readonly roles = ROLES;
  protected readonly contrastColumns = CONTRAST_COLUMNS;

  protected readonly ramps = signal<readonly ToneRamp[]>([]);
  protected readonly translucent = signal<readonly string[]>([]);
  protected readonly contrasts = signal<readonly ContrastResult[]>([]);

  constructor() {
    afterNextRender(() => {
      this.ramps.set(this.reader.toneFamilies(FAMILIES));
      this.translucent.set(this.reader.alphaPrimitives('navy'));
      this.contrasts.set(
        PAIRS.map((pair) => {
          const ratio = this.reader.ratio(pair.foreground, pair.background);
          return {
            ...pair,
            ratio: ratio === null ? '—' : formatRatio(ratio),
            verdict: ratio === null ? 'exempt' : verdict(ratio, pair.minimum, pair.exempt),
          };
        }),
      );
    });
  }

  /** Utilidad que pinta un veredicto; la falla tiene que verse fuerte. */
  protected verdictClasses(value: ContrastVerdict): string {
    switch (value) {
      case 'pass':
        return 'bg-success-surface text-success';
      case 'fail':
        return 'bg-danger-surface text-danger';
      case 'exempt':
        return 'bg-neutral-surface text-neutral';
    }
  }

  /** Clave del nombre de un veredicto; la plantilla la traduce. */
  protected verdictLabel(value: ContrastVerdict): string {
    return VERDICT_LABELS[value];
  }

  /** Muestra de cualquier token, primitivos incluidos, sin que el valor llegue al fuente. */
  protected swatch(token: string): Record<string, string> {
    return { 'background-color': `var(${token})` };
  }
}
