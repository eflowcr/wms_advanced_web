/*
 * Lee tokens de la página en vivo y hace la matemática de color. Nunca se transcriben valores:
 * el catálogo mentiría el día que se toque tokens.css (Ver vault: Showroom - Especificacion §5.3).
 * Ningún primitivo se nombra acá, ni en comentarios: la compuerta 10 los lee igual.
 */
// La cadena se recorre sobre el CSSOM y no con getComputedStyle, que devuelve el valor ya
// sustituido y pierde a qué primitivo apunta cada semántico; solo el valor final sale de ahí.

/** Un paso del recorrido: un token y el texto con que se declaró. */
export interface TokenLink {
  readonly name: string;
  readonly declared: string;
}

export interface TokenChain {
  readonly name: string;
  /** `missing` se muestra bien visible: un token que nadie declaró es un bug. */
  readonly status: 'resolved' | 'missing';
  /** Del token pedido hasta el primitivo, en orden. */
  readonly links: readonly TokenLink[];
  /** Último token del recorrido si terminó en un primitivo; si no, null. */
  readonly primitive: string | null;
  /** Valor computado por el navegador; vacío si falta. */
  readonly value: string;
}

// Captura la referencia `var(--nombre`, no la función entera. A la compuerta 10 solo le
// molestan las funciones de color.
const VAR_REFERENCE = /var\(\s*(--[\w-]+)/g;

/** Todo token nombrado en un valor declarado. */
export function referencedTokens(declared: string): readonly string[] {
  return [...declared.matchAll(VAR_REFERENCE)]
    .map((match) => match[1])
    .filter((name): name is string => name !== undefined);
}

/** Una declaración sin referencias es, por definición, un primitivo. */
export function isPrimitiveValue(declared: string): boolean {
  return referencedTokens(declared).length === 0;
}

// tokens.css declara todo en un solo `:root` y Tailwind emite los suyos; cualquier otra regla
// (componente, utilidad) no es donde vive un token.
function targetsRoot(selector: string): boolean {
  return selector.split(',').some((part) => {
    const trimmed = part.trim();
    return trimmed === ':root' || trimmed === 'html' || trimmed === ':host';
  });
}

// Duck typing y no `instanceof CSSStyleRule`: el constructor es del window del documento
// y un elemento de otro realm fallaría el chequeo sin culpa de la regla.
function isStyleRule(rule: CSSRule): rule is CSSStyleRule {
  return 'selectorText' in rule && 'style' in rule;
}

function isGroupingRule(rule: CSSRule): rule is CSSGroupingRule {
  return 'cssRules' in rule;
}

function collectFromRules(rules: CSSRuleList, into: Map<string, string>): void {
  for (let index = 0; index < rules.length; index += 1) {
    const rule = rules.item(index);
    if (!rule) {
      continue;
    }
    if (isStyleRule(rule)) {
      if (!targetsRoot(rule.selectorText)) {
        continue;
      }
      const { style } = rule;
      for (let property = 0; property < style.length; property += 1) {
        const name = style.item(property);
        if (name.startsWith('--')) {
          into.set(name, style.getPropertyValue(name).trim());
        }
      }
    } else if (isGroupingRule(rule)) {
      // Tailwind envuelve su salida en `@layer`: los tokens están un nivel adentro.
      collectFromRules(rule.cssRules, into);
    }
  }
}

/** Toda propiedad personalizada declarada en la raíz, con su texto. Gana la última, como en la cascada. */
export function readDeclarations(document: Document): ReadonlyMap<string, string> {
  const declarations = new Map<string, string>();
  const sheets = document.styleSheets;
  for (let index = 0; index < sheets.length; index += 1) {
    try {
      const rules = sheets.item(index)?.cssRules;
      if (rules) {
        collectFromRules(rules, declarations);
      }
    } catch {
      // Una hoja de otro origen lanza al leerla; ninguna nuestra se sirve así y no aporta nada.
    }
  }
  return declarations;
}

/**
 * Recorre un token hasta su primitivo. Se detiene si una declaración nombra más de un token:
 * un compuesto como `--focus-ring-shadow` no tiene un único padre.
 */
export function resolveChain(
  name: string,
  declarations: ReadonlyMap<string, string>,
  value: string,
): TokenChain {
  const links: TokenLink[] = [];
  const seen = new Set<string>();
  let current: string | null = name;

  while (current && !seen.has(current)) {
    seen.add(current);
    const declared = declarations.get(current);
    if (declared === undefined) {
      break;
    }
    links.push({ name: current, declared });
    const references = referencedTokens(declared);
    current = references.length === 1 ? (references[0] ?? null) : null;
  }

  const last = links[links.length - 1];
  if (!last) {
    return { name, status: 'missing', links: [], primitive: null, value: '' };
  }

  return {
    name,
    status: 'resolved',
    links,
    primitive: isPrimitiveValue(last.declared) ? last.name : null,
    value,
  };
}

// ---------------------------------------------------------------------- color

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly alpha: number;
}

/**
 * Convierte cualquier color que acepte el parser CSS en canales, vía un elemento sonda y su
 * estilo computado. Así no hay que conocer sintaxis ni escribir colores literales; lo que el
 * parser rechaza (una sombra, una longitud) devuelve null.
 */
export function parseColor(view: Window, probe: HTMLElement, value: string): Rgb | null {
  probe.style.color = '';
  probe.style.color = value;
  if (!probe.style.color) {
    return null;
  }
  const channels = view.getComputedStyle(probe).color.match(/[\d.]+/g);
  if (!channels || channels.length < 3) {
    return null;
  }
  return {
    r: Number(channels[0]),
    g: Number(channels[1]),
    b: Number(channels[2]),
    alpha: channels.length > 3 ? Number(channels[3]) : 1,
  };
}

/** Compone un color translúcido sobre uno opaco, para que la razón de contraste signifique algo. */
export function composite(foreground: Rgb, background: Rgb): Rgb {
  const mix = (top: number, bottom: number) =>
    top * foreground.alpha + bottom * (1 - foreground.alpha);
  return {
    r: mix(foreground.r, background.r),
    g: mix(foreground.g, background.g),
    b: mix(foreground.b, background.b),
    alpha: 1,
  };
}

/** Luminancia relativa, WCAG 2.x. */
export function luminance(colour: Rgb): number {
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(colour.r) + 0.7152 * channel(colour.g) + 0.0722 * channel(colour.b);
}

/** Razón de contraste WCAG 2.x, con el frente compuesto antes sobre el fondo. */
export function contrastRatio(foreground: Rgb, background: Rgb): number {
  const front = foreground.alpha < 1 ? composite(foreground, background) : foreground;
  const lighter = Math.max(luminance(front), luminance(background));
  const darker = Math.min(luminance(front), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

/** Los dos umbrales AA contra los que juzga el catálogo. */
export const AA_TEXT = 4.5;
export const AA_NON_TEXT = 3;

export type ContrastVerdict = 'pass' | 'fail' | 'exempt';

/**
 * `exempt` no es un `fail` suave: WCAG 1.4.3 exime al control deshabilitado y un divisor
 * decorativo no es control. Marcarlos como falla enseñaría a ignorar la columna.
 */
export function verdict(ratio: number, minimum: number, exempt: boolean): ContrastVerdict {
  if (exempt) {
    return 'exempt';
  }
  return ratio >= minimum ? 'pass' : 'fail';
}

/** La razón con la precisión con que la registra el vault. */
export function formatRatio(ratio: number): string {
  return `${ratio.toFixed(2)}:1`;
}
