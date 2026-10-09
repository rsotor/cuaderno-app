'use strict';
// Ocultar carpetas o ficheros del árbol, solo en la app (Roberto, 2026-10-09), y el botón de Ajustes con su nombre.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { arrancar, hasta, visible, oculto } = require('./ayuda');

let e;
test.before(async () => { e = await arrancar({ kit: false }); });
test.after(async () => { if (e) await e.cerrar(); });

test('ocultar una carpeta desde el árbol: desaparece, sigue oculta al recargar, el disco no cambia y Ajustes la devuelve', async () => {
  await e.ir('#/');
  const resumen = e.pagina.locator('#arbol summary', { hasText: 'conceptos' });
  await resumen.hover();
  const boton = resumen.locator('button.ocultar');
  await hasta(() => boton.evaluate(b => getComputedStyle(b).opacity === '1'), 'árbol', 'el botón de ocultar no aparece al pasar el ratón');
  assert.equal(await boton.getAttribute('aria-label'), 'Ocultar conceptos');
  await boton.click();
  await oculto(resumen, 'árbol', 'la carpeta «conceptos» tras ocultarla');
  assert.ok(fs.existsSync(path.join(e.c.base, 'conceptos', 'capital.md')), 'ocultar ha tocado el disco');
  await e.pagina.reload(); await e.pagina.locator('#miga strong').waitFor();
  assert.equal(await e.pagina.locator('#arbol summary', { hasText: 'conceptos' }).count(), 0, 'tras recargar, la carpeta vuelve a salir');
  await e.pagina.click('#btn-ajustes');
  const fila = await visible(e.pagina.locator('#lista-ocultas li', { hasText: 'conceptos' }), 'ajustes', 'la carpeta en «Ocultas en este cuaderno»');
  await fila.locator('button', { hasText: 'Mostrar' }).click();
  await oculto(e.pagina.locator('#ajustes-ocultas'), 'ajustes', 'la sección de ocultas sin nada oculto');
  await e.pagina.click('#ajustes-cerrar');
  await visible(e.pagina.locator('#arbol summary', { hasText: 'conceptos' }), 'árbol', 'la carpeta de vuelta en el árbol');
});

test('ocultar un fichero no abre la nota, y con nada oculto Ajustes no enseña la sección', async () => {
  await e.ir('#/');
  const fila = e.pagina.locator('#arbol .fila', { has: e.pagina.locator('a.hoja[data-ruta="inicio.md"]') });
  await fila.hover();
  await fila.locator('button.ocultar').click();
  await oculto(fila, 'árbol', 'la nota tras ocultarla');
  await e.pagina.click('#btn-ajustes');
  await (await visible(e.pagina.locator('#lista-ocultas li', { hasText: 'inicio.md' }), 'ajustes', 'la nota en la lista')).locator('button').click();
  await oculto(e.pagina.locator('#ajustes-ocultas'), 'ajustes', 'la sección vacía');
  await e.pagina.click('#ajustes-cerrar');
});

test('el botón de Ajustes dice «Ajustes» y lleva la rueda dentada', async () => {
  await e.ir('#/');
  const b = e.pagina.locator('#btn-ajustes');
  assert.equal((await b.textContent()).trim(), 'Ajustes');
  assert.equal(await b.locator('use').getAttribute('href'), '#i-engranaje');
});

test('aviso de reinicio: oculto normalmente; sale si una llamada a la app da 404 (servidor de una versión anterior)', async () => {
  await e.ir('#/');
  assert.equal(await e.pagina.locator('#aviso-reinicio').isVisible(), false, 'el aviso sale sin motivo');
  await e.pagina.evaluate(() => api('/api/no-existe').catch(() => {}));
  await visible(e.pagina.locator('#aviso-reinicio'), 'aviso', 'el aviso de reiniciar tras un 404 de la API');
  await e.pagina.click('#aviso-cerrar');
  await oculto(e.pagina.locator('#aviso-reinicio'), 'aviso', 'la × no cierra el aviso');
  await e.pagina.evaluate(() => api('/api/no-existe').catch(() => {}));
  assert.equal(await e.pagina.locator('#aviso-reinicio').isVisible(), false, 'el aviso cerrado vuelve a salir');
});
