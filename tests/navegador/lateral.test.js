'use strict';
// Recorrido de la barra lateral plegable en escritorio (Roberto, 2026-10-09): un botón en la barra, otro en la miga para
// volver a abrirla, Ctrl+\ (o Cmd+\), el estado recordado en este navegador y #centro que gana el ancho (con el índice
// de la nota recalculando). A 760 px o menos sigue su menú de siempre. Sin kit: es la base.
const test = require('node:test');
const assert = require('node:assert/strict');
const { arrancar, hasta, visible, oculto } = require('./ayuda');

let e;
test.before(async () => { e = await arrancar({ kit: false }); });
test.after(async () => { if (e) await e.cerrar(); });

const anchoCentro = () => e.pagina.evaluate(() => Math.round(document.querySelector('#centro').getBoundingClientRect().width));

test('barra lateral: el botón pliega, #centro gana el ancho, el índice recalcula y el botón de la miga la abre', async () => {
  await e.pagina.setViewportSize({ width: 1300, height: 900 });
  await e.ir('#/n/lectura/mercado-de-la-plaza.md');
  await e.pagina.evaluate(() => localStorage.clear());
  await visible(e.pagina.locator('#nota h2').first(), 'barra lateral', 'la nota larga');
  const abierta = await anchoCentro();
  await oculto(e.pagina.locator('#indice'), 'barra lateral', 'el índice con la barra abierta (no cabe a 1300 px)');
  assert.equal(await e.pagina.getAttribute('#btn-plegar', 'aria-expanded'), 'true', 'barra lateral: el botón de plegar no dice que está abierta');
  assert.equal(await e.pagina.getAttribute('#btn-plegar', 'aria-label'), 'Plegar la barra lateral');
  await e.pagina.click('#btn-plegar');
  await oculto(e.pagina.locator('#lateral'), 'barra lateral', 'la barra tras plegarla');
  const plegada = await anchoCentro();
  assert.equal(plegada, abierta + 280, `barra lateral: #centro mide ${plegada} px plegada y ${abierta} abierta; debería ganar 280`);
  const d = await visible(e.pagina.locator('#btn-desplegar'), 'barra lateral', 'el botón para volver a abrirla');
  assert.equal(await d.getAttribute('aria-expanded'), 'false', 'barra lateral: el botón de abrir no dice que está plegada');
  assert.ok(await d.getAttribute('aria-label'), 'barra lateral: el botón de abrir no tiene nombre');
  await visible(e.pagina.locator('#indice'), 'barra lateral', 'el índice de la nota con el espacio ganado');
  await d.click();
  await visible(e.pagina.locator('#lateral'), 'barra lateral', 'la barra tras abrirla');
  assert.equal(await anchoCentro(), abierta, 'barra lateral: abierta otra vez, #centro no recupera su ancho');
  await oculto(e.pagina.locator('#indice'), 'barra lateral', 'el índice al volver a abrirla');
});

test('barra lateral: se recuerda tras recargar y Ctrl+\\ la pliega y la abre', async () => {
  await e.pagina.setViewportSize({ width: 1300, height: 900 });
  await e.ir('#/n/lectura/mercado-de-la-plaza.md');
  await e.pagina.evaluate(() => localStorage.clear());
  await e.pagina.keyboard.press('Control+\\');
  await oculto(e.pagina.locator('#lateral'), 'barra lateral', 'la barra tras Ctrl+\\');
  await e.pagina.reload(); await e.pagina.locator('#miga strong').waitFor();
  await oculto(e.pagina.locator('#lateral'), 'barra lateral', 'la barra tras recargar (se recuerda)');
  assert.equal(await e.pagina.getAttribute('#btn-desplegar', 'aria-expanded'), 'false');
  await e.pagina.keyboard.press('Control+\\');
  await visible(e.pagina.locator('#lateral'), 'barra lateral', 'la barra tras el segundo Ctrl+\\');
  await e.pagina.reload(); await e.pagina.locator('#miga strong').waitFor();
  await visible(e.pagina.locator('#lateral'), 'barra lateral', 'la barra tras recargar abierta (ya no se recuerda plegada)');
  // Ctrl K con la barra plegada abre la modal de búsqueda y la barra sigue plegada (la búsqueda ya no vive en ella).
  await e.pagina.keyboard.press('Control+\\');
  await e.pagina.keyboard.press('Control+k');
  await visible(e.pagina.locator('#busqueda'), 'barra lateral', 'la modal de búsqueda con Ctrl K y la barra plegada');
  assert.equal(await e.pagina.evaluate(() => document.activeElement.id), 'buscador', 'barra lateral: Ctrl K no enfoca el campo de la modal');
  await oculto(e.pagina.locator('#lateral'), 'barra lateral', 'la barra, que sigue plegada con la modal abierta');
  await e.pagina.keyboard.press('Escape');
  await oculto(e.pagina.locator('#busqueda'), 'barra lateral', 'la modal tras Esc');
  await e.pagina.keyboard.press('Control+\\');
  await e.pagina.evaluate(() => localStorage.clear());
});

test('barra lateral: a 760 px no hay botón de plegar y el menú sigue siendo el de siempre', async () => {
  await e.pagina.setViewportSize({ width: 760, height: 800 });
  await e.ir('#/n/lectura/mercado-de-la-plaza.md');
  assert.equal(await e.pagina.locator('#btn-plegar').isVisible(), false, 'barra lateral: el botón de plegar sale a 760 px');
  assert.equal(await e.pagina.locator('#btn-desplegar').isVisible(), false, 'barra lateral: el botón de abrir sale a 760 px');
  await e.pagina.click('#btn-menu');
  await visible(e.pagina.locator('#lateral'), 'barra lateral', 'el menú a 760 px');
});
