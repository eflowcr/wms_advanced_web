import { computed, signal } from '@angular/core';
import {
  TABLE_VIEWS_VERSION,
  type SavedTableView,
  type TableSavedState,
  type TableViewStore,
  type TableViewsDocument,
} from './table-saved-views.types';

interface SavedViewsHost {
  /** Sin store o sin clave, la tabla no ofrece vistas: todo queda en memoria, como siempre. */
  readonly store: TableViewStore | null;
  readonly key: () => string | null;
  /** Lo que hay ahora en la tabla, en la forma que se guarda. */
  readonly capture: () => TableSavedState;
  readonly apply: (state: TableSavedState) => void;
  /** Un id nuevo para una vista: único dentro de la tabla. */
  readonly newId: () => string;
}

/**
 * Las vistas guardadas de una tabla: cuáles hay, cuál está puesta, si cambió y cuál abre por
 * defecto. Cada cambio se escribe entero en el store. Interna. Ver vault: Tabla §29.
 */
export class TableSavedViews {
  readonly views = signal<readonly SavedTableView[]>([]);
  readonly activeId = signal<string | null>(null);
  readonly defaultId = signal<string | null>(null);

  readonly enabled = computed(() => this.host.store !== null && this.host.key() !== null);

  readonly active = computed(
    () => this.views().find((view) => view.id === this.activeId()) ?? null,
  );

  /** Lo que hay en la tabla difiere de la vista puesta: habilita «Guardar cambios». */
  readonly modified = computed(() => {
    const active = this.active();
    return active !== null && !sameState(this.host.capture(), active.state);
  });

  constructor(private readonly host: SavedViewsHost) {}

  /** Lee lo guardado y pone la vista por defecto, si hay. */
  async load(): Promise<void> {
    const key = this.host.key();
    if (!this.host.store || key === null) {
      return;
    }
    const document = await this.host.store.read(key);
    this.views.set(document?.views ?? []);
    this.defaultId.set(document?.defaultId ?? null);
    const initial = this.views().find((view) => view.id === this.defaultId());
    if (initial) {
      this.choose(initial.id);
    }
  }

  /** Poner una vista; `null` es la inicial, la declarada. */
  choose(id: string | null): void {
    const view = this.views().find((candidate) => candidate.id === id) ?? null;
    this.activeId.set(view?.id ?? null);
    if (view) {
      this.host.apply(view.state);
    }
  }

  /** Lo de ahora, con nombre: queda puesta. */
  create(name: string): void {
    const view: SavedTableView = { id: this.host.newId(), name, state: this.host.capture() };
    this.views.update((views) => [...views, view]);
    this.activeId.set(view.id);
    this.persist();
  }

  saveChanges(): void {
    this.update(this.activeId(), (view) => ({ ...view, state: this.host.capture() }));
  }

  /** Descartar los cambios: la vista puesta, como se guardó. */
  revert(): void {
    const active = this.active();
    if (active) {
      this.host.apply(active.state);
    }
  }

  rename(id: string, name: string): void {
    this.update(id, (view) => ({ ...view, name }));
  }

  /** La copia queda al lado y puesta, con el nombre que se le dé. */
  duplicate(id: string, name: string): void {
    const source = this.views().find((view) => view.id === id);
    if (!source) {
      return;
    }
    const copy: SavedTableView = { id: this.host.newId(), name, state: source.state };
    this.views.update((views) => views.flatMap((view) => (view.id === id ? [view, copy] : [view])));
    this.activeId.set(copy.id);
    this.persist();
  }

  remove(id: string): void {
    this.views.update((views) => views.filter((view) => view.id !== id));
    if (this.activeId() === id) {
      this.activeId.set(null);
    }
    if (this.defaultId() === id) {
      this.defaultId.set(null);
    }
    this.persist();
  }

  /** Una sola abre por defecto; la misma otra vez la quita. */
  toggleDefault(id: string): void {
    this.defaultId.update((current) => (current === id ? null : id));
    this.persist();
  }

  private update(id: string | null, change: (view: SavedTableView) => SavedTableView): void {
    this.views.update((views) => views.map((view) => (view.id === id ? change(view) : view)));
    this.persist();
  }

  private persist(): void {
    const key = this.host.key();
    if (!this.host.store || key === null) {
      return;
    }
    const document: TableViewsDocument = {
      version: TABLE_VIEWS_VERSION,
      views: this.views(),
      defaultId: this.defaultId(),
    };
    void this.host.store.write(key, document);
  }
}

/** Comparación por contenido, sin el orden de las claves: `{a, b}` y `{b, a}` son lo mismo. */
export function sameState(a: TableSavedState, b: TableSavedState): boolean {
  return canonical(a) === canonical(b);
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item as Record<string, unknown>).sort(([x], [y]) => (x < y ? -1 : 1)),
        )
      : item,
  );
}
