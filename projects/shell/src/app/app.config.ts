import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, TitleStrategy } from '@angular/router';
import {
  provideChunkReload,
  provideEwmsErrorHandling,
  provideEwmsI18n,
  provideRuntimeConfig,
  traceparentInterceptor,
  withChunkReload,
} from '@ewms/core';
import { routes } from './app.routes';
import { CDK_STYLES_FROM_STYLESHEET } from './cdk.providers';
import { EwmsTitleStrategy } from './title.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    // Lo no capturado llega al ErrorHandler, y de ahí al puerto de telemetría (ADR 0017).
    provideBrowserGlobalErrorListeners(),
    provideEwmsErrorHandling(),
    provideRouter(routes, withChunkReload()),
    provideChunkReload(),
    // El loader de i18n y la configuración leen con HttpClient; cada petición lleva su traza.
    provideHttpClient(withFetch(), withInterceptors([traceparentInterceptor])),
    provideRuntimeConfig(),
    provideEwmsI18n(),
    // Título traducido por ruta (WCAG 2.4.2); el `title` de Angular lo congelaría en un idioma.
    { provide: TitleStrategy, useClass: EwmsTitleStrategy },
    CDK_STYLES_FROM_STYLESHEET,
  ],
};
