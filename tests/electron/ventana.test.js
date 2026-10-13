'use strict';
// El recorrido de la app de escritorio, con el Electron de verdad lanzado por Playwright (_electron, experimental) sobre
// una copia del cuaderno de ejemplo: abre el último cuaderno en su ventana, un enlace a otra web no cambia la ventana (va al
// navegador del sistema; en pruebas, CUADERNO_SIN_NAVEGADOR lo anota en vez de abrirlo), recargar con el editor sucio
// pregunta (en pruebas, CUADERNO_SIN_DIALOGO=1 contesta «seguir editando»), el servidor se relanza si muere, y al cerrar
// no queda ni el puerto ni ningún proceso. Va en su paso (`npm run test:electron`), no en `npm test`: necesita el
// binario de Electron (`node node_modules/electron/install.js`) y, sin pantalla, `xvfb-run -a`. Configuración y userData
// temporales (el lock de instancia única va en userData: así no choca con la app abierta de quien lo corra).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { _electron } = require('playwright');
const { crearCuaderno } = require('../ayuda');

const RAIZ = path.join(__dirname, '..', '..');
const ESPERA = 20_000;   // ms: el arranque del binario frío tarda ~1,5 s; con margen para una CI lenta
const dormir = ms => new Promise(r => setTimeout(r, ms));
const unix = process.platform !== 'win32';

let c, configDir, userData, app, pagina, registro, puerto;
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cuaderno-electron-'));

// ¿Está el puerto escuchando? (conectar y ver si contesta o rechaza)
const escuchando = p => new Promise(r => { const s = net.connect(p, '127.0.0.1'); s.once('connect', () => { s.destroy(); r(true); }); s.once('error', () => r(false)); });
// Lo que dice `ps` de cada proceso: pid, ppid, si es zombi (estado Z: ya ha muerto y solo espera a que lo recojan,
// cosa que en un contenedor sin init tarda) y sus argumentos. Solo en Mac y Linux.
function procesos() {
  return execFileSync('ps', ['-eo', 'pid=,ppid=,stat=,args='], { encoding: 'utf8' }).split('\n').map(l => l.trim()).filter(Boolean)
    .map(l => { const [p, pp, stat, ...args] = l.split(/\s+/); return { pid: +p, ppid: +pp, zombi: /^Z/.test(stat), args: args.join(' ') }; });
}
// El árbol de procesos vivos de la app (el principal y sus descendientes, incluido el utilityProcess del servidor).
function arbolDe(pid) {
  const vivos = procesos().filter(p => !p.zombi);
  const arbol = new Set([pid]);
  let cambia = true;
  while (cambia) { cambia = false; for (const p of vivos) if (arbol.has(p.ppid) && !arbol.has(p.pid)) { arbol.add(p.pid); cambia = true; } }
  return vivos.filter(p => arbol.has(p.pid));
}
// ¿Sigue vivo este pid? Un zombi cuenta como muerto. (Los huérfanos pasan a ppid 1 al cerrar, así que no vale
// reconstruir el árbol después: se mira cada pid de la lista tomada antes.)
function vivo(pid) {
  try { process.kill(pid, 0); } catch (e) { return e.code !== 'ESRCH'; }
  const p = procesos().find(x => x.pid === pid);
  return !!p && !p.zombi;
}
const pidDelServidor = () => arbolDe(app.process().pid).find(p => /utility-sub-type=node\.mojom\.NodeService/.test(p.args));
// Espera a que la ventana enseñe la portada del cuaderno de ejemplo con su título («inicio.md — <carpeta>»: en la app, lo abierto).
async function esperarPortada() {
  await pagina.locator('#nota h1', { hasText: 'Mi curso' }).waitFor({ state: 'visible', timeout: ESPERA });
  const nombre = path.basename(c.raiz), fin = Date.now() + ESPERA;
  while (Date.now() < fin && (await pagina.title()) !== `inicio.md — ${nombre}`) await dormir(50);
  assert.equal(await pagina.title(), `inicio.md — ${nombre}`, 'en la app el título es lo abierto: la nota y el cuaderno');
}

test.before(async () => {
  c = crearCuaderno({ kit: false });
  configDir = path.join(base, 'config'); userData = path.join(base, 'userData');
  fs.mkdirSync(configDir); fs.mkdirSync(userData);
  // El último cuaderno abierto es la copia: la app lo abre sin argumentos, como server.js.
  fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify({ tema: 'claro', recientes: [{ ruta: c.raiz, nombre: path.basename(c.raiz), abierto: new Date().toISOString() }] }));
  registro = () => { try { return fs.readFileSync(path.join(configDir, 'registro.log'), 'utf8'); } catch { return ''; } };
  // Chromium crea el socket del singleton bajo TMPDIR y el sistema limita su ruta a ~108 caracteres (lo vio el spike).
  const tmp = unix && os.tmpdir().length > 40 ? '/tmp' : os.tmpdir();
  app = await _electron.launch({ args: ['.'], cwd: RAIZ, timeout: 60_000, env: { ...process.env, TMPDIR: tmp, CUADERNO_CONFIG_DIR: configDir, CUADERNO_USERDATA: userData, CUADERNO_SIN_DIALOGO: '1', CUADERNO_SIN_NAVEGADOR: '1', CUADERNO_OCULTA: '1' } });
  pagina = await app.firstWindow();
  pagina.setDefaultTimeout(ESPERA);
  // El beforeunload de la pantalla lo atiende Electron (will-prevent-unload, en electron/ventana.js), no un diálogo de
  // Chromium: Playwright, que por defecto intenta cerrar todo diálogo, fallaría con «No dialog is showing» fuera de un test.
  pagina.on('dialog', d => d.dismiss().catch(() => {}));
});
test.after(async () => {
  if (app) await app.close().catch(() => {});
  if (c) c.borrar();
  fs.rmSync(base, { recursive: true, force: true });
});

test('la app de escritorio: abre el último cuaderno en su ventana (portada y título), entrando por la URL con el código; el registro recoge el arranque del padre y del hijo', async () => {
  await esperarPortada();
  const url = new URL(pagina.url());
  assert.equal(url.hostname, 'localhost');
  assert.equal(url.searchParams.get('t'), null, 'el código de la URL de entrada ya no está: el servidor lo cambió por la cookie y volvió a /');
  puerto = Number(url.port);
  assert.ok(puerto > 0);
  assert.ok(await escuchando(puerto), 'el servidor escucha en el puerto de la ventana');
  // La cookie viaja: la API contesta 200 desde la página (sin cookie sería 403).
  assert.equal(await pagina.evaluate(() => fetch('/api/info').then(r => r.status)), 200);
  assert.match(registro(), new RegExp(`\\[app\\] servidor en el puerto ${puerto}; el último cuaderno: `));
  assert.match(registro(), new RegExp(`\\[hijo\\] escuchando en el puerto ${puerto}`));
  assert.match(registro(), /\[app\] entorno de la shell: (shell -i?lc|respaldo), \d+ ms/);
  assert.match(registro(), /\[hijo\] node \d+\.\d+\.\d+ \(electron \d+\.\d+\.\d+\)/, 'el hijo corre con el Node de Electron');
  assert.ok(fs.readdirSync(userData).some(n => /Singleton/.test(n)), 'el lock de instancia única va en el userData temporal');
});

// Ir a una pantalla de la app por su hash y esperar a que pinte.
async function ir(hash) { await pagina.evaluate(h => { location.hash = h; }, hash); await pagina.locator('#miga strong').waitFor(); }
const hasta = async (fn, que) => { const fin = Date.now() + ESPERA; while (Date.now() < fin) { if (await fn()) return; await dormir(50); } assert.fail(que); };

test('la app de escritorio: un enlace a otra web va al navegador del sistema y la ventana no cambia (y copiar al portapapeles funciona sin pedir permiso)', async () => {
  await esperarPortada();
  await ir('#/n/render/enlaces.md');
  const enlace = pagina.locator('#nota a', { hasText: 'la web del curso' });
  assert.equal(await enlace.getAttribute('href'), 'https://example.com');
  const antes = pagina.url();
  await enlace.click({ noWaitAfter: true });   // Playwright esperaría a una navegación que la app impide a propósito
  await hasta(() => /navegador no abierto \(CUADERNO_SIN_NAVEGADOR\): https:\/\/example\.com\//.test(registro()), 'el enlace no ha llegado al registro como enlace fuera');
  await dormir(200);
  assert.equal(pagina.url(), antes, 'la ventana ha navegado');
  assert.match(await pagina.locator('#miga strong').textContent(), /enlaces/, 'la nota sigue a la vista');
  assert.match(registro(), /\[app\] enlace al navegador del sistema: https:\/\/example\.com\//);
  // El portapapeles: la pantalla lo usa para «Copiar ruta»; el permiso clipboard-sanitized-write se concede sin preguntar.
  assert.equal(await pagina.evaluate(() => navigator.clipboard.writeText('hola').then(() => 'ok', e => `${e.name}: ${e.message}`)), 'ok');
});

test('la app de escritorio: navegando con clics reales en el árbol, ‹ se enciende, ‹ › y ⌘[ recorren el historial, y el deslizamiento de dos dedos (rueda horizontal) da un paso por gesto', async () => {
  const hashDe = () => pagina.evaluate(() => location.hash);
  const atrasApagada = () => pagina.locator('#btn-atras').isDisabled();
  await ir('#/n/inicio.md');   // los tests anteriores ya han dejado entradas: aquí se cuenta desde esta
  await pagina.evaluate(() => document.querySelectorAll('#arbol details').forEach(d => { d.open = true; }));
  await pagina.locator('#arbol a[href="#/n/conceptos/capital.md"]').click();
  await hasta(async () => (await hashDe()) === '#/n/conceptos/capital.md' && !(await atrasApagada()), '‹ no se enciende tras abrir una nota desde el árbol');
  await pagina.locator('#arbol a[href="#/n/conceptos/interes.md"]').click();
  await hasta(async () => (await hashDe()) === '#/n/conceptos/interes.md', 'el árbol no abre la tercera nota');
  const estados = await pagina.evaluate(() => navigation.entries().map(e => (e.getState() || {}).cuaderno || null));
  assert.ok(estados.length >= 3 && estados.every(s => s && s === estados[0]), `entradas sin cuaderno: ${JSON.stringify(estados)}`);
  await pagina.locator('#btn-atras').click();
  await hasta(async () => (await hashDe()) === '#/n/conceptos/capital.md', '‹ no vuelve a la segunda nota');
  await pagina.locator('#btn-adelante').click();
  await hasta(async () => (await hashDe()) === '#/n/conceptos/interes.md', '› no avanza');
  await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('atras').click());   // ⌘[ (la acción del menú)
  await hasta(async () => (await hashDe()) === '#/n/conceptos/capital.md', 'la acción Atrás del menú no vuelve');
  // El gesto por defecto de macOS llega como rueda horizontal: un gesto largo con su inercia da un solo paso. Los eventos se
  // mandan desde la propia página, uno cada 16 ms como un trackpad: con `mouse.wheel` de Playwright cada evento tarda ~1 s en la
  // ventana oculta de Linux (xvfb; lo midió la CI: 30 eventos, uno por segundo), y con tanta pausa la rueda «calla» entre uno y otro
  // y no hay gesto. El manejador y el resto del camino (irHistorial, la API de navegación) son los de la app de verdad.
  const deslizar = (dx, n) => pagina.evaluate(async ([dx, n]) => { for (let i = 0; i < n; i++) { document.elementFromPoint(700, 400).dispatchEvent(new WheelEvent('wheel', { deltaX: dx, deltaY: 0, bubbles: true, cancelable: true })); await new Promise(r => setTimeout(r, 16)); } }, [dx, n]);
  await deslizar(20, 30);
  await hasta(async () => (await hashDe()) === '#/n/conceptos/interes.md', 'el deslizamiento a la izquierda no avanza');
  await dormir(700);
  assert.equal(await hashDe(), '#/n/conceptos/interes.md', 'un gesto ha dado más de un paso');
  await deslizar(-20, 30);
  await hasta(async () => (await hashDe()) === '#/n/conceptos/capital.md', 'el deslizamiento a la derecha no vuelve');
  await dormir(700);
  assert.equal(await hashDe(), '#/n/conceptos/capital.md', 'un gesto ha dado más de un paso atrás');
});

test('la app de escritorio: recargar con el editor sucio pregunta «¿Descartar lo escrito?»; con «seguir editando» la ventana se queda como estaba', async () => {
  await ir('#/n/conceptos/capital.md');
  await pagina.locator('#btn-editar').click();
  await pagina.locator('#edicion-cm .cm-content').waitFor();
  await pagina.keyboard.type('ZZ');
  await hasta(() => pagina.evaluate(() => !document.querySelector('#edicion-aplicar').disabled), 'el editor no se da por sucio');
  // Ver → Recargar (desde el proceso principal, como lo hará el menú): el beforeunload de la pantalla cancela y Electron pregunta.
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.reload());
  await hasta(() => /diálogo saltado \(CUADERNO_SIN_DIALOGO=1\): ¿Descartar lo escrito\? → seguir editando/.test(registro()), 'el cierre con cambios no ha preguntado');
  await dormir(300);
  assert.ok(await pagina.locator('#edicion-cm .cm-content').isVisible(), 'la recarga se ha llevado el editor');
  assert.match(await pagina.locator('#edicion-cm .cm-content').textContent(), /ZZ/, 'lo escrito se ha perdido');
  // Se deja el editor limpio (Cancelar → Descartar) para que el cierre del final no tenga nada que preguntar.
  await pagina.locator('#edicion-cancelar').click();
  await pagina.locator('#descartar-ok').click();
  await pagina.locator('#btn-editar').waitFor();
  await pagina.locator('#link-inicio').click();   // de vuelta a la portada, que es donde esperan los recorridos siguientes
  await esperarPortada();
});

test('la app de escritorio: si el servidor muere, el padre lo relanza y la ventana vuelve a la portada', { skip: !unix && 'ps solo en Mac y Linux' }, async () => {
  await esperarPortada();
  const servidor = pidDelServidor();
  assert.ok(servidor, `no encuentro el utilityProcess del servidor entre ${JSON.stringify(arbolDe(app.process().pid).map(p => p.args.slice(0, 60)))}`);
  const recarga = pagina.waitForEvent('load', { timeout: ESPERA });
  process.kill(servidor.pid, 'SIGKILL');
  await recarga;
  await esperarPortada();
  const otro = pidDelServidor();
  assert.ok(otro && otro.pid !== servidor.pid, 'hay un servidor nuevo');
  puerto = Number(new URL(pagina.url()).port);
  assert.equal(await pagina.evaluate(() => fetch('/api/info').then(r => r.status)), 200);
  assert.match(registro(), /\[app\] se relanza el servidor con el mismo entorno/);
  assert.match(registro(), new RegExp(`\\[app\\] servidor relanzado en el puerto ${puerto}: se recarga la ventana`));
});

test('la app de escritorio: al cerrar, el servidor se para (el puerto queda libre) y no queda ningún proceso (hasta 2 s)', { skip: !unix && 'la lista de procesos se toma con ps: solo Mac y Linux' }, async () => {
  await esperarPortada();
  puerto = Number(new URL(pagina.url()).port);
  // La lista del árbol se toma ANTES de cerrar: después los huérfanos tendrían ppid 1 y no se encontrarían.
  const arbol = arbolDe(app.process().pid);
  assert.ok(arbol.length >= 2, `el árbol tiene el principal y el servidor: ${arbol.length}`);
  assert.ok(arbol.some(p => /node\.mojom\.NodeService/.test(p.args)), 'el servidor está en la lista');
  await app.close();
  app = null;
  const fin = Date.now() + 2000;
  let vivos = arbol.filter(p => vivo(p.pid)), escucha = await escuchando(puerto);
  while (Date.now() < fin && (vivos.length || escucha)) { await dormir(100); vivos = arbol.filter(p => vivo(p.pid)); escucha = await escuchando(puerto); }
  assert.equal(escucha, false, `el puerto ${puerto} sigue escuchando`);
  assert.deepEqual(vivos.map(p => `${p.pid} ${p.args.slice(0, 80)}`), [], 'quedan procesos de la app');
  assert.match(registro(), /\[app\] el servidor ha salido con código/, 'la salida del hijo al cerrar queda anotada');
  assert.doesNotMatch(registro(), /FALLO/, 'cerrar no es un fallo');
  // Al cerrar, dónde y cuánto medía la ventana queda en config.json (ventana), para abrir igual la próxima vez.
  const guardada = JSON.parse(fs.readFileSync(path.join(configDir, 'config.json'), 'utf8')).ventana;
  assert.ok(guardada && Number.isInteger(guardada.x) && Number.isInteger(guardada.y) && guardada.width >= 760 && guardada.height >= 480, `la ventana guardada: ${JSON.stringify(guardada)}`);
  assert.match(registro(), /\[app\] ventana \d+ × \d+: (el tamaño por defecto|el 90 % del área de trabajo)/, 'al arrancar sin ventana guardada, el tamaño por defecto o el del área');
});
