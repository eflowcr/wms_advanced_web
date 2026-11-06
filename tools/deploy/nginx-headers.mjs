// Escribe las cabeceras de seguridad del contrato como directivas de nginx: la imagen las genera al
// construirse, así la CSP de la cabecera nunca se aparta de la del <meta>. Uso: node nginx-headers.mjs <salida>.
// Ver vault: 02-Arquitectura/Contrato de despliegue.
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { securityHeaders } from './headers.mjs';

/** Una directiva `add_header … always;` por cabecera; nginx no admite comillas dobles sin escapar. */
export function nginxHeaders(headers = securityHeaders()) {
  return Object.entries(headers)
    .map(([name, value]) => {
      if (value.includes('"')) throw new Error(`header ${name} contains a double quote`);
      const title = name.replace(/(^|-)\w/g, (s) => s.toUpperCase());
      return `add_header ${title} "${value}" always;`;
    })
    .join('\n')
    .concat('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = process.argv[2];
  if (!out) {
    console.error('usage: node tools/deploy/nginx-headers.mjs <output.conf>');
    process.exit(2);
  }
  writeFileSync(out, nginxHeaders());
}
