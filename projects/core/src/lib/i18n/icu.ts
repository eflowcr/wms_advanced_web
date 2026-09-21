/**
 * Intérprete ICU sin eval (ADR 0008): transloco-messageformat usa `new Function` y la CSP sin
 * 'unsafe-eval' lo rompe. Soporta plural (=N, offset), selectordinal, select, `#` y escapes con
 * apóstrofo; rechaza argumentos sueltos, number y date. Ver vault: 08-Sistema-de-Diseno/i18n.
 */
// Sin dependencias y solo sintaxis borrable: check-i18n.mjs importa este archivo con el type
// stripping de Node, así la compuerta y la ejecución no discrepan sobre la gramática.

export class IcuError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IcuError';
  }
}

export type IcuPart = string | IcuPound | IcuChoice;

export interface IcuPound {
  readonly kind: 'pound';
}

export interface IcuChoice {
  readonly kind: 'plural' | 'selectordinal' | 'select';
  readonly arg: string;
  readonly offset: number;
  readonly options: ReadonlyMap<string, readonly IcuPart[]>;
}

const PLURAL_CATEGORIES = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);
const IDENTIFIER = /[A-Za-z_][\w.]*/y;
const SELECT_KEY = /[\w-]+/y;
const EXACT_KEY = /=-?\d+(?:\.\d+)?/y;
const OFFSET = /offset:\s*(\d+)/y;

/** Parte un mensaje en texto literal, marcas `#` y bloques de elección. */
export function parseIcu(message: string): readonly IcuPart[] {
  return new Parser(message).parse();
}

/** Si el mensaje tiene algo para el intérprete ICU. */
export function hasIcuSyntax(message: string): boolean {
  return /[{}'#]/.test(message.replace(/\{\{[^{}]*\}\}/g, ''));
}

class Parser {
  private pos = 0;
  private readonly message: string;

  constructor(message: string) {
    this.message = message;
  }

  parse(): readonly IcuPart[] {
    const parts = this.parseMessage(0, false);
    if (this.pos < this.message.length) {
      this.fail(`unmatched '}'`);
    }
    return parts;
  }

  private parseMessage(depth: number, inPlural: boolean): IcuPart[] {
    const parts: IcuPart[] = [];
    let text = '';
    const flush = (): void => {
      if (text) {
        parts.push(text);
        text = '';
      }
    };

    while (this.pos < this.message.length) {
      const char = this.message.charAt(this.pos);
      const next = this.message.charAt(this.pos + 1);

      if (char === "'") {
        text += this.readApostrophe(next, inPlural);
      } else if (char === '{' && next === '{') {
        const end = this.message.indexOf('}}', this.pos + 2);
        if (end === -1) {
          this.fail(`'{{' without its closing '}}'`);
        }
        text += this.message.slice(this.pos, end + 2);
        this.pos = end + 2;
      } else if (char === '{') {
        flush();
        parts.push(this.parseChoice(inPlural));
      } else if (char === '}') {
        if (depth === 0) {
          this.fail(`unmatched '}'`);
        }
        break;
      } else if (char === '#' && inPlural) {
        flush();
        parts.push({ kind: 'pound' });
        this.pos += 1;
      } else {
        text += char;
        this.pos += 1;
      }
    }

    flush();
    return parts;
  }

  private readApostrophe(next: string, inPlural: boolean): string {
    if (next === "'") {
      this.pos += 2;
      return "'";
    }
    const opensQuote = next === '{' || next === '}' || (next === '#' && inPlural);
    if (!opensQuote) {
      this.pos += 1;
      return "'";
    }
    let quoted = '';
    this.pos += 1;
    while (this.pos < this.message.length) {
      const char = this.message.charAt(this.pos);
      if (char === "'") {
        if (this.message.charAt(this.pos + 1) === "'") {
          quoted += "'";
          this.pos += 2;
          continue;
        }
        this.pos += 1;
        return quoted;
      }
      quoted += char;
      this.pos += 1;
    }
    return this.fail('quoted text without its closing apostrophe');
  }

  private parseChoice(inPlural: boolean): IcuChoice {
    const start = this.pos;
    this.pos += 1;
    this.skipSpace();
    const arg = this.read(IDENTIFIER, 'an argument name after "{"');
    this.skipSpace();

    if (this.message.charAt(this.pos) === '}') {
      this.pos = start;
      this.fail(`bare argument '{${arg}}'. Parameters are written {{ ${arg} }}`);
    }
    this.expect(',');
    this.skipSpace();
    const kind = this.read(IDENTIFIER, 'plural, selectordinal or select');
    if (kind !== 'plural' && kind !== 'selectordinal' && kind !== 'select') {
      this.pos = start;
      this.fail(
        `unsupported argument type '${kind}'. Only plural, selectordinal and select are ` +
          'interpreted; format numbers and dates with the transloco-locale pipes',
      );
    }
    this.skipSpace();
    this.expect(',');
    this.skipSpace();

    let offset = 0;
    if (kind !== 'select') {
      OFFSET.lastIndex = this.pos;
      const match = OFFSET.exec(this.message);
      if (match) {
        offset = Number(match[1]);
        this.pos = OFFSET.lastIndex;
      }
    }

    const numeric = kind !== 'select';
    const options = new Map<string, readonly IcuPart[]>();
    for (;;) {
      this.skipSpace();
      if (this.pos >= this.message.length) {
        this.fail(`'{${arg}, ${kind}' without its closing '}'`);
      }
      if (this.message.charAt(this.pos) === '}') {
        this.pos += 1;
        break;
      }
      const key = this.readSelector(numeric);
      if (options.has(key)) {
        this.fail(`duplicate selector '${key}' in '${arg}'`);
      }
      this.skipSpace();
      this.expect('{');
      const branch = this.parseMessage(1, numeric || inPlural);
      this.expect('}');
      options.set(key, branch);
    }

    if (!options.has('other')) {
      this.pos = start;
      this.fail(`'{${arg}, ${kind}}' has no 'other' branch`);
    }
    return { kind, arg, offset, options };
  }

  private readSelector(numeric: boolean): string {
    if (numeric) {
      EXACT_KEY.lastIndex = this.pos;
      const exact = EXACT_KEY.exec(this.message);
      if (exact) {
        this.pos = EXACT_KEY.lastIndex;
        return exact[0];
      }
    }
    const key = this.read(SELECT_KEY, 'a selector');
    if (numeric && !PLURAL_CATEGORIES.has(key)) {
      this.fail(`'${key}' is not a plural category (zero, one, two, few, many, other) nor =N`);
    }
    return key;
  }

  private read(pattern: RegExp, what: string): string {
    pattern.lastIndex = this.pos;
    const match = pattern.exec(this.message);
    if (!match) {
      this.fail(`expected ${what}`);
    }
    this.pos = pattern.lastIndex;
    return match[0];
  }

  private expect(char: string): void {
    if (this.message.charAt(this.pos) !== char) {
      this.fail(`expected '${char}'`);
    }
    this.pos += 1;
  }

  private skipSpace(): void {
    while (/\s/.test(this.message.charAt(this.pos))) {
      this.pos += 1;
    }
  }

  private fail(reason: string): never {
    throw new IcuError(`${reason} (at ${this.pos} in "${this.message}")`);
  }
}

const numberFormats = new Map<string, Intl.NumberFormat>();
const pluralRules = new Map<string, Intl.PluralRules>();

/** `#` usa el formato numérico del locale; la categoría plural sale de Intl.PluralRules. */
export function formatIcu(
  parts: readonly IcuPart[],
  params: Readonly<Record<string, unknown>>,
  locale: string,
): string {
  return render(parts, params, locale, undefined);
}

function render(
  parts: readonly IcuPart[],
  params: Readonly<Record<string, unknown>>,
  locale: string,
  pound: number | undefined,
): string {
  let out = '';
  for (const part of parts) {
    if (typeof part === 'string') {
      out += part;
    } else if (part.kind === 'pound') {
      out += pound === undefined ? '#' : numberFormat(locale).format(pound);
    } else if (part.kind === 'select') {
      const value = param(params, part.arg);
      const branch = part.options.get(String(value)) ?? part.options.get('other') ?? [];
      out += render(branch, params, locale, pound);
    } else {
      const raw = param(params, part.arg);
      const value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new IcuError(`'${part.arg}' must be a number for ${part.kind}, got ${String(raw)}`);
      }
      const shifted = value - part.offset;
      const exact = part.options.get(`=${value}`);
      const branch =
        exact ??
        part.options.get(rules(locale, part.kind).select(shifted)) ??
        part.options.get('other') ??
        [];
      out += render(branch, params, locale, shifted);
    }
  }
  return out;
}

function param(params: Readonly<Record<string, unknown>>, path: string): unknown {
  let value: unknown = params;
  for (const segment of path.split('.')) {
    value =
      value !== null && typeof value === 'object'
        ? (value as Record<string, unknown>)[segment]
        : undefined;
  }
  if (value === undefined || value === null) {
    throw new IcuError(`missing parameter '${path}'`);
  }
  return value;
}

function numberFormat(locale: string): Intl.NumberFormat {
  let format = numberFormats.get(locale);
  if (!format) {
    format = new Intl.NumberFormat(locale);
    numberFormats.set(locale, format);
  }
  return format;
}

function rules(locale: string, kind: 'plural' | 'selectordinal'): Intl.PluralRules {
  const cacheKey = `${locale}|${kind}`;
  let rule = pluralRules.get(cacheKey);
  if (!rule) {
    rule = new Intl.PluralRules(locale, { type: kind === 'plural' ? 'cardinal' : 'ordinal' });
    pluralRules.set(cacheKey, rule);
  }
  return rule;
}
