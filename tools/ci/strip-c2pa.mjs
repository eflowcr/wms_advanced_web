/**
 * Quita metadatos de procedencia C2PA (Content Credentials) de los activos
 * de marca.
 *
 * Los archivos se entregaron a traves del chat y el canal de entrega les
 * adjunta un manifiesto C2PA firmado. Son ~7.8 KB por SVG y ~5.7 KB por PNG
 * de base64 que viaja al navegador de cada usuario y no aporta nada al
 * producto.
 *
 * Uso:  node tools/ci/strip-c2pa.mjs
 */
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';

const RAIZ = 'projects/shell/public';

// ---------------------------------------------------------------- SVG
function limpiarSvg(texto) {
  return texto
    .replace(/\s*xmlns:c2pa="[^"]*"/g, '')
    .replace(/<metadata>[\s\S]*?<\/metadata>/g, '')
    .replace(/<c2pa:manifest>[\s\S]*?<\/c2pa:manifest>/g, '');
}

// ---------------------------------------------------------------- PNG
// Un PNG es firma + secuencia de chunks. Se conservan los criticos y los que
// afectan al render; se descartan los de metadatos donde vive el manifiesto.
const CHUNKS_FUERA = new Set(['iTXt', 'tEXt', 'zTXt', 'caBX', 'eXIf']);

function limpiarPng(buf) {
  const salida = [buf.subarray(0, 8)];
  let i = 8;
  while (i < buf.length) {
    const largo = buf.readUInt32BE(i);
    const tipo = buf.toString('latin1', i + 4, i + 8);
    const fin = i + 12 + largo;
    if (!CHUNKS_FUERA.has(tipo)) salida.push(buf.subarray(i, fin));
    i = fin;
    if (tipo === 'IEND') break;
  }
  return Buffer.concat(salida);
}

// ---------------------------------------------------------------- recorrido
async function archivos(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await archivos(p)));
    else out.push(p);
  }
  return out;
}

let ahorro = 0;
for (const f of await archivos(RAIZ)) {
  const ext = path.extname(f).toLowerCase();
  const antes = (await stat(f)).size;

  if (ext === '.svg') {
    const limpio = limpiarSvg(await readFile(f, 'utf8'));
    await writeFile(f, limpio, 'utf8');
  } else if (ext === '.png') {
    await writeFile(f, limpiarPng(await readFile(f)));
  } else {
    continue;
  }

  const despues = (await stat(f)).size;
  if (despues < antes) {
    ahorro += antes - despues;
    console.log(`  ${f}  ${antes} -> ${despues} B  (-${antes - despues})`);
  }
}
console.log(`\nTotal recuperado: ${(ahorro / 1024).toFixed(1)} KB`);
