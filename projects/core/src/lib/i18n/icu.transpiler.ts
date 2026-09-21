import { Injectable, isDevMode } from '@angular/core';
import { DefaultTranspiler, type TranspileParams } from '@jsverse/transloco';
import { formatIcu, hasIcuSyntax, parseIcu, type IcuPart } from './icu';
import { DEFAULT_LANGUAGE, isLanguage, LANGUAGE_LOCALES } from './language.types';

/**
 * ICU primero y después la interpolación: así un valor como la ubicación "A{1}" nunca se
 * interpreta como ICU. Un mensaje roto lanza en desarrollo; en producción se muestra crudo.
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
    // Las cargas con scope llegan como 'scope/lang'; el locale sigue a la parte del idioma.
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
