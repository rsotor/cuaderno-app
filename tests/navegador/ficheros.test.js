'use strict';
// Ver cualquier fichero del cuaderno (fase 10): cada tipo se pinta bien al pulsarlo en el árbol, y un botón lo
// muestra en el Finder (o el Explorador). Ejemplos de cada tipo en ejemplos/curso-demo/material/.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { arrancar, hasta, visible, conTexto } = require('./ayuda');

let e;
const hoja = nombre => e.pagina.locator('#arbol a.hoja', { hasText: nombre });
const abrirDelArbol = async nombre => {
  const carpeta = e.pagina.locator('#arbol details', { has: e.pagina.locator('summary', { hasText: 'material' }) });
  if (!(await carpeta.evaluate(d => d.open))) await carpeta.locator('summary .nombre').click();
  await (await visible(hoja(nombre), 'árbol', `«${nombre}» en la carpeta material`)).click();
};
test.before(async () => { e = await arrancar({ kit: 'carpeta' }); });
test.after(async () => { if (e) await e.cerrar(); });

test('HTML: la página corre con su script, ocupa el ancho y casi todo el alto, y el árbol la titula con su <title>', async () => {
  await e.ir('#/');
  await abrirDelArbol('Calculadora 50/30/20');
  const marco = await visible(e.pagina.locator('#nota iframe.ejercicio'), 'html', 'el iframe de la página');
  const f = e.pagina.frameLocator('#nota iframe.ejercicio');
  await conTexto(f.locator('[data-parte="Ahorro"]'), /360,00/, 'html', 'el cálculo del script (20 % de 1800)');
  await f.locator('#ingresos').fill('2000');
  await conTexto(f.locator('[data-parte="Ahorro"]'), /400,00/, 'html', 'el cálculo tras cambiar los ingresos');
  const caja = await marco.boundingBox(), centro = await e.pagina.locator('#centro').boundingBox();
  assert.ok(caja.width > centro.width - 120, `html: la página mide ${caja.width} px de ancho en una columna de ${centro.width}; se queda encajada en la columna de lectura`);
  assert.ok(caja.height > 600, `html: la página mide ${caja.height} px de alto en una ventana de 800`);
});

test('PDF: se ve en el visor del navegador, a todo el ancho', async () => {
  await e.ir('#/');
  await abrirDelArbol('extracto-octubre.pdf');
  const visor = await visible(e.pagina.locator('#nota iframe.visor-pdf'), 'pdf', 'el visor');
  assert.match(await visor.getAttribute('src'), /\/fichero\/material\/extracto-octubre\.pdf$/);
  const r = await e.pagina.evaluate(src => fetch(src).then(x => x.headers.get('content-type')), await visor.getAttribute('src'));
  assert.equal(r, 'application/pdf', 'pdf: no se sirve como PDF');
  assert.ok((await visor.boundingBox()).height > 600, 'pdf: el visor no ocupa la ventana');
});

test('JSON con sangría; un JSON roto sale tal cual; CSV y TXT como texto; ninguno es editable', async () => {
  await e.ir('#/');
  await abrirDelArbol('gastos-octubre.json');
  await conTexto(e.pagina.locator('#nota pre.fichero-texto'), /\n  "ingresos": 1800,\n/, 'json', 'el JSON con sangría de dos espacios');
  fs.writeFileSync(path.join(e.c.base, 'material', 'roto.json'), '{"a": 1,,}');
  await visible(hoja('roto.json'), 'json', 'el JSON roto en el árbol (recarga en vivo)');
  await abrirDelArbol('roto.json');
  await conTexto(e.pagina.locator('#nota pre.fichero-texto'), /^\{"a": 1,,\}$/, 'json roto', 'el texto tal cual');
  await abrirDelArbol('gastos-octubre.csv');
  await conTexto(e.pagina.locator('#nota pre.fichero-texto'), /^concepto,categoria,importe\nAlquiler/, 'csv', 'las filas tal cual');
  await abrirDelArbol('apuntes-de-clase.txt');
  await conTexto(e.pagina.locator('#nota pre.fichero-texto'), /fondo de emergencia/, 'txt', 'el texto');
  assert.equal(await e.pagina.locator('#nota .bloque, #nota [data-accion="editar"]').count(), 0, 'txt: un fichero de texto sale con acciones de editar');
});

test('los enlaces de una nota abren el visor del fichero; el buscador encuentra el PDF por su nombre', async () => {
  await e.ir('#/n/material/material.md');
  await e.pagina.locator('#nota a', { hasText: 'gastos de octubre' }).click();
  await conTexto(e.pagina.locator('#nota pre.fichero-texto'), /"mes": "2026-10"/, 'enlace', 'el JSON tras pulsar el enlace relativo');
  await e.ir('#/n/material/material.md');
  await e.pagina.locator('#nota a.wiki', { hasText: 'extracto-octubre.pdf' }).click();
  await visible(e.pagina.locator('#nota iframe.visor-pdf'), 'enlace', 'el visor tras pulsar [[extracto-octubre.pdf]]');
  await e.pagina.fill('#buscador', 'extracto');
  await (await visible(e.pagina.locator('#arbol a.resultado', { hasText: 'extracto-octubre.pdf' }), 'buscador', 'el PDF entre los resultados')).click();
  await visible(e.pagina.locator('#nota iframe.visor-pdf'), 'buscador', 'el visor tras abrir el resultado');
  await e.pagina.fill('#buscador', ''); await e.pagina.press('#buscador', 'Escape');
});

test('mostrar en el Finder: el botón aparece al pasar el ratón por una fila y lanza el gestor de archivos; el de la miga, también', async () => {
  await e.ir('#/n/material/material.md');
  const fila = e.pagina.locator('#arbol .fila', { has: e.pagina.locator('a.hoja', { hasText: 'extracto-octubre.pdf' }) });
  const boton = fila.locator('button.mostrar');
  assert.equal(await boton.evaluate(b => getComputedStyle(b).opacity), '0', 'el botón se ve sin pasar el ratón');
  await fila.hover();
  await hasta(() => boton.evaluate(b => getComputedStyle(b).opacity === '1'), 'árbol', 'el botón no aparece al pasar el ratón');
  assert.match(await boton.getAttribute('aria-label'), /^Mostrar extracto-octubre\.pdf en /);
  const antes = e.lanzado.length;
  await boton.click();
  await hasta(() => e.lanzado.length === antes + 1, 'árbol', 'el botón no lanza el gestor de archivos');
  assert.ok(e.lanzado.at(-1).args.some(a => a.endsWith('extracto-octubre.pdf')), 'no señala el PDF');
  assert.equal(await e.pagina.locator('#nota iframe.visor-pdf').count(), 0, 'pulsar el botón ha abierto el PDF en vez de mostrarlo en la carpeta');
  // Sobre una carpeta: la muestra y no la pliega.
  const carpeta = e.pagina.locator('#arbol details', { has: e.pagina.locator('summary', { hasText: 'material' }) });
  await carpeta.locator('summary').hover();
  await carpeta.locator('summary button.mostrar').click();
  await hasta(() => e.lanzado.length === antes + 2, 'árbol', 'el botón de la carpeta no lanza nada');
  assert.ok(await carpeta.evaluate(d => d.open), 'el botón ha plegado la carpeta');
  // En la miga, siempre visible, para la nota abierta.
  await e.pagina.locator('#miga button.mostrar').click();
  await hasta(() => e.lanzado.length === antes + 3, 'miga', 'el botón de la miga no lanza nada');
  assert.ok(e.lanzado.at(-1).args.some(a => a.endsWith('material.md')), 'la miga no señala la nota abierta');
});
