import { Component } from '@angular/core';
import { DemoContext } from './demo-context';

/** Desarrollo y demostración: fileReplacements cambia el hueco vacío por la franja. */
@Component({ selector: 'app-demo-slot', imports: [DemoContext], template: '<app-demo-context />' })
export class DemoSlot {}
