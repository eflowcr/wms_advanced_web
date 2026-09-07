import { Component } from '@angular/core';

/**
 * Landing page of the internal showroom.
 *
 * The showroom is an in-app route (/design-system), not Storybook. It may only
 * depend on @ewms/design-system and @ewms/shared.
 */
@Component({
  selector: 'ewms-showroom-home',
  templateUrl: './showroom-home.html',
})
export class ShowroomHome {}
