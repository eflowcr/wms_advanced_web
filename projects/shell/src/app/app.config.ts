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
    // The i18n loader reads the dictionaries through HttpClient.
    provideHttpClient(withFetch()),
    provideEwmsI18n(),
    /*
     * Every route gets a translated document title (WCAG 2.4.2). Angular's own
     * `title` takes a string, which would freeze the tab in one language.
     */
    { provide: TitleStrategy, useClass: EwmsTitleStrategy },
  ],
};
