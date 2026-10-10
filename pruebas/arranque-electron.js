'use strict';
// Mide el arranque de la app de escritorio: desde que Playwright lanza Electron hasta que la ventana enseña la portada
// del cuaderno de ejemplo, tres veces, con los tiempos internos que anota el registro. Lo que el recorrido
// (tests/electron/ventana.test.js) no mide porque un tiempo no es un criterio de test (plan §5: objetivo < 2 s).
//   node pruebas/arranque-electron.js            (sin pantalla: xvfb-run -a node pruebas/arranque-electron.js)
// Escribe solo en carpetas temporales; necesita el binario de Electron (node node_modules/electron/install.js).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require('playwright');
const { crearCuaderno } = require('../tests/ayuda');

const RAIZ = path.join(__dirname, '..');
const dormir = ms => new Promise(r => setTimeout(r, ms));

async function medir(configDir, userData, nombre) {
  const t0 = Date.now();
  const tmp = os.tmpdir().length > 40 ? '/tmp' : os.tmpdir();   // el socket del singleton va bajo TMPDIR (ruta corta)
  const app = await _electron.launch({ args: ['.'], cwd: RAIZ, timeout: 60_000, env: { ...process.env, TMPDIR: tmp, CUADERNO_CONFIG_DIR: configDir, CUADERNO_USERDATA: userData, CUADERNO_SIN_DIALOGO: '1' } });
  const pagina = await app.firstWindow();
  await pagina.locator('#nota h1', { hasText: 'Mi curso' }).waitFor({ state: 'visible', timeout: 30_000 });
  while ((await pagina.title()) !== `${nombre} · Cuaderno`) await dormir(20);
  const ms = Date.now() - t0;
  await app.close();
  return ms;
}

async function main() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cuaderno-arranque-'));
  const configDir = path.join(base, 'config'), userData = path.join(base, 'userData');
  fs.mkdirSync(configDir); fs.mkdirSync(userData);
  const c = crearCuaderno({ kit: false });
  const nombre = path.basename(c.raiz);
  fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify({ recientes: [{ ruta: c.raiz, nombre, abierto: new Date().toISOString() }] }));
  console.log(`electron ${require('electron/package.json').version}; node ${process.version}; cuaderno de ejemplo en una copia temporal`);
  const tiempos = [];
  for (let i = 1; i <= 3; i++) { tiempos.push(await medir(configDir, userData, nombre)); console.log(`arranque ${i}: ${tiempos[i - 1]} ms hasta la portada`); await dormir(300); }
  console.log(`tiempos: ${tiempos.join(', ')} ms (objetivo < 2000; el primero paga el binario frío)`);
  const registro = fs.readFileSync(path.join(configDir, 'registro.log'), 'utf8').split('\n').filter(l => /entorno de la shell|servidor en el puerto/.test(l));
  console.log(registro.map(l => `  ${l.replace(/^\S+ /, '')}`).join('\n'));
  c.borrar();
  fs.rmSync(base, { recursive: true, force: true });
}

main().catch(e => { console.error(e); process.exit(1); });
