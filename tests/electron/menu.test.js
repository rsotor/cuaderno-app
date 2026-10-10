'use strict';
// El menú de la app de escritorio (electron/menu.js, T5) con el Electron de verdad lanzado por Playwright, sobre una copia
// del cuaderno de ejemplo sin kit con un repositorio debajo (git init, como hacen los recorridos de uso): los elementos
// del menú se «pulsan» desde el proceso principal (`Menu.getApplicationMenu().getMenuItemById(id).click()`, lo mismo que
// hace el acelerador) y se mira lo que pasa en la pantalla y en el fichero: Guardar abre el diálogo de Guardar y el commit
// se hace por /api/guardar; Abrir nota…, Buscar… y Nueva tarea van al buscador; Ajustes… abre Ajustes; Abrir carpeta… (el
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
const { ATAJOS, URL_PLAN_VIVO } = require('../../electron/menu');

const RAIZ = path.join(__dirname, '..', '..');
const ESPERA = 20_000;
const dormir = ms => new Promise(r => setTimeout(r, ms));

let c, otro, configDir, userData, app, pagina, registro;
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cuaderno-electron-menu-'));
const git = (cuaderno, ...args) => execFileSync('git', args, { cwd: cuaderno.raiz, stdio: 'pipe', encoding: 'utf8' }).trim();
const titulo = cuaderno => `${path.basename(cuaderno.raiz)} · Cuaderno`;
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
  assert.deepEqual(await menu(), process.platform === 'darwin' ? ['Cuaderno', 'Cuaderno', 'Edición', 'Ver', 'Ventana', 'Ayuda'] : ['Cuaderno', 'Edición', 'Ver', 'Ventana', 'Ayuda']);
  const aceleradores = await app.evaluate(({ Menu }, ids) => ids.map(id => Menu.getApplicationMenu().getMenuItemById(id).accelerator), ATAJOS.map(a => a.id));
  assert.deepEqual(aceleradores, ATAJOS.map(a => a.accelerator), 'cada atajo de la tabla está en el menú instalado');
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

test('el menú de la app de escritorio: Abrir nota… y Buscar… enfocan el buscador con el texto seleccionado, Nueva tarea lo deja con «+» para añadirla con Enter, y Ajustes… abre Ajustes', async () => {
  await esperarTitulo(c);
  await pagina.locator('#buscador').fill('capital');
  await pagina.locator('#link-inicio').focus();
  await pulsar('buscar');
  await hasta(async () => (await enfocado()) === 'buscador', 'Buscar… no enfoca el buscador');
  assert.deepEqual(await pagina.evaluate(() => { const b = document.querySelector('#buscador'); return [b.selectionStart, b.selectionEnd, b.value]; }), [0, 7, 'capital'], 'el texto seleccionado: escribir lo sustituye');
  await pagina.locator('#link-inicio').focus();
  await pulsar('abrir-nota');
  await hasta(async () => (await enfocado()) === 'buscador', 'Abrir nota… no enfoca el buscador');
  // Enter abre el primer resultado: la nota «Capital» (por nombre de fichero y título), una vez pintados los resultados.
  await pagina.locator('#arbol a.resultado').first().waitFor({ state: 'visible' });
  await pagina.keyboard.press('Enter');
  await hasta(async () => /conceptos\/capital\.md/.test(await pagina.evaluate(() => location.hash)), 'Enter en el buscador no ha abierto la nota');
  await pagina.locator('#buscador').fill('');
  await pagina.locator('#link-inicio').focus();
  await pulsar('nueva-tarea');
  await hasta(async () => (await enfocado()) === 'buscador' && (await pagina.inputValue('#buscador')) === '+ ', 'Nueva tarea no deja el buscador con «+»');
  await pagina.locator('#arbol .comando').waitFor({ state: 'visible' });
  assert.match(await pagina.locator('#arbol .comando').textContent(), /Escribe la tarea después del \+/);
  await pagina.locator('#buscador').fill('');
  await pagina.locator('#link-inicio').click();
  await esperarTitulo(c);
  await pulsar('ajustes');
  await pagina.locator('#ajustes').waitFor({ state: 'visible' });
  assert.equal(await enfocado(), 'ajustes-tema');
  await pagina.locator('#ajustes-cerrar').click();
  await pagina.locator('#ajustes').waitFor({ state: 'hidden' });
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
  assert.match(r, /\[app\] diagnóstico:\nCuaderno \d+\.\d+\.\d+\nElectron \d+\.\d+\.\d+ · Node \d+\.\d+\.\d+ · Chromium \d+\./);
  assert.match(r, new RegExp(`Puerto del servidor: ${puerto}\\n`));
  assert.match(r, /node-pty cargado: (sí|no \(la app arranca sin terminal\))\n/);
  assert.match(r, /Entorno de la shell: (shell -i?lc|respaldo|sistema)/);
  assert.match(r, /\nPATH: \S+/);
  assert.match(r, new RegExp(`Carpeta de configuración: ${escapar(configDir)}\\n`));
  assert.ok(!r.includes(token), 'el token en el registro');
  await pulsar('plan-vivo');
  await hasta(() => registro().includes(`navegador no abierto (CUADERNO_SIN_NAVEGADOR): ${URL_PLAN_VIVO}`), 'el plan vivo no ha llegado al registro');
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
  assert.equal(await enfocado(), 'link-inicio', 'ACCIONES_APP ya no la atiende: el buscador no se enfoca');
});
