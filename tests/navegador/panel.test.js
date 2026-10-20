'use strict';
// El cajón de la terminal (fase 9): dónde va, cuánto mide, cómo se ajusta y que varias sesiones convivan.
// Corre con una pty de mentira (tests/navegador/ayuda.js) para que la terminal abra de verdad sin node-pty.
const test = require('node:test');
const assert = require('node:assert/strict');
const { arrancar, ptyFalso, hasta, visible, oculto, conTexto } = require('./ayuda');
const { crearCuaderno } = require('../ayuda');

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

test.before(async () => { pty = ptyFalso(); e = await arrancar({ kit: true, pty }); });
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
  // Un clic sin arrastrar no guarda: antes cada clic del doble clic guardaba el ancho de antes, y en Windows una de esas
  // respuestas llegó después de la del 420 y lo pintó en 520 (CI, 2026-10-10).
  const guardados = [];
  const oir = r => { if (r.method() === 'POST' && r.url().endsWith('/api/configuracion')) guardados.push(r.url()); };
  e.pagina.on('request', oir);
  await e.pagina.click('.cajon-asa');
  await e.pagina.waitForTimeout(300);
  e.pagina.off('request', oir);
  assert.deepEqual(guardados, [], 'panel: un clic en el asa sin arrastrar ha guardado el tamaño');
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

// ---------- sesiones de terminal
// Lo que enseña la sesión activa, leído del búfer de xterm: con el pintado por WebGL no hay filas en el HTML.
const textoTerminal = () => e.pagina.evaluate(() => { const s = sesionActiva; if (!s) return ''; const b = s.term.buffer.active, lineas = [];
  for (let i = 0; i < b.length; i++) lineas.push(b.getLine(i).translateToString(true)); return lineas.join('\n'); });
const enTerminal = async (re, que) => { let texto = ''; await hasta(async () => { texto = await textoTerminal(); return re.test(texto); }, 'terminal', () => `${que}: se esperaba ${re}, hay «${texto.trim().slice(-120)}»`); };
const pestanas = () => e.pagina.locator('.sesion-pestana');
const recargar = async () => { await e.pagina.reload(); await e.pagina.locator('#miga strong').waitFor(); };

test('un solo botón, Terminal; el profesor (desde un Guardar que falla) convive con el shell sin matarlo, y volver a él conserva lo escrito', async () => {
  await e.ir('#/'); const base = pty.procesos.length;
  assert.equal(await e.pagina.locator('#btn-profesor').count(), 0, 'terminal: sigue habiendo un botón Profesor junto a Terminal');
  await abrirPanel();
  await hasta(() => pty.procesos.length === base + 1, 'terminal', 'abrir el panel no abre una pty');
  await hasta(() => e.pagina.evaluate(() => document.activeElement.classList.contains('xterm-helper-textarea')), 'terminal', 'al abrir, el foco no está en la terminal');
  await e.pagina.keyboard.type('hola');
  await hasta(() => pty.procesos[base].escrito.includes('hola'), 'terminal', `lo tecleado no llega a la pty (llegó «${pty.procesos[base].escrito}»)`);
  await enTerminal(/hola/, 'el eco en la pantalla');
  assert.ok(await e.pagina.locator('#terminal .sesion:not([hidden]) .xterm-screen canvas').count() > 0, 'terminal: no se pinta con WebGL (no hay canvas en la pantalla de xterm)');
  // Shift y Option+Enter: salto de línea (\n) para Claude Code o Codex, no el \r de Enter que envía el mensaje.
  const antes = pty.procesos[base].escrito.length;
  await e.pagina.keyboard.press('Shift+Enter'); await e.pagina.keyboard.press('Alt+Enter'); await e.pagina.keyboard.press('Enter');
  await hasta(() => pty.procesos[base].escrito.slice(antes) === '\n\n\r', 'terminal', `Shift/Option+Enter no mandan \\n (llegó ${JSON.stringify(pty.procesos[base].escrito.slice(antes))})`);
  // ⌘C con un programa que se queda el ratón (Claude Code a pantalla completa): tras arrastrar, ⌘C le manda Ctrl+C (copia su
  // selección); sin arrastrar, nada, porque Ctrl+C sin selección interrumpiría el programa.
  pty.procesos[base].datos('\x1b[?1003h');
  await hasta(() => e.pagina.evaluate(() => sesionActiva.term.modes.mouseTrackingMode === 'any'), 'terminal', 'el programa no se queda el ratón');
  const pantalla = await e.pagina.locator('#terminal .sesion:not([hidden]) .xterm-screen').boundingBox();
  const sinCtrlC = () => pty.procesos[base].escrito.split('\u0003').length - 1;
  const ctrlCAntes = sinCtrlC();
  await e.pagina.keyboard.press('Meta+C'); await e.pagina.waitForTimeout(200);
  assert.equal(sinCtrlC(), ctrlCAntes, 'terminal: ⌘C sin haber arrastrado manda Ctrl+C e interrumpiría el programa');
  await e.pagina.mouse.move(pantalla.x + 5, pantalla.y + 5); await e.pagina.mouse.down(); await e.pagina.mouse.move(pantalla.x + 120, pantalla.y + 5, { steps: 6 }); await e.pagina.mouse.up();
  await e.pagina.keyboard.press('Meta+C');
  await hasta(() => sinCtrlC() === ctrlCAntes + 1, 'terminal', 'tras arrastrar, ⌘C no manda Ctrl+C al programa');
  await e.pagina.keyboard.press('Meta+C'); await e.pagina.waitForTimeout(200);
  assert.equal(sinCtrlC(), ctrlCAntes + 1, 'terminal: un segundo ⌘C sin arrastrar otra vez manda otro Ctrl+C');
  pty.procesos[base].datos('\x1b[?1003l');
  // Un Guardar que falla ofrece «Abrir con el profesor»: la única puerta al profesor que queda fuera del botón Terminal.
  await e.pagina.evaluate(() => mostrarResultado('Guardar', { codigo: 1, salida: 'conflicto' }));
  await e.pagina.click('#resultado-profesor');
  await hasta(() => pty.procesos.length === base + 2, 'terminal', 'Profesor no abre su propia pty');
  assert.equal(pty.procesos[base + 1].cmd, 'claude', `terminal: Profesor lanza «${pty.procesos[base + 1].cmd}», no el comando del adaptador`);
  await conTexto(e.pagina.locator('.sesion-pestana.activa'), /Profesor/, 'terminal', 'la pestaña activa');
  // El canal del Profesor abre algo después de que el servidor lance su pty; si se cambia de pestaña antes, abre oculto (mide 0) y no manda tamaño.
  await hasta(() => pty.procesos[base + 1].redimensiones.length > 0, 'terminal', 'el Profesor, a la vista, no manda su tamaño a la pty');
  assert.equal(pty.procesos[base].muerto, false, 'terminal: abrir al profesor ha matado el shell');
  await e.pagina.click('.sesion-pestana:not(.activa) [data-activar]');
  await conTexto(e.pagina.locator('.sesion-pestana.activa'), /^Terminal/, 'terminal', 'volver a la pestaña del shell');
  await enTerminal(/hola/, 'lo escrito en el shell tras volver a él');
  // Ninguna sesión ha mandado nunca un tamaño de 0 columnas o filas (la pestaña oculta mide 0).
  const ceros = pty.procesos.slice(base).flatMap(p => p.redimensiones).filter(r => !(r.cols > 0 && r.rows > 0));
  assert.deepEqual(ceros, [], `terminal: se han mandado tamaños a 0 a la pty: ${JSON.stringify(ceros)}`);
  assert.ok(pty.procesos.slice(base).every(p => p.redimensiones.length > 0), 'terminal: alguna sesión no ha recibido ningún tamaño');
});

test('si se cae la conexión (el Mac se duerme), la pestaña se reengancha sola a la misma pty y no la da por cerrada', async () => {
  await e.ir('#/'); await abrirPanel();
  const base = pty.procesos.length;
  await e.pagina.click('#btn-nueva-sesion');
  await hasta(() => pty.procesos.length === base + 1, 'terminal', 'no se abre la pty');
  await hasta(() => e.pagina.evaluate(() => sesionActiva.ws && sesionActiva.ws.readyState === 1), 'terminal', 'el socket no abre');
  const p = pty.procesos[base];
  await e.pagina.evaluate(() => sesionActiva.ws.close(1000));   // la caída, vista desde la pestaña
  await hasta(() => e.pagina.evaluate(() => sesionActiva.ws && sesionActiva.ws.readyState === 1 && !sesionActiva.reconectando), 'terminal', 'la pestaña no se reengancha');
  p.datos('tras la caída');
  await enTerminal(/tras la caída/, 'lo que escribe la pty tras reengancharse');
  assert.equal(pty.procesos.length, base + 1, 'terminal: reengancharse abrió otra pty');
  assert.equal(p.muerto, false, 'terminal: la caída mató la pty');
  assert.equal(await e.pagina.locator('.sesion-pestana.activa.cerrada').count(), 0, 'terminal: la pestaña se da por cerrada');
  await e.pagina.keyboard.type('sigo');
  await hasta(() => p.escrito.includes('sigo'), 'terminal', 'lo tecleado tras reengancharse no llega a la misma pty');
});

test('si el programa termina, la pestaña lo dice y Enter abre otra igual; cerrar la última deja el aviso y + abre una', async () => {
  await e.ir('#/'); await recargar(); const base = pty.procesos.length;
  await abrirPanel();
  await hasta(() => pty.procesos.length === base + 1, 'terminal', 'abrir el panel no abre una pty');
  pty.procesos[base].salir();
  await visible(e.pagina.locator('.sesion-pestana.cerrada'), 'terminal', 'la pestaña marcada como cerrada');
  await enTerminal(/terminal cerrada/, 'el aviso de terminal cerrada');
  await e.pagina.click('#terminal .sesion:not([hidden])'); await e.pagina.keyboard.press('Enter');
  await hasta(() => pty.procesos.length === base + 2, 'terminal', 'Enter en una terminal cerrada no abre otra');
  await oculto(e.pagina.locator('.sesion-pestana.cerrada'), 'terminal', 'la marca de cerrada tras reabrir');
  await e.pagina.click('.sesion-pestana [data-cerrar]');
  await visible(e.pagina.locator('.sin-sesiones'), 'terminal', 'el aviso de que no hay terminales');
  assert.equal(await pestanas().count(), 0, 'terminal: quedan pestañas tras cerrar la única');
  await hasta(() => pty.procesos[base + 1].muerto, 'terminal', 'cerrar la pestaña no mata su pty');
  await e.pagina.click('#btn-nueva-sesion');
  await hasta(() => pty.procesos.length === base + 3, 'terminal', '+ no abre otra terminal');
  await oculto(e.pagina.locator('.sin-sesiones'), 'terminal', 'el aviso con una terminal abierta');
});

test('Ctrl ` con el foco en la terminal cierra el cajón y devuelve el foco al botón Terminal', async () => {
  await e.ir('#/'); await recargar();
  await abrirPanel();
  await e.pagina.click('#terminal .sesion:not([hidden])');
  await e.pagina.keyboard.press('Control+Backquote');
  await oculto(e.pagina.locator('#cajon'), 'terminal', 'el cajón tras Ctrl `');
  assert.equal(await e.pagina.evaluate(() => document.activeElement.id), 'btn-terminal', 'terminal: el foco no vuelve al botón Terminal');
});

test('cambiar de cuaderno cierra las terminales: la pty muere y no queda ninguna pestaña', async () => {
  await e.ir('#/'); await recargar(); const base = pty.procesos.length;
  await abrirPanel();
  await hasta(() => pty.procesos.length === base + 1, 'terminal', 'abrir el panel no abre una pty');
  const otro = crearCuaderno({ kit: false });
  try {
    await e.ir('#/cuadernos');
    await e.pagina.fill('#ruta-carpeta', otro.raiz); await e.pagina.press('#ruta-carpeta', 'Enter');
    await conTexto(e.pagina.locator('#nombre-curso'), new RegExp(otro.nombre || '.'), 'cuadernos', 'el nombre del cuaderno nuevo');
    await hasta(() => pty.procesos[base].muerto, 'cuadernos', 'cambiar de cuaderno no mata la pty del anterior');
    await hasta(async () => (await pestanas().count()) === 0, 'cuadernos', 'siguen las pestañas de terminal del cuaderno anterior');
  } finally { otro.borrar(); }
});
