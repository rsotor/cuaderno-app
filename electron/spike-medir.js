// SPIKE 2026-10-10: se reescribe en la tarea T1 con sus tests (docs/planes/electron.md §6)
'use strict';
// Script de medida del spike (plan §5): lanza la app con Playwright (_electron.launch) sobre una copia temporal del
// cuaderno de ejemplo CON kit, mide el arranque hasta la portada (3 veces), y comprueba cookie, WebSocket, guardar
// con kit (ELECTRON_RUN_AS_NODE), node-pty, portapapeles y la muerte del hijo. Sin pantalla: `xvfb-run -a node
// electron/spike-medir.js`. Escribe solo en la carpeta temporal que se le indique (CUADERNO_SPIKE_TMP) o en os.tmpdir().
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { _electron } = require('playwright');
const { crearCuaderno } = require('../tests/ayuda');

const RAIZ = path.join(__dirname, '..');
const TMP = process.env.CUADERNO_SPIKE_TMP || os.tmpdir();
const hoja = [];   // el informe: líneas con lo medido
const anotar = (...a) => { const l = a.join(' '); hoja.push(l); console.log(`>> ${l}`); };
const dormir = ms => new Promise(r => setTimeout(r, ms));
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.email=spike@example.com', '-c', 'user.name=spike', ...args], { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();

// La copia del cuaderno de ejemplo con kit, como un repo, y con una herramienta guardar.js «del kit» que hace lo que
// hace la de verdad en lo que importa aquí: un commit con git, y dice con qué Node corre y qué PATH ve.
function montarCuaderno() {
  const c = crearCuaderno({ kit: true });
  git(c.raiz, 'init', '-q', '-b', 'main'); git(c.raiz, 'add', '-A'); git(c.raiz, 'commit', '-q', '-m', 'base');
  fs.mkdirSync(path.join(c.raiz, '.kit', 'herramientas'), { recursive: true });
  fs.writeFileSync(path.join(c.raiz, '.kit', 'herramientas', 'guardar.js'), `'use strict';
// Herramienta de mentira para el spike: hace el commit como la del kit, y cuenta con qué corre.
const { execFileSync } = require('node:child_process');
const mensaje = process.argv[2];
const git = (...a) => execFileSync('git', ['-c', 'user.email=kit@example.com', '-c', 'user.name=kit', ...a], { encoding: 'utf8' }).trim();
git('add', '-A'); git('commit', '-q', '-m', mensaje);
const which = (() => { try { return execFileSync('which', ['git'], { encoding: 'utf8' }).trim(); } catch (e) { return 'NO: ' + e.message; } })();
console.log(JSON.stringify({ guardado: git('log', '-1', '--format=%s'), execPath: process.execPath, node: process.versions.node, electron: process.versions.electron || null, argv0: process.argv0, runAsNode: process.env.ELECTRON_RUN_AS_NODE || null, PATH: process.env.PATH, whichGit: which, defaultApp: !!process.defaultApp, tieneElectronModulo: (() => { try { require('electron'); return true; } catch { return false; } })() }));
`);
  return c;
}

async function lanzar({ configDir, userData, carpeta, extra = {} }) {
  const t0 = Date.now();
  const app = await _electron.launch({
    args: ['.'], cwd: RAIZ, timeout: 60_000,
    env: { ...process.env, CUADERNO_CONFIG_DIR: configDir, CUADERNO_USERDATA: userData, CUADERNO_SPIKE_CARPETA: carpeta, CUADERNO_SPIKE_SIN_DIALOGO: '1', ...extra },
  });
  const registro = [];   // lo que el proceso principal y el hijo escriben por stderr
  const p = app.process();
  for (const s of [p.stdout, p.stderr]) if (s) s.on('data', d => { for (const l of String(d).split('\n')) if (l.trim()) { registro.push(l); if (process.env.CUADERNO_SPIKE_VERBOSO) console.log('   | ' + l); } });
  const page = await app.firstWindow();
  page.setDefaultTimeout(20_000);
  const respuestas = [];   // [estado, url] de cada respuesta HTTP de la ventana
  page.on('response', r => respuestas.push([r.status(), new URL(r.url()).pathname]));
  const sockets = [];   // WebSockets abiertos por la pantalla y qué les pasó
  page.on('websocket', ws => { const e = { url: new URL(ws.url()).pathname, cerrado: false, error: null, tramas: 0 }; sockets.push(e); ws.on('close', () => { e.cerrado = true; }); ws.on('socketerror', m => { e.error = m; }); ws.on('framereceived', () => { e.tramas++; }); });
  return { app, page, t0, registro, respuestas, sockets };
}

// Espera a que la ventana enseñe la portada del cuaderno de ejemplo: el título de inicio.md y el de la ventana.
async function esperarPortada(page, nombre) {
  await page.locator('#nota h1', { hasText: 'Mi curso' }).waitFor({ state: 'visible' });
  const fin = Date.now() + 10_000;
  while (Date.now() < fin && (await page.title()) !== `${nombre} · Cuaderno`) await dormir(30);
  return page.title();
}

const ocuparPuerto = puerto => new Promise((ok, mal) => { const s = net.createServer(); s.on('error', mal); s.listen(puerto, '127.0.0.1', () => ok(s)); });

async function main() {
  const base = fs.mkdtempSync(path.join(TMP, 'spike-electron-'));
  const configDir = path.join(base, 'config'), userData = path.join(base, 'userData');
  fs.mkdirSync(configDir); fs.mkdirSync(userData);
  const c = montarCuaderno();
  const nombre = path.basename(c.raiz);
  anotar(`cuaderno de prueba: ${c.raiz} (con kit, repo git)`);
  anotar(`electron: ${require('electron/package.json').version}; node del sistema: ${process.version}; playwright: ${require('playwright/package.json').version}`);
  const pathLogin = spawnSync('bash', ['-lc', 'echo $PATH'], { encoding: 'utf8' }).stdout.trim();

  // ---- P1 y P4: tres arranques medidos hasta la portada; el segundo con 7331 ocupado (EADDRINUSE → listen(0)).
  const tiempos = [];
  let ultimo = null;
  for (let i = 1; i <= 3; i++) {
    const ocupado = i === 2 ? await ocuparPuerto(7331).catch(() => null) : null;
    const e = await lanzar({ configDir, userData, carpeta: c.raiz });
    let titulo;
    try { titulo = await esperarPortada(e.page, nombre); } catch (err) { anotar(`arranque ${i}: NO llega la portada: ${err.message.split('\n')[0]}`); anotar(...e.registro.map(l => `   ${l}`)); throw err; }
    const ms = Date.now() - e.t0;
    tiempos.push(ms);
    const puerto = await e.app.evaluate(() => global.spikeEstado.puerto);
    const interno = e.registro.filter(l => /a los \d+ ms/.test(l)).map(l => l.replace(/^\[app \d+\] /, '')).join(' · ');
    anotar(`arranque ${i}: ${ms} ms hasta la portada (desde _electron.launch); título «${titulo}»; puerto ${puerto}${ocupado ? ' (7331 estaba ocupado)' : ''}; url ${e.page.url()}`);
    anotar(`   tiempos internos: ${interno}`);
    if (ocupado) ocupado.close();
    if (i < 3) { await e.app.close(); await dormir(300); } else ultimo = e;
  }
  anotar(`tiempos de arranque: ${tiempos.join(', ')} ms (objetivo < 2000)`);

  const { app, page, registro, respuestas, sockets } = ultimo;
  // ---- P1: la cookie viaja en los fetch (200 y no 403) y el WebSocket /cambios conecta (el servidor exige Origin).
  await dormir(500);
  const info = respuestas.filter(([, p]) => p === '/api/info');
  const malas = respuestas.filter(([s]) => s >= 400);
  anotar(`P1 cookie: /api/info respondió ${JSON.stringify(info.map(([s]) => s))}; respuestas ≥ 400: ${JSON.stringify(malas)}; total respuestas ${respuestas.length}`);
  const cambios = sockets.find(s => s.url === '/cambios');
  anotar(`P1 WebSocket /cambios: ${cambios ? `abierto, cerrado=${cambios.cerrado}, error=${cambios.error}` : 'NO se ha abierto'}`);
  const cookieDirecta = await page.evaluate(async () => { const r = await fetch('/api/info'); const j = await r.json(); return [r.status, j.cuaderno && j.cuaderno.nombre]; });
  anotar(`P1 fetch('/api/info') desde la página: ${JSON.stringify(cookieDirecta)}; document.cookie=«${await page.evaluate(() => document.cookie)}» (HttpOnly: vacío es lo esperado)`);
  const lock = fs.readdirSync(userData).filter(n => /Singleton/.test(n));
  anotar(`P4 lock de instancia única en userData temporal: ${JSON.stringify(lock)}`);

  // ---- P2 (Linux): el PATH que resolvió entornoDeLaShell frente al de `bash -lc`, y lo que ve el hijo.
  const entorno = await app.evaluate(() => global.spikeEstado.entorno);
  const pathHijo = (registro.find(l => /^\[hijo\] PATH=/.test(l)) || '').replace('[hijo] PATH=', '');
  anotar(`P2 entornoDeLaShell: origen=${entorno.origen}, ${entorno.ms} ms, shell=${entorno.shell}${entorno.error ? `, error=${entorno.error}` : ''}`);
  anotar(`P2 PATH de bash -lc : ${pathLogin}`);
  anotar(`P2 PATH resuelto    : ${entorno.PATH}`);
  anotar(`P2 PATH del hijo    : ${pathHijo}`);
  anotar(`P2 PATH de este test: ${process.env.PATH}`);
  anotar(`P2 ¿el del hijo empieza por el de login? ${pathHijo.startsWith(pathLogin)}; ¿igual al resuelto? ${pathHijo === entorno.PATH}`);

  // ---- P3: guardar con kit desde la ventana (fetch con la cookie): la herramienta del kit corre con ELECTRON_RUN_AS_NODE.
  fs.appendFileSync(path.join(c.base, 'tareas.md'), '- [ ] Tarea del spike\n');
  const guardado = await page.evaluate(() => fetch('/api/guardar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mensaje: 'Guardado desde Electron' }) }).then(r => r.json()));
  anotar(`P3 /api/guardar → código ${guardado.codigo}; salida de la herramienta del kit:`);
  anotar(`   ${guardado.salida}`);
  anotar(`P3 git log -1 en la copia: «${git(c.raiz, 'log', '-1', '--format=%s %an')}»; status limpio: ${git(c.raiz, 'status', '--porcelain') === ''}`);
  anotar(`P3 execPath del hijo: ${(registro.find(l => /^\[hijo\] execPath=/.test(l)) || '').replace('[hijo] ', '')}`);
  anotar(`P3 nodeDelKit en el hijo: ${(registro.find(l => /nodeDelKit/.test(l)) || '')}`);

  // ---- Extra: node-pty dentro del utilityProcess: /pty por WebSocket desde la página, con cookie y Origin de Chromium.
  anotar(`extra node-pty: ${registro.find(l => /node-pty/.test(l)) || 'sin traza'}`);
  const pty = await page.evaluate(() => new Promise(resolver => {
    const ws = new WebSocket(`ws://${location.host}/pty`); let salida = ''; let escrito = false;
    ws.onmessage = ev => { salida += ev.data; if (!escrito && salida.length) { escrito = true; setTimeout(() => ws.send('echo $((40+2))-spike\r'), 300); } if (/42-spike\r?\n/.test(salida.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').split('echo').pop())) { ws.close(); resolver({ ok: true, salida }); } };
    ws.onerror = () => resolver({ ok: false, salida: 'error del WebSocket' });
    ws.onclose = ev => setTimeout(() => resolver({ ok: false, salida: `cerrado ${ev.code}: ${salida}` }), 50);
    setTimeout(() => { ws.close(); resolver({ ok: false, salida: `tiempo agotado: ${salida}` }); }, 8000);
  }));
  anotar(`extra /pty: ${pty.ok ? 'la shell responde (echo $((40+2)) → 42)' : 'NO'}; salida recortada: ${JSON.stringify(pty.salida.slice(-160))}`);

  // ---- Extra: portapapeles tras un gesto de usuario (clic), sin setPermissionRequestHandler.
  await page.click('body');
  const porta = await page.evaluate(async () => { try { await navigator.clipboard.writeText('spike-portapapeles'); return 'writeText ok'; } catch (e) { return `writeText falla: ${e.name}: ${e.message}`; } });
  const lectura = await page.evaluate(async () => { try { return `readText → «${await navigator.clipboard.readText()}»`; } catch (e) { return `readText falla: ${e.name}: ${e.message}`; } });
  const sinGesto = await page.evaluate(() => new Promise(r => setTimeout(async () => { try { await navigator.clipboard.writeText('x'); r('writeText sin gesto ok'); } catch (e) { r(`writeText sin gesto falla: ${e.name}: ${e.message}`); } }, 6000)));
  anotar(`extra portapapeles: ${porta}; ${lectura}; ${sinGesto}`);

  // ---- P1: matar al hijo con la ventana abierta: el padre lo relanza una vez y la pantalla vuelve.
  const pid1 = await app.evaluate(() => global.spikeEstado.hijo.pid);
  const t1 = Date.now();
  process.kill(pid1, 'SIGKILL');
  await page.waitForEvent('load', { timeout: 20_000 });   // la recarga en la urlEntrada nueva
  const titulo2 = await esperarPortada(page, nombre);
  const pid2 = await app.evaluate(() => global.spikeEstado.hijo.pid);
  const puerto2 = await app.evaluate(() => global.spikeEstado.puerto);
  const info2 = await page.evaluate(() => fetch('/api/info').then(r => r.status));
  anotar(`P1 muerte del hijo: pid ${pid1} matado; relanzado como ${pid2} en ${Date.now() - t1} ms; portada de vuelta («${titulo2}»), puerto ${puerto2}, /api/info ${info2}`);
  // La segunda muerte: diálogo (saltado aquí) y salir con 1.
  const salida = new Promise(r => app.process().once('exit', code => r(code)));
  process.kill(pid2, 'SIGKILL');
  const codigo = await Promise.race([salida, dormir(10_000).then(() => 'sigue viva')]);
  anotar(`P1 segunda muerte: la app ${codigo === 'sigue viva' ? 'SIGUE VIVA' : `ha salido con código ${codigo}`}; registro: ${registro.filter(l => /FALLO|relanz|salido/.test(l)).map(l => l.replace(/^\[app \d+\] /, '')).join(' · ')}`);
  if (codigo === 'sigue viva') await app.close().catch(() => {});

  // ¿Quedan huérfanos? (el hijo y la shell del pty)
  await dormir(500);
  const huerfanos = spawnSync('bash', ['-c', `ps -eo pid,ppid,comm,args | grep -E 'servidor-hijo|electron' | grep -v grep | grep -v spike-medir || true`], { encoding: 'utf8' }).stdout.trim();
  anotar(`huérfanos tras salir: ${huerfanos ? '\n' + huerfanos : 'ninguno'}`);

  fs.writeFileSync(path.join(base, 'informe.txt'), hoja.join('\n') + '\n');
  fs.writeFileSync(path.join(base, 'registro.txt'), registro.join('\n') + '\n');
  anotar(`informe en ${path.join(base, 'informe.txt')}; registro del proceso en ${path.join(base, 'registro.txt')}`);
  c.borrar();
}

main().catch(e => { console.error('FALLO DEL SPIKE:', e); process.exit(1); });
