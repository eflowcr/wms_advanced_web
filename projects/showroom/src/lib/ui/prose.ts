import { Directive, effect, ElementRef, inject, input, Renderer2 } from '@angular/core';

/** Lo que va sin más marcas adentro: texto, código, tecla o valor en monoespaciada. */
export interface ProseLeaf {
  readonly kind: 'text' | 'code' | 'kbd' | 'mono';
  readonly text: string;
}

/** Énfasis: puede llevar código o teclas adentro, no otro énfasis. */
export interface ProseEmphasis {
  readonly kind: 'strong' | 'em';
  readonly children: readonly ProseLeaf[];
}

export type ProseNode = ProseLeaf | ProseEmphasis;

export interface ParsedProse {
  readonly nodes: readonly ProseNode[];
  /** Marcas mal cerradas. El texto igual se muestra; la spec de diccionarios exige cero. */
  readonly errors: readonly string[];
}

const RAW = { code: 'code', kbd: 'kbd', mono: 'mono' } as const;
const EMPHASIS = { b: 'strong', i: 'em' } as const;
const OPENING = /<(b|i|code|kbd|mono)>/g;

/**
 * El marcado de un texto del diccionario: `<b>`, `<i>`, `<code>`, `<kbd>` y `<mono>`. Adentro de
 * `<code>`, `<kbd>` y `<mono>` todo es literal, así que `<code><ewms-table></code>` se lee tal cual.
 */
export function parseProse(text: string): ParsedProse {
  const errors: string[] = [];
  const nodes: ProseNode[] = [];
  let rest = text;
  while (rest) {
    const match = firstTag(rest);
    if (match === null) {
      pushText(nodes, rest);
      break;
    }
    pushText(nodes, rest.slice(0, match.index));
    const tag = match.tag;
    const close = `</${tag}>`;
    const start = match.index + tag.length + 2;
    const end = rest.indexOf(close, start);
    if (end === -1) {
      errors.push(`<${tag}> without ${close}`);
      pushText(nodes, rest.slice(match.index));
      break;
    }
    const inner = rest.slice(start, end);
    if (tag in RAW) {
      nodes.push({ kind: RAW[tag as keyof typeof RAW], text: inner });
    } else {
      const children = leaves(inner, errors);
      nodes.push({ kind: EMPHASIS[tag as keyof typeof EMPHASIS], children });
    }
    rest = rest.slice(end + close.length);
  }
  return { nodes, errors };
}

function firstTag(text: string): { tag: string; index: number } | null {
  OPENING.lastIndex = 0;
  const match = OPENING.exec(text);
  return match ? { tag: match[1]!, index: match.index } : null;
}

// Adentro de un énfasis solo hay hojas: otro énfasis anidado es un error del diccionario.
function leaves(text: string, errors: string[]): ProseLeaf[] {
  const parsed = parseProse(text);
  errors.push(...parsed.errors);
  return parsed.nodes.flatMap((node): readonly ProseLeaf[] => {
    if ('children' in node) {
      errors.push(`<${node.kind === 'strong' ? 'b' : 'i'}> inside another emphasis`);
      return node.children;
    }
    return [node];
  });
}

function pushText(nodes: ProseNode[], text: string): void {
  if (text) {
    nodes.push({ kind: 'text', text });
  }
}

/** El elemento de cada marca. */
const ELEMENTS: Readonly<Record<Exclude<ProseNode['kind'], 'text'>, string>> = {
  strong: 'strong',
  em: 'em',
  code: 'code',
  kbd: 'kbd',
  mono: 'span',
};

/**
 * Widget de prosa: un párrafo, un ítem o una celda cuyo texto viene del diccionario con marcas
 * (`<p [ewmsProse]="'showroom.x' | transloco"></p>`). Arma los nodos con el Renderer: el texto
 * entra siempre como nodo de texto, nunca como HTML.
 */
@Directive({ selector: '[ewmsProse]' })
export class Prose {
  readonly ewmsProse = input.required<string>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly renderer = inject(Renderer2);

  constructor() {
    effect(() => {
      const nodes = parseProse(this.ewmsProse()).nodes;
      for (const child of [...this.host.childNodes]) {
        this.renderer.removeChild(this.host, child);
      }
      for (const node of nodes) {
        this.renderer.appendChild(this.host, this.build(node));
      }
    });
  }

  private build(node: ProseNode): Node {
    if (node.kind === 'text') {
      return this.renderer.createText(node.text) as Node;
    }
    const element = this.renderer.createElement(ELEMENTS[node.kind]) as HTMLElement;
    if ('children' in node) {
      for (const child of node.children) {
        this.renderer.appendChild(element, this.build(child));
      }
    } else {
      this.renderer.addClass(element, 'font-mono');
      this.renderer.appendChild(element, this.renderer.createText(node.text));
    }
    return element;
  }
}
