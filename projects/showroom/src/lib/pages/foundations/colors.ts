import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DemoFrame } from '../../ui/demo-frame';
import { TokenReader } from '../../ui/token-reader';
import { TokenValue } from '../../ui/token-value';
import { AA_NON_TEXT, AA_TEXT, formatRatio, verdict, type ContrastVerdict } from '../../ui/tokens';

/** A family of primitives, read live so a new tone shows up on its own. */
interface ToneRamp {
  readonly family: string;
  readonly names: readonly string[];
}

/** Semantics grouped by the role they play. The grouping is intent, not value. */
interface RoleGroup {
  readonly id: string;
  readonly title: string;
  readonly note: string;
  readonly tokens: readonly string[];
}

/** A pair the catalogue checks, with the threshold it is judged against. */
interface ContrastPair {
  readonly foreground: string;
  readonly background: string;
  readonly minimum: number;
  /**
   * WCAG 1.4.3 exempts a disabled control, and a decorative divider is not a
   * control at all. Exempt is not a softer failure: it is a different question.
   */
  readonly exempt: boolean;
  readonly note: string;
}

interface ContrastResult extends ContrastPair {
  readonly ratio: string;
  readonly verdict: ContrastVerdict;
}

const FAMILIES = ['navy', 'blue', 'red', 'orange', 'green'];

const ROLES: readonly RoleGroup[] = [
  {
    id: 'brand',
    title: 'Marca',
    note: 'El azul significa «se hace clic». Nada informativo, decorativo ni de estado lo usa.',
    tokens: ['--color-brand-navy', '--color-brand-blue'],
  },
  {
    id: 'text',
    title: 'Texto',
    note: 'Cinco roles, no cinco grises: cada uno dice sobre qué superficie vive.',
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
    title: 'Superficies',
    note: 'La superficie no se separa del canvas por color (1.07:1) sino por borde o sombra.',
    tokens: [
      '--color-canvas',
      '--color-surface',
      '--color-bg-secondary',
      '--color-bg-secondary-hover',
    ],
  },
  {
    id: 'borders',
    title: 'Bordes',
    note: 'El primero es divisor decorativo y nunca el borde de un control; los otros dos sí lo son.',
    tokens: ['--color-border', '--color-border-strong', '--color-border-strong-hover'],
  },
  {
    id: 'action',
    title: 'Acción',
    note: 'hover = base mezclada 15 % con negro, active = 28 %, disabled ≈ 85 % con blanco.',
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
    title: 'Botón de peligro',
    note: 'Es el fondo del botón, no la severidad: la severidad es --color-danger-solid.',
    tokens: [
      '--color-bg-danger',
      '--color-bg-danger-hover',
      '--color-bg-danger-active',
      '--color-bg-danger-disabled',
    ],
  },
  {
    id: 'families',
    title: 'Familias semánticas',
    note: 'Cuatro tokens por familia: un banner necesita fondo, borde, icono y texto. No existe familia info.',
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
    title: 'Estados y superficies',
    note: 'El overlay es navy translúcido y no negro: el negro apaga la escena, el navy la tiñe.',
    tokens: [
      '--color-focus-ring',
      '--color-focus-ring-on-dark',
      '--color-row-selected',
      '--color-overlay',
    ],
  },
];

/**
 * The pairs the page measures.
 *
 * WHICH pairs is design intent and is written here; WHAT they measure is not
 * written anywhere -- the ratio comes from the tokens as the browser computed
 * them. Move a token and break a contrast and this table says so on the next
 * reload, without anyone remembering to re-check.
 */
const PAIRS: readonly ContrastPair[] = [
  {
    foreground: '--color-text-primary',
    background: '--color-surface',
    minimum: AA_TEXT,
    exempt: false,
    note: 'Texto principal sobre la superficie blanca.',
  },
  {
    foreground: '--color-text-primary',
    background: '--color-canvas',
    minimum: AA_TEXT,
    exempt: false,
    note: 'Texto principal sobre el canvas.',
  },
  {
    foreground: '--color-text-primary',
    background: '--color-ghost-hover',
    minimum: AA_TEXT,
    exempt: false,
    note: 'La opción activa del panel del Select lleva este fondo.',
  },
  {
    foreground: '--color-text-secondary',
    background: '--color-surface',
    minimum: AA_TEXT,
    exempt: false,
    note: 'Caption y metadatos sobre superficie: es texto de 12 px.',
  },
  {
    foreground: '--color-text-secondary',
    background: '--color-canvas',
    minimum: AA_TEXT,
    exempt: false,
    note: 'El peor caso del texto secundario.',
  },
  {
    foreground: '--color-text-secondary',
    background: '--color-bg-secondary',
    minimum: AA_TEXT,
    exempt: false,
    note: 'Texto secundario sobre superficie secundaria.',
  },
  {
    foreground: '--color-text-on-dark',
    background: '--color-brand-navy',
    minimum: AA_TEXT,
    exempt: false,
    note: 'Barra superior y rail navy.',
  },
  {
    foreground: '--color-text-on-primary',
    background: '--color-bg-primary',
    minimum: AA_TEXT,
    exempt: false,
    note: 'Texto del botón Primary.',
  },
  {
    foreground: '--color-text-on-primary',
    background: '--color-bg-primary-hover',
    minimum: AA_TEXT,
    exempt: false,
    note: 'Primary en hover.',
  },
  {
    foreground: '--color-text-on-primary',
    background: '--color-bg-primary-active',
    minimum: AA_TEXT,
    exempt: false,
    note: 'Primary en active.',
  },
  {
    foreground: '--color-text-on-primary',
    background: '--color-bg-danger',
    minimum: AA_TEXT,
    exempt: false,
    note: 'Texto del botón Danger. Es el caso que obligó a que este token sea blanco y no text-on-dark.',
  },
  {
    foreground: '--color-text-on-primary',
    background: '--color-danger-solid',
    minimum: AA_TEXT,
    exempt: false,
    note: 'Blanco sobre la severidad danger.',
  },
  {
    foreground: '--color-text-on-primary',
    background: '--color-warning-solid',
    minimum: AA_TEXT,
    exempt: false,
    note: 'Blanco sobre la severidad warning.',
  },
  {
    foreground: '--color-text-on-primary',
    background: '--color-success-solid',
    minimum: AA_TEXT,
    exempt: false,
    note: 'Blanco sobre la severidad success.',
  },
  {
    foreground: '--color-danger-text',
    background: '--color-danger-surface',
    minimum: AA_TEXT,
    exempt: false,
    note: 'Texto de la familia sobre su propia superficie.',
  },
  {
    foreground: '--color-warning-text',
    background: '--color-warning-surface',
    minimum: AA_TEXT,
    exempt: false,
    note: 'Texto de la familia sobre su propia superficie.',
  },
  {
    foreground: '--color-success-text',
    background: '--color-success-surface',
    minimum: AA_TEXT,
    exempt: false,
    note: 'Texto de la familia sobre su propia superficie.',
  },
  {
    foreground: '--color-neutral-text',
    background: '--color-neutral-surface',
    minimum: AA_TEXT,
    exempt: false,
    note: 'Badge neutral: surface + text, nunca solid + blanco.',
  },
  {
    foreground: '--color-border-strong',
    background: '--color-surface',
    minimum: AA_NON_TEXT,
    exempt: false,
    note: 'Borde que define un control (WCAG 1.4.11).',
  },
  {
    foreground: '--color-border-strong',
    background: '--color-canvas',
    minimum: AA_NON_TEXT,
    exempt: false,
    note: 'El mismo borde sobre el canvas.',
  },
  {
    foreground: '--color-border-strong-hover',
    background: '--color-surface',
    minimum: AA_NON_TEXT,
    exempt: false,
    note: 'Hover del borde de control.',
  },
  {
    foreground: '--color-border-strong-hover',
    background: '--color-bg-secondary',
    minimum: AA_NON_TEXT,
    exempt: false,
    note: 'El peor caso del hover del borde.',
  },
  {
    foreground: '--color-focus-ring',
    background: '--color-surface',
    minimum: AA_NON_TEXT,
    exempt: false,
    note: 'El anillo contrasta contra la superficie, no contra el control: por eso lleva separación.',
  },
  {
    foreground: '--color-focus-ring',
    background: '--color-canvas',
    minimum: AA_NON_TEXT,
    exempt: false,
    note: 'El anillo sobre el canvas.',
  },
  {
    foreground: '--color-focus-ring-on-dark',
    background: '--color-brand-navy',
    minimum: AA_NON_TEXT,
    exempt: false,
    note: 'Existe porque el azul de marca sobre navy queda sin aire.',
  },
  {
    foreground: '--color-border',
    background: '--color-surface',
    minimum: AA_NON_TEXT,
    exempt: true,
    note: 'Divisor decorativo: exento. Nunca el borde de un control.',
  },
  {
    foreground: '--color-text-disabled',
    background: '--color-bg-primary-disabled',
    minimum: AA_TEXT,
    exempt: true,
    note: 'Control deshabilitado: exento de 1.4.3. Anotado como pendiente de producto en la ficha del Botón.',
  },
  {
    foreground: '--color-text-disabled',
    background: '--color-bg-danger-disabled',
    minimum: AA_TEXT,
    exempt: true,
    note: 'El mismo cálculo para Danger deshabilitado.',
  },
  {
    foreground: '--color-text-disabled',
    background: '--color-bg-secondary',
    minimum: AA_TEXT,
    exempt: true,
    note: 'Texto deshabilitado sobre superficie secundaria.',
  },
  {
    foreground: '--color-text-on-primary',
    background: '--color-bg-primary-disabled',
    minimum: AA_NON_TEXT,
    exempt: true,
    note: 'El thumb del Toggle encendido y deshabilitado, contra su track.',
  },
];

/**
 * /design-system/foundations/colors — the two layers, and whether they pass.
 *
 * The primitives are not listed in this file: they are read out of the running
 * stylesheet, so a tone added to tokens.css appears here without anyone
 * editing this page. The semantic groups ARE listed, because grouping by role
 * is a judgement and not a fact about the file.
 */
@Component({
  selector: 'ewms-showroom-colors',
  imports: [DemoFrame, TokenValue],
  templateUrl: './colors.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomColors {
  private readonly reader = inject(TokenReader);

  protected readonly roles = ROLES;

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

  /** The utility that paints a verdict. Failing has to be loud. */
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

  protected verdictLabel(value: ContrastVerdict): string {
    switch (value) {
      case 'pass':
        return 'pasa';
      case 'fail':
        return 'FALLA';
      case 'exempt':
        return 'exento';
    }
  }

  /** A swatch of any token, primitive included: the value never reaches the source. */
  protected swatch(token: string): Record<string, string> {
    return { 'background-color': `var(${token})` };
  }
}
