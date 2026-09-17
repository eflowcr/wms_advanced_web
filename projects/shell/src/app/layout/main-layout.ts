import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageSwitcher } from './language-switcher';

/**
 * Application chrome (header, navigation, content region).
 * Styling arrives with the design tokens in DS-1 -- no colours or spacing here.
 */
@Component({
  imports: [LanguageSwitcher, RouterLink, RouterOutlet, TranslocoPipe],
  selector: 'app-main-layout',
  templateUrl: './main-layout.html',
})
export class MainLayout {}
