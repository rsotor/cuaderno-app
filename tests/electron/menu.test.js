'use strict';
// El menú de la app de escritorio (electron/menu.js, T5) con el Electron de verdad lanzado por Playwright, sobre una copia
// del cuaderno de ejemplo sin kit con un repositorio debajo (git init, como hacen los recorridos de uso): los elementos
// del menú se «pulsan» desde el proceso principal (`Menu.getApplicationMenu().getMenuItemById(id).click()`, lo mismo que
// hace el acelerador) y se mira lo que pasa en la pantalla y en el fichero: Guardar abre el diálogo de Guardar y el commit
// se hace por /api/guardar; Abrir nota…, Buscar… y Nueva tarea abren la modal de búsqueda; Ajustes… abre Ajustes; Abrir carpeta… (el
// diálogo del sistema, en pruebas CUADERNO_DIALOGO_PRUEBA) cambia de cuaderno y el menú se reconstruye con el reciente
// nuevo; Cuadernos recientes vuelve al anterior; Ayuda → Diagnóstico queda en el registro sin el token, y Plan vivo y
// Mostrar registro van fuera (anotados con CUADERNO_SIN_NAVEGADOR). Mismo paso que ventana.test.js (`npm run test:electron`).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { _electron } = require('playwright');
const { crearCuaderno } = require('../ayuda');
const { ATAJOS, URL_PLAN_VIVO, URL_COMO_SE_USA, URL_ATAJOS } = require('../../electron/menu');

const RAIZ = path.join(__dirname, '..', '..');
const ESPERA = 20_000;
const dormir = ms => new Promise(r => setTimeout(r, ms));

let c, otro, configDir, userData, app, pagina, registro;
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cuaderno-electron-menu-'));
const git = (cuaderno, ...args) => execFileSync('git', args, { cwd: cuaderno.raiz, stdio: 'pipe', encoding: 'utf8' }).trim();
const titulo = cuaderno => `inicio.md — ${path.basename(cuaderno.raiz)}`;   // en la app, el título es lo abierto (la portada) y el cuaderno
const escapar = t => t.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
// Espera la portada del cuaderno `cuaderno` (las copias se distinguen por el título de la ventana). Mientras navega, title() falla.
async function esperarTitulo(cuaderno) {
  await pagina.locator('#nota h1', { hasText: 'Mi curso' }).waitFor({ state: 'visible', timeout: ESPERA });
  const fin = Date.now() + ESPERA;
  let t = '';
  while (Date.now() < fin && t !== titulo(cuaderno)) { await dormir(50); try { t = await pagina.title(); } catch { /* navegando */ } }
  assert.equal(t, titulo(cuaderno));
}
const hasta = async (fn, que) => { const fin = Date.now() + ESPERA; while (Date.now() < fin) { if (await fn()) return; await dormir(50); } assert.fail(que); };
// Pulsar un elemento del menú desde el proceso principal: lo que hace Electron cuando se pulsa su acelerador.
const pulsar = id => app.evaluate(({ Menu }, id) => { const e = Menu.getApplicationMenu().getMenuItemById(id); if (!e) throw new Error(`no hay elemento ${id}`); e.click(); }, id);
const menu = () => app.evaluate(({ Menu }) => Menu.getApplicationMenu().items.map(i => i.label));
const recientes = () => app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('recientes').submenu.items.map(i => i.label));
const enfocado = () => pagina.evaluate(() => document.activeElement && document.activeElement.id);

test.before(async () => {
  c = crearCuaderno({ kit: false }); otro = crearCuaderno({ kit: false });
  // Un repositorio debajo, con quien firma los commits configurado en el propio repo (la app hace `git commit` tal cual).
  git(c, 'init', '-q'); git(c, 'config', 'user.email', 't@t'); git(c, 'config', 'user.name', 't'); git(c, 'add', '-A'); git(c, 'commit', '-q', '-m', 'base');
  configDir = path.join(base, 'config'); userData = path.join(base, 'userData');
  fs.mkdirSync(configDir); fs.mkdirSync(userData);
  fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify({ tema: 'claro', recientes: [{ ruta: c.raiz, nombre: path.basename(c.raiz), abierto: new Date().toISOString() }] }));
  registro = () => { try { return fs.readFileSync(path.join(configDir, 'registro.log'), 'utf8'); } catch { return ''; } };
  const tmp = process.platform !== 'win32' && os.tmpdir().length > 40 ? '/tmp' : os.tmpdir();
  app = await _electron.launch({ args: ['.'], cwd: RAIZ, timeout: 60_000, env: { ...process.env, TMPDIR: tmp, CUADERNO_CONFIG_DIR: configDir, CUADERNO_USERDATA: userData, CUADERNO_SIN_DIALOGO: '1', CUADERNO_SIN_NAVEGADOR: '1', CUADERNO_DIALOGO_PRUEBA: otro.raiz } });
  pagina = await app.firstWindow();
  pagina.setDefaultTimeout(ESPERA);
  pagina.on('dialog', d => d.dismiss().catch(() => {}));
});
test.after(async () => {
  if (app) await app.close().catch(() => {});
  for (const x of [c, otro]) if (x) x.borrar();
  fs.rmSync(base, { recursive: true, force: true });
});

test('el menú de la app de escritorio: en castellano, con los atajos de la tabla; Guardar (⌘S desde el principal) abre el diálogo de Guardar de la pantalla y «Guardar» hace el commit por /api/guardar', async () => {
  await esperarTitulo(c);
  assert.deepEqual(await menu(), process.platform === 'darwin' ? ['Cuaderno', 'Archivo', 'Edición', 'Ver', 'Ventana', 'Ayuda'] : ['Archivo', 'Edición', 'Ver', 'Ventana', 'Ayuda']);
  const aceleradores = await app.evaluate(({ Menu }, ids) => ids.map(id => Menu.getApplicationMenu().getMenuItemById(id).accelerator), ATAJOS.map(a => a.id));
  assert.deepEqual(aceleradores, ATAJOS.map(a => a.accelerator), 'cada atajo de la tabla está en el menú instalado');
  // Las pistas de la pantalla dicen lo que dice el menú (en Linux, Ctrl; en Mac dirían ⌘).
  const mod = process.platform === 'darwin' ? '⌘' : 'Ctrl ';
  // La lupa de la fila de accesos ya no lleva texto (decisión de Roberto, 2026-10-13): la tecla del menú está en su title.
  assert.match(await pagina.getAttribute('#btn-buscar', 'title'), new RegExp(`^Buscar \\(${mod}F\\)$`), 'la lupa dice la tecla del menú');
  assert.equal(await pagina.getAttribute('#btn-guardar', 'title'), `Guardar en el repositorio del cuaderno (${mod}S)`);
  assert.equal(await pagina.getAttribute('#btn-nueva-nota', 'title'), `Crear una nota nueva (${mod}N)`);
  // Ajustes sale del lateral en la app (decisión de Roberto, 2026-10-13): vive en el menú, y «⌘,» lo abre (más abajo, `pulsar('ajustes')`).
  assert.equal(await pagina.locator('#btn-ajustes').isVisible(), false, 'en la app, Ajustes no se pinta en el lateral');
  assert.equal(await pagina.getAttribute('#btn-terminal', 'title'), 'Abrir la terminal (Ctrl `)', 'el menú también usa Ctrl para la terminal');
  // Un cambio en una nota (en el disco, como lo haría el editor) y Guardar desde el menú: el diálogo de la pantalla, con el cambio contado.
  fs.appendFileSync(path.join(c.base, 'conceptos', 'capital.md'), '\nUna línea más desde la app.\n');
  await hasta(() => git(c, 'status', '--porcelain').length > 0, 'git no ve el cambio');
  await pulsar('guardar');
  await pagina.locator('#guardar').waitFor({ state: 'visible' });
  await hasta(async () => /1 fichero con cambios/.test(await pagina.locator('#guardar-cambios').textContent()), 'el diálogo de Guardar no cuenta el fichero cambiado');
  assert.equal(await enfocado(), 'guardar-mensaje');
  await pulsar('guardar');   // con el diálogo abierto, el atajo no apila otro
  await dormir(200);
  assert.equal(await pagina.locator('.aviso-flotante').count(), 0, 'ni aviso ni otro diálogo');
  await pagina.locator('#guardar-mensaje').fill('Guardado desde el menú');
  const [r] = await Promise.all([pagina.waitForResponse(x => x.url().endsWith('/api/guardar')), pagina.locator('#guardar-ok').click()]);
  assert.equal(r.status(), 200);
  await pagina.locator('#resultado').waitFor({ state: 'visible' });
  assert.equal(await pagina.locator('#resultado-titulo').textContent(), 'Guardar');
  assert.match(await pagina.locator('#resultado-texto').textContent(), /Guardado en local/);
  assert.equal(git(c, 'log', '-1', '--format=%s'), 'Guardado desde el menú', 'el commit está en el repositorio del cuaderno');
  assert.equal(git(c, 'status', '--porcelain'), '');
  await pagina.locator('#resultado-cerrar').click();
  await pagina.locator('#resultado').waitFor({ state: 'hidden' });
  assert.match(registro(), /\[app\] menú: guardar/);
});

test('el menú de la app de escritorio: con el editor de la nota abierto, Guardar (⌘S) la escribe como Aplicar (y con el «¿Descartar lo escrito?» abierto se ignora); sin editor sigue siendo el Guardar del repositorio', async () => {
  await esperarTitulo(c);
  const fichero = path.join(c.base, 'conceptos', 'capital.md');
  const antes = fs.readFileSync(fichero, 'utf8');
  await pagina.evaluate(() => { location.hash = '#/n/conceptos/capital.md'; });
  await pagina.locator('#btn-editar').click();
  await pagina.locator('#edicion-cm .cm-content').waitFor();
  await pagina.keyboard.type('ESCRITO-CON-CMD-S ');
  await hasta(() => pagina.evaluate(() => !document.querySelector('#edicion-aplicar').disabled), 'el editor no se da por sucio');
  // Con «¿Descartar lo escrito?» abierto, la acción se ignora: ni se escribe la nota ni se cierra el editor.
  await pagina.locator('#edicion-cancelar').click();
  await pagina.locator('#descartar').waitFor({ state: 'visible' });
  await pulsar('guardar');
  await dormir(300);
  assert.equal(fs.readFileSync(fichero, 'utf8'), antes, 'el atajo ha escrito la nota por detrás del diálogo');
  assert.ok(await pagina.locator('#descartar').isVisible(), 'el diálogo se ha cerrado');
  await pagina.locator('#descartar-seguir').click();
  await pagina.locator('#descartar').waitFor({ state: 'hidden' });
  // Con el editor abierto y sin diálogo: escribe la nota y cierra el editor (no abre el diálogo de Guardar del repositorio).
  await pulsar('guardar');
  await hasta(() => /ESCRITO-CON-CMD-S/.test(fs.readFileSync(fichero, 'utf8')), 'la nota no tiene lo escrito');
  await pagina.locator('#edicion-cm').waitFor({ state: 'hidden' });
  await pagina.locator('#btn-editar').waitFor({ state: 'visible' });
  assert.equal(await pagina.locator('#guardar').isVisible(), false, 'no es el Guardar del repositorio');
  // Sin el editor, vuelve a ser el Guardar del repositorio (la nota escrita es un cambio que contar).
  await pulsar('guardar');
  await pagina.locator('#guardar').waitFor({ state: 'visible' });
  await pagina.locator('#guardar-cancelar').click();
  await pagina.locator('#guardar').waitFor({ state: 'hidden' });
  await pagina.locator('#link-inicio').click();
  await esperarTitulo(c);
});

test('el menú de la app de escritorio: Abrir nota… y Buscar… abren la modal de búsqueda con el texto seleccionado, Nueva tarea la deja con «+» para apuntarla con Enter, y Ajustes… abre Ajustes', async () => {
  await esperarTitulo(c);
  await pagina.locator('#link-inicio').focus();
  await pulsar('buscar');
  await pagina.locator('#busqueda').waitFor({ state: 'visible' });
  await hasta(async () => (await enfocado()) === 'buscador', 'Buscar… no enfoca el campo de la modal');
  await pagina.locator('#buscador').fill('capital');
  await pulsar('buscar');   // con la modal abierta: no apila otra, solo enfoca y selecciona
  await hasta(async () => (await enfocado()) === 'buscador', 'Buscar… con la modal abierta no enfoca el campo');
  assert.deepEqual(await pagina.evaluate(() => { const b = document.querySelector('#buscador'); return [b.selectionStart, b.selectionEnd, b.value]; }), [0, 7, 'capital'], 'el texto seleccionado: escribir lo sustituye');
  assert.equal(await pagina.locator('.modal:visible').count(), 1);
  await pagina.keyboard.press('Escape');
  await pagina.locator('#busqueda').waitFor({ state: 'hidden' });
  assert.equal(await enfocado(), 'link-inicio', 'Esc no devuelve el foco a donde estaba');
  await pulsar('abrir-nota');
  await pagina.locator('#busqueda').waitFor({ state: 'visible' });
  await hasta(async () => (await enfocado()) === 'buscador', 'Abrir nota… no enfoca el campo de la modal');
  assert.deepEqual(await pagina.evaluate(() => { const b = document.querySelector('#buscador'); return [b.selectionStart, b.selectionEnd, b.value]; }), [0, 7, 'capital'], 'la última consulta, seleccionada');
  // Enter abre la primera nota: «Capital» (por nombre de fichero y título), una vez pintados los resultados.
  await pagina.locator('#busqueda-lista [role="option"]').first().waitFor({ state: 'visible' });
  await pagina.keyboard.press('Enter');
  await hasta(async () => /conceptos\/capital\.md/.test(await pagina.evaluate(() => location.hash)), 'Enter en la modal no ha abierto la nota');
  await pagina.locator('#link-inicio').focus();
  await pulsar('nueva-tarea');
  await hasta(async () => (await enfocado()) === 'buscador' && (await pagina.inputValue('#buscador')) === '+ ', 'Nueva tarea no deja el campo de la modal con «+»');
  await pagina.locator('#busqueda-nada').waitFor({ state: 'visible' });
  assert.match(await pagina.locator('#busqueda-nada').textContent(), /Escribe la tarea después del \+/);
  await pagina.keyboard.press('Escape');
  await pagina.locator('#busqueda').waitFor({ state: 'hidden' });
  await pagina.locator('#link-inicio').click();
  await esperarTitulo(c);
  await pulsar('ajustes');
  await pagina.locator('#ajustes').waitFor({ state: 'visible' });
  assert.equal(await enfocado(), 'ajustes-tema');
  await pagina.locator('#ajustes-cerrar').click();
  await pagina.locator('#ajustes').waitFor({ state: 'hidden' });
});

test('el menú de la app de escritorio: Nueva nota abre su diálogo; Ver → Barra lateral la pliega y la despliega, Terminal abre y cierra el cajón, Atrás y Adelante recorren el historial de la ventana', async () => {
  await esperarTitulo(c);
  await pulsar('nueva-nota');
  await pagina.locator('#nueva-nota').waitFor({ state: 'visible' });
  assert.equal(await enfocado(), 'nueva-nota-nombre');
  await pulsar('nueva-nota');   // con el diálogo abierto no se apila otro
  await pagina.locator('#nueva-nota-cancelar').click();
  await pagina.locator('#nueva-nota').waitFor({ state: 'hidden' });
  const plegada = () => pagina.evaluate(() => document.querySelector('#app').classList.contains('lateral-plegado'));
  assert.equal(await plegada(), false);
  await pulsar('barra-lateral');
  await hasta(async () => await plegada(), 'Barra lateral no pliega');
  await pulsar('barra-lateral');
  await hasta(async () => !(await plegada()), 'Barra lateral no despliega');
  await pulsar('terminal');
  await pagina.locator('#cajon').waitFor({ state: 'visible' });
  await pulsar('terminal');
  await pagina.locator('#cajon').waitFor({ state: 'hidden' });
  // Atrás y Adelante: el historial del webContents (cada cambio de hash es una entrada).
  await pagina.evaluate(() => { location.hash = '#/n/conceptos/capital.md'; });
  await pagina.locator('#miga strong', { hasText: 'capital' }).waitFor();
  await pulsar('atras');
  await hasta(() => pagina.evaluate(() => location.hash === '#/n/inicio.md' || location.hash === '' || location.hash === '#/'), 'Atrás no vuelve a la portada');
  await pulsar('adelante');
  await hasta(() => pagina.evaluate(() => location.hash === '#/n/conceptos/capital.md'), 'Adelante no vuelve a la nota');
  // El gesto del trackpad (el evento `swipe` de BrowserWindow, solo macOS y con «Deslizar entre páginas»; aquí emitido a mano): left es Atrás y right Adelante.
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].emit('swipe', {}, 'left'));
  await hasta(() => pagina.evaluate(() => location.hash !== '#/n/conceptos/capital.md'), 'el gesto left no vuelve atrás');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].emit('swipe', {}, 'right'));
  await hasta(() => pagina.evaluate(() => location.hash === '#/n/conceptos/capital.md'), 'el gesto right no avanza');
  // Atrás de más no sale de la app (P17): ni a «Arrancando…» (otro origen) ni a otra pantalla; el menú y el botón ‹ comparten criterio.
  for (let i = 0; i < 6; i++) await pulsar('atras');
  await pagina.waitForTimeout(400);
  assert.match(pagina.url(), /^http:\/\/localhost:\d+\//, 'Atrás ha salido de la app (¿vuelve a «Arrancando…»?)');
  await pulsar('adelante');
  await pagina.locator('#btn-adelante').waitFor();
  await pagina.locator('#link-inicio').click();
  await esperarTitulo(c);
});

test('el menú de la app de escritorio: Abrir carpeta… (el diálogo del sistema) cambia de cuaderno y el menú se reconstruye con el reciente nuevo; Cuadernos recientes vuelve al anterior', async () => {
  await esperarTitulo(c);
  assert.deepEqual(await recientes(), [path.basename(c.raiz)]);
  const [r] = await Promise.all([pagina.waitForResponse(x => x.url().endsWith('/api/abrir')), pulsar('abrir-carpeta')]);
  assert.equal(r.status(), 200);
  await esperarTitulo(otro);
  await hasta(async () => (await recientes()).length === 2, 'el menú no se ha reconstruido con el cuaderno nuevo');
  assert.deepEqual(await recientes(), [path.basename(otro.raiz), path.basename(c.raiz)], 'el más nuevo primero');
  assert.match(registro(), /\[app\] menú reconstruido: 2 recientes/);
  await pulsar(`reciente:${c.raiz}`);
  await esperarTitulo(c);
  assert.match(registro(), new RegExp(`\\[app\\] carpeta por menú: ${escapar(c.raiz)}`));
  assert.match(registro(), /\[app\] cuaderno abierto en el servidor: .*; se recarga la ventana/);
  assert.equal(await pagina.evaluate(() => fetch('/api/info').then(x => x.status)), 200, 'la ventana ha vuelto a entrar con su cookie');
});

test('el menú de la app de escritorio: Ayuda → Diagnóstico queda en el registro con versiones, puerto, PATH y node-pty, nunca el token; Plan vivo va al repo público y Mostrar registro al fichero (en pruebas, anotados)', async () => {
  await esperarTitulo(c);
  const puerto = Number(new URL(pagina.url()).port);
  const token = fs.readFileSync(path.join(configDir, 'token'), 'utf8').trim();
  assert.ok(token.length >= 16, 'hay token');
  await pulsar('diagnostico');
  await hasta(() => /diálogo saltado \(CUADERNO_SIN_DIALOGO\): Diagnóstico/.test(registro()), 'el Diagnóstico no ha llegado al registro');
  const r = registro();
  assert.match(r, /\[app\] diagnóstico:\nnode-pty cargado: /);
  assert.match(r, /\nCuaderno \d+\.\d+\.\d+ · Electron \d+\.\d+\.\d+ · Node \d+\.\d+\.\d+ · Chromium \d+\./);
  assert.match(r, new RegExp(`Puerto del servidor: ${puerto}\\n`));
  assert.match(r, /node-pty cargado: (sí|no \(la app arranca sin terminal\))\n/);
  assert.match(r, /Entorno de la shell: (shell -i?lc|respaldo|sistema)/);
  assert.match(r, /\nPATH: \S+/);
  assert.match(r, new RegExp(`Carpeta de configuración: ${escapar(configDir)}\\n`));
  assert.ok(!r.includes(token), 'el token en el registro');
  await pulsar('plan-vivo'); await pulsar('como-se-usa'); await pulsar('atajos');
  await hasta(() => registro().includes(`navegador no abierto (CUADERNO_SIN_NAVEGADOR): ${URL_PLAN_VIVO}`), 'el plan vivo no ha llegado al registro');
  await hasta(() => registro().includes(`navegador no abierto (CUADERNO_SIN_NAVEGADOR): ${URL_COMO_SE_USA}`) && registro().includes(`navegador no abierto (CUADERNO_SIN_NAVEGADOR): ${URL_ATAJOS}`), 'cómo se usa y los atajos no han llegado al registro');
  assert.match(URL_PLAN_VIVO, /^https:\/\/github\.com\/[^?#]+$/);
  await pulsar('mostrar-registro');
  await hasta(() => registro().includes(`registro no abierto (CUADERNO_SIN_NAVEGADOR): ${path.join(configDir, 'registro.log')}`), 'el registro no ha llegado al registro');
  await pulsar('acerca-de');
  await hasta(() => /diálogo saltado \(CUADERNO_SIN_DIALOGO\): Acerca de Cuaderno/.test(registro()), 'Acerca de no ha llegado al registro');
});

// El último: deja la pantalla con otro callback (ACCIONES_APP ya no atiende), así que nada va después.
test('el menú de la app de escritorio: el preload pone un solo oyente de «accion»; llamar otra vez a alAccion sustituye el callback (una acción llega una vez y solo al último)', async () => {
  await esperarTitulo(c);
  await pagina.evaluate(() => { window.__recibidas = []; window.cuadernoApp.alAccion(n => window.__recibidas.push(`1:${n}`)); window.cuadernoApp.alAccion(n => window.__recibidas.push(`2:${n}`)); });
  await pagina.locator('#link-inicio').focus();
  await pulsar('buscar');
  await hasta(() => pagina.evaluate(() => window.__recibidas.length >= 1), 'la acción no ha llegado al callback nuevo');
  await dormir(300);
  assert.deepEqual(await pagina.evaluate(() => window.__recibidas), ['2:buscar'], 'ni al primero ni dos veces');
  assert.equal(await enfocado(), 'link-inicio', 'ACCIONES_APP ya no la atiende: la modal no se abre');
});
