'use strict';
// Recorridos de la búsqueda en modal (⌘K, ⌘F y ⌘O; Ctrl en Windows y en la web): abrir, buscar, moverse, abrir la nota y
// cerrar con el foco de vuelta; la modal sigue al disco; apuntar una tarea. La pantalla se prueba aquí, contra la web
// (mismo código que la app); lo que solo existe en la app (el menú) está en tests/electron/menu.test.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { arrancar, ptyFalso, hasta, visible, oculto, conTexto, hashCumple, ficheroCumple } = require('./ayuda');
const { crearServidor } = require('../../servidor');

let e, pty;
test.before(async () => { pty = ptyFalso(); e = await arrancar({ kit: false, pty }); });
test.after(async () => { if (e) await e.cerrar(); });

const activo = () => e.pagina.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.tagName));
const filas = () => e.pagina.locator('#busqueda-lista [role="option"]');
const abierta = () => e.pagina.locator('#busqueda').isVisible();
const escribir = async texto => { await e.pagina.keyboard.type(texto); };

test('búsqueda en modal: Ctrl K, Ctrl F, Ctrl O y el botón del lateral la abren con el foco en el campo, y Esc devuelve el foco a donde estaba', async () => {
  await e.ir('#/');
  assert.equal(await e.pagina.locator('#busqueda').isVisible(), false, 'búsqueda: la modal está abierta sin pedirla');
  await e.pagina.focus('#link-inicio');
  await e.pagina.keyboard.press('Control+k');
  await visible(e.pagina.locator('#busqueda'), 'búsqueda', 'la modal con Ctrl K');
  assert.equal(await e.pagina.getAttribute('#busqueda', 'role'), 'dialog');
  assert.equal(await e.pagina.getAttribute('#busqueda', 'aria-modal'), 'true');
  assert.equal(await activo(), 'buscador', 'búsqueda: el foco no está en el campo');
  assert.equal(await e.pagina.getAttribute('#buscador', 'role'), 'combobox');
  assert.equal(await e.pagina.evaluate(() => document.querySelector('#app').inert), true, 'búsqueda: lo de detrás no está inerte');
  await e.pagina.keyboard.press('Escape');
  await oculto(e.pagina.locator('#busqueda'), 'búsqueda', 'la modal tras Esc');
  assert.equal(await activo(), 'link-inicio', 'búsqueda: Esc no devuelve el foco a donde estaba');
  assert.equal(await e.pagina.evaluate(() => document.querySelector('#app').inert), false);
  for (const tecla of ['Control+f', 'Control+o']) {
    await e.pagina.keyboard.press(tecla);
    await visible(e.pagina.locator('#busqueda'), 'búsqueda', `la modal con ${tecla}`);
    await e.pagina.keyboard.press('Escape');
    await oculto(e.pagina.locator('#busqueda'), 'búsqueda', `la modal tras Esc (${tecla})`);
  }
  await e.pagina.focus('#btn-buscar');
  await e.pagina.keyboard.press('Enter');
  await visible(e.pagina.locator('#busqueda'), 'búsqueda', 'la modal desde el botón del lateral');
  await e.pagina.keyboard.press('Escape');
  await oculto(e.pagina.locator('#busqueda'), 'búsqueda', 'la modal tras Esc (botón)');
  assert.equal(await activo(), 'btn-buscar', 'búsqueda: Esc no devuelve el foco al botón que la abrió');
});

test('búsqueda en modal: «interes» elige la nota con su carpeta, «capital» sale una vez, las flechas mueven la elegida sin sacar el foco del campo y Enter abre y cierra', async () => {
  await e.ir('#/');
  await e.pagina.keyboard.press('Control+k');
  await escribir('interes');
  const primera = await visible(filas().first(), 'búsqueda', 'resultados de «interes»');
  await hasta(async () => (await primera.getAttribute('aria-selected')) === 'true', 'búsqueda', 'la primera nota no queda elegida');
  assert.match(await primera.textContent(), /interes/);
  assert.match(await primera.textContent(), /conceptos/, 'búsqueda: la fila no dice su carpeta');
  assert.equal(await primera.getAttribute('data-ruta'), 'conceptos/interes.md');
  await e.pagina.fill('#buscador', 'capital');
  await conTexto(e.pagina.locator('#busqueda-lista'), /capital/, 'búsqueda', 'resultados de «capital»');
  await hasta(async () => (await e.pagina.locator('#busqueda-lista [data-ruta="conceptos/capital.md"]').count()) === 1, 'búsqueda', '«capital» no sale exactamente una vez');
  const n = await filas().count();
  assert.ok(n >= 2, `búsqueda: «capital» debería dar al menos dos notas (hay ${n})`);
  const id0 = await e.pagina.getAttribute('#buscador', 'aria-activedescendant');
  await e.pagina.keyboard.press('ArrowDown');
  const id1 = await e.pagina.getAttribute('#buscador', 'aria-activedescendant');
  assert.notEqual(id1, id0, 'búsqueda: ↓ no mueve aria-activedescendant');
  assert.equal(await activo(), 'buscador', 'búsqueda: ↓ ha sacado el foco del campo');
  await e.pagina.keyboard.press('ArrowUp'); await e.pagina.keyboard.press('ArrowUp');
  assert.equal(await e.pagina.evaluate(() => document.querySelectorAll('#busqueda-lista [role="option"]').length - 1), n - 1);
  assert.equal(await e.pagina.evaluate(() => document.querySelector('#busqueda-lista [aria-selected="true"]').id), await e.pagina.getAttribute('#buscador', 'aria-activedescendant'), 'búsqueda: la fila elegida no es la activedescendant');
  await e.pagina.keyboard.press('ArrowDown');   // vuelta al principio
  await e.pagina.keyboard.press('Enter');
  await hashCumple(e.pagina, /^#\/n\//, 'búsqueda');
  await oculto(e.pagina.locator('#busqueda'), 'búsqueda', 'la modal tras abrir una nota con Enter');
});

test('búsqueda en modal: el fragmento sale sin sintaxis de Markdown y Enter abre la nota en esa línea', async () => {
  await e.ir('#/');
  await e.pagina.keyboard.press('Control+k');
  await escribir('zanahoria');
  const fila = await visible(e.pagina.locator('#busqueda-lista [data-ruta="render/fragmentos-de-busqueda.md"]'), 'búsqueda', 'la nota con «zanahoria»');
  const texto = await fila.textContent();
  assert.match(texto, /Apuntar zanahoria en las tareas del domingo/, `búsqueda: el fragmento no es el de la casilla limpia («${texto}»)`);
  assert.ok(!/\[\[|\[!|- \[ \]/.test(texto), `búsqueda: el fragmento lleva sintaxis («${texto}»)`);
  await visible(fila.locator('mark'), 'búsqueda', 'el texto buscado resaltado');
  await e.pagina.keyboard.press('Enter');
  await hashCumple(e.pagina, /^#\/n\/render\/fragmentos-de-busqueda\.md\?l=\d+$/, 'búsqueda');
});

test('búsqueda en modal: Tab y Mayús Tab no sacan el foco de la modal', async () => {
  await e.ir('#/');
  await e.pagina.keyboard.press('Control+k');
  await escribir('capital');
  for (const tecla of ['Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab']) {
    await e.pagina.keyboard.press(tecla);
    assert.equal(await e.pagina.evaluate(() => !!document.activeElement.closest('#busqueda')), true, `búsqueda: ${tecla} ha sacado el foco de la modal`);
  }
  await e.pagina.keyboard.press('Escape');
});

test('búsqueda en modal: abrirla dos veces no apila nada, deja el texto seleccionado y el foco vuelve a donde estaba antes de la primera', async () => {
  await e.ir('#/');
  await e.pagina.focus('#link-inicio');
  await e.pagina.keyboard.press('Control+k');
  await escribir('capital');
  await e.pagina.keyboard.press('Control+k');
  await e.pagina.keyboard.press('Control+f');
  assert.equal(await e.pagina.locator('.modal:visible').count(), 1, 'búsqueda: hay más de un diálogo abierto');
  assert.deepEqual(await e.pagina.evaluate(() => { const b = document.querySelector('#buscador'); return [b.selectionStart, b.selectionEnd, b.value]; }), [0, 7, 'capital']);
  await e.pagina.keyboard.press('Escape');
  await oculto(e.pagina.locator('#busqueda'), 'búsqueda', 'la modal tras Esc');
  assert.equal(await activo(), 'link-inicio', 'búsqueda: tras abrirla dos veces el foco no vuelve al primer sitio');
  // La última consulta se recuerda y se abre seleccionada (P7).
  await e.pagina.keyboard.press('Control+k');
  assert.deepEqual(await e.pagina.evaluate(() => { const b = document.querySelector('#buscador'); return [b.selectionStart, b.selectionEnd, b.value]; }), [0, 7, 'capital'], 'búsqueda: no recuerda la última consulta');
  await e.pagina.keyboard.press('Escape');
});

test('búsqueda en modal: con el foco en la terminal, Ctrl K no abre la modal y llega al shell', async () => {
  await e.ir('#/');
  const base = pty.procesos.length;
  await e.pagina.click('#btn-terminal');
  await visible(e.pagina.locator('#cajon'), 'búsqueda', 'el cajón de la terminal');
  await hasta(() => e.pagina.evaluate(() => document.activeElement.classList.contains('xterm-helper-textarea')), 'búsqueda', 'el foco no está en la terminal');
  await e.pagina.keyboard.press('Control+k');
  await hasta(() => pty.procesos[base] && pty.procesos[base].escrito.includes('\x0b'), 'búsqueda', 'el shell no recibe Ctrl K (\\x0b)');
  assert.equal(await abierta(), false, 'búsqueda: Ctrl K en la terminal ha abierto la modal');
  await e.pagina.click('#btn-cerrar-terminal');
  await oculto(e.pagina.locator('#cajon'), 'búsqueda', 'el cajón tras cerrarlo');
});

test('búsqueda en modal: sin cuaderno abierto (pantalla de Cuadernos) ningún atajo la abre', async () => {
  const sin = crearServidor({});
  await new Promise(r => sin.listen(0, '127.0.0.1', r));
  const pagina = await e.navegador.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    await pagina.goto(sin.urlEntrada());
    await pagina.locator('#miga strong').waitFor();
    await pagina.locator('#lateral.sin-cuaderno').waitFor({ state: 'attached' });   // la pantalla de Cuadernos: no hay cuaderno abierto
    for (const tecla of ['Control+k', 'Control+f', 'Control+o']) {
      await pagina.keyboard.press(tecla);
      assert.equal(await pagina.locator('#busqueda').isVisible(), false, `búsqueda: ${tecla} abre la modal sin cuaderno`);
    }
  } finally { await pagina.close(); await new Promise(r => sin.close(r)); }
});

test('búsqueda en modal: a 390 px, abrirla desde el cajón del menú y cerrarla con Esc devuelve el foco al botón y deja el cajón abierto; la caja cabe', async () => {
  await e.pagina.setViewportSize({ width: 390, height: 800 });
  try {
    await e.ir('#/');
    await e.pagina.click('#btn-menu');
    await visible(e.pagina.locator('#btn-buscar'), 'búsqueda', 'el botón de buscar en el cajón del menú');
    await e.pagina.click('#btn-buscar');
    await visible(e.pagina.locator('#busqueda'), 'búsqueda', 'la modal a 390 px');
    const caja = await e.pagina.locator('#busqueda .busqueda-caja').boundingBox();
    assert.ok(caja.x >= 0 && caja.x + caja.width <= 390, `búsqueda: la caja desborda a 390 px (x ${caja.x}, ancho ${caja.width})`);
    assert.ok(await e.pagina.evaluate(() => document.documentElement.scrollWidth <= 390), 'búsqueda: la página desborda a 390 px con la modal abierta');
    await e.pagina.keyboard.press('Escape');
    await oculto(e.pagina.locator('#busqueda'), 'búsqueda', 'la modal tras Esc a 390 px');
    assert.equal(await activo(), 'btn-buscar', 'búsqueda: el foco no vuelve al botón');
    assert.equal(await e.pagina.evaluate(() => document.querySelector('#lateral').classList.contains('abierto')), true, 'búsqueda: Esc ha cerrado también el cajón del menú');
    await e.pagina.keyboard.press('Escape');
    await hasta(() => e.pagina.evaluate(() => !document.querySelector('#lateral').classList.contains('abierto')), 'búsqueda', 'el segundo Esc no cierra el cajón');
  } finally { await e.pagina.setViewportSize({ width: 1280, height: 800 }); }
});

test('búsqueda en modal: la caja mide 620 px a 1280 de ancho', async () => {
  await e.ir('#/');
  await e.pagina.keyboard.press('Control+k');
  await visible(e.pagina.locator('#busqueda .busqueda-caja'), 'búsqueda', 'la caja');
  const caja = await e.pagina.locator('#busqueda .busqueda-caja').boundingBox();
  assert.equal(Math.round(caja.width), 620);
  await e.pagina.keyboard.press('Escape');
});

test('búsqueda en modal: sigue al disco con la modal abierta (recarga en vivo, ocultar y papelera) sin perder texto, fila elegida ni foco', async () => {
  await e.ir('#/');
  await e.pagina.keyboard.press('Control+k');
  await escribir('capital');
  const elegida = () => e.pagina.evaluate(() => { const o = document.querySelector('#busqueda-lista [aria-selected="true"]'); return o && o.dataset.ruta; });
  await hasta(async () => (await filas().count()) >= 2, 'búsqueda', 'resultados de «capital»');
  await e.pagina.keyboard.press('ArrowDown');
  const antes = await elegida();
  // Una nota nueva con «capital» en el disco: su fila aparece sola.
  fs.writeFileSync(path.join(e.c.base, 'capital-nueva.md'), '# Nueva\n\nOtra nota que habla del capital.\n');
  await visible(e.pagina.locator('#busqueda-lista [data-ruta="capital-nueva.md"]'), 'búsqueda', 'la fila de la nota nueva, sin cerrar la modal');
  assert.equal(await e.pagina.inputValue('#buscador'), 'capital', 'búsqueda: la recarga ha cambiado el texto');
  assert.equal(await activo(), 'buscador', 'búsqueda: la recarga ha quitado el foco del campo');
  assert.equal(await elegida(), antes, 'búsqueda: la recarga ha cambiado la fila elegida');
  // Ocultar la carpeta: su fila se va y el árbol se repinta con la modal abierta.
  await e.pagina.evaluate(() => ocultar('conceptos', true));
  await hasta(async () => (await e.pagina.locator('#busqueda-lista [data-ruta^="conceptos/"]').count()) === 0, 'búsqueda', 'la fila de lo oculto sigue en la modal');
  assert.equal(await e.pagina.locator('#arbol summary', { hasText: 'conceptos' }).count(), 0, 'búsqueda: el árbol no se ha repintado sin la carpeta oculta');
  assert.equal(await e.pagina.inputValue('#buscador'), 'capital');
  // La papelera (simulada por el servidor de pruebas): la nota se va de la modal.
  await e.pagina.evaluate(() => mandarAPapelera('capital-nueva.md'));
  await hasta(async () => (await e.pagina.locator('#busqueda-lista [data-ruta="capital-nueva.md"]').count()) === 0, 'búsqueda', 'la fila de la nota a la papelera sigue en la modal');
  assert.equal(await activo(), 'buscador');
  await e.pagina.evaluate(() => ocultar('conceptos', false));
  await e.pagina.keyboard.press('Escape');
});

// ---------- apuntar una tarea desde la modal: escribe lo de siempre en tareas.md (la línea y el [[enlace]] de la nota abierta)
const tareasMd = () => e.c.leer('tareas.md');
const aviso = texto => visible(e.pagina.locator('.aviso-flotante', { hasText: texto }), 'búsqueda', `el aviso «${texto}»`);

test('búsqueda en modal: leyendo una nota, «Releer esto» + Ctrl Enter apunta la tarea enlazada a la nota; la modal se cierra', async () => {
  await e.ir('#/n/conceptos/interes.md');
  await conTexto(e.pagina.locator('#nota h1'), /^Interés$/, 'nota', 'el título');
  await e.pagina.keyboard.press('Control+k');
  await escribir('Releer esto');
  const fila = await visible(e.pagina.locator('#busqueda-lista [role="option"]').last(), 'búsqueda', 'la fila «Apuntar tarea»');
  assert.match(await fila.textContent(), /Apuntar tarea: «Releer esto»/);
  assert.equal(await fila.getAttribute('aria-selected'), 'false', 'búsqueda: la fila de tarea se elige sola');
  await e.pagina.keyboard.press('Control+Enter');
  await ficheroCumple(e.c, 'tareas.md', /- \[ \] Releer esto \[\[conceptos\/interes\]\]\r?\n$/, 'búsqueda');
  await aviso('Tarea añadida');
  await oculto(e.pagina.locator('#busqueda'), 'búsqueda', 'la modal tras apuntar');
});

test('búsqueda en modal: desde Tareas, «+ Comprar pan» + Enter apunta la tarea sin enlace; y tras apuntar la consulta se olvida (Ctrl K abre vacía y Enter no escribe)', async () => {
  await e.ir('#/tareas');
  await e.pagina.keyboard.press('Control+k');
  await escribir('+ Comprar pan');
  await e.pagina.keyboard.press('Enter');
  await ficheroCumple(e.c, 'tareas.md', /- \[ \] Comprar pan\r?\n$/, 'búsqueda');
  await oculto(e.pagina.locator('#busqueda'), 'búsqueda', 'la modal tras apuntar');
  const igual = tareasMd();
  await e.pagina.keyboard.press('Control+k');
  assert.equal(await e.pagina.inputValue('#buscador'), '', 'búsqueda: tras apuntar la tarea la consulta se recuerda');
  await e.pagina.keyboard.press('Enter');
  await e.pagina.waitForTimeout(300);
  assert.equal(tareasMd(), igual, 'búsqueda: Enter con el campo vacío ha escrito algo en tareas.md');
  await e.pagina.keyboard.press('Escape');
});

test('búsqueda en modal: con flechas hasta la fila «Apuntar tarea», Enter la apunta', async () => {
  await e.ir('#/tareas');
  await e.pagina.keyboard.press('Control+k');
  await escribir('zanahoria');
  const filaTarea = e.pagina.locator('#busqueda-lista [role="option"]').last();
  await visible(filaTarea, 'búsqueda', 'la fila «Apuntar tarea»');
  await e.pagina.keyboard.press('ArrowUp');   // desde la primera nota, con vuelta: la última, la de tarea
  await hasta(async () => (await filaTarea.getAttribute('aria-selected')) === 'true', 'búsqueda', 'las flechas no llegan a la fila de tarea');
  await e.pagina.keyboard.press('Enter');
  await ficheroCumple(e.c, 'tareas.md', /- \[ \] zanahoria\r?\n$/, 'búsqueda');
});

test('búsqueda en modal: sin resultados, Enter no apunta nada (la fila de tarea nunca se elige sola)', async () => {
  await e.ir('#/tareas');
  const igual = tareasMd();
  await e.pagina.keyboard.press('Control+k');
  await escribir('Pendientes de hoy');
  await conTexto(e.pagina.locator('#busqueda-nada'), /Nada con «Pendientes de hoy»/, 'búsqueda', 'el aviso de que no hay resultados');
  assert.equal(await e.pagina.locator('#busqueda-lista [role="option"]').last().getAttribute('aria-selected'), 'false');
  await e.pagina.keyboard.press('Enter');
  await e.pagina.waitForTimeout(400);
  assert.equal(tareasMd(), igual, 'búsqueda: Enter sin resultados ha escrito en tareas.md');
  assert.equal(await abierta(), true, 'búsqueda: Enter sin resultados ha cerrado la modal');
  await e.pagina.keyboard.press('Escape');
});
