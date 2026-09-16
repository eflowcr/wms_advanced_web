import { Injectable, isDevMode } from '@angular/core';
import { DefaultTranspiler, type TranspileParams } from '@jsverse/transloco';
import { formatIcu, hasIcuSyntax, parseIcu, type IcuPart } from './icu';
import { DEFAULT_LANGUAGE, isLanguage, LANGUAGE_LOCALES } from './language.types';

/**
 * Transloco transpiler: ICU first, then Transloco's own `{{ }}` interpolation.
 *
 * The order is deliberate. ICU runs on the dictionary text only; parameter
 * values are inserted afterwards by DefaultTranspiler, so user data such as a
 * location named "A{1}" is never parsed as ICU.
 *
 * A malformed message or a missing plural parameter throws in development,
 * like a missing key (see missing-handler.ts). In production the raw text is
 * shown instead: odd text is a visible bug, a blank is an invisible one.
 * tools/ci/check-i18n.mjs parses every message, so a malformed one should not
 * reach production at all.
 */
@Injectable()
export class IcuTranspiler extends DefaultTranspiler {
  private locale = LANGUAGE_LOCALES[DEFAULT_LANGUAGE];
  private readonly parsed = new Map<string, readonly IcuPart[]>();

  override transpile(params: TranspileParams): unknown {
    const { value } = params;
    if (typeof value !== 'string' || !hasIcuSyntax(value)) {
      return super.transpile(params);
    }
    let formatted: string;
    try {
      formatted = formatIcu(this.parse(value), params.params ?? {}, this.locale);
    } catch (error) {
      if (isDevMode()) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`i18n: cannot format '${params.key}': ${reason}`, { cause: error });
      }
      formatted = value;
    }
    return super.transpile({ ...params, value: formatted });
  }

  onLangChanged(lang: string): void {
    // Scoped loads report 'scope/lang'; the locale follows the language part.
    const language = lang.split('/').pop();
    this.locale = LANGUAGE_LOCALES[isLanguage(language) ? language : DEFAULT_LANGUAGE];
  }

  private parse(message: string): readonly IcuPart[] {
    let parts = this.parsed.get(message);
    if (!parts) {
      parts = parseIcu(message);
      this.parsed.set(message, parts);
    }
    return parts;
  }
}
