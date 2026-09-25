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
import { DocTable } from '../../ui/doc-table';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { StateMatrix, type MatrixAxis } from '../../ui/state-matrix';
import { TokenValue } from '../../ui/token-value';
import { computedOf, tagOf } from './measure';

/**
 * Filas de la matriz: las siete variantes. Los ids son la unión del componente,
 * así que renombrar una variante en la librería rompe este archivo al compilar.
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
 * Columnas: no son estados, porque ewms-text no tiene hover, foco ni deshabilitado.
 * Cruzan el elemento que se renderiza con cómo se ve, que es justo el acople
 * que el componente existe para garantizar.
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

/** Un texto de muestra por variante, para que la grilla no sea siete veces «Aa». */
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
 * Verificada contra text.ts: una sola entrada, requerida, y sin input as.
 * Esa ausencia es el componente, por eso la tabla la dice explícitamente.
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
  imports: [Text, DemoFrame, DocTable, PropTable, StateMatrix, TokenValue],
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

  protected sampleFor(id: string): string {
    return SAMPLES[id] ?? '';
  }

  /** Solo en los encabezados el acople tiene consecuencias. */
  protected isHeading(id: string): boolean {
    return id.startsWith('h');
  }

  protected isPending(row: VariantTokens, token: string): boolean {
    return row.pending.includes(token);
  }
}
