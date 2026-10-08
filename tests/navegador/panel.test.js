'use strict';
// El cajón de la terminal (fase 9): dónde va, cuánto mide, cómo se ajusta y que varias sesiones convivan.
// Corre con una pty de mentira (tests/navegador/ayuda.js) para que la terminal abra de verdad sin node-pty.
const test = require('node:test');
const assert = require('node:assert/strict');
const { arrancar, ptyFalso, hasta, visible, oculto } = require('./ayuda');

let e, pty;
const caja = sel => e.pagina.locator(sel).boundingBox();
const abrirPanel = async () => { await e.pagina.click('#btn-terminal'); return visible(e.pagina.locator('#cajon'), 'panel', 'el cajón de la terminal'); };
const cerrarPanel = async () => { await e.pagina.click('#btn-cerrar-terminal'); await oculto(e.pagina.locator('#cajon'), 'panel', 'el cajón tras cerrarlo'); };
const ponerPosicion = async pos => {
  await e.pagina.click('#btn-ajustes'); await visible(e.pagina.locator('#ajustes-panel'), 'ajustes', 'el selector del panel');
  await e.pagina.selectOption('#ajustes-panel', pos);
  await hasta(() => e.pagina.evaluate(p => document.querySelector('#app').dataset.panel === p, pos), 'ajustes', `el panel no pasa a «${pos}» al cambiar el selector`);
  await e.pagina.click('#ajustes-cerrar');
};

test.before(async () => { pty = ptyFalso(); e = await arrancar({ kit: 'kit', pty }); });
test.after(async () => { if (e) await e.cerrar(); });

test('cerrado no reserva sitio; abierto a la derecha mide 420 px y se los quita a la columna de la nota', async () => {
  await e.ir('#/');
  const antes = await caja('#centro');
  const cajon = await abrirPanel();
  const c = await cajon.boundingBox(), centro = await caja('#centro');
  assert.equal(Math.round(c.width), 420, `panel: a la derecha mide ${c.width} px, no 420`);
  assert.equal(Math.round(centro.width), Math.round(antes.width) - 420, `panel: la columna de la nota pasa de ${antes.width} a ${centro.width}; debería perder justo 420`);
  assert.ok(c.x > centro.x, 'panel: el cajón no está a la derecha de la nota');
  await cerrarPanel();
  const despues = await caja('#centro');
  assert.equal(Math.round(despues.width), Math.round(antes.width), `panel: cerrado, la columna mide ${despues.width} y antes medía ${antes.width} (columna fantasma)`);
});

test('en Ajustes, «Abajo»: el cajón pasa bajo la nota con 320 px de alto y sigue ahí tras recargar', async () => {
  await e.ir('#/');
  await ponerPosicion('abajo');
  let cajon = await abrirPanel();
  let c = await cajon.boundingBox(), centro = await caja('#centro');
  assert.equal(Math.round(c.height), 320, `panel: abajo mide ${c.height} px de alto, no 320`);
  assert.ok(c.y > centro.y && Math.round(c.x) === Math.round(centro.x), `panel: abajo debería estar bajo la nota (nota y=${centro.y}, cajón y=${c.y}, x=${c.x} frente a ${centro.x})`);
  await cerrarPanel();
  await e.pagina.reload(); await e.pagina.locator('#miga strong').waitFor();
  cajon = await abrirPanel();
  c = await cajon.boundingBox(); centro = await caja('#centro');
  assert.ok(c.y > centro.y, `panel: tras recargar ya no está abajo (cajón y=${c.y}, nota y=${centro.y})`);
  await cerrarPanel();
  await ponerPosicion('derecha');
});

test('si no cabe (390 px, o 900 px con el panel a la derecha), el cajón ocupa toda la ventana', async () => {
  await e.ir('#/');
  for (const ancho of [390, 900]) {
    await e.pagina.setViewportSize({ width: ancho, height: 800 });
    // A 390 px la barra lateral está plegada y el botón no se ve: el atajo Ctrl ` abre el panel igual.
    await e.pagina.keyboard.press('Control+Backquote');
    const cajon = await visible(e.pagina.locator('#cajon'), 'panel', `el cajón con Ctrl \` a ${ancho} px`);
    const c = await cajon.boundingBox();
    assert.equal(Math.round(c.width), ancho, `panel: a ${ancho} px de ancho el cajón mide ${c.width}; debería ocupar toda la ventana`);
    assert.equal(Math.round(c.height), 800, `panel: a ${ancho} px de ancho el cajón mide ${c.height} de alto; debería ocupar toda la ventana`);
    await cerrarPanel();
  }
  await e.pagina.setViewportSize({ width: 1280, height: 800 });
});
