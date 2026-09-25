import { Component, EnvironmentInjector, inject, Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  DialogService,
  EWMS_FAVORITE_LABELS,
  EWMS_FORM_MESSAGES,
  EWMS_SHORTCUT_MAP,
  EWMS_TABLE_MESSAGES,
  type FavoriteLabelResolver,
} from '@ewms/design-system';
import { provideI18nTesting } from '@ewms/testing';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { provideShipmentCodeMessage, SHIPMENT_CODE } from './pages/patterns/expedicion.rules';
import { provideShowroomDesignSystem } from './showroom.providers';
import {
  loadShowroomScope,
  provideDesignSystemTextsTesting,
  SHOWROOM_DICTIONARIES,
  useSpanishBrowser,
} from './showroom.testing';
import { SHOWROOM_SHORTCUT_MAP } from './shortcuts.map';

async function start(): Promise<EnvironmentInjector> {
  useSpanishBrowser();
  TestBed.configureTestingModule({
    providers: [provideI18nTesting(SHOWROOM_DICTIONARIES), provideDesignSystemTextsTesting()],
  });
  await loadShowroomScope();
  return TestBed.inject(EnvironmentInjector);
}

/** Cambia de idioma con el diccionario del catálogo ya cargado, como hace `LanguageService`. */
async function switchTo(lang: 'es' | 'en'): Promise<void> {
  const transloco = TestBed.inject(TranslocoService);
  await firstValueFrom(transloco.load(lang));
  await firstValueFrom(transloco.load(`showroom/${lang}`));
  transloco.setActiveLang(lang);
}

describe('provideShowroomDesignSystem', () => {
  afterEach(() => vi.restoreAllMocks());

  it('leaves the design-system texts to the application: it provides no EWMS_*_MESSAGES', () => {
    const alone = Injector.create({ providers: provideShowroomDesignSystem() });
    expect(alone.get(EWMS_TABLE_MESSAGES, null)).toBeNull();
    expect(alone.get(EWMS_FORM_MESSAGES, null)).toBeNull();
  });

  it('keeps its own shortcut map, which registers `create` without the shell', () => {
    const alone = Injector.create({ providers: provideShowroomDesignSystem() });
    expect(alone.get(EWMS_SHORTCUT_MAP)).toBe(SHOWROOM_SHORTCUT_MAP);
  });
});

// Nombre de un favorito en la barra del catálogo (REQ-FE-DS4-002 v1.3). Dos inyectores, como en
// la aplicación: el resolvedor del shell arriba y el del catálogo abajo, preguntando hacia arriba.
describe("the showroom's favourite labels", () => {
  const BUTTON = '/design-system/components/button';

  afterEach(() => vi.restoreAllMocks());

  function resolverUnder(
    environment: EnvironmentInjector,
    parent?: FavoriteLabelResolver,
  ): FavoriteLabelResolver {
    const above = Injector.create({
      providers: parent === undefined ? [] : [{ provide: EWMS_FAVORITE_LABELS, useValue: parent }],
      parent: environment,
    });
    return Injector.create({ providers: provideShowroomDesignSystem(), parent: above }).get(
      EWMS_FAVORITE_LABELS,
    );
  }

  const application: FavoriteLabelResolver = {
    labelFor: (route) => signal(route === '/catalogos/articulos' ? 'Artículos' : '').asReadonly(),
    iconFor: (route) => (route === '/catalogos/articulos' ? 'package' : null),
  };

  it('names a catalogue page by its entry, whatever is above', async () => {
    const environment = await start();
    expect(resolverUnder(environment).labelFor(BUTTON)()).toBe('Botón');
    expect(resolverUnder(environment, application).labelFor(BUTTON)()).toBe('Botón');
    // El catálogo no tiene íconos propios: el bloque dibuja el neutro.
    expect(resolverUnder(environment, application).iconFor(BUTTON)).toBeNull();
  });

  it('follows the language, without being asked again', async () => {
    const environment = await start();
    const label = resolverUnder(environment).labelFor(BUTTON);

    await switchTo('en');

    expect(label()).toBe('Button');
  });

  it("asks the application for a screen that is not the catalogue's", async () => {
    const labels = resolverUnder(await start(), application);
    expect(labels.labelFor('/catalogos/articulos')()).toBe('Artículos');
    expect(labels.iconFor('/catalogos/articulos')).toBe('package');
  });

  it('alone, an unknown route resolves to nothing -- and the block shows the route', async () => {
    const labels = resolverUnder(await start());
    expect(labels.labelFor('/no-existe')()).toBe('');
    expect(labels.iconFor('/no-existe')).toBeNull();
  });
});

// Donde se usa: en el componente del formulario, en la página o dentro de un diálogo.
@Component({ template: '', providers: [provideShipmentCodeMessage()] })
class UsesShipmentCode {
  readonly messages = inject(EWMS_FORM_MESSAGES);
}

describe('el mensaje del código de expedición', () => {
  afterEach(() => vi.restoreAllMocks());

  it('suma su kind a los mensajes de arriba, sin tocar el resto', async () => {
    const environment = await start();
    const above = environment.get(EWMS_FORM_MESSAGES);
    const messages = TestBed.createComponent(UsesShipmentCode).componentInstance.messages;

    expect(messages.errors[SHIPMENT_CODE]?.(null)).toBe('El código tiene la forma EXP-2026-0000');
    expect(messages.errors.required(null)).toBe(above.errors.required(null));
    expect(messages.customError(null)).toBe(above.customError(null));
    expect(messages.errorSummary(3)).toBe(above.errorSummary(3));
    expect(messages.errorSummaryLabel).toBe(above.errorSummaryLabel);
    expect(messages.requiredLegend).toBe(above.requiredLegend);
  });

  it('sigue al idioma: no copia los textos del momento', async () => {
    await start();
    const messages = TestBed.createComponent(UsesShipmentCode).componentInstance.messages;

    await switchTo('en');

    expect(messages.errors[SHIPMENT_CODE]?.(null)).toBe('The code looks like EXP-2026-0000');
  });

  // Como en la aplicación: los textos del sistema los provee el layout, no la raíz, y Alt+N abre el
  // formulario en un diálogo. Sin el inyector de la pantalla el formulario no llegaba a abrirse.
  it('también dentro de un diálogo abierto con el inyector de la pantalla', async () => {
    useSpanishBrowser();
    TestBed.configureTestingModule({ providers: [provideI18nTesting(SHOWROOM_DICTIONARIES)] });
    await loadShowroomScope();

    @Component({ template: '', providers: [provideDesignSystemTextsTesting()] })
    class Screen {
      readonly injector = inject(Injector);
    }

    const screen = TestBed.createComponent(Screen).componentInstance;
    const ref = TestBed.inject(DialogService).open<void, undefined, UsesShipmentCode>(
      UsesShipmentCode,
      { injector: screen.injector },
    );
    const messages = ref.componentInstance!.messages;

    expect(messages.errors[SHIPMENT_CODE]?.(null)).toBe('El código tiene la forma EXP-2026-0000');
    expect(messages.errors.required(null)).toBe('Este campo es obligatorio');
    ref.close();
  });
});
