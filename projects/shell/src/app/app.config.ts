import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, TitleStrategy } from '@angular/router';
import { provideEwmsI18n } from '@ewms/core';
import { routes } from './app.routes';
import { EwmsTitleStrategy } from './title.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // El loader de i18n lee los diccionarios con HttpClient.
    provideHttpClient(withFetch()),
    provideEwmsI18n(),
    // Título traducido por ruta (WCAG 2.4.2); el `title` de Angular lo congelaría en un idioma.
    { provide: TitleStrategy, useClass: EwmsTitleStrategy },
  ],
};
