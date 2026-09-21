import axe from 'axe-core';

/** Corre axe-core sobre el componente renderizado y falla con un reporte legible. */
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
