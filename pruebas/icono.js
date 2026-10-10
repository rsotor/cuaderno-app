'use strict';
// Rasteriza el logo (un SVG) al PNG del icono de la app de escritorio, electron/icono/icono.png (1024 × 1024), con el
// Chromium de Playwright que ya está en el repo: sin `sharp` ni ninguna dependencia nueva (plan de Electron §2, fila
// Icono). electron-builder genera de ese PNG el .icns de Mac y el .ico de Windows al empaquetar.
//
// El logo es la propuesta 3 de docs/diseno/logo/ (la «c» subrayada; decisión de Roberto, 2026-10-10). En el Dock y en la
// barra de Windows un dibujo de trazos sobre transparente queda raro junto a los demás iconos, así que el dibujo va sobre
// una PLACA: un cuadrado redondeado de 832 px centrado en el lienzo de 1024 (el margen transparente que llevan los iconos de
// macOS: así en el Dock no sale más grande que los vecinos; crítica de diseño 2026-10-10, 2), con el radio del 22 % del lado
// de la placa, del color de la hoja en claro (`--papel` de public/estilo.css), con la «c» en la tinta oscura y el subrayado
// amarillo del propio SVG; el dibujo ocupa el 70 % de la placa, centrado; sin degradados. Sin placa (--sin-fondo), el
// dibujo ocupa el lado entero sobre transparente.
//   npm run icono                                              → docs/diseno/logo/propuesta-3.svg, con placa
//   node pruebas/icono.js docs/diseno/logo/propuesta-1.svg     → cambiar de logo es esta línea (y hacer commit del PNG)
//   node pruebas/icono.js [svg] [destino] [tamaño] [--fondo=#rrggbb | --sin-fondo]
// public/icono.svg (el de la web, con su prefers-color-scheme) es otro cambio: docs/diseno/logo/README.md dice cómo.
// El SVG va en línea en una página en claro con el color del texto fijado a la tinta, así un logo con `currentColor` o
// con `@media (prefers-color-scheme)` sale como en claro. Se escribe solo el fichero destino.
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const ORIGEN = path.join(RAIZ, 'docs', 'diseno', 'logo', 'propuesta-3.svg');
const DESTINO = path.join(RAIZ, 'electron', 'icono', 'icono.png');
const TAMANO = 1024;
const TINTA = '#1b1b1f';    // la tinta en claro (--tinta de public/estilo.css): lo que vale `currentColor`
const FONDO = '#fbfbfc';    // la hoja en claro (--papel de public/estilo.css): el color de la placa
const PLACA = 832 / 1024;   // cuánto del lienzo ocupa la placa (el resto, margen transparente, como los iconos de macOS)
const RADIO = 0.22;         // radio de las esquinas de la placa, en fracción del lado de la placa (como los iconos de macOS)
const OCUPA = 0.7;          // cuánto del lado de la placa ocupa el dibujo

// Rasteriza el SVG (texto) a un PNG cuadrado de `tamano` px en `destino` (crea la carpeta si falta). Devuelve el destino.
// `fondo`: el color de la placa, o null para dibujar sin placa sobre transparente. `chromium` es inyectable para no abrir
// un navegador en un test que solo quiera comprobar lo que se escribe.
async function rasterizar(svg, destino = DESTINO, tamano = TAMANO, { fondo = FONDO, chromium = require('playwright').chromium } = {}) {
  if (!/<svg[\s>]/.test(svg)) throw new Error('el origen no parece un SVG');
  if (!(Number.isInteger(tamano) && tamano > 0 && tamano <= 4096)) throw new Error(`tamaño no válido: ${tamano}`);
  if (fondo !== null && !/^#[0-9a-f]{6}$/i.test(fondo)) throw new Error(`fondo no válido (se espera #rrggbb o --sin-fondo): ${fondo}`);
  const navegador = await chromium.launch();
  try {
    const pagina = await navegador.newPage({ viewport: { width: tamano, height: tamano }, deviceScaleFactor: 1, colorScheme: 'light' });
    await pagina.setContent(paginaDelIcono(svg, tamano, { fondo }));
    const png = await pagina.screenshot({ type: 'png', omitBackground: true, clip: { x: 0, y: 0, width: tamano, height: tamano } });
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, png);
    return destino;
  } finally { await navegador.close(); }
}

// La página que se fotografía: el lienzo es el viewport, transparente; la placa (el 81,25 % del lado: 832 de 1024) va
// centrada en él y el SVG centrado dentro de la placa; sin placa, el SVG ocupa el viewport entero.
function paginaDelIcono(svg, tamano, { fondo = FONDO, tinta = TINTA } = {}) {
  const ladoPlaca = fondo ? Math.round(tamano * PLACA) : tamano;
  const lado = fondo ? Math.round(ladoPlaca * OCUPA) : tamano;
  const placa = fondo ? `background:${fondo};border-radius:${Math.round(ladoPlaca * RADIO)}px;` : '';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;background:transparent;color:${tinta};width:${tamano}px;height:${tamano}px;overflow:hidden}
.lienzo{width:${tamano}px;height:${tamano}px;display:grid;place-items:center}
.placa{width:${ladoPlaca}px;height:${ladoPlaca}px;display:grid;place-items:center;${placa}}
.placa>svg{display:block;width:${lado}px;height:${lado}px}
</style></head><body><div class="lienzo"><div class="placa">${svg}</div></div></body></html>`;
}

// Las dimensiones de un PNG (su IHDR: anchura y altura en los bytes 16-23, tipo de color en el 25; 6 = RGBA, con
// transparencia). Para comprobar lo generado sin ninguna librería de imágenes.
function leerPng(buffer) {
  const firma = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(firma) || buffer.toString('latin1', 12, 16) !== 'IHDR') throw new Error('no es un PNG');
  return { anchura: buffer.readUInt32BE(16), altura: buffer.readUInt32BE(20), profundidad: buffer[24], tipoColor: buffer[25] };
}

// Los argumentos de la línea de órdenes: los posicionales (svg, destino, tamaño) y las opciones del fondo.
function leerArgumentos(argv) {
  const posicionales = argv.filter(a => !a.startsWith('--')), opciones = argv.filter(a => a.startsWith('--'));
  let fondo = FONDO;
  for (const o of opciones) {
    if (o === '--sin-fondo') fondo = null;
    else if (o.startsWith('--fondo=')) fondo = o.slice(8);
    else throw new Error(`opción desconocida: ${o}`);
  }
  return { origen: path.resolve(posicionales[0] || ORIGEN), destino: path.resolve(posicionales[1] || DESTINO), tamano: posicionales[2] ? Number(posicionales[2]) : TAMANO, fondo };
}

async function main(argv) {
  const { origen, destino, tamano, fondo } = leerArgumentos(argv);
  const salida = await rasterizar(fs.readFileSync(origen, 'utf8'), destino, tamano, { fondo });
  const { anchura, altura, tipoColor } = leerPng(fs.readFileSync(salida));
  console.log(`${path.relative(RAIZ, origen)} → ${path.relative(RAIZ, salida)}: ${anchura} × ${altura}, ${fondo ? `placa ${fondo}` : 'sin placa'}${tipoColor === 6 ? ', con transparencia' : ''} (${fs.statSync(salida).size} bytes)`);
}

if (require.main === module) main(process.argv.slice(2)).catch(e => { console.error(e.message); process.exit(1); });

module.exports = { rasterizar, paginaDelIcono, leerPng, leerArgumentos, ORIGEN, DESTINO, TAMANO, TINTA, FONDO, PLACA, RADIO, OCUPA };
