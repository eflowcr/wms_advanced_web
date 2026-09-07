import { TestBed } from '@angular/core/testing';
import { expectNoAxeViolations } from '@ewms/testing';
import { Home } from './home';

describe('Home', () => {
  it('has no accessibility violations', async () => {
    await TestBed.configureTestingModule({ imports: [Home] }).compileComponents();
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();

    await expectNoAxeViolations(fixture.nativeElement as Element);
  });
});
