import {
  Directive,
  effect,
  inject,
  input,
  Renderer2,
  TemplateRef,
  untracked,
  ViewContainerRef,
  type EmbeddedViewRef,
} from '@angular/core';
import { AccessStore } from './access-store';

/**
 * `*ewmsCan="'security.users:create'"`: la plantilla existe solo con ese permiso en el contexto
 * activo y reacciona a cada cambio de concesiones. Ocultar es presentación: el servidor decide.
 * Marca lo que pinta con `data-ewms-can` para que una prueba lo compare con los permisos.
 */
@Directive({ selector: '[ewmsCan]' })
export class Can {
  readonly ewmsCan = input.required<string>();
  private readonly access = inject(AccessStore);
  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);
  private readonly renderer = inject(Renderer2);
  private view: EmbeddedViewRef<unknown> | null = null;

  constructor() {
    effect(() => {
      const code = this.ewmsCan();
      const allowed = this.access.can(code);
      untracked(() => this.render(allowed, code));
    });
  }

  private render(allowed: boolean, code: string): void {
    if (!allowed) {
      this.container.clear();
      this.view = null;
      return;
    }
    this.view ??= this.container.createEmbeddedView(this.template);
    for (const node of this.view.rootNodes as Node[]) {
      if (node instanceof Element) this.renderer.setAttribute(node, 'data-ewms-can', code);
    }
  }
}
