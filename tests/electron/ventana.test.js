'use strict';
// El recorrido de la app de escritorio, con el Electron de verdad lanzado por Playwright (_electron, experimental) sobre
// una copia del cuaderno de ejemplo: abre el último cuaderno en su ventana, el servidor se relanza si muere, y al
// cerrar no queda ni el puerto ni ningún proceso. Va en su paso (`npm run test:electron`), no en `npm test`: necesita el
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
// Los procesos vivos del árbol de la app (el principal y sus hijos, incluido el utilityProcess del servidor), por pid.
function procesosDe(pid) {
  if (!unix) return [];
  const lineas = execFileSync('ps', ['-eo', 'pid=,ppid=,stat=,args='], { encoding: 'utf8' }).split('\n').map(l => l.trim()).filter(Boolean)
    .map(l => { const [p, pp, stat, ...args] = l.split(/\s+/); return { pid: +p, ppid: +pp, zombi: /^Z/.test(stat), args: args.join(' ') }; });
  const vivos = lineas.filter(p => !p.zombi);   // un <defunct> ya ha muerto: solo espera a que lo recojan (sin init en un contenedor, tarda)
  const arbol = new Set([pid]);
  let creció = true;
  while (creció) { creció = false; for (const p of vivos) if (arbol.has(p.ppid) && !arbol.has(p.pid)) { arbol.add(p.pid); creció = true; } }
  return vivos.filter(p => arbol.has(p.pid));
}
const pidDelServidor = () => procesosDe(app.process().pid).find(p => /utility-sub-type=node\.mojom\.NodeService/.test(p.args));
// Espera a que la ventana enseñe la portada del cuaderno de ejemplo con su título.
async function esperarPortada() {
  await pagina.locator('#nota h1', { hasText: 'Mi curso' }).waitFor({ state: 'visible', timeout: ESPERA });
  const nombre = path.basename(c.raiz), fin = Date.now() + ESPERA;
  while (Date.now() < fin && (await pagina.title()) !== `${nombre} · Cuaderno`) await dormir(50);
  assert.equal(await pagina.title(), `${nombre} · Cuaderno`);
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
  app = await _electron.launch({ args: ['.'], cwd: RAIZ, timeout: 60_000, env: { ...process.env, TMPDIR: tmp, CUADERNO_CONFIG_DIR: configDir, CUADERNO_USERDATA: userData, CUADERNO_SIN_DIALOGO: '1' } });
  pagina = await app.firstWindow();
  pagina.setDefaultTimeout(ESPERA);
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

test('la app de escritorio: si el servidor muere, el padre lo relanza y la ventana vuelve a la portada', { skip: !unix && 'ps solo en Mac y Linux' }, async () => {
  await esperarPortada();
  const servidor = pidDelServidor();
  assert.ok(servidor, `no encuentro el utilityProcess del servidor entre ${JSON.stringify(procesosDe(app.process().pid).map(p => p.args.slice(0, 60)))}`);
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

test('la app de escritorio: al cerrar, el servidor se para (el puerto queda libre) y no queda ningún proceso (hasta 2 s)', async () => {
  await esperarPortada();
  puerto = Number(new URL(pagina.url()).port);
  const pid = app.process().pid;
  await app.close();
  app = null;
  const fin = Date.now() + 2000;
  let vivos = procesosDe(pid), escucha = await escuchando(puerto);
  while (Date.now() < fin && (vivos.length || escucha)) { await dormir(100); vivos = procesosDe(pid); escucha = await escuchando(puerto); }
  assert.equal(escucha, false, `el puerto ${puerto} sigue escuchando`);
  assert.deepEqual(vivos.map(p => p.args.slice(0, 80)), [], 'quedan procesos de la app');
  assert.match(registro(), /\[app\] el servidor ha salido con código/, 'la salida del hijo al cerrar queda anotada');
  assert.doesNotMatch(registro(), /FALLO/, 'cerrar no es un fallo');
});
