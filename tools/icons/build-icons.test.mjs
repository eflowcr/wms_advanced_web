/**
 * Tests for the icon generator's SVG extraction (ADR 0011).
 *
 * Plain node:test, no Angular: the generator is a Node script. Run with
 * `npm run test:tools` (also part of `npm test`).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractPrimitives } from './build-icons.mjs';

const OPEN =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" ' +
  'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
const BOUNDING_BOX = '<path stroke="none" d="M0 0h24v24H0z" fill="none" />';
const GEOMETRY = '<path d="M3 7h18v4h-18l0 -4" /><path d="M3 16h18" />';

describe('extractPrimitives', () => {
  it('produces the same output for a custom icon with and without the bounding box', () => {
    const withBox = extractPrimitives(`${OPEN}${BOUNDING_BOX}${GEOMETRY}</svg>`, 'custom/a.svg', {
      requireBoundingBox: false,
    });
    const withoutBox = extractPrimitives(`${OPEN}${GEOMETRY}</svg>`, 'custom/b.svg', {
      requireBoundingBox: false,
    });

    assert.deepEqual(withBox, [
      { type: 'path', d: 'M3 7h18v4h-18l0 -4' },
      { type: 'path', d: 'M3 16h18' },
    ]);
    assert.deepEqual(withoutBox, withBox);
  });

  it('still fails for a Tabler file without the bounding box', () => {
    assert.throws(
      () =>
        extractPrimitives(`${OPEN}${GEOMETRY}</svg>`, 'tabler/x.svg', { requireBoundingBox: true }),
      { message: 'tabler/x.svg: first element must be the bounding-box path "M0 0h24v24H0z".' },
    );
  });

  it('rejects any shape other than <path> and says how to fix it', () => {
    assert.throws(
      () =>
        extractPrimitives(`${OPEN}<circle cx="12" cy="12" r="9" /></svg>`, 'custom/c.svg', {
          requireBoundingBox: false,
        }),
      {
        message:
          'custom/c.svg <circle>: unsupported element. Icons are <path> only (ADR 0011): convert the ' +
          'shape to a path before adding the icon, as any vector editor does on export.',
      },
    );
  });
});
