import { ApplicationInitStatus, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router, TitleStrategy } from '@angular/router';
import { provideI18nTesting } from '@ewms/testing';
import { BRAND_NAME } from './brand';
import { DICTIONARIES } from './i18n.testing';
import { EwmsTitleStrategy } from './title.strategy';

@Component({ selector: 'app-blank', template: '' })
class Blank {}

/**
 * Every route has a title, and it is translated (WCAG 2.4.2).
 *
 * The thing worth defending is not that a title is set -- Angular does that --
 * but that the title follows the DICTIONARY. A route carrying a finished
 * string would leave the browser tab in whichever language it was written in,
 * which is the one string the rest of the interface cannot fix on a language
 * change.
 */
describe('EwmsTitleStrategy', () => {
  let router: Router;
  let title: Title;

  beforeEach(async () => {
    // Spanish, through the browser language, exactly as startup resolves it.
    vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('es-CR');
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
    router = TestBed.inject(Router);
    title = TestBed.inject(Title);
    await router.navigateByUrl('/');
  });

  afterEach(() => vi.restoreAllMocks());

  it('puts the screen FIRST and the product second', async () => {
    // A tab strip truncates from the right, and what tells two tabs apart is
    // the screen's name, not the product's.
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
