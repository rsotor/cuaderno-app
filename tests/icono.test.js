'use strict';
// pruebas/icono.js sin abrir un navegador: la página que se fotografía (placa redondeada con el dibujo al 70 %, o el
// dibujo a lado entero sin placa), los argumentos de la línea de órdenes, la lectura del IHDR de un PNG y el flujo de
// rasterizar() con un Chromium falso (lo que se escribe y dónde; lo que se rechaza antes de abrir nada). El PNG de
// verdad, con el Chromium de Playwright, se comprueba en tests/navegador/icono.test.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const icono = require('../pruebas/icono');

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="20"/></svg>';
// Un PNG mínimo creíble: la firma y el IHDR (sin IDAT: a leerPng le basta la cabecera).
function cabeceraPng({ anchura = 64, altura = 64, profundidad = 8, tipoColor = 6 } = {}) {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8); b.write('IHDR', 12, 'latin1');
  b.writeUInt32BE(anchura, 16); b.writeUInt32BE(altura, 20); b[24] = profundidad; b[25] = tipoColor;
  return b;
}
// Un Chromium de mentira: anota las opciones de la página y lo que se le pone, y «fotografía» una cabecera de PNG.
function chromiumFalso(anotaciones) {
  return {
    async launch() {
      anotaciones.lanzado = (anotaciones.lanzado || 0) + 1;
      return {
        async newPage(opciones) {
          anotaciones.pagina = opciones;
          return { async setContent(html) { anotaciones.html = html; }, async screenshot(o) { anotaciones.captura = o; return cabeceraPng({ anchura: o.clip.width, altura: o.clip.height }); } };
        },
        async close() { anotaciones.cerrado = true; },
      };
    },
  };
}

test('la página del icono: con placa, un cuadrado redondeado del color de la hoja (radio 22 %) con el SVG al 70 % centrado y la tinta como color', () => {
  const html = icono.paginaDelIcono(SVG, 1024);
  assert.match(html, /<!doctype html><html lang="es">/);
  assert.match(html, /color:#1b1b1f/, 'currentColor vale la tinta en claro');
  assert.match(html, /background:#fbfbfc;border-radius:225px/, 'la placa: --papel en claro y el 22 % de 1024');
  assert.match(html, /\.placa>svg\{display:block;width:717px;height:717px\}/, 'el dibujo ocupa el 70 % del lado');
  assert.match(html, /place-items:center/);
  assert.ok(html.includes(`<div class="placa">${SVG}</div>`), 'el SVG va en línea dentro de la placa');
  assert.equal(icono.FONDO, '#fbfbfc'); assert.equal(icono.TINTA, '#1b1b1f'); assert.equal(icono.RADIO, 0.22); assert.equal(icono.OCUPA, 0.7);
});

test('la página del icono sin placa: sin fondo ni esquinas, el SVG ocupa el lado entero', () => {
  const html = icono.paginaDelIcono(SVG, 256, { fondo: null });
  assert.doesNotMatch(html, /background:#|border-radius/);
  assert.match(html, /\.placa>svg\{display:block;width:256px;height:256px\}/);
});

test('los argumentos: por defecto la propuesta 3 a electron/icono/icono.png a 1024 con placa; posicionales, --fondo y --sin-fondo', () => {
  const porDefecto = icono.leerArgumentos([]);
  assert.equal(porDefecto.origen, path.join(__dirname, '..', 'docs', 'diseno', 'logo', 'propuesta-3.svg'));
  assert.equal(porDefecto.destino, path.join(__dirname, '..', 'electron', 'icono', 'icono.png'));
  assert.equal(porDefecto.tamano, 1024);
  assert.equal(porDefecto.fondo, '#fbfbfc');
  const otro = icono.leerArgumentos(['docs/diseno/logo/propuesta-1.svg', 'salida.png', '512', '--fondo=#ffffff']);
  assert.equal(otro.origen, path.resolve('docs/diseno/logo/propuesta-1.svg'));
  assert.equal(otro.destino, path.resolve('salida.png'));
  assert.equal(otro.tamano, 512);
  assert.equal(otro.fondo, '#ffffff');
  assert.equal(icono.leerArgumentos(['--sin-fondo']).fondo, null);
  assert.throws(() => icono.leerArgumentos(['--transparente']), /opción desconocida: --transparente/);
});

test('leerPng: la anchura, la altura, la profundidad y el tipo de color del IHDR; lo que no es un PNG se rechaza', () => {
  assert.deepEqual(icono.leerPng(cabeceraPng({ anchura: 1024, altura: 1024 })), { anchura: 1024, altura: 1024, profundidad: 8, tipoColor: 6 });
  assert.throws(() => icono.leerPng(Buffer.from('<svg/>')), /no es un PNG/);
  assert.throws(() => icono.leerPng(Buffer.alloc(10)), /no es un PNG/);
});

test('rasterizar con un Chromium falso: viewport del tamaño pedido en claro, captura sin fondo recortada al cuadrado, el PNG escrito en el destino (creando la carpeta) y el navegador cerrado', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cuaderno-icono-'));
  try {
    const destino = path.join(base, 'nueva', 'icono.png'), anotaciones = {};
    const salida = await icono.rasterizar(SVG, destino, 128, { chromium: chromiumFalso(anotaciones) });
    assert.equal(salida, destino);
    assert.deepEqual(anotaciones.pagina, { viewport: { width: 128, height: 128 }, deviceScaleFactor: 1, colorScheme: 'light' });
    assert.deepEqual(anotaciones.captura, { type: 'png', omitBackground: true, clip: { x: 0, y: 0, width: 128, height: 128 } });
    assert.match(anotaciones.html, /border-radius:28px/, 'la placa por defecto (22 % de 128)');
    assert.deepEqual(icono.leerPng(fs.readFileSync(destino)), { anchura: 128, altura: 128, profundidad: 8, tipoColor: 6 });
    assert.equal(anotaciones.cerrado, true);
    assert.equal(anotaciones.lanzado, 1);
    // Sin placa: la página cambia; el resto, igual.
    const sinPlaca = {};
    await icono.rasterizar(SVG, path.join(base, 'sin-placa.png'), 64, { fondo: null, chromium: chromiumFalso(sinPlaca) });
    assert.doesNotMatch(sinPlaca.html, /border-radius/);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('rasterizar rechaza, sin abrir el navegador, lo que no es un SVG, un tamaño fuera de 1-4096 y un fondo que no es #rrggbb', async () => {
  const anotaciones = {}, chromium = chromiumFalso(anotaciones), destino = path.join(os.tmpdir(), 'no-se-escribe.png');
  await assert.rejects(icono.rasterizar('<html></html>', destino, 64, { chromium }), /no parece un SVG/);
  await assert.rejects(icono.rasterizar(SVG, destino, 0, { chromium }), /tamaño no válido: 0/);
  await assert.rejects(icono.rasterizar(SVG, destino, 4097, { chromium }), /tamaño no válido: 4097/);
  await assert.rejects(icono.rasterizar(SVG, destino, 64.5, { chromium }), /tamaño no válido/);
  await assert.rejects(icono.rasterizar(SVG, destino, 64, { chromium, fondo: 'blanco' }), /fondo no válido/);
  assert.equal(anotaciones.lanzado, undefined, 'no se ha lanzado ningún navegador');
  assert.equal(fs.existsSync(destino), false);
});
