'use strict';
// Rasteriza el logo (un SVG) al PNG del icono de la app de escritorio, electron/icono/icono.png (1024 × 1024, fondo
// transparente), con el Chromium de Playwright que ya está en el repo: sin `sharp` ni ninguna dependencia nueva (plan
// de Electron §2, fila Icono). electron-builder genera de ese PNG el .icns de Mac y el .ico de Windows al empaquetar.
//   npm run icono                                        → public/icono.svg (el provisional, hasta que Roberto elija logo; §8.2)
//   node pruebas/icono.js docs/diseno/logo/propuesta-3.svg   → cambiar de logo es esta línea (y hacer commit del PNG)
//   node pruebas/icono.js <svg> [destino] [tamaño]
// El SVG va en línea en una página en claro (prefers-color-scheme: light) con el color del texto fijado, así un logo
// con `currentColor` o con `@media (prefers-color-scheme)` sale como en claro. Se escribe solo el fichero destino.
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const ORIGEN = path.join(RAIZ, 'public', 'icono.svg');
const DESTINO = path.join(RAIZ, 'electron', 'icono', 'icono.png');
const TAMANO = 1024;
const COLOR = '#1b1b1f';   // el color de la tinta en claro (docs/diseno/logo/README.md): lo que vale `currentColor`

// Rasteriza el SVG (texto) a un PNG cuadrado de `tamano` px en `destino` (crea la carpeta si falta). Devuelve el destino.
// `chromium` es inyectable para no abrir un navegador en un test que solo quiera comprobar la página que se monta.
async function rasterizar(svg, destino = DESTINO, tamano = TAMANO, { chromium = require('playwright').chromium } = {}) {
  if (!/<svg[\s>]/.test(svg)) throw new Error('el origen no parece un SVG');
  if (!(Number.isInteger(tamano) && tamano > 0 && tamano <= 4096)) throw new Error(`tamaño no válido: ${tamano}`);
  const navegador = await chromium.launch();
  try {
    const pagina = await navegador.newPage({ viewport: { width: tamano, height: tamano }, deviceScaleFactor: 1, colorScheme: 'light' });
    await pagina.setContent(paginaDelIcono(svg, tamano, COLOR));
    const png = await pagina.screenshot({ type: 'png', omitBackground: true, clip: { x: 0, y: 0, width: tamano, height: tamano } });
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, png);
    return destino;
  } finally { await navegador.close(); }
}

// La página que se fotografía: el SVG ocupa el viewport entero, sin márgenes ni fondo (lo transparente queda transparente).
function paginaDelIcono(svg, tamano, color) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;background:transparent;color:${color};width:${tamano}px;height:${tamano}px;overflow:hidden}
body>svg{display:block;width:${tamano}px;height:${tamano}px}
</style></head><body>${svg}</body></html>`;
}

// Las dimensiones de un PNG (su IHDR: anchura y altura en los bytes 16-23, tipo de color en el 25; 6 = RGBA, con
// transparencia). Para comprobar lo generado sin ninguna librería de imágenes.
function leerPng(buffer) {
  const firma = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(firma) || buffer.toString('latin1', 12, 16) !== 'IHDR') throw new Error('no es un PNG');
  return { anchura: buffer.readUInt32BE(16), altura: buffer.readUInt32BE(20), profundidad: buffer[24], tipoColor: buffer[25] };
}

async function main(argv) {
  const origen = path.resolve(argv[0] || ORIGEN), destino = path.resolve(argv[1] || DESTINO), tamano = argv[2] ? Number(argv[2]) : TAMANO;
  const salida = await rasterizar(fs.readFileSync(origen, 'utf8'), destino, tamano);
  const { anchura, altura, tipoColor } = leerPng(fs.readFileSync(salida));
  console.log(`${path.relative(RAIZ, origen)} → ${path.relative(RAIZ, salida)}: ${anchura} × ${altura}${tipoColor === 6 ? ', con transparencia' : ''} (${fs.statSync(salida).size} bytes)`);
}

if (require.main === module) main(process.argv.slice(2)).catch(e => { console.error(e.message); process.exit(1); });

module.exports = { rasterizar, paginaDelIcono, leerPng, ORIGEN, DESTINO, TAMANO };
