/**
 * Reading tokens out of the running page, and the colour maths the catalogue
 * needs on top of them.
 *
 * WHY THE VALUES ARE NEVER WRITTEN DOWN HERE
 *
 * A catalogue that transcribes token values starts lying the day somebody
 * edits tokens.css. It already happened in this project, one layer up: six
 * component sheets in the vault carried `--color-border-strong` next to a hex
 * that had gone stale, and the stale one failed contrast. There it was fixed
 * by deleting the column. Here it is fixed by never writing the value at all.
 *
 * WHY THE CHAIN NEEDS THE CSSOM AND NOT getComputedStyle
 *
 * `getComputedStyle(root).getPropertyValue('--color-text-primary')` hands back
 * the SUBSTITUTED value, so the answer is the final colour and the chain is
 * gone: you cannot tell which primitive a semantic points at, and that arrow
 * is the whole concept of the two layers. The declared text -- the literal
 * `var(...)` naming the primitive -- only exists in the stylesheet, so the
 * chain is walked over the CSSOM and only the last value is taken from the
 * computed style.
 *
 * (No primitive is named anywhere in this file, comments included: gate 10
 * reads a name in a comment exactly as it reads one in code, and it is right
 * to -- a name written down here is a name that can go stale.)
 */

/** One step of the walk: a token and the text it was declared with. */
export interface TokenLink {
  readonly name: string;
  readonly declared: string;
}

export interface TokenChain {
  readonly name: string;
  /** `missing` is rendered, loudly. A token nobody declared is a bug worth seeing. */
  readonly status: 'resolved' | 'missing';
  /** From the token asked for down to the primitive, in order. */
  readonly links: readonly TokenLink[];
  /** The last token of the walk when it ended on a primitive, else null. */
  readonly primitive: string | null;
  /** The computed value, substituted by the browser. Empty when missing. */
  readonly value: string;
}

/**
 * `var(--name` — the reference, not the whole function. Written as a character
 * class rather than the literal three letters followed by a parenthesis so it
 * reads as what it matches; either spelling is fine for gate 10, which only
 * objects to the colour functions.
 */
const VAR_REFERENCE = /var\(\s*(--[\w-]+)/g;

/** Every token named anywhere in a declared value. */
export function referencedTokens(declared: string): readonly string[] {
  return [...declared.matchAll(VAR_REFERENCE)]
    .map((match) => match[1])
    .filter((name): name is string => name !== undefined);
}

/** A declaration with no reference in it is, by definition, a primitive. */
export function isPrimitiveValue(declared: string): boolean {
  return referencedTokens(declared).length === 0;
}

/**
 * Whether a rule targets the root. tokens.css declares everything on a single
 * `:root`, and Tailwind emits its own `:root` blocks too; anything else (a
 * component rule, a utility) is not where a token lives.
 */
function targetsRoot(selector: string): boolean {
  return selector.split(',').some((part) => {
    const trimmed = part.trim();
    return trimmed === ':root' || trimmed === 'html' || trimmed === ':host';
  });
}

/**
 * Duck typing rather than `instanceof CSSStyleRule`: the constructor belongs to
 * the document's own window, and an element rendered inside another realm
 * would fail the check for a reason that has nothing to do with the rule.
 */
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
      // Tailwind wraps its output in `@layer`, so the tokens sit one level in.
      collectFromRules(rule.cssRules, into);
    }
  }
}

/**
 * Every custom property declared on the root, with the text it was written
 * with. Later declarations win, which is what the cascade does anyway.
 */
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
      // A cross-origin sheet throws on access. Nothing of ours is served that
      // way, and a sheet we cannot read simply contributes nothing.
    }
  }
  return declarations;
}

/**
 * Walks a token down to its primitive.
 *
 * The walk stops when a declaration names more than one token: a composite
 * such as `--focus-ring-shadow` has no single parent, and inventing one would
 * be a worse answer than showing the declaration as written.
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

// --------------------------------------------------------------------- colour

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly alpha: number;
}

/**
 * Turns any colour the CSS parser accepts into channels, by letting the parser
 * do it: the value is assigned to a probe element and read back from its
 * computed style, which the browser has already normalised.
 *
 * Doing it this way means the catalogue never has to know the colour syntaxes
 * tokens.css happens to use today, and keeps every literal colour out of this
 * file. A value the parser rejects -- a shadow, a length -- leaves the
 * property empty and comes back as null.
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

/** Lays a translucent colour over an opaque one, so the ratio means something. */
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

/** WCAG 2.x relative luminance. */
export function luminance(colour: Rgb): number {
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(colour.r) + 0.7152 * channel(colour.g) + 0.0722 * channel(colour.b);
}

/** WCAG 2.x contrast ratio, foreground composited over the background first. */
export function contrastRatio(foreground: Rgb, background: Rgb): number {
  const front = foreground.alpha < 1 ? composite(foreground, background) : foreground;
  const lighter = Math.max(luminance(front), luminance(background));
  const darker = Math.min(luminance(front), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

/** The two thresholds the catalogue judges against. */
export const AA_TEXT = 4.5;
export const AA_NON_TEXT = 3;

export type ContrastVerdict = 'pass' | 'fail' | 'exempt';

/**
 * `exempt` is not a softer `fail`. WCAG 1.4.3 exempts a disabled control, and
 * a decorative divider is not a control at all: marking those as failures
 * would train everyone to ignore the column.
 */
export function verdict(ratio: number, minimum: number, exempt: boolean): ContrastVerdict {
  if (exempt) {
    return 'exempt';
  }
  return ratio >= minimum ? 'pass' : 'fail';
}

/** One decimal is the precision the vault records and argues about. */
export function formatRatio(ratio: number): string {
  return `${ratio.toFixed(2)}:1`;
}
