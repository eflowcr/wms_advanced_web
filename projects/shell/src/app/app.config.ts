import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  computed,
  EnvironmentInjector,
  inject,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, TitleStrategy } from '@angular/router';
import {
  provideChunkReload,
  provideEwmsErrorHandling,
  provideEwmsI18n,
  provideRuntimeConfig,
  RuntimeConfigStore,
  traceparentInterceptor,
  withChunkReload,
} from '@ewms/core';
import {
  authInterceptor,
  SECURITY_API_URL,
  securityAccessInterceptor,
  STEP_UP,
} from '@ewms/core/security';
import { DEMO_HTTP_INTERCEPTORS } from './demo-mode';
import { routes } from './app.routes';
import { CDK_STYLES_FROM_STYLESHEET } from './cdk.providers';
import { DICTIONARY_VERSIONS } from './dictionary-versions.generated';
import { EwmsTitleStrategy } from './title.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    // Lo no capturado llega al ErrorHandler, y de ahí al puerto de telemetría (ADR 0017).
    provideBrowserGlobalErrorListeners(),
    provideEwmsErrorHandling(),
    provideRouter(routes, withChunkReload()),
    provideChunkReload(),
    // El loader de i18n y la configuración leen con HttpClient; cada petición lleva su traza.
    provideHttpClient(
      withFetch(),
      withInterceptors([
        traceparentInterceptor,
        authInterceptor,
        securityAccessInterceptor,
        ...DEMO_HTTP_INTERCEPTORS,
      ]),
    ),
    provideRuntimeConfig(),
    // La URL del Security Core sale de config.json, por ambiente; es la propuesta de 05-API.
    {
      provide: SECURITY_API_URL,
      useFactory: () => {
        const runtime = inject(RuntimeConfigStore);
        return computed(() => runtime.config()?.securityApiUrl);
      },
    },
    // El diálogo del segundo factor carga con el primer desafío, fuera de la ruta crítica (ADR 0026).
    {
      provide: STEP_UP,
      useFactory: () => {
        const injector = inject(EnvironmentInjector);
        return async (challenge: string) =>
          (await import('./step-up/step-up-dialog')).verifySecondFactor(injector, challenge);
      },
    },
    // Cada diccionario con la huella de su contenido en la URL: ningún caché sirve uno viejo.
    provideEwmsI18n({ versions: DICTIONARY_VERSIONS }),
    // Título traducido por ruta (WCAG 2.4.2); el `title` de Angular lo congelaría en un idioma.
    { provide: TitleStrategy, useClass: EwmsTitleStrategy },
    CDK_STYLES_FROM_STYLESHEET,
  ],
};
