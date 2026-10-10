'use strict';
// El icono de la app de escritorio de verdad: pruebas/icono.js rasteriza la propuesta 3 con el Chromium de Playwright
// a un PNG pequeño (64 px) en una carpeta temporal, y se comprueba lo que hay en los píxeles (leídos con un canvas en el
// mismo Chromium, sin librería de imágenes): el margen transparente alrededor de la placa (832 de 1024, como los iconos
// de macOS; crítica 2026-10-10, 2), la placa clara, la «c» en tinta oscura, el subrayado amarillo; y sin placa, el hueco
// de la «c» transparente. Va con los recorridos de navegador porque
// necesita el Chromium instalado (`npx playwright install chromium`), como ellos.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const icono = require('../../pruebas/icono');

const RAIZ = path.join(__dirname, '..', '..');
const SVG = fs.readFileSync(path.join(RAIZ, 'docs', 'diseno', 'logo', 'propuesta-3.svg'), 'utf8');
const LADO = 64;
const executablePath = process.env.CUADERNO_CHROMIUM || undefined;
const chromiumDeAqui = { launch: () => chromium.launch({ executablePath }) };

let base, navegador;
test.before(async () => { base = fs.mkdtempSync(path.join(os.tmpdir(), 'cuaderno-icono-')); navegador = await chromium.launch({ executablePath }); });
test.after(async () => { if (navegador) await navegador.close(); fs.rmSync(base, { recursive: true, force: true }); });

// Los píxeles [r, g, b, a] de un PNG en las coordenadas pedidas, leídos con un canvas.
async function pixeles(png, puntos) {
  const pagina = await navegador.newPage();
  try {
    await pagina.setContent('<canvas id="c"></canvas>');
    return await pagina.evaluate(async ({ datos, puntos, lado }) => {
      const img = new Image(); img.src = `data:image/png;base64,${datos}`; await img.decode();
      const c = document.getElementById('c'); c.width = lado; c.height = lado;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
      return puntos.map(([x, y]) => Array.from(ctx.getImageData(x, y, 1, 1).data));
    }, { datos: png.toString('base64'), puntos, lado: LADO });
  } finally { await pagina.close(); }
}
const oscuro = ([r, g, b, a]) => r < 70 && g < 70 && b < 70 && a === 255;
const amarillo = ([r, g, b, a]) => r > 230 && g > 190 && b < 140 && a === 255;
const claro = ([r, g, b, a]) => r > 240 && g > 240 && b > 240 && a === 255;
const transparente = ([, , , a]) => a === 0;
// En el viewBox 64 de la propuesta 3 la «c» es el arco «M46 14 A17 17 0 1 0 46 40»: de (46, 14) a (46, 40) con radio
// 17 por el lado largo, así que su centro está en (46 − √(17² − 13²), 27) ≈ (35, 27) y su punto más a la izquierda en
// (18, 27); el hueco del arco está en el centro; el subrayado va de (12, 53) a (52, 50,5). A 64 px la placa mide 52
// (832/1024) y empieza en 6; el dibujo, el 70 % de la placa (36 px), empieza en 6 + 8 = 14: un punto (x, y) del SVG cae
// en 14 + 0,5625 · (x, y).
const sobrePlaca = ([x, y]) => [Math.round(14 + 0.5625 * x), Math.round(14 + 0.5625 * y)];
const ARCO = [18, 27], SUBRAYADO = [32, 51.75], HUECO = [35, 27];

test('el icono con placa: PNG 64 × 64 RGBA con el margen transparente alrededor de la placa (también en las esquinas), la placa clara en el hueco de la «c», tinta en el arco y amarillo en el subrayado', async () => {
  const destino = path.join(base, 'con-placa.png');
  await icono.rasterizar(SVG, destino, LADO, { chromium: chromiumDeAqui });
  const png = fs.readFileSync(destino);
  assert.deepEqual(icono.leerPng(png), { anchura: LADO, altura: LADO, profundidad: 8, tipoColor: 6 });
  const [esquina, margen, hueco, arco, subrayado, bordeDeLaPlaca] = await pixeles(png, [[1, 1], [3, 32], sobrePlaca(HUECO), sobrePlaca(ARCO), sobrePlaca(SUBRAYADO), [8, 32]]);
  assert.ok(transparente(esquina), `la esquina del lienzo es transparente: ${esquina}`);
  assert.ok(transparente(margen), `el margen entre el lienzo y la placa es transparente (antes la placa llegaba al borde): ${margen}`);
  assert.ok(claro(hueco), `el hueco de la «c» enseña la placa clara: ${hueco}`);
  assert.ok(claro(bordeDeLaPlaca), `dentro de la placa, a 2 px de su borde y lejos de las esquinas, es claro: ${bordeDeLaPlaca}`);
  assert.ok(oscuro(arco), `el arco de la «c» es tinta oscura: ${arco}`);
  assert.ok(amarillo(subrayado), `el subrayado es amarillo: ${subrayado}`);
});

test('el icono sin placa (--sin-fondo): el dibujo a lado entero sobre transparente, con el hueco de la «c» también transparente', async () => {
  const destino = path.join(base, 'sin-placa.png');
  await icono.rasterizar(SVG, destino, LADO, { fondo: null, chromium: chromiumDeAqui });
  const png = fs.readFileSync(destino);
  assert.deepEqual(icono.leerPng(png), { anchura: LADO, altura: LADO, profundidad: 8, tipoColor: 6 });
  const [esquina, hueco, arco, subrayado] = await pixeles(png, [[1, 1], HUECO, ARCO, [32, 52]]);
  assert.ok(transparente(esquina), `la esquina es transparente: ${esquina}`);
  assert.ok(transparente(hueco), `el hueco de la «c» es transparente: ${hueco}`);
  assert.ok(oscuro(arco), `el arco es tinta oscura: ${arco}`);
  assert.ok(amarillo(subrayado), `el subrayado es amarillo: ${subrayado}`);
});

test('el PNG del repo (electron/icono/icono.png) es el que sale de la propuesta 3 con placa de 832 a 1024: regenerarlo no lo cambia', async () => {
  const destino = path.join(base, 'icono-1024.png');
  await icono.rasterizar(SVG, destino, 1024, { chromium: chromiumDeAqui });
  assert.ok(fs.readFileSync(destino).equals(fs.readFileSync(icono.DESTINO)), 'electron/icono/icono.png no coincide con lo que genera npm run icono: regenerarlo y hacer commit');
});
