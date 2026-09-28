import { DOCUMENT } from '@angular/common';
import {
  inject,
  Injectable,
  makeEnvironmentProviders,
  provideAppInitializer,
  type EnvironmentProviders,
} from '@angular/core';
import {
  NavigationEnd,
  Router,
  withNavigationErrorHandler,
  type NavigationError,
  type NavigationErrorHandlerFeature,
} from '@angular/router';
import { filter, take } from 'rxjs';

/** La marca de la recarga: en la URL y solo hasta que arranca la app; nada se guarda. */
export const CHUNK_RELOAD_PARAM = 'chunk-reload';

/** El módulo que pidió el router ya no está: hubo un despliegue y el HTML viejo apunta a chunks borrados. */
export function isChunkLoadError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'ChunkLoadError' ||
      /dynamically imported module|Importing a module script failed/.test(error.message))
  );
}

/**
 * Tras un despliegue, navegar a una ruta perezosa pide un chunk que ya no existe. Se recarga
 * **una vez** hacia la ruta pedida; si vuelve a fallar, el error sigue su curso: nunca un bucle.
 */
@Injectable({ providedIn: 'root' })
export class ChunkReload {
  private readonly document = inject(DOCUMENT);
  private reloaded = false;

  /** Al arrancar: si la URL trae la marca, la quita antes de que el router la lea y la recuerda. */
  takeMark(): void {
    const url = new URL(this.document.location.href);
    if (!url.searchParams.has(CHUNK_RELOAD_PARAM)) {
      return;
    }
    this.reloaded = true;
    url.searchParams.delete(CHUNK_RELOAD_PARAM);
    this.document.defaultView?.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  /** La primera navegación que termina bien habilita otra recarga (el siguiente despliegue). */
  settled(): void {
    this.reloaded = false;
  }

  onNavigationError(event: NavigationError): void {
    if (!isChunkLoadError(event.error) || this.reloaded) {
      return;
    }
    const target = new URL(event.url, this.document.baseURI);
    target.searchParams.set(CHUNK_RELOAD_PARAM, '1');
    this.document.location.assign(target.href);
  }
}

/** Para `provideRouter(routes, withChunkReload())`. */
export function withChunkReload(): NavigationErrorHandlerFeature {
  return withNavigationErrorHandler((event) => inject(ChunkReload).onNavigationError(event));
}

/** Quita la marca antes de la navegación inicial y la olvida en cuanto una navegación termina. */
export function provideChunkReload(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAppInitializer(() => {
      const reload = inject(ChunkReload);
      reload.takeMark();
      inject(Router)
        .events.pipe(
          filter((event) => event instanceof NavigationEnd),
          take(1),
        )
        .subscribe(() => reload.settled());
    }),
  ]);
}
