import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { DESIGN_SYSTEM_VERSION, Text, type TextVariant } from '@ewms/design-system';
import { DemoFrame } from '../../ui/demo-frame';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { StateMatrix, type MatrixAxis } from '../../ui/state-matrix';
import { TokenValue } from '../../ui/token-value';
import { computedOf, tagOf } from './measure';

/**
 * The seven variants, as the matrix's row axis.
 *
 * The ids ARE the component's union, so the template needs no cast and a
 * variant renamed in the library breaks this file at compile time.
 */
const VARIANTS: readonly MatrixAxis[] = [
  { id: 'h1', label: 'h1' },
  { id: 'h2', label: 'h2' },
  { id: 'h3', label: 'h3' },
  { id: 'h4', label: 'h4' },
  { id: 'p', label: 'p' },
  { id: 'caption', label: 'caption' },
  { id: 'mono', label: 'mono' },
];

/**
 * The column axis. NOT states: this component has none.
 *
 * `ewms-text` is a primitive with no hover, no focus and no disabled -- it
 * renders an element and stops. So the matrix's second axis is the thing that
 * actually varies and that the component exists to couple: the ELEMENT the
 * variant renders against the LOOK it renders with. Reading the grid across a
 * row is the whole argument of the component in one line.
 */
const AXES: readonly MatrixAxis[] = [
  { id: 'element', label: 'Elemento del documento' },
  { id: 'sample', label: 'Cómo se ve' },
];

const VARIANT_BY_ID: Readonly<Record<string, TextVariant>> = {
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  p: 'p',
  caption: 'caption',
  mono: 'mono',
};

/** One line of sample text per variant, so the grid is not seven copies of "Aa". */
const SAMPLES: Readonly<Record<string, string>> = {
  h1: 'Recepción de mercancía',
  h2: 'Órdenes pendientes',
  h3: 'Detalle del bulto',
  h4: 'Ubicación',
  p: 'El operario confirma la cantidad antes de cerrar.',
  caption: 'Actualizado hace 3 minutos',
  mono: 'SKU-04871-B',
};

/**
 * The property table.
 *
 * VERIFIED AGAINST text.ts. One input, required, and no `as`: that absence is
 * the component, so it is written into the table rather than left to be
 * noticed.
 */
const PROPS: readonly PropRow[] = [
  {
    name: 'variant',
    type: "'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'caption' | 'mono'",
    default: '— (requerido)',
    description:
      'Fija tamaño, peso e interlineado a la vez, y determina el elemento que se renderiza. No tiene default: elegir el nivel es LA decisión, y un default la escondería.',
  },
  {
    name: '<ng-content>',
    type: 'texto proyectado',
    default: '—',
    description:
      'El texto, ya traducido por el consumidor: el sistema de diseño no habla ningún idioma.',
  },
];

/**
 * The tokens each variant consumes. Four of them are knowingly undeclared in
 * tokens.css and are marked as such instead of being filled in with a guess --
 * the same treatment the Fundamentos page gives them.
 */
interface VariantTokens {
  readonly variant: string;
  readonly size: string;
  readonly weight: string;
  readonly lineHeight: string;
  readonly pending: readonly string[];
}

const TOKENS: readonly VariantTokens[] = [
  {
    variant: 'h1',
    size: '--text-h1-size',
    weight: '--text-h1-weight',
    lineHeight: '--text-h1-line-height',
    pending: [],
  },
  {
    variant: 'h2',
    size: '--text-h2-size',
    weight: '--text-h2-weight',
    lineHeight: '--text-h2-line-height',
    pending: [],
  },
  {
    variant: 'h3',
    size: '--text-h3-size',
    weight: '--text-h3-weight',
    lineHeight: '--text-h3-line-height',
    pending: [],
  },
  {
    variant: 'h4',
    size: '--text-h4-size',
    weight: '--text-h4-weight',
    lineHeight: '--text-h4-line-height',
    pending: ['--text-h4-line-height'],
  },
  {
    variant: 'p',
    size: '--text-p-size',
    weight: '--text-p-weight',
    lineHeight: '--text-p-line-height',
    pending: [],
  },
  {
    variant: 'caption',
    size: '--text-caption-size',
    weight: '--text-caption-weight',
    lineHeight: '--text-caption-line-height',
    pending: ['--text-caption-line-height'],
  },
  {
    variant: 'mono',
    size: '--text-mono-size',
    weight: '--text-mono-weight',
    lineHeight: '--text-mono-line-height',
    pending: ['--text-mono-weight', '--text-mono-line-height'],
  },
];

/** What the browser actually built for a variant, read back off the page. */
interface RenderedElement {
  readonly variant: string;
  /** `H2`, `P`, `SPAN` -- measured, never written down. */
  readonly tag: string;
  readonly fontSize: string;
}

/**
 * /design-system/components/text -- the sheet of `ewms-text`.
 *
 * NOT the type scale. The scale is at /design-system/foundations/typography,
 * where it is shown at its real size with its tokens; this page is about the
 * COMPONENT, and the component's whole reason to exist is a rule the scale
 * cannot state: the visual level and the document level cannot be separated.
 *
 * Which is why block 7 reads the tag name out of the DOM rather than printing
 * a table of promises. `variant="h3"` renders `<h3>` is a claim, and the page
 * that documents it should be the page that checks it.
 */
@Component({
  selector: 'ewms-showroom-text',
  imports: [Text, DemoFrame, PropTable, StateMatrix, TokenValue],
  templateUrl: './text.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomText {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly variants = VARIANTS;
  protected readonly axes = AXES;
  protected readonly props = PROPS;
  protected readonly tokens = TOKENS;

  protected readonly rendered = signal<readonly RenderedElement[]>(
    VARIANTS.map((variant) => ({ variant: variant.id, tag: '…', fontSize: '…' })),
  );

  protected readonly snippet = [
    '<!-- el nivel visual ES el nivel del documento -->',
    '<ewms-text variant="h2">{{ \'recepciones.titulo\' | transloco }}</ewms-text>',
    '',
    '<!-- una etiqueta NO es un encabezado: va caption, no h4 -->',
    '<ewms-text variant="caption">{{ \'kpi.pendientes\' | transloco }}</ewms-text>',
  ].join('\n');

  constructor() {
    /*
     * The element and its size come off the rendered page, not out of a list
     * here. A table saying "h3 renders <h3>" written by hand is a table that
     * keeps saying it after somebody adds an `as` input.
     */
    afterNextRender(() => {
      this.rendered.update((rows) =>
        rows.map((row) => {
          const sample = this.host.nativeElement.querySelector(
            `[data-variant-sample="${row.variant}"] ewms-text > *`,
          );
          return { ...row, tag: tagOf(sample), fontSize: computedOf(sample, 'font-size') };
        }),
      );
    });
  }

  /**
   * The element a variant really produced, for the matrix's first column.
   *
   * It reads the SAME measurement the anatomy table shows, rather than
   * printing the variant's own name a second time: the row header already
   * says `h3`, and a column repeating it would be a grid that looks like it
   * proves the coupling while proving nothing at all.
   */
  protected tagFor(id: string): string {
    return this.rendered().find((row) => row.variant === id)?.tag ?? '…';
  }

  protected variantFor(id: string): TextVariant {
    return VARIANT_BY_ID[id] ?? 'p';
  }

  protected sampleFor(id: string): string {
    return SAMPLES[id] ?? '';
  }

  /** A heading variant, which is what makes the coupling bite. */
  protected isHeading(id: string): boolean {
    return id.startsWith('h');
  }

  protected isPending(row: VariantTokens, token: string): boolean {
    return row.pending.includes(token);
  }
}
