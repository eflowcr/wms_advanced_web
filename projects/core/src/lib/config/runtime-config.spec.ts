import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  parseRuntimeConfig,
  RUNTIME_CONFIG_FIELDS,
  RUNTIME_CONFIG_URL,
  RuntimeConfigInvalidError,
  RuntimeConfigStore,
} from './runtime-config';

describe('parseRuntimeConfig', () => {
  it('accepts a JSON object with only the fields it knows', () => {
    expect(parseRuntimeConfig({})).toEqual({});
  });

  it('knows the Security Core URL, the field that 05-API names', () => {
    expect(RUNTIME_CONFIG_FIELDS).toEqual(['securityApiUrl']);
    expect(parseRuntimeConfig({ securityApiUrl: '/api/v1/security' })).toEqual({
      securityApiUrl: '/api/v1/security',
    });
  });

  it('rejects a Security Core URL that is not a non-empty text', () => {
    for (const value of [42, '', null, ['/api']]) {
      expect(() => parseRuntimeConfig({ securityApiUrl: value }), JSON.stringify(value)).toThrow(
        /securityApiUrl/,
      );
    }
  });

  it('rejects a field it does not know, a typo included', () => {
    expect(() => parseRuntimeConfig({ apiUrl: 'https://x' })).toThrow(RuntimeConfigInvalidError);
    expect(() => parseRuntimeConfig({ apiUrl: 'https://x' })).toThrow(/unknown field\(s\) apiUrl/);
  });

  it('rejects anything that is not an object', () => {
    for (const value of [null, 'config', 42, [], true]) {
      expect(() => parseRuntimeConfig(value), JSON.stringify(value)).toThrow(RuntimeConfigInvalidError);
    }
  });
});

describe('RuntimeConfigStore', () => {
  let store: RuntimeConfigStore;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    store = TestBed.inject(RuntimeConfigStore);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('loads config.json at start and keeps it validated', async () => {
    const loading = store.load();
    backend.expectOne(RUNTIME_CONFIG_URL).flush({});

    await loading;
    expect(store.config()).toEqual({});
  });

  it('an invalid configuration rejects the start with RuntimeConfigInvalidError', async () => {
    const loading = store.load();
    backend.expectOne(RUNTIME_CONFIG_URL).flush({ environment: 'prod' });

    await expect(loading).rejects.toThrow(RuntimeConfigInvalidError);
    expect(store.config()).toBeNull();
  });

  it('a configuration that does not load rejects the start the same way', async () => {
    const loading = store.load();
    backend.expectOne(RUNTIME_CONFIG_URL).flush('gone', { status: 404, statusText: 'Not Found' });

    await expect(loading).rejects.toThrow(/could not be loaded/);
  });
});
