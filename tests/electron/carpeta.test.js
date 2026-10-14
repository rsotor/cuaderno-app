'use strict';
// Abrir una carpeta en la app de escritorio, con el Electron de verdad (Playwright _electron) y tres copias del cuaderno
// de ejemplo: la del último reciente (que NO debe abrirse), la que va en los argumentos (se abre al arrancar) y la que
// «elige» el diálogo del sistema, forzado en pruebas con CUADERNO_DIALOGO_PRUEBA (pulsar «Elegir carpeta…» en Cuadernos
// la abre y queda en recientes). Y una segunda instancia con otra carpeta en sus argumentos: la primera la abre. Mismo
// paso que ventana.test.js (`npm run test:electron`), configuración y userData temporales.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { _electron } = require('playwright');
const { crearCuaderno } = require('../ayuda');
const { version } = require('../../package.json');

const RAIZ = path.join(__dirname, '..', '..');
const ESPERA = 20_000;
const dormir = ms => new Promise(r => setTimeout(r, ms));

let reciente, porArgv, elegida, segunda, configDir, userData, app, pagina, entorno, registro;
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cuaderno-electron-carpeta-'));
const titulo = c => `inicio.md — ${path.basename(c.raiz)}`;   // en la app, el título es lo abierto (la portada) y el cuaderno
// Espera la portada del cuaderno `c` (las copias son iguales: las distingue el título de la ventana, con su carpeta).
// Mientras la ventana navega (arrancando.html → URL de entrada → /), title() falla: se reintenta.
async function esperarTitulo(c) {
  await pagina.locator('#nota h1', { hasText: 'Mi curso' }).waitFor({ state: 'visible', timeout: ESPERA });
  const fin = Date.now() + ESPERA;
  let t = '';
  while (Date.now() < fin && t !== titulo(c)) { await dormir(50); try { t = await pagina.title(); } catch { /* navegando */ } }
  assert.equal(t, titulo(c));
}
const recientes = () => pagina.evaluate(() => fetch('/api/cuadernos').then(r => r.json()).then(l => l.map(c => c.ruta)));

test.before(async () => {
  reciente = crearCuaderno({ kit: false }); porArgv = crearCuaderno({ kit: false }); elegida = crearCuaderno({ kit: false }); segunda = crearCuaderno({ kit: false });
  configDir = path.join(base, 'config'); userData = path.join(base, 'userData');
  fs.mkdirSync(configDir); fs.mkdirSync(userData);
  fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify({ tema: 'claro', recientes: [{ ruta: reciente.raiz, nombre: path.basename(reciente.raiz), abierto: new Date().toISOString() }] }));
  registro = () => { try { return fs.readFileSync(path.join(configDir, 'registro.log'), 'utf8'); } catch { return ''; } };
  const tmp = process.platform !== 'win32' && os.tmpdir().length > 40 ? '/tmp' : os.tmpdir();
  entorno = { ...process.env, TMPDIR: tmp, CUADERNO_CONFIG_DIR: configDir, CUADERNO_USERDATA: userData, CUADERNO_SIN_DIALOGO: '1', CUADERNO_DIALOGO_PRUEBA: elegida.raiz, CUADERNO_OCULTA: '1' };
  app = await _electron.launch({ args: ['.', porArgv.raiz], cwd: RAIZ, timeout: 60_000, env: entorno });
  pagina = await app.firstWindow();
  pagina.setDefaultTimeout(ESPERA);
});
test.after(async () => {
  if (app) await app.close().catch(() => {});
  for (const c of [reciente, porArgv, elegida, segunda]) if (c) c.borrar();
  fs.rmSync(base, { recursive: true, force: true });
});

test('abrir carpeta en la app de escritorio: con la carpeta en los argumentos, la app abre ESA carpeta y no el último reciente; el preload deja window.cuadernoApp y los textos ya no hablan de la terminal', async () => {
  await esperarTitulo(porArgv);
  assert.match(registro(), new RegExp(`\\[app\\] carpeta en los argumentos: ${porArgv.raiz.replace(/[\\\\^$.*+?()[\]{}|]/g, '\\$&')}`));
  assert.match(registro(), /\[app\] servidor en el puerto \d+; la carpeta: /);
  assert.equal(await pagina.evaluate(() => fetch('/api/info').then(r => r.status)), 200);
  // Lo que la pantalla ve de Electron: solo las cuatro cosas del preload, en el sandbox.
  assert.deepEqual(await pagina.evaluate(() => Object.keys(window.cuadernoApp).sort()), ['alAccion', 'elegirCarpeta', 'rutaDeFichero', 'version']);
  assert.equal(await pagina.evaluate(() => window.cuadernoApp.version), version);
  assert.deepEqual(await pagina.evaluate(() => [typeof window.cuadernoApp.elegirCarpeta, typeof window.cuadernoApp.alAccion, typeof window.cuadernoApp.rutaDeFichero, typeof window.require, typeof window.process]), ['function', 'function', 'function', 'undefined', 'undefined']);
  assert.match(await pagina.locator('#aviso-reinicio').textContent(), /Cierra y vuelve a abrir la app/);
  assert.doesNotMatch(await pagina.locator('#aviso-reinicio').textContent(), /terminal|run-cuaderno-app/);
});

test('abrir carpeta en la app de escritorio: «Elegir carpeta…» en Cuadernos (el diálogo del sistema, en pruebas una ruta fija) abre ese cuaderno y lo deja en recientes; la casilla de la ruta sigue estando', async () => {
  await esperarTitulo(porArgv);
  await pagina.evaluate(() => { location.hash = '#/cuadernos'; });
  const boton = pagina.locator('#elegir-carpeta', { hasText: 'Elegir carpeta…' });
  await boton.waitFor({ state: 'visible' });
  assert.equal(await pagina.title(), 'Cuadernos — Cuaderno', 'el título de la ventana en Cuadernos');
  await pagina.locator('#ruta-carpeta').waitFor({ state: 'visible' });
  assert.match(await pagina.locator('#panel .resumen').textContent(), /Abre uno reciente o, abajo, otro cuaderno\.$/);
  // Los recientes primero y «Otro cuaderno» debajo, en una frase: [Elegir carpeta…] (sin .secundario) o escribe la ruta [casilla] [Abrir]; Enter en la casilla es Abrir.
  const orden = await pagina.evaluate(() => [...document.querySelectorAll('#panel > section')].map(s => s.className.split(' ')[1] || s.className));
  assert.ok(orden.indexOf('cuaderno') < orden.indexOf('otro-cuaderno'), `los recientes van antes que «Otro cuaderno»: ${orden}`);
  assert.equal(await pagina.locator('#panel .otro-cuaderno form#abrir-carpeta').count(), 1, 'un solo formulario');
  assert.match(await pagina.locator('#panel .otro-cuaderno').textContent(), /Otro cuaderno:\s*Elegir carpeta…\s*o escribe la ruta/);
  assert.equal(await boton.getAttribute('class'), null, 'el botón sin .secundario');
  assert.equal(await pagina.locator('#ruta-carpeta').getAttribute('placeholder'), '~/cursos/finanzas');
  assert.equal(await pagina.locator('#abrir-carpeta button[type=submit]').textContent(), 'Abrir');
  assert.ok(!(await recientes()).includes(elegida.raiz), 'la carpeta a elegir aún no es reciente');
  const [r] = await Promise.all([pagina.waitForResponse(x => x.url().endsWith('/api/abrir')), boton.click()]);
  assert.equal(r.status(), 200, 'abrir la carpeta elegida');
  await esperarTitulo(elegida);
  assert.ok((await recientes()).includes(elegida.raiz), 'la elegida queda en recientes');
  assert.match(registro(), /\[app\] diálogo de carpeta sustituido \(CUADERNO_DIALOGO_PRUEBA\): /);
  assert.doesNotMatch(registro(), /remitente que no es la pantalla/, 'la pantalla es un remitente válido');
});

test('abrir carpeta en la app de escritorio: una segunda instancia con otra carpeta en sus argumentos hace que la primera la abra (y la segunda sale sola)', { skip: process.platform === 'win32' && 'la segunda instancia tarda demasiado en Windows' }, async () => {
  await esperarTitulo(elegida);
  const recarga = pagina.waitForEvent('load', { timeout: ESPERA });
  const binario = require('electron');   // en Node, el módulo electron es la ruta de su binario
  const args = [...(process.getuid && process.getuid() === 0 ? ['--no-sandbox'] : []), '.', segunda.raiz];
  const otra = spawn(binario, args, { cwd: RAIZ, env: entorno, stdio: 'ignore' });
  const salida = new Promise(r => otra.once('exit', r));
  await recarga;
  await esperarTitulo(segunda);
  assert.ok((await recientes()).includes(segunda.raiz));
  assert.match(registro(), /\[app\] carpeta por segunda instancia: /);
  assert.match(registro(), /\[app\] cuaderno abierto en el servidor: .*; se recarga la ventana/);
  assert.match(registro(), /ya hay otra instancia abierta/);
  const t = setTimeout(() => otra.kill('SIGKILL'), 10_000);
  await salida; clearTimeout(t);
  assert.equal(otra.killed, false, 'la segunda instancia sale por su cuenta');
});
