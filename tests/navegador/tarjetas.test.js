'use strict';
// Recorrido del modo tarjeta: destapar, «la sabía» escribe las dos casillas en el fichero y pasa a la siguiente;
// las teclas también valen. El fichero de flashcards del cuaderno de prueba tiene dos tarjetas.
const test = require('node:test');
const assert = require('node:assert/strict');
const { arrancar, visible, oculto, conTexto, ficheroCumple } = require('./ayuda');

let e;
test.before(async () => { e = await arrancar({ kit: 'kit' }); });
test.after(async () => { if (e) await e.cerrar(); });

const RUTA = 'flashcards/01-tarjetas.md';

test('modo tarjeta: destapar enseña la respuesta y «la sabía» marca ✅ y desmarca ❌ en el fichero', async () => {
  await e.ir(`#/n/${RUTA}`);
  const tarjeta = await visible(e.pagina.locator('#nota .tarjeta'), 'tarjetas', 'la tarjeta');
  await conTexto(e.pagina.locator('#nota h1'), /^Flashcards · 01-01-01-sesion$/, 'tarjetas', 'el título');
  await conTexto(e.pagina.locator('#nota .resumen'), /^2 tarjetas: 1 sabidas, 0 falladas$/, 'tarjetas', 'el resumen de sabidas y falladas');
  await conTexto(tarjeta.locator('.cabecera'), /Tarjeta 1 de 2/, 'tarjetas', 'el número de tarjeta');
  await conTexto(tarjeta.locator('.pregunta-tarjeta'), /¿Qué es el interés\?/, 'tarjetas', 'la pregunta');
  assert.equal(await tarjeta.locator('.respuesta-tarjeta').count(), 0, 'tarjetas: la respuesta se ve antes de destapar');
  await tarjeta.locator('button[data-tarjeta="destapar"]').click();
  await conTexto(tarjeta.locator('.respuesta-tarjeta'), /El precio del dinero\./, 'tarjetas', 'la respuesta tras destapar');
  await tarjeta.locator('button[data-tarjeta="sabia"]').click();
  await ficheroCumple(e.c, RUTA, /> El precio del dinero\.\n\n- \[x\] ✅ la sabía\n- \[ \] ❌ no la sabía\n\*Caja 1 de 5/, 'tarjetas');
  await conTexto(e.pagina.locator('#nota .tarjeta .cabecera'), /Tarjeta 2 de 2/, 'tarjetas', 'el paso a la tarjeta siguiente');
  await conTexto(e.pagina.locator('#nota .resumen'), /^2 tarjetas: 2 sabidas, 0 falladas$/, 'tarjetas', 'el resumen actualizado');
  await oculto(e.pagina.locator('#nota .respuesta-tarjeta'), 'tarjetas', 'la respuesta de la tarjeta nueva (debería estar tapada)');
});

test('teclado: espacio destapa, 2 marca «no la sabía» y la flecha izquierda vuelve a la anterior con su marca', async () => {
  await e.pagina.keyboard.press(' ');
  await conTexto(e.pagina.locator('#nota .respuesta-tarjeta'), /Unidad de cuenta/, 'tarjetas', 'la respuesta tras pulsar espacio');
  await e.pagina.keyboard.press('2');
  await ficheroCumple(e.c, RUTA, /- \[ \] ✅ la sabía\n- \[x\] ❌ no la sabía\n\*Caja 2 de 5/, 'tarjetas');
  await conTexto(e.pagina.locator('#nota .tarjeta .marca'), /no la sabías/, 'tarjetas', 'la marca ❌ en la última tarjeta');
  await conTexto(e.pagina.locator('#nota .resumen'), /^2 tarjetas: 1 sabidas, 1 falladas$/, 'tarjetas', 'el resumen');
  await e.pagina.keyboard.press('ArrowLeft');
  await conTexto(e.pagina.locator('#nota .tarjeta .cabecera'), /Tarjeta 1 de 2.*la sabías/, 'tarjetas', 'la primera tarjeta con su marca ✅');
});
