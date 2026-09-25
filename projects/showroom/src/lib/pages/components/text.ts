import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { DESIGN_SYSTEM_VERSION, Text, type TextVariant } from '@ewms/design-system';
import { TranslocoPipe } from '@jsverse/transloco';
import { DemoFrame } from '../../ui/demo-frame';
import { DocTable, type DocColumn } from '../../ui/doc-table';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { Prose } from '../../ui/prose';
import { StateMatrix, type MatrixAxis } from '../../ui/state-matrix';
import { TokenValue } from '../../ui/token-value';
import { translated } from '../../ui/translated';
import { computedOf, tagOf } from './measure';
import { TEXT_SAMPLE } from './text.fixtures';

/**
 * Filas de la matriz: las siete variantes. Los ids son la unión del componente,
 * así que renombrar una variante en la librería rompe este archivo al compilar.
 * El nombre es código y se lee igual en los dos idiomas, pero la matriz lo pide por clave.
 * t(showroom.text.variants.names.h1, showroom.text.variants.names.h2,
 *   showroom.text.variants.names.h3, showroom.text.variants.names.h4,
 *   showroom.text.variants.names.p, showroom.text.variants.names.caption,
 *   showroom.text.variants.names.mono)
 */
const VARIANTS: readonly MatrixAxis[] = [
  { id: 'h1', label: 'showroom.text.variants.names.h1' },
  { id: 'h2', label: 'showroom.text.variants.names.h2' },
  { id: 'h3', label: 'showroom.text.variants.names.h3' },
  { id: 'h4', label: 'showroom.text.variants.names.h4' },
  { id: 'p', label: 'showroom.text.variants.names.p' },
  { id: 'caption', label: 'showroom.text.variants.names.caption' },
  { id: 'mono', label: 'showroom.text.variants.names.mono' },
];

/**
 * Columnas: no son estados, porque ewms-text no tiene hover, foco ni deshabilitado.
 * Cruzan el elemento que se renderiza con cómo se ve, que es justo el acople
 * que el componente existe para garantizar.
 * t(showroom.text.states.element, showroom.text.states.sample)
 */
const AXES: readonly MatrixAxis[] = [
  { id: 'element', label: 'showroom.text.states.element' },
  { id: 'sample', label: 'showroom.text.states.sample' },
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

/**
 * Verificada contra text.ts: una sola entrada, requerida, y sin input as.
 * Esa ausencia es el componente, por eso la tabla la dice explícitamente.
 * t(showroom.text.props.variant, showroom.text.props.content)
 */
const PROPS: readonly PropRow[] = [
  {
    name: 'variant',
    type: "'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'caption' | 'mono'",
    default: '—',
    description: 'showroom.text.props.variant',
  },
  {
    // El tipo es código; «texto proyectado» pasa a la descripción.
    name: '<ng-content>',
    type: '—',
    default: '—',
    description: 'showroom.text.props.content',
  },
];

/**
 * Bloque 7, primera tabla: lo que el navegador construyó para cada variante.
 * t(showroom.common.matrix.variant, showroom.text.anatomy.columns.tag,
 *   showroom.text.anatomy.columns.size, showroom.text.anatomy.columns.heading)
 */
const RENDERED_COLUMNS: readonly DocColumn[] = [
  { id: 'variant', label: 'showroom.common.matrix.variant' },
  { id: 'tag', label: 'showroom.text.anatomy.columns.tag' },
  { id: 'size', label: 'showroom.text.anatomy.columns.size' },
  { id: 'heading', label: 'showroom.text.anatomy.columns.heading' },
];

/**
 * Bloque 7, segunda tabla: los tokens de cada variante.
 * t(showroom.common.matrix.variant, showroom.common.anatomy.token)
 */
const TOKEN_COLUMNS: readonly DocColumn[] = [
  { id: 'variant', label: 'showroom.common.matrix.variant' },
  { id: 'tokens', label: 'showroom.common.anatomy.token' },
];

/**
 * Tokens por variante. Cuatro no están declarados en tokens.css y se marcan
 * como pendientes en vez de inventarles valor, igual que en Fundamentos.
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

/** Lo que el navegador construyó para cada variante, leído de la página. */
interface RenderedElement {
  readonly variant: string;
  /** H2, P, SPAN: medido, nunca escrito a mano. */
  readonly tag: string;
  readonly fontSize: string;
}

/**
 * /design-system/components/text: ficha de ewms-text. La escala tipográfica vive en
 * foundations/typography; acá importa la regla de que nivel visual y nivel del
 * documento no se separan, y por eso el bloque 7 lee la etiqueta del DOM.
 */
@Component({
  selector: 'ewms-showroom-text',
  imports: [Text, DemoFrame, DocTable, PropTable, Prose, StateMatrix, TokenValue, TranslocoPipe],
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
  protected readonly renderedColumns = RENDERED_COLUMNS;
  protected readonly tokenColumns = TOKEN_COLUMNS;
  protected readonly sample = TEXT_SAMPLE;

  /**
   * Un texto de muestra por variante, para que la grilla no sea siete veces «Aa». El de mono
   * es un código de artículo: dato del registro, sin traducir.
   * t(showroom.text.samples.h1, showroom.text.samples.h2, showroom.text.samples.h3,
   *   showroom.text.demo.location, showroom.text.samples.p, showroom.text.demo.updated)
   */
  private readonly samples = translated((t): Readonly<Record<string, string>> => ({
    h1: t('showroom.text.samples.h1'),
    h2: t('showroom.text.samples.h2'),
    h3: t('showroom.text.samples.h3'),
    h4: t('showroom.text.demo.location'),
    p: t('showroom.text.samples.p'),
    caption: t('showroom.text.demo.updated'),
    mono: TEXT_SAMPLE.sku,
  }));

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
    // Elemento y tamaño salen de la página renderizada: una tabla escrita a mano
    // seguiría diciendo «h3 da un h3» aunque alguien agregara un input as.
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
   * Elemento medido para la primera columna. Repetir el nombre de la variante
   * aparentaría probar el acople sin probar nada.
   */
  protected tagFor(id: string): string {
    return this.rendered().find((row) => row.variant === id)?.tag ?? '…';
  }

  protected variantFor(id: string): TextVariant {
    return VARIANT_BY_ID[id] ?? 'p';
  }

  /** El texto de muestra ya traducido; sigue al idioma. */
  protected sampleFor(id: string): string {
    return this.samples()[id] ?? '';
  }

  /** Solo en los encabezados el acople tiene consecuencias. */
  protected isHeading(id: string): boolean {
    return id.startsWith('h');
  }

  protected isPending(row: VariantTokens, token: string): boolean {
    return row.pending.includes(token);
  }
}
