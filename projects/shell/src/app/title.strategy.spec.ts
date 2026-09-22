import { ApplicationInitStatus, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router, TitleStrategy } from '@angular/router';
import { LanguageService } from '@ewms/core';
import { provideI18nTesting } from '@ewms/testing';
import { BRAND_NAME } from './brand';
import { DICTIONARIES } from './i18n.testing';
import { EwmsTitleStrategy } from './title.strategy';

@Component({ selector: 'app-blank', template: '' })
class Blank {}

/**
 * Lo que se defiende no es que haya título (eso lo hace Angular) sino que siga al diccionario
 * al cambiar de idioma (WCAG 2.4.2).
 */
describe('EwmsTitleStrategy', () => {
  let router: Router;
  let title: Title;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(DICTIONARIES),
        provideRouter([
          { path: '', component: Blank, data: { titleKey: 'shell.menu.dashboard' } },
          {
            path: 'catalogos',
            component: Blank,
            data: { titleKey: 'shell.menu.catalogs' },
            children: [
              {
                path: 'articulos',
                component: Blank,
                data: { titleKey: 'shell.menu.articles' },
              },
              { path: 'sin-titulo', component: Blank },
            ],
          },
          { path: 'suelta', component: Blank },
        ]),
        { provide: TitleStrategy, useClass: EwmsTitleStrategy },
      ],
    });
    await TestBed.inject(ApplicationInitStatus).donePromise;
    // El idioma se fija acá: por el navegador, la prueba seguía al idioma de la máquina.
    await TestBed.inject(LanguageService).use('es');
    router = TestBed.inject(Router);
    title = TestBed.inject(Title);
    await router.navigateByUrl('/');
  });

  it('puts the screen FIRST and the product second', async () => {
    // La pestaña trunca por la derecha: lo que distingue dos es el nombre de la pantalla.
    expect(title.getTitle()).toBe(`Dashboard · ${BRAND_NAME}`);
  });

  it('takes the DEEPEST title, because a child is more specific than its parent', async () => {
    await router.navigateByUrl('/catalogos/articulos');

    expect(title.getTitle()).toBe(`Artículos · ${BRAND_NAME}`);
  });

  it('falls back to the nearest ancestor that declared one', async () => {
    await router.navigateByUrl('/catalogos/sin-titulo');

    expect(title.getTitle()).toBe(`Catálogos · ${BRAND_NAME}`);
  });

  it('a route with no title anywhere is the product alone, never a blank tab', async () => {
    await router.navigateByUrl('/suelta');

    expect(title.getTitle()).toBe(BRAND_NAME);
  });
});
