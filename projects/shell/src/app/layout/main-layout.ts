import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ToastOutlet } from '@ewms/design-system';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageSwitcher } from './language-switcher';

/**
 * Application chrome (header, navigation, content region).
 * Styling arrives with the design tokens in DS-1 -- no colours or spacing here.
 *
 * It also mounts the application's ONE `<ewms-toast-outlet>`. Here and not in
 * `App` because this is the component every routed page renders inside, and
 * the outlet has to outlive a route change: a toast raised by a save that
 * navigates away has to survive the navigation it triggered.
 */
@Component({
  imports: [LanguageSwitcher, RouterLink, RouterOutlet, ToastOutlet, TranslocoPipe],
  selector: 'app-main-layout',
  templateUrl: './main-layout.html',
})
export class MainLayout {}
