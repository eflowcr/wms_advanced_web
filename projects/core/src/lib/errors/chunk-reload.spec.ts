import { DOCUMENT } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { ApplicationInitStatus, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationError, provideRouter, Router } from '@angular/router';
import {
  CHUNK_RELOAD_PARAM,
  ChunkReload,
  isChunkLoadError,
  provideChunkReload,
  withChunkReload,
} from './chunk-reload';

/** El `document` justo lo que la recarga usa: dónde está, adónde va y su historial. */
function fakeDocument(href: string) {
  const assigned: string[] = [];
  const replaced: string[] = [];
  const document = {
    baseURI: 'http://localhost/',
    location: { href, assign: (url: string) => assigned.push(url) },
    defaultView: { history: { replaceState: (_: unknown, __: string, url: string) => replaced.push(url) } },
  };
  return { document, assigned, replaced };
}

function reloadFor(href: string) {
  const fake = fakeDocument(href);
  TestBed.configureTestingModule({ providers: [{ provide: DOCUMENT, useValue: fake.document }] });
  return { reload: TestBed.inject(ChunkReload), ...fake };
}

const chunkGone = () => new TypeError('Failed to fetch dynamically imported module: http://localhost/chunk-OLD.js');
const failed = (url: string, error: unknown) => new NavigationError(1, url, error);

describe('ChunkReload', () => {
  it('a failed import reloads ONCE, towards the route that was asked for', () => {
    const { reload, assigned } = reloadFor('http://localhost/');

    reload.onNavigationError(failed('/design-system/components/table?q=1', chunkGone()));

    expect(assigned).toEqual([`http://localhost/design-system/components/table?q=1&${CHUNK_RELOAD_PARAM}=1`]);
  });

  it('after that reload, the same failure does not reload again: never a loop', () => {
    const { reload, assigned, replaced } = reloadFor(
      `http://localhost/design-system/components/table?q=1&${CHUNK_RELOAD_PARAM}=1#top`,
    );

    reload.takeMark();
    reload.onNavigationError(failed('/design-system/components/table', chunkGone()));

    expect(assigned).toEqual([]);
    // La marca sale de la URL antes de que el router la lea.
    expect(replaced).toEqual(['/design-system/components/table?q=1#top']);
  });

  it('once a navigation has landed, a later deploy may reload again', () => {
    const { reload, assigned } = reloadFor(`http://localhost/?${CHUNK_RELOAD_PARAM}=1`);

    reload.takeMark();
    reload.settled();
    reload.onNavigationError(failed('/catalogos/articulos', chunkGone()));

    expect(assigned).toHaveLength(1);
  });

  it('any other navigation error is not its business', () => {
    const { reload, assigned } = reloadFor('http://localhost/');

    reload.onNavigationError(failed('/x', new Error('guard said no')));
    reload.onNavigationError(failed('/x', 'not even an error'));

    expect(assigned).toEqual([]);
  });

  it('a start without the mark leaves the URL alone', () => {
    const { reload, replaced } = reloadFor('http://localhost/catalogos?page=2');

    reload.takeMark();

    expect(replaced).toEqual([]);
  });
});

@Component({ template: '' })
class Landing {}

describe('wired into the router', () => {
  it('a lazy route whose chunk is gone reloads once, and not while the mark is fresh', async () => {
    const fake = fakeDocument(`http://localhost/?${CHUNK_RELOAD_PARAM}=1`);
    TestBed.configureTestingModule({
      providers: [
        { provide: DOCUMENT, useValue: fake.document },
        provideLocationMocks(),
        provideRouter(
          [
            { path: '', component: Landing },
            { path: 'gone', loadComponent: () => Promise.reject(chunkGone()) },
          ],
          withChunkReload(),
        ),
        provideChunkReload(),
      ],
    });
    await TestBed.inject(ApplicationInitStatus).donePromise;
    const router = TestBed.inject(Router);

    // Recién recargada: la marca salió de la URL y la ruta que vuelve a fallar no recarga.
    expect(fake.replaced).toEqual(['/']);
    await expect(router.navigateByUrl('/gone')).rejects.toThrow(/dynamically imported/);
    expect(fake.assigned).toEqual([]);

    // Una navegación que aterriza habilita la recarga del próximo despliegue.
    await router.navigateByUrl('/');
    await expect(router.navigateByUrl('/gone')).rejects.toThrow(/dynamically imported/);
    expect(fake.assigned).toEqual([`http://localhost/gone?${CHUNK_RELOAD_PARAM}=1`]);
  });
});

describe('isChunkLoadError', () => {
  it('recognises the wording of Chromium, Firefox, Safari and webpack', () => {
    expect(isChunkLoadError(chunkGone())).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module: x.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    const webpack = new Error('Loading chunk 7 failed.');
    webpack.name = 'ChunkLoadError';
    expect(isChunkLoadError(webpack)).toBe(true);
  });

  it('and nothing else', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch'))).toBe(false);
    expect(isChunkLoadError('dynamically imported module')).toBe(false);
  });
});
