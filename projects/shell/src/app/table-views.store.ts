import { inject } from '@angular/core';
import { SessionContext } from '@ewms/core';
import {
  parseTableViews,
  type TableViewStore,
  type TableViewsDocument,
} from '@ewms/design-system';

/** La clave es `ewms.tableViews.<usuario>.<tabla>`: cada quien ve solo sus vistas. */
export const TABLE_VIEWS_STORAGE_PREFIX = 'ewms.tableViews';

/**
 * Las vistas de las tablas en el navegador (ADR 0019): preferencias de presentación, sin sesión
 * ni credenciales. Lo ilegible o de otra versión se borra. Pasa al servidor sin tocar la tabla.
 */
export class BrowserTableViewStore implements TableViewStore {
  private readonly session = inject(SessionContext);

  constructor(private readonly storage: Storage | null = browserStorage()) {}

  read(tableKey: string): Promise<TableViewsDocument | null> {
    const key = this.keyOf(tableKey);
    try {
      const raw = this.storage?.getItem(key) ?? null;
      const document = raw === null ? null : parseTableViews(JSON.parse(raw));
      if (raw !== null && document === null) {
        this.storage?.removeItem(key);
      }
      return Promise.resolve(document);
    } catch {
      // JSON roto: se descarta, como otra versión.
      this.forget(key);
      return Promise.resolve(null);
    }
  }

  write(tableKey: string, document: TableViewsDocument): Promise<void> {
    try {
      this.storage?.setItem(this.keyOf(tableKey), JSON.stringify(document));
    } catch {
      // Lleno o deshabilitado: la vista vale en esta sesión, sin recordarse.
    }
    return Promise.resolve();
  }

  private keyOf(tableKey: string): string {
    const user = encodeURIComponent(this.session.user().name);
    return `${TABLE_VIEWS_STORAGE_PREFIX}.${user}.${encodeURIComponent(tableKey)}`;
  }

  private forget(key: string): void {
    try {
      this.storage?.removeItem(key);
    } catch {
      // Sin almacenamiento no hay nada que borrar.
    }
  }
}

/** Acceder lanza si el navegador lo tiene deshabilitado: sin él, las vistas viven en memoria. */
function browserStorage(): Storage | null {
  try {
    // eslint-disable-next-line no-restricted-globals -- ADR 0019: vistas de tabla, preferencias no sensibles por usuario y tabla. Pasan al servidor cuando haya backend de preferencias.
    return localStorage;
  } catch {
    return null;
  }
}
