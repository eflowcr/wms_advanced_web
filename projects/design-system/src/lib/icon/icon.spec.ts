import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { expectNoAxeViolations } from '@ewms/testing';
import manifest from '../../icons/icons.manifest.json';
import { ICON_CATEGORIES, ICONS, type IconName } from '../../icons/icons.generated';
import { Icon, type IconSize } from './icon';

const SVG_NS = 'http://www.w3.org/2000/svg';
const BOUNDING_BOX = 'M0 0h24v24H0z';

async function render(inputs: {
  name: IconName;
  size?: IconSize;
  label?: string;
}): Promise<{ fixture: ComponentFixture<Icon>; svg: SVGSVGElement }> {
  const fixture = TestBed.createComponent(Icon);
  for (const [key, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(key, value);
  }
  await fixture.whenStable();
  const svg = (fixture.nativeElement as HTMLElement).querySelector('svg');
  if (!svg) {
    throw new Error('ewms-icon rendered no <svg>');
  }
  return { fixture, svg };
}

describe('Icon', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Icon] }).compileComponents();
  });

  describe('geometry', () => {
    it('renders the expected geometry for a known name', async () => {
      const { svg } = await render({ name: 'package' });

      const paths = [...svg.querySelectorAll('path')];
      // Literal Tabler geometry, not read back from the generated table: the
      // test must fail if the generator mangles the data.
      expect(paths.map((path) => path.getAttribute('d'))).toEqual([
        'M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5',
        'M12 12l8 -4.5',
        'M12 12l0 9',
        'M12 12l-8 -4.5',
        'M16 5.25l-8 4.5',
      ]);
      expect(paths.every((path) => path.namespaceURI === SVG_NS)).toBe(true);
    });

    it('sets presentation once on the <svg> and never on the shapes', async () => {
      const { svg } = await render({ name: 'forklift' });

      expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(svg.getAttribute('fill')).toBe('none');
      expect(svg.getAttribute('stroke')).toBe('currentColor');
      expect(svg.getAttribute('stroke-linecap')).toBe('round');
      expect(svg.getAttribute('stroke-linejoin')).toBe('round');
      for (const shape of svg.children) {
        expect(shape.getAttributeNames()).toEqual(['d']);
      }
    });

    it('never outputs the Tabler bounding-box path, for any icon', async () => {
      const names = Object.keys(ICONS) as IconName[];
      expect(names.length).toBeGreaterThan(0);

      for (const name of names) {
        for (const primitive of ICONS[name]) {
          expect(JSON.stringify(primitive)).not.toContain(BOUNDING_BOX);
        }
        const { svg } = await render({ name });
        expect(svg.children.length, name).toBe(ICONS[name].length);
        expect(svg.outerHTML, name).not.toContain(BOUNDING_BOX);
      }
    });
  });

  describe('manifest', () => {
    it('has exactly the same set of names as icons.generated.ts', () => {
      const manifestNames = [
        ...Object.keys(manifest.domain),
        ...Object.keys(manifest.interface),
      ].sort();

      expect(Object.keys(ICONS).sort()).toEqual(manifestNames);
      expect([...ICON_CATEGORIES.domain].sort()).toEqual(Object.keys(manifest.domain).sort());
      expect([...ICON_CATEGORIES.interface].sort()).toEqual(
        Object.keys(manifest.interface).sort(),
      );
    });
  });

  describe('accessibility', () => {
    it('is decorative without a label', async () => {
      const { svg } = await render({ name: 'search' });

      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.getAttribute('focusable')).toBe('false');
      expect(svg.hasAttribute('role')).toBe(false);
      expect(svg.hasAttribute('aria-label')).toBe(false);
    });

    it('is an image named by the consumer with a label', async () => {
      const { svg } = await render({ name: 'alert-triangle', label: 'Stock bajo' });

      expect(svg.getAttribute('role')).toBe('img');
      expect(svg.getAttribute('aria-label')).toBe('Stock bajo');
      expect(svg.hasAttribute('aria-hidden')).toBe(false);
      expect(svg.hasAttribute('focusable')).toBe(false);
    });

    it('treats an empty label as no label', async () => {
      const { svg } = await render({ name: 'search', label: '' });

      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.hasAttribute('role')).toBe(false);
    });

    it('has no axe violations when decorative', async () => {
      const { fixture } = await render({ name: 'warehouse' });
      await expectNoAxeViolations(fixture.nativeElement as Element);
    });

    it('has no axe violations when informative', async () => {
      const { fixture } = await render({ name: 'pallet', label: 'Tarima' });
      await expectNoAxeViolations(fixture.nativeElement as Element);
    });
  });

  describe('size', () => {
    it('defaults to md', async () => {
      const { svg } = await render({ name: 'bell' });
      expect([...svg.classList].sort()).toEqual(['block', 'size-icon-md', 'stroke-icon-md']);
    });

    // The class pair is what reaches the stylesheet: size-icon-* maps to
    // --size-icon-* (width and height) and stroke-icon-* to --stroke-icon-*
    // (stroke-width) in styles.css. jsdom has no Tailwind, so the computed
    // 16/2.25, 18/2, 20/2, 24/1.75 values are asserted in the browser by
    // e2e/iconography.e2e.ts.
    it.each<IconSize>(['sm', 'md', 'lg', 'xl'])(
      'applies the width and stroke-width pair for %s',
      async (size) => {
        const { svg } = await render({ name: 'bell', size });
        expect([...svg.classList].sort()).toEqual([
          'block',
          `size-icon-${size}`,
          `stroke-icon-${size}`,
        ]);
      },
    );
  });
});
