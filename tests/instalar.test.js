'use strict';
// pruebas/instalar.js (`npm run instalar`) sin instalar nada: el plan (función pura) por plataforma y arquitectura, las
// paradas (rama, cambios sin guardar, app que no se cierra, plataforma sin soporte) y la ejecución con `ejecutar`, `fs`,
// `dormir` y `log` falsos: qué órdenes salen y en qué orden, que no se reinstalan dependencias sin necesidad y que en Mac
// la app vieja va a la Papelera y no se borra nunca. La máquina real no se toca: ninguna orden se lanza de verdad.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { instalar, planificar, leerArgumentos, describirPaso, nombreEnPapelera, buscarInstalador, hashDe, MARCA_LOCK } = require('../pruebas/instalar');
const paquete = require('../package.json');

const RAIZ = '/repo';
const HOME = '/Users/ana';
const base = (extra = {}) => ({ plataforma: 'darwin', arch: 'arm64', raiz: RAIZ, home: HOME, localAppData: 'C:\\Users\\ana\\AppData\\Local', node: 'node',
  rama: 'main', ramaPedida: 'main', limpio: true, lockCambiado: false, hayDist: true, ...extra });
const ids = plan => plan.pasos.map(p => p.id);

// ── Argumentos ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('argumentos: main por defecto, --simular, --rama con valor, y rechaza lo que no conoce', () => {
  assert.deepEqual(leerArgumentos([]), { simular: false, rama: 'main' });
  assert.deepEqual(leerArgumentos(['--simular', '--rama', 'probando']), { simular: true, rama: 'probando' });
  assert.match(leerArgumentos(['--rama']).error, /necesita el nombre de la rama/);
  assert.match(leerArgumentos(['--rama', '--simular']).error, /necesita el nombre de la rama/);
  assert.match(leerArgumentos(['--forzar']).error, /argumento desconocido: --forzar/);
});

// ── El plan ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('plan en darwin arm64: pull, construir con --dir, cerrar sin forzar, Papelera, ditto, firma y abrir; sin npm ci', () => {
  const plan = planificar(base());
  assert.deepEqual(ids(plan), ['pull', 'construir', 'cerrar', 'esperar-cierre', 'papelera', 'copiar', 'verificar', 'abrir']);
  const por = Object.fromEntries(plan.pasos.map(p => [p.id, p]));
  assert.deepEqual(por.pull.orden, ['git', 'pull', '--ff-only']);
  assert.deepEqual(por.construir.orden, ['node', '/repo/node_modules/electron-builder/cli.js', '--dir', '--mac', '--arm64']);
  assert.deepEqual(por.cerrar.orden, ['osascript', '-e', 'quit app "Cuaderno"']);
  assert.ok(!por.cerrar.orden.includes('-9') && !/kill/i.test(por.cerrar.orden.join(' ')), 'nunca a la fuerza');
  assert.equal(por.papelera.origen, '/Applications/Cuaderno.app');
  assert.equal(por.papelera.carpeta, '/Users/ana/.Trash');
  assert.deepEqual(por.copiar.orden, ['ditto', '/repo/dist-app/mac-arm64/Cuaderno.app', '/Applications/Cuaderno.app']);
  assert.deepEqual(por.verificar.orden, ['codesign', '--verify', '--deep', '--strict', '/Applications/Cuaderno.app']);
  assert.deepEqual(por.abrir.orden, ['open', '-a', '/Applications/Cuaderno.app']);
});

test('plan en darwin x64: construye para x64 y copia de dist-app/mac/', () => {
  const plan = planificar(base({ arch: 'x64' }));
  assert.ok(plan.pasos.find(p => p.id === 'construir').orden.includes('--x64'));
  assert.equal(plan.pasos.find(p => p.id === 'copiar').orden[1], '/repo/dist-app/mac/Cuaderno.app');
});

test('plan en win32 x64: instalador NSIS, taskkill sin /F, /S y abre el ejecutable por usuario', () => {
  const plan = planificar(base({ plataforma: 'win32', arch: 'x64', raiz: 'C:\\repo' }));
  assert.deepEqual(ids(plan), ['pull', 'construir', 'cerrar', 'esperar-cierre', 'instalar', 'abrir']);
  const por = Object.fromEntries(plan.pasos.map(p => [p.id, p]));
  assert.deepEqual(por.construir.orden, ['node', 'C:\\repo\\node_modules\\electron-builder\\cli.js', '--win', 'nsis', '--x64']);
  assert.deepEqual(por.cerrar.orden, ['taskkill', '/IM', 'Cuaderno.exe']);
  assert.ok(!por.cerrar.orden.some(a => /^\/F$/i.test(a)), 'taskkill sin /F');
  assert.equal(por.instalar.carpeta, 'C:\\repo\\dist-app');
  assert.equal(por.abrir.ruta, 'C:\\Users\\ana\\AppData\\Local\\Programs\\Cuaderno\\Cuaderno.exe');
  assert.ok(!ids(plan).includes('papelera'), 'la Papelera es cosa de Mac');
});

test('plan: si cambió el package-lock.json (o falta node_modules) hace npm ci, baja Electron y anota el lock, antes de construir', () => {
  const plan = planificar(base({ lockCambiado: true, hayDist: false }));
  assert.deepEqual(ids(plan).slice(0, 5), ['pull', 'npm-ci', 'electron', 'marcar-lock', 'construir']);
  assert.deepEqual(plan.pasos[1].orden, ['npm', 'ci']);
  assert.deepEqual(plan.pasos[2].orden, ['node', '/repo/node_modules/electron/install.js']);
});

test('plan: sin cambios en el lock no reinstala dependencias; solo baja Electron si falta su binario', () => {
  assert.ok(!ids(planificar(base())).some(i => ['npm-ci', 'electron', 'marcar-lock'].includes(i)));
  const sinBinario = planificar(base({ hayDist: false }));
  assert.deepEqual(ids(sinBinario).slice(0, 3), ['pull', 'electron', 'construir']);
  assert.ok(!ids(sinBinario).includes('npm-ci'));
  // npm ci borra node_modules entero: el binario hay que bajarlo aunque antes estuviera.
  assert.ok(ids(planificar(base({ lockCambiado: true, hayDist: true }))).includes('electron'));
});

test('plan: para si no está en main, si hay cambios, en Linux o en una arquitectura sin soporte', () => {
  assert.match(planificar(base({ rama: 'electron' })).error, /rama «electron».*desde «main».*--rama electron/);
  assert.equal(planificar(base({ rama: 'electron', ramaPedida: 'electron' })).error, undefined, '--rama a sabiendas vale');
  assert.match(planificar(base({ limpio: false })).error, /cambios sin guardar/);
  assert.match(planificar(base({ plataforma: 'linux' })).error, /no soportado en linux/);
  assert.match(planificar(base({ arch: 'ia32' })).error, /arquitectura no soportada: ia32/);
});

test('describirPaso: pone comillas a lo que lleva espacios y no inventa orden en los pasos internos', () => {
  assert.match(describirPaso({ texto: 'Abrir', orden: ['open', '-a', '/Applications/Mi App.app'] }, 3), /3\. Abrir\n\s+\$ open -a "\/Applications\/Mi App\.app"/);
  assert.match(describirPaso({ texto: 'Cerrar', orden: ['osascript', '-e', 'quit app "Cuaderno"'] }, 2), /\$ osascript -e 'quit app "Cuaderno"'/);
  assert.equal(describirPaso({ texto: 'Esperar', accion: 'esperar-cierre' }, 1), '  1. Esperar');
});

// ── La ejecución, con todo falso ───────────────────────────────────────────────────────────────────────────────────

// Un sistema de ficheros de mentira (rutas con /) y un `ejecutar` que apunta las órdenes y contesta lo programado.
function entorno({ plataforma = 'darwin', rama = 'main', sucio = false, lock = 'lock-v2', marca = hashDe('lock-v2'), nodeModules = true, dist = true,
  appInstalada = true, abierta = [false], siguenAbiertas = false, fallan = [], exes = [] } = {}) {
  const ficheros = new Map([['/repo/package-lock.json', lock], ['/repo/package.json', JSON.stringify({ version: paquete.version })]]);
  if (marca !== null) ficheros.set(`/repo/${MARCA_LOCK.replace(/\\/g, '/')}`, marca);
  const carpetas = new Set(['/Users/ana/.Trash']);
  if (nodeModules) carpetas.add('/repo/node_modules');
  if (dist) carpetas.add('/repo/node_modules/electron/dist');
  if (appInstalada) carpetas.add('/Applications/Cuaderno.app');
  const ordenes = [], registro = [], renombrados = [], dormidas = [], abiertos = [];
  let consultas = 0;
  const fs = {
    readFileSync: ruta => { const r = String(ruta).replace(/\\/g, '/'); if (!ficheros.has(r)) throw new Error(`ENOENT ${r}`); return ficheros.get(r); },
    writeFileSync: (ruta, contenido) => { ficheros.set(String(ruta).replace(/\\/g, '/'), String(contenido)); },
    existsSync: ruta => { const r = String(ruta).replace(/\\/g, '/'); return ficheros.has(r) || carpetas.has(r); },
    renameSync: (de, a) => { renombrados.push([de, a]); carpetas.delete(de); carpetas.add(a); },
    readdirSync: () => exes.map(e => e.nombre),
    statSync: ruta => ({ mtimeMs: exes.find(e => ruta.endsWith(e.nombre)).t }),
  };
  const ejecutar = (orden, opciones = {}) => {
    ordenes.push(orden);
    const texto = orden.join(' ');
    if (fallan.some(f => texto.includes(f))) return { status: 1, stdout: '' };
    if (orden[0] === 'git' && orden[1] === 'rev-parse' && orden.includes('--abbrev-ref')) return { status: 0, stdout: `${rama}\n` };
    if (orden[0] === 'git' && orden[1] === 'status') return { status: 0, stdout: sucio ? ' M public/app.js\n' : '' };
    if (orden[0] === 'git' && orden[1] === 'rev-parse') return { status: 0, stdout: 'abc1234\n' };
    if (orden[0] === 'pgrep' || orden[0] === 'tasklist') {
      const viva = siguenAbiertas || abierta[Math.min(consultas++, abierta.length - 1)];
      return orden[0] === 'pgrep' ? { status: viva ? 0 : 1, stdout: '' } : { status: 0, stdout: viva ? '"Cuaderno.exe","1234"' : 'INFORMACIÓN: no hay tareas' };
    }
    return { status: 0, stdout: '' };
  };
  const d = { plataforma, arch: plataforma === 'darwin' ? 'arm64' : 'x64', raiz: RAIZ, home: HOME, localAppData: 'C:\\Users\\ana\\AppData\\Local', node: 'node',
    ejecutar, fs, dormir: ms => dormidas.push(ms), abrirSeparado: ruta => abiertos.push(ruta), ahora: () => new Date(2026, 9, 10, 21, 54, 3), log: m => registro.push(m) };
  return { d, ordenes, registro, renombrados, dormidas, abiertos, ficheros, carpetas, texto: () => registro.join('\n'),
    lanzadas: () => ordenes.filter(o => !(o[0] === 'git' && o[1] !== 'pull') && o[0] !== 'pgrep' && o[0] !== 'tasklist').map(o => o.join(' ').replace(/\\/g, '/')) };
}

test('instalar en Mac: pull, construir, cerrar la app abierta, vieja a la Papelera, ditto, firma, abrir y línea final con versión y commit', () => {
  const e = entorno({ abierta: [true, true, false] });   // abierta al ir a cerrar y al primer vistazo, cerrada al segundo
  assert.equal(instalar([], e.d), 0, e.texto());
  assert.deepEqual(e.lanzadas(), [
    'git pull --ff-only',
    'node /repo/node_modules/electron-builder/cli.js --dir --mac --arm64',
    'osascript -e quit app "Cuaderno"',
    'ditto /repo/dist-app/mac-arm64/Cuaderno.app /Applications/Cuaderno.app',
    'codesign --verify --deep --strict /Applications/Cuaderno.app',
    'open -a /Applications/Cuaderno.app',
  ]);
  assert.deepEqual(e.renombrados, [['/Applications/Cuaderno.app', '/Users/ana/.Trash/Cuaderno 2026-10-10 21.54.03.app']]);
  assert.ok(e.dormidas.length >= 1, 'espera entre vistazos');
  assert.match(e.registro.at(-1), new RegExp(`^Instalada Cuaderno ${paquete.version.replace(/\./g, '\\.')} \\(abc1234\\) en /Applications/Cuaderno\\.app$`));
});

test('instalar en Mac: la vieja nunca se borra (solo rename a la Papelera, con nombre único) y no hay rm', () => {
  const e = entorno({});
  e.carpetas.add('/Users/ana/.Trash/Cuaderno 2026-10-10 21.54.03.app');   // ya hay una con ese nombre
  assert.equal(instalar([], e.d), 0, e.texto());
  assert.equal(e.renombrados.length, 1);
  assert.equal(e.renombrados[0][1], '/Users/ana/.Trash/Cuaderno 2026-10-10 21.54.03 (2).app');
  assert.ok(!e.ordenes.some(o => /^(rm|rmdir|unlink)$/.test(path.basename(o[0]))), 'ninguna orden de borrado');
  assert.equal(nombreEnPapelera(e.d, '/Users/ana/.Trash'), '/Users/ana/.Trash/Cuaderno 2026-10-10 21.54.03 (3).app', 'y la siguiente ya iría por (3)');
});

test('instalar en Mac: sin app instalada (primera vez) no hay nada que mover y no pide cerrar nada', () => {
  const e = entorno({ appInstalada: false });
  assert.equal(instalar([], e.d), 0, e.texto());
  assert.deepEqual(e.renombrados, []);
  assert.ok(!e.ordenes.some(o => o[0] === 'osascript'), 'cerrar con osascript la arrancaría solo para cerrarla');
  assert.match(e.texto(), /primera instalación/);
});

test('si la app no se cierra en el tope, para SIN instalar: ni Papelera, ni ditto, ni abrir', () => {
  const e = entorno({ siguenAbiertas: true });
  assert.equal(instalar([], e.d), 1);
  assert.match(e.registro.at(-1), /sigue abierta tras 20 s.*No se ha instalado nada y no se fuerza/);
  assert.deepEqual(e.renombrados, []);
  assert.ok(!e.ordenes.some(o => ['ditto', 'codesign', 'open'].includes(o[0])));
  assert.equal(e.dormidas.length, 40, '20 s en vueltas de 500 ms');
  assert.ok(e.ordenes.some(o => o[0] === 'osascript'), 'sí se lo pidió, con buenas maneras');
});

test('sin main (u otra rama pedida) o con cambios, no ejecuta nada: ni el pull', () => {
  const enOtraRama = entorno({ rama: 'electron' });
  assert.equal(instalar([], enOtraRama.d), 1);
  assert.match(enOtraRama.registro[0], /rama «electron»/);
  const sucio = entorno({ sucio: true });
  assert.equal(instalar([], sucio.d), 1);
  assert.match(sucio.registro[0], /cambios sin guardar/);
  for (const e of [enOtraRama, sucio]) assert.deepEqual(e.lanzadas(), []);
  const aSabiendas = entorno({ rama: 'electron' });
  assert.equal(instalar(['--rama', 'electron'], aSabiendas.d), 0, aSabiendas.texto());
});

test('en Linux no está soportado: lo dice y sale con 1 sin lanzar nada', () => {
  const e = entorno({ plataforma: 'linux' });
  assert.equal(instalar([], e.d), 1);
  assert.match(e.registro[0], /no soportado en linux/);
  assert.deepEqual(e.lanzadas(), []);
});

test('argumento desconocido: sale con 1 antes de mirar nada', () => {
  const e = entorno({});
  assert.equal(instalar(['--rapido'], e.d), 1);
  assert.match(e.registro[0], /argumento desconocido/);
  assert.deepEqual(e.ordenes, []);
});

test('no reinstala dependencias si el lock coincide con el de la última npm ci; sí si cambió, y anota el nuevo', () => {
  const igual = entorno({});
  assert.equal(instalar([], igual.d), 0, igual.texto());
  assert.ok(!igual.lanzadas().some(o => o.startsWith('npm ') || o.includes('electron/install.js')));
  const cambiado = entorno({ lock: 'lock-v3' });   // la marca es la de lock-v2
  assert.equal(instalar([], cambiado.d), 0, cambiado.texto());
  const lanzadas = cambiado.lanzadas();
  assert.ok(lanzadas.indexOf('npm ci') > 0 && lanzadas.indexOf('npm ci') < lanzadas.findIndex(o => o.includes('electron-builder')));
  assert.ok(lanzadas.includes('node /repo/node_modules/electron/install.js'), 'npm ci borra el binario de Electron');
  assert.equal(cambiado.ficheros.get(`/repo/${MARCA_LOCK.replace(/\\/g, '/')}`), hashDe('lock-v3'), 'la clave, con / como guarda el fs falso (en Windows MARCA_LOCK lleva \\)');
});

test('sin node_modules o sin marca del lock, instala las dependencias; sin binario de Electron, solo lo baja', () => {
  assert.ok(instalarYLanzadas({ nodeModules: false, dist: false }).includes('npm ci'));
  assert.ok(instalarYLanzadas({ marca: null }).includes('npm ci'));
  const soloBinario = instalarYLanzadas({ dist: false });
  assert.ok(!soloBinario.includes('npm ci') && soloBinario.includes('node /repo/node_modules/electron/install.js'));
});
function instalarYLanzadas(opciones) { const e = entorno(opciones); assert.equal(instalar([], e.d), 0, e.texto()); return e.lanzadas(); }

test('el pull puede traer otro lock: tras él se vuelve a decidir (npm ci aparece aunque antes no hiciera falta)', () => {
  const e = entorno({});
  const ejecutarOriginal = e.d.ejecutar;
  e.d.ejecutar = (orden, o) => { const r = ejecutarOriginal(orden, o); if (orden[1] === 'pull') e.ficheros.set('/repo/package-lock.json', 'lock-traido'); return r; };
  assert.equal(instalar([], e.d), 0, e.texto());
  assert.ok(e.lanzadas().includes('npm ci'));
});

test('un fallo de una orden para el resto y lo dice (código 1); sin firma válida no abre', () => {
  const sinConstruir = entorno({ fallan: ['--dir --mac'] });
  assert.equal(instalar([], sinConstruir.d), 1);
  assert.match(sinConstruir.registro.at(-1), /ha fallado/);
  assert.deepEqual(sinConstruir.renombrados, [], 'si no construye, la app instalada se queda donde está');
  const sinFirma = entorno({ fallan: ['codesign'] });
  assert.equal(instalar([], sinFirma.d), 1);
  assert.ok(!sinFirma.ordenes.some(o => o[0] === 'open'));
  const pullFalla = entorno({ fallan: ['pull'] });
  assert.equal(instalar([], pullFalla.d), 1);
  assert.deepEqual(pullFalla.renombrados, []);
});

test('si no puede mover la vieja a la Papelera, para sin copiar encima', () => {
  const e = entorno({});
  e.d.fs.renameSync = () => { throw new Error('Operation not permitted'); };
  assert.equal(instalar([], e.d), 1);
  assert.match(e.registro.at(-1), /no he podido mover \/Applications\/Cuaderno\.app a la Papelera \(Operation not permitted\)/);
  assert.ok(!e.ordenes.some(o => o[0] === 'ditto'));
});

test('instalar en Windows: cierra con taskkill sin /F, ejecuta el instalador con /S y abre el ejecutable instalado', () => {
  const e = entorno({ plataforma: 'win32', abierta: [true, false], exes: [
    { nombre: `Cuaderno Setup ${paquete.version}.exe`, t: 100 }, { nombre: 'Cuaderno Setup 0.0.1.exe', t: 500 }, { nombre: 'builder-debug.yml', t: 900 }] });
  assert.equal(instalar([], e.d), 0, e.texto());
  assert.deepEqual(e.lanzadas(), [
    'git pull --ff-only',
    'node /repo/node_modules/electron-builder/cli.js --win nsis --x64',
    'taskkill /IM Cuaderno.exe',
    `/repo/dist-app/Cuaderno Setup ${paquete.version}.exe /S`,
  ]);
  assert.deepEqual(e.abiertos, ['C:\\Users\\ana\\AppData\\Local\\Programs\\Cuaderno\\Cuaderno.exe']);
  assert.match(e.registro.at(-1), /^Instalada Cuaderno .* \(abc1234\) en C:/);
});

test('Windows: si la app no se cierra no ejecuta el instalador; si no hay instalador de esta versión, lo dice', () => {
  const abierta = entorno({ plataforma: 'win32', siguenAbiertas: true });
  assert.equal(instalar([], abierta.d), 1);
  assert.ok(!abierta.ordenes.some(o => o[0].endsWith('.exe')));
  const sinExe = entorno({ plataforma: 'win32', exes: [] });
  assert.equal(instalar([], sinExe.d), 1);
  assert.match(sinExe.registro.at(-1), new RegExp(`no encuentro el instalador de la versión ${paquete.version.replace(/\./g, '\\.')}`));
  assert.equal(buscarInstalador(sinExe.d, '/repo/dist-app', paquete.version), null);
});

test('--simular enseña los pasos y no ejecuta nada más que leer (git rev-parse, git status)', () => {
  const e = entorno({});
  assert.equal(instalar(['--simular'], e.d), 0);
  assert.deepEqual(e.lanzadas(), [], 'ninguna orden de instalación');
  assert.deepEqual(e.renombrados, []);
  assert.match(e.texto(), /Simulación \(no se ejecuta nada\): darwin arm64, rama main/);
  assert.match(e.texto(), /1\. Traer los cambios[\s\S]*\$ git pull --ff-only/);
  assert.match(e.texto(), /Pedir a Cuaderno que se cierre/);
  assert.ok(e.dormidas.length === 0 && e.abiertos.length === 0);
});

test('--simular también para en la rama equivocada, para que se vea antes de lanzarlo de verdad', () => {
  const e = entorno({ rama: 'electron' });
  assert.equal(instalar(['--simular'], e.d), 1);
  assert.match(e.registro[0], /rama «electron»/);
});
