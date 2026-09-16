import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideEwmsI18n } from '@ewms/core';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // The i18n loader reads the dictionaries through HttpClient.
    provideHttpClient(withFetch()),
    provideEwmsI18n(),
  ],
};
