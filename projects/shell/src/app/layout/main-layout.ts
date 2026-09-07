import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

/**
 * Application chrome (header, navigation, content region).
 * Styling arrives with the design tokens in Fase 1 -- no colours or spacing here.
 */
@Component({
  imports: [RouterLink, RouterOutlet],
  selector: 'app-main-layout',
  templateUrl: './main-layout.html',
})
export class MainLayout {}
