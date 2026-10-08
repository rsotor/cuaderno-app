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

// Lo que dice el servidor que hay guardado, para comprobar que soltar el asa lo guardó.
const anchoGuardado = () => e.pagina.evaluate(() => fetch('/api/info').then(r => r.json()).then(i => i.configuracion.panel_ancho));
const arrastrarAsa = async dx => {
  const a = await e.pagina.locator('.cajon-asa').boundingBox();
  const x = a.x + a.width / 2, y = a.y + a.height / 2;
  await e.pagina.mouse.move(x, y); await e.pagina.mouse.down(); await e.pagina.mouse.move(x + dx, y, { steps: 6 }); await e.pagina.mouse.up();
};

test('el asa: arrastrar cambia el ancho y lo guarda; no pasa del sitio de la nota; doble clic vuelve a 420', async () => {
  await e.ir('#/');
  await abrirPanel();
  await arrastrarAsa(-60);
  await hasta(async () => (await anchoGuardado()) === 480, 'panel', `soltar el asa no guarda 480 px (hay ${await anchoGuardado()})`);
  assert.equal(Math.round((await caja('#cajon')).width), 480, 'panel: tras arrastrar 60 px el cajón no mide 480');
  await cerrarPanel(); await e.pagina.reload(); await e.pagina.locator('#miga strong').waitFor(); await abrirPanel();
  assert.equal(Math.round((await caja('#cajon')).width), 480, 'panel: tras recargar no vuelve a medir 480');
  // Hasta el borde izquierdo: la nota conserva 480 px, el cajón se queda en 1280 - 280 - 480 = 520.
  await arrastrarAsa(-800);
  await hasta(async () => (await anchoGuardado()) === 520, 'panel', `arrastrar hasta el borde no se queda en 520 px (hay ${await anchoGuardado()})`);
  assert.ok((await caja('#centro')).width >= 480, 'panel: la columna de la nota ha bajado de 480 px');
  await e.pagina.dblclick('.cajon-asa');
  await hasta(async () => (await anchoGuardado()) === 420, 'panel', `doble clic en el asa no vuelve a 420 (hay ${await anchoGuardado()})`);
  assert.equal(Math.round((await caja('#cajon')).width), 420, 'panel: tras el doble clic el cajón no mide 420');
  await cerrarPanel();
});

test('un ancho guardado que no cabe (3000 px) se acota al abrir, no se aplica tal cual', async () => {
  await e.pagina.evaluate(() => fetch('/api/configuracion', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ panel_ancho: 3000 }) }));
  await e.ir('#/');
  await abrirPanel();
  assert.equal(Math.round((await caja('#cajon')).width), 520, `panel: con 3000 px guardados el cajón mide ${(await caja('#cajon')).width}; debería acotarse a 520`);
  await e.pagina.dblclick('.cajon-asa');
  await hasta(async () => (await anchoGuardado()) === 420, 'panel', 'el doble clic no deja el ancho en 420');
  await cerrarPanel();
});
