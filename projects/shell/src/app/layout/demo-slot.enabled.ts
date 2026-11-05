import { Component } from '@angular/core';
import { DemoContext } from './demo-context';

/** Solo el artefacto sintético de las E2E: fileReplacements cambia el hueco vacío por la franja. */
@Component({ selector: 'app-demo-slot', imports: [DemoContext], template: '<app-demo-context />' })
export class DemoSlot {}
