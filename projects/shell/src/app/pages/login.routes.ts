import { provideEwmsLocale } from '@ewms/core/locale';
import type { Routes } from '@angular/router';

/** La capa pública lleva sus propios formatos de idioma, como la autenticada (shell.routes). */
export const loginRoutes: Routes = [
  {
    path: '',
    providers: [provideEwmsLocale()],
    data: { titleKey: 'shell.login.title' },
    loadComponent: async () => (await import('./login')).Login,
  },
];
