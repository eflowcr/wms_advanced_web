import axe from 'axe-core';

/**
 * Run axe-core against a rendered component and fail with a readable report.
 *
 * Gate 5 of the CI contract. Wired in Fase 0 with no design-system components
 * to exercise yet; every component spec from Fase 2 onward calls this.
 */
export async function expectNoAxeViolations(root: Element): Promise<void> {
  const results = await axe.run(root, {
    resultTypes: ['violations'],
  });

  if (results.violations.length === 0) {
    return;
  }

  const report = results.violations
    .map((violation) => {
      const nodes = violation.nodes.map((node) => `      ${node.html}`).join('\n');
      return `  [${violation.impact ?? 'unknown'}] ${violation.id}: ${violation.help}\n${nodes}`;
    })
    .join('\n');

  throw new Error(`Accessibility violations found:\n${report}`);
}
