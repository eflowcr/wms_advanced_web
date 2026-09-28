import { HttpClient } from '@angular/common/http';
import {
  inject,
  Injectable,
  makeEnvironmentProviders,
  provideAppInitializer,
  signal,
  type EnvironmentProviders,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';

/**
 * La configuración de ejecución: un artefacto, muchos ambientes (DEV-011), sin secretos en el
 * bundle (Estructura §5). Hoy sin campos: ninguno lo nombra un documento. **(pendiente)**: URL
 * del API, nombre de la cabecera de traza y destino de la telemetría. Ver vault: ADR 0017.
 */
export type RuntimeConfig = Readonly<Record<never, never>>;

/** Los campos que la configuración admite; uno nuevo entra acá con el documento que lo nombra. */
export const RUNTIME_CONFIG_FIELDS: readonly string[] = [];

/** Junto a index.html, relativa a <base href>; el despliegue la reemplaza por ambiente. */
export const RUNTIME_CONFIG_URL = 'config.json';

/** No cargó, o cargó algo que no es la configuración: la app no arranca y el shell lo dice. */
export class RuntimeConfigInvalidError extends Error {
  constructor(readonly reason: string) {
    super(`config: ${reason}; the app cannot start.`);
    this.name = 'RuntimeConfigInvalidError';
  }
}

/** Un objeto JSON con solo los campos conocidos; cualquier otra cosa es inválida. */
export function parseRuntimeConfig(value: unknown): RuntimeConfig {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new RuntimeConfigInvalidError('config.json is not a JSON object');
  }
  const unknown = Object.keys(value).filter((key) => !RUNTIME_CONFIG_FIELDS.includes(key));
  if (unknown.length > 0) {
    throw new RuntimeConfigInvalidError(`unknown field(s) ${unknown.join(', ')}`);
  }
  return value as RuntimeConfig;
}

/** La configuración validada; existe desde que el arranque terminó. */
@Injectable({ providedIn: 'root' })
export class RuntimeConfigStore {
  private readonly http = inject(HttpClient);
  private readonly loaded = signal<RuntimeConfig | null>(null);

  readonly config = this.loaded.asReadonly();

  async load(): Promise<void> {
    let raw: unknown;
    try {
      raw = await firstValueFrom(this.http.get<unknown>(RUNTIME_CONFIG_URL));
    } catch {
      throw new RuntimeConfigInvalidError('config.json could not be loaded');
    }
    this.loaded.set(parseRuntimeConfig(raw));
  }
}

/** Carga y valida al arrancar; requiere provideHttpClient(). Si falla, rechaza el arranque. */
export function provideRuntimeConfig(): EnvironmentProviders {
  return makeEnvironmentProviders([provideAppInitializer(() => inject(RuntimeConfigStore).load())]);
}
