'use strict';
// El proceso principal de la app de escritorio (electron/app.js) con un Electron falso y un hijo falso: el orden del
// arranque (ventana antes del entorno), qué recibe el hijo, la URL de entrada, el relanzado del hijo que muere, el
// cierre (sin relanzar, también a medio arrancar) y los fallos con diálogo y salida, sin que el token se filtre. Y lo
// que app.js engancha de electron/carpeta.js: la carpeta de argv va al hijo, y una que llega después (open-file,
// segunda instancia) se abre en el servidor con POST /api/abrir y recarga la ventana (lo fino, en electron-carpeta.test.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { arrancar, sinToken, FONDO } = require('../electron/app');

const carpetaConfig = fs.mkdtempSync(path.join(os.tmpdir(), 'cuaderno-app-config-'));   // la que «vigila» el fs.watch falso
test.after(() => fs.rmSync(carpetaConfig, { recursive: true, force: true }));

const tic = () => new Promise(r => setImmediate(r));
const esperar = ms => new Promise(r => setTimeout(r, ms));

// Un Electron de mentira: lo que app.js usa de app, BrowserWindow, utilityProcess, dialog, ipcMain y Menu (y lo que ventana.js
// usa de webContents, session, shell y nativeTheme: aquí solo se comprueba que se enganchan; su conducta, en
// electron-ventana.test.js; lo que menu.js usa de Menu, dialog.showMessageBox, shell y clipboard), anotando cada paso en
// `pasos`. `fallosURL`: errores con los que loadURL rechaza, en orden, antes de empezar a cargar bien.
function electronFalso({ lock = true, fallosURL = [], sistemaOscuro = false } = {}) {
  const pasos = [], ventanas = [], hijos = [], dialogos = [], salidas = [], abiertos = [], canales = {}, menus = [], rutasAbiertas = [], portapapeles = [];
  const eventos = new EventEmitter();
  let pid = 100;
  class BrowserWindow {
    constructor(opciones) {
      this.opciones = opciones; this.cargas = []; this.minimizada = false; this.enfocada = 0; this.fondos = []; ventanas.push(this); pasos.push('ventana');
      this.webContents = Object.assign(new EventEmitter(), { manejadorVentanas: null, mensajes: [], setWindowOpenHandler(f) { this.manejadorVentanas = f; }, send(canal, ...args) { this.mensajes.push([canal, ...args]); } });
    }
    setBackgroundColor(c) { this.fondos.push(c); }
    async loadFile(f) { this.cargas.push({ fichero: f }); pasos.push('loadFile'); }
    async loadURL(u) { pasos.push(`loadURL ${u}`); if (fallosURL.length) throw fallosURL.shift(); this.cargas.push({ url: u }); }
    isMinimized() { return this.minimizada; }
    restore() { this.minimizada = false; pasos.push('restore'); }
    focus() { this.enfocada++; pasos.push('focus'); }
    static getAllWindows() { return ventanas; }
  }
  // El hijo falso: EventEmitter con pid, kill() (sale con null un instante después, como el de verdad) y los mensajes que mande el test.
  const utilityProcess = { fork(ruta, args, opciones) {
    const h = new EventEmitter();
    Object.assign(h, { ruta, args, opciones, pid: ++pid, muerto: false, kill() { if (h.muerto) return false; h.muerto = true; pasos.push(`kill ${h.pid}`); setImmediate(() => h.emit('exit', null)); return true; },
      escucha(puerto, token = 'abc123', pty = undefined) { setImmediate(() => { h.emit('spawn'); h.emit('message', pty === undefined ? { puerto, token } : { puerto, token, pty }); }); },
      muere(codigo) { h.muerto = true; h.emit('exit', codigo); } });
    hijos.push(h); pasos.push(`fork ${h.pid}`);
    return h;
  } };
  const app = {
    rutas: {}, setPath(k, v) { this.rutas[k] = v; }, requestSingleInstanceLock() { return lock; },
    whenReady() { return Promise.resolve(); }, on(e, f) { eventos.on(e, f); }, emitir(e, ...a) { eventos.emit(e, ...a); },
    // quit(): before-quit y, como nadie lo cancela en el falso, will-quit (en Electron, un «Seguir editando» corta entre los dos).
    quit() { pasos.push('quit'); salidas.push('quit'); eventos.emit('before-quit'); eventos.emit('will-quit'); }, exit(c) { pasos.push(`exit ${c}`); salidas.push(c); },
  };
  // showMessageBox (el del Diagnóstico y Acerca de) contesta con el último botón (Cerrar), salvo que el test fije `respuesta`.
  const dialog = { respuesta: null, showMessageBoxSync(o) { dialogos.push(o); pasos.push('diálogo'); return 0; }, async showMessageBox(v, o) { dialogos.push({ ...o, ventana: v }); pasos.push('diálogo'); return { response: dialog.respuesta === null ? o.buttons.length - 1 : dialog.respuesta }; } };
  const nativeTheme = { themeSource: 'system', shouldUseDarkColors: sistemaOscuro };
  const sesiones = {};
  const session = { fromPartition(p) { sesiones[p] = sesiones[p] || { manejadorPermisos: null, setPermissionRequestHandler(f) { this.manejadorPermisos = f; } }; return sesiones[p]; } };
  const shell = { async openExternal(u) { abiertos.push(u); }, async openPath(r) { rutasAbiertas.push(r); return ''; } };
  const ipcMain = { handle(canal, f) { canales[canal] = f; } };
  // Menu: buildFromTemplate devuelve la plantilla tal cual (con `getMenuItemById` como el de verdad) y setApplicationMenu la anota.
  const buscar = (items, id) => { for (const e of items) { if (e.id === id) return e; if (Array.isArray(e.submenu)) { const h = buscar(e.submenu, id); if (h) return h; } } return null; };
  const Menu = { buildFromTemplate(plantilla) { return { items: plantilla, getMenuItemById: id => buscar(plantilla, id) }; }, setApplicationMenu(m) { menus.push(m); pasos.push('menú'); } };
  const clipboard = { writeText(t) { portapapeles.push(t); } };
  return { electron: { app, BrowserWindow, utilityProcess, dialog, nativeTheme, session, shell, ipcMain, Menu, clipboard }, pasos, ventanas, hijos, dialogos, salidas, sesiones, abiertos, canales, menus, rutasAbiertas, portapapeles };
}
// Una configuración de mentira; `recientes` puede ser una función para que cambie entre el arranque y una caída.
const configFalsa = ({ tema = 'auto', recientes = [] } = {}) => ({ leer: () => ({ tema, recientes: typeof recientes === 'function' ? recientes() : recientes }), cuadernoAlArrancar: require('../config').cuadernoAlArrancar, carpeta: () => carpetaConfig });
// Un fs.watch de mentira: anota qué carpeta se vigila y deja disparar el cambio a mano.
const vigilanteFalso = () => { const v = { carpetas: [], avisar: null, cerrado: 0 }; v.vigilar = (dir, f) => { v.carpetas.push(dir); v.avisar = f; return { close() { v.cerrado++; } }; }; return v; };
const registroFalso = () => { const lineas = []; return { lineas, escribir: l => lineas.push(l), ruta: () => '/config/registro.log' }; };
// Un entorno de la shell de mentira: anota cuántas ventanas había al llamarlo y devuelve un PATH propio.
const entornoFalso = (f, { PATH = '/shell/bin:/usr/bin' } = {}) => ({ env }) => { f.vistas = f.ventanas.length; return { env: { ...env, PATH, LANG: 'es_ES.UTF-8' }, origen: 'shell -lc', ms: 7, shell: '/bin/zsh' }; };

// Monta un arranque: `lock`, `fallosURL` y `sistemaOscuro` son del Electron falso; lo demás va a `arrancar`. Sin argumentos
// (argv solo con el ejecutable y la app), toda ruta «existe», y las peticiones al hijo (POST /api/abrir) se anotan y contestan 200.
function montar({ env = {}, config = configFalsa(), topePuerto = 500, lock, fallosURL, sistemaOscuro, ...paraArrancar } = {}) {
  const f = electronFalso({ lock, fallosURL, sistemaOscuro });
  const registro = registroFalso();
  const entorno = entornoFalso(f);
  const vigilante = vigilanteFalso();
  const peticiones = [];
  const peticion = async (o, cuerpo) => { peticiones.push({ ...o, cuerpo }); return { status: 200, cuerpo: '{}' }; };
  const estado = arrancar({ electron: f.electron, config, env: { PATH: '/usr/bin', ...env }, entorno, registro, topePuerto, execPath: '/apps/Cuaderno', existe: () => true, vigilar: vigilante.vigilar, argv: ['/apps/electron', '.'], peticion, ...paraArrancar });
  return { ...f, registro, estado, vigilante, peticiones, get vistas() { return f.vistas; }, get menu() { return f.menus.at(-1); } };   // el menú instalado ahora (los getters no sobreviven al spread)
}
// Un arranque ya con la app cargada en el puerto 7331.
async function arrancado(opciones) { const m = montar(opciones); await tic(); m.hijos[0].escucha(7331, 't0k'); assert.equal(await m.estado.listo, true); return m; }
const sinCarpeta = env => { const { CUADERNO_CARPETA, ...resto } = env; return resto; };

test('arranca en orden: userData de pruebas, instancia única, ventana con el fondo del tema y «Arrancando…» ANTES del entorno, hijo con el entorno resuelto, CUADERNO_NODE y el último cuaderno; loadURL con la URL de entrada al llegar { puerto, token }', async () => {
  const recientes = [{ ruta: '/cuadernos/viejo', nombre: 'Viejo', abierto: '2026-01-01' }, { ruta: '/cuadernos/ultimo', nombre: 'Último', abierto: '2026-10-10' }];
  const m = montar({ env: { CUADERNO_USERDATA: '/tmp/ud' }, config: configFalsa({ tema: 'oscuro', recientes }) });
  await tic();
  assert.deepEqual(m.electron.app.rutas, { userData: '/tmp/ud' });
  assert.equal(m.ventanas.length, 1);
  const v = m.ventanas[0];
  assert.equal(v.opciones.backgroundColor, FONDO.oscuro);
  assert.equal(v.opciones.title, 'Cuaderno');
  assert.deepEqual(v.opciones.webPreferences, { contextIsolation: true, nodeIntegration: false, sandbox: true, partition: 'cuaderno', preload: path.join(__dirname, '..', 'electron', 'preload.js'), additionalArguments: [`--cuaderno-version=${require('../package.json').version}`] });
  assert.equal(v.cargas[0].fichero, path.join(__dirname, '..', 'electron', 'arrancando.html'));
  assert.equal(m.vistas, 1, 'la ventana ya existía cuando se resolvió el entorno');
  assert.equal(m.hijos.length, 1);
  const h = m.hijos[0];
  assert.equal(h.ruta, path.join(__dirname, '..', 'electron', 'servidor-hijo.js'));
  assert.equal(h.opciones.env.PATH, '/shell/bin:/usr/bin'); assert.equal(h.opciones.env.LANG, 'es_ES.UTF-8');
  assert.equal(h.opciones.env.CUADERNO_NODE, '/apps/Cuaderno');
  assert.equal(h.opciones.env.CUADERNO_CARPETA, '/cuadernos/ultimo', 'el reciente más nuevo');
  assert.equal(h.opciones.env.CUADERNO_USERDATA, '/tmp/ud', 'el entorno del padre viaja al hijo');
  assert.equal(v.cargas.length, 1, 'sin puerto aún no entra en la app');
  h.escucha(7331, 'f00d');
  assert.equal(await m.estado.listo, true);
  assert.deepEqual(v.cargas[1], { url: 'http://localhost:7331/?t=f00d' });
  assert.deepEqual({ ...m.estado.entorno, env: undefined }, { origen: 'shell -lc', ms: 7, shell: '/bin/zsh', error: undefined, PATH: '/shell/bin:/usr/bin', env: undefined });
  assert.equal(m.estado.puerto, 7331);
  assert.deepEqual(m.pasos, ['ventana', 'menú', 'loadFile', `fork ${h.pid}`, 'loadURL http://localhost:7331/?t=f00d'], 'el menú se instala con la ventana, antes del primer píxel');
  assert.ok(m.registro.lineas.some(l => l === '[app] entorno de la shell: shell -lc, 7 ms'), m.registro.lineas.join('\n'));
  assert.ok(m.registro.lineas.includes('[app] servidor en el puerto 7331; el último cuaderno: /cuadernos/ultimo'));
  assert.ok(m.registro.lineas.includes(`[app] servidor lanzado (pid ${h.pid})`));
});

test('sin recientes, el hijo arranca sin CUADERNO_CARPETA (pantalla de cuadernos); con tema claro, o auto sobre un sistema claro, fondo blanco', async () => {
  const m = montar({ config: configFalsa({ tema: 'claro' }) });
  await tic();
  assert.equal('CUADERNO_CARPETA' in m.hijos[0].opciones.env, false);
  assert.equal(m.ventanas[0].opciones.backgroundColor, '#ffffff');
  assert.equal(m.electron.nativeTheme.themeSource, 'light');
  m.hijos[0].escucha(40000);
  await m.estado.listo;
  assert.ok(m.registro.lineas.includes('[app] servidor en el puerto 40000; sin cuaderno: pantalla de cuadernos'));
  const auto = montar({ config: configFalsa({ tema: 'auto' }) });
  await tic();
  assert.equal(auto.ventanas[0].opciones.backgroundColor, '#ffffff'); assert.equal(auto.electron.nativeTheme.themeSource, 'system');
  auto.electron.app.emitir('will-quit');
});

test('tema: oscuro fijo → themeSource dark y fondo oscuro; auto sobre un sistema oscuro → fondo oscuro (nunca blanco); la ventana lleva los tratos de ventana.js (enlaces, cierre, permisos de la partición, vigilante de config.json que se cierra al salir)', async () => {
  const m = await arrancado({ config: configFalsa({ tema: 'oscuro' }) });
  assert.equal(m.electron.nativeTheme.themeSource, 'dark');
  assert.equal(m.ventanas[0].opciones.backgroundColor, FONDO.oscuro);
  const wc = m.ventanas[0].webContents;
  assert.equal(typeof wc.manejadorVentanas, 'function', 'setWindowOpenHandler');
  for (const e of ['will-navigate', 'will-prevent-unload', 'did-create-window']) assert.equal(wc.listenerCount(e), 1, e);
  assert.equal(typeof m.sesiones.cuaderno.manejadorPermisos, 'function', 'setPermissionRequestHandler en la sesión de la partición de la ventana');
  assert.deepEqual(m.vigilante.carpetas, [carpetaConfig], 'vigila la carpeta de configuración');
  // Un enlace de la pantalla a otra web va al navegador del sistema y la ventana no navega; el puerto propio es el de ahora.
  const navegacion = { impedida: 0, preventDefault() { this.impedida++; } };
  wc.emit('will-navigate', navegacion, 'https://example.com/x');
  assert.equal(navegacion.impedida, 1); await tic(); assert.deepEqual(m.abiertos, ['https://example.com/x']);
  wc.emit('will-navigate', navegacion, 'http://localhost:7331/#/n/inicio.md');
  assert.equal(navegacion.impedida, 1, 'lo propio navega');
  m.electron.app.emitir('will-quit');
  assert.equal(m.vigilante.cerrado, 1);
  const oscuroPorSistema = montar({ config: configFalsa({ tema: 'auto' }), sistemaOscuro: true });
  await tic();
  assert.equal(oscuroPorSistema.ventanas[0].opciones.backgroundColor, FONDO.oscuro); assert.equal(oscuroPorSistema.electron.nativeTheme.themeSource, 'system');
  oscuroPorSistema.electron.app.emitir('will-quit');
});

test('si el hijo muere después de arrancar, se relanza una vez con el mismo entorno (PATH, CUADERNO_NODE) y la ventana se recarga en la URL nueva (el puerto puede cambiar)', async () => {
  const m = await arrancado({ config: configFalsa({ recientes: [{ ruta: '/cuadernos/a', abierto: '2026-01-01' }] }) });
  m.hijos[0].muere(1);
  await tic();
  assert.equal(m.hijos.length, 2, 'relanzado');
  assert.deepEqual(sinCarpeta(m.hijos[1].opciones.env), sinCarpeta(m.hijos[0].opciones.env));
  assert.equal(m.hijos[1].opciones.env.CUADERNO_CARPETA, '/cuadernos/a', 'sin cambiar de cuaderno, el mismo');
  assert.equal(m.estado.hijo, m.hijos[1]);
  m.hijos[1].escucha(45000, 't0k');
  await tic(); await tic();
  assert.deepEqual(m.ventanas[0].cargas.at(-1), { url: 'http://localhost:45000/?t=t0k' });
  assert.equal(m.estado.puerto, 45000);
  assert.deepEqual(m.salidas, [], 'la app sigue');
  assert.ok(m.registro.lineas.includes('[app] el servidor ha salido con código 1'));
  assert.ok(m.registro.lineas.includes('[app] se relanza el servidor con el mismo entorno y el cuaderno /cuadernos/a'));
  assert.ok(m.registro.lineas.includes('[app] servidor relanzado en el puerto 45000: se recarga la ventana'));
});

test('si la persona cambió de cuaderno antes de la caída, el relanzado abre el que estaba abierto (el reciente más nuevo), no el del arranque', async () => {
  let recientes = [{ ruta: '/cuadernos/a', abierto: '2026-01-01' }];
  const m = await arrancado({ config: configFalsa({ recientes: () => recientes }) });
  assert.equal(m.hijos[0].opciones.env.CUADERNO_CARPETA, '/cuadernos/a');
  recientes = [{ ruta: '/cuadernos/b', abierto: '2026-10-10' }, ...recientes];   // abrir «b» en Cuadernos lo registró como reciente
  m.hijos[0].muere(1); await tic();
  assert.equal(m.hijos[1].opciones.env.CUADERNO_CARPETA, '/cuadernos/b');
  assert.deepEqual(sinCarpeta(m.hijos[1].opciones.env), sinCarpeta(m.hijos[0].opciones.env), 'lo demás, igual');
  assert.ok(m.registro.lineas.includes('[app] se relanza el servidor con el mismo entorno y el cuaderno /cuadernos/b'));
  // Y si ya no queda ningún reciente válido (más de un minuto después), sin carpeta: pantalla de cuadernos, no la vieja.
  m.hijos[1].escucha(7332); await tic(); await tic();
  recientes = [];
  m.hijos[1].muere(1); await tic();
  assert.equal(m.hijos.length, 2, 'dentro de la tregua: no se relanza');
  assert.deepEqual(m.salidas, [1]);
});

test('la salida tardía del hijo viejo tras un relanzado no cuenta como caída ni dispara otro relanzado', async () => {
  const m = await arrancado();
  m.hijos[0].muere(1); await tic();
  assert.equal(m.hijos.length, 2);
  m.hijos[1].escucha(7332); await tic(); await tic();
  m.hijos[0].emit('exit', 137);   // el proceso viejo aún dice algo (Electron puede emitir exit tras kill)
  await tic(); await tic();
  assert.equal(m.hijos.length, 2, 'sin tercer hijo');
  assert.deepEqual(m.salidas, []); assert.equal(m.dialogos.length, 0);
  assert.equal(m.estado.muertes.length, 1);
});

test('si vuelve a morir en menos de un minuto: diálogo y salir con 1; pasado el minuto, se vuelve a relanzar', async () => {
  let reloj = 1_000_000;
  const m = await arrancado({ ahora: () => reloj });
  m.hijos[0].muere(139); await tic();
  m.hijos[1].escucha(7332); await tic(); await tic();
  reloj += 61_000;   // más de un minuto después: la tregua ha pasado
  m.hijos[1].muere(139); await tic();
  assert.equal(m.hijos.length, 3, 'tercera vida: la muerte anterior ya es vieja');
  assert.deepEqual(m.salidas, []);
  m.hijos[2].escucha(7333); await tic(); await tic();
  // Una muerte reciente de verdad: diez segundos después de la anterior.
  reloj += 10_000;
  m.hijos[2].muere(139); await tic();
  assert.equal(m.hijos.length, 3, 'no se relanza');
  assert.deepEqual(m.salidas, [1]);
  assert.equal(m.dialogos.length, 1);
  assert.equal(m.dialogos[0].message, 'El servidor del cuaderno ha fallado');
  assert.match(m.dialogos[0].detail, /se ha caído dos veces en menos de un minuto \(código 139\)/);
  assert.match(m.dialogos[0].detail, /El registro está en \/config\/registro\.log/);
  assert.ok(m.registro.lineas.some(l => l.startsWith('[app] FALLO: El servidor se ha caído dos veces')));
});

test('no relanza si el hijo sale durante el cierre: will-quit marca cerrando (lo vio el spike: app.quit() mata al hijo con 0)', async () => {
  const m = await arrancado();
  m.electron.app.emitir('will-quit');
  assert.equal(m.estado.cerrando, true);
  assert.ok(m.hijos[0].muerto, 'al salir, el padre mata al hijo');
  await tic(); await tic();
  m.hijos[0].muere(0); await tic();
  assert.equal(m.hijos.length, 1, 'sin relanzado');
  assert.deepEqual(m.salidas, []);
  assert.equal(m.dialogos.length, 0);
});

test('quit cancelado (⌘Q con el editor sucio y «Seguir editando»): tras before-quit el hijo sigue vivo, el vigilante sigue y nada está cerrando; un quit posterior sí cierra', async () => {
  const m = await arrancado();
  m.electron.app.emitir('before-quit');   // Electron lo emite al pedir salir; luego la ventana no se cierra y el quit se cancela
  await tic();
  assert.equal(m.estado.cerrando, false);
  assert.equal(m.hijos[0].muerto, false, 'el hijo sigue vivo: la app sigue');
  assert.equal(m.vigilante.cerrado, 0, 'el vigilante del tema sigue');
  m.hijos[0].muere(1); await tic();   // y una caída de verdad después del quit cancelado se relanza, como siempre
  assert.equal(m.hijos.length, 2, 'relanzado');
  m.hijos[1].escucha(7332); await tic(); await tic();
  m.electron.app.emitir('before-quit'); m.electron.app.emitir('will-quit');   // esta vez nadie cancela
  assert.equal(m.estado.cerrando, true);
  assert.ok(m.hijos[1].muerto);
  assert.equal(m.vigilante.cerrado, 1);
  await tic(); await tic();
  assert.equal(m.hijos.length, 2, 'la salida del hijo al cerrar no relanza');
  assert.deepEqual(m.salidas, []); assert.equal(m.dialogos.length, 0);
});

test('cerrar la última ventana: mata al hijo, sale, y la salida del hijo no cuenta como caída', async () => {
  const m = await arrancado();
  m.electron.app.emitir('window-all-closed');
  assert.deepEqual(m.pasos.slice(-2), [`kill ${m.hijos[0].pid}`, 'quit']);
  await tic(); await tic();
  assert.equal(m.hijos.length, 1);
  assert.deepEqual(m.salidas, ['quit']);
  assert.ok(m.registro.lineas.includes('[app] el servidor ha salido con código null'));
});

test('cerrar la ventana durante «Arrancando…» (antes del puerto) no es un fallo: ni diálogo ni salida con 1, solo quit', async () => {
  const m = montar();
  await tic();
  assert.equal(m.hijos.length, 1);
  m.electron.app.emitir('window-all-closed');   // el hijo muere antes de decir su puerto
  assert.equal(await m.estado.listo, false);
  assert.equal(m.dialogos.length, 0);
  assert.deepEqual(m.salidas, ['quit']);
  assert.ok(m.registro.lineas.some(l => /^\[app\] durante el cierre: el servidor ha salido con código null antes de escuchar/.test(l)), m.registro.lineas.join('\n'));
  assert.ok(!m.registro.lineas.some(l => /FALLO/.test(l)));
});

test('cerrar con un relanzado en vuelo (el hijo nuevo aún sin puerto) tampoco es un fallo', async () => {
  const m = await arrancado();
  m.hijos[0].muere(1); await tic();
  assert.equal(m.hijos.length, 2);
  m.electron.app.emitir('will-quit');   // mata al hijo relanzado antes de que escuche
  await tic(); await tic();
  assert.equal(m.dialogos.length, 0);
  assert.deepEqual(m.salidas, []);
  assert.equal(m.hijos.length, 2);
  assert.ok(m.registro.lineas.some(l => /^\[app\] durante el cierre: El servidor no ha vuelto a arrancar/.test(l)));
});

test('si el hijo sale antes de decir el puerto: registro, diálogo con el motivo y salir con 1', async () => {
  const m = montar();
  await tic();
  m.hijos[0].muere(2);
  assert.equal(await m.estado.listo, false);
  assert.deepEqual(m.salidas, [1]);
  assert.equal(m.dialogos.length, 1);
  assert.match(m.dialogos[0].detail, /^el servidor ha salido con código 2 antes de escuchar/);
  assert.equal(m.ventanas[0].cargas.length, 1, 'la ventana se queda en «Arrancando…»');
  assert.ok(m.registro.lineas.includes('[app] FALLO: el servidor ha salido con código 2 antes de escuchar'));
});

test('si da error antes del puerto, lo mismo; y si vence el tope (inyectable) también, con el tope en el motivo', async () => {
  const m = montar();
  await tic();
  m.hijos[0].emit('error', new Error('no se puede ejecutar'));
  assert.equal(await m.estado.listo, false);
  assert.match(m.dialogos[0].detail, /^no se puede ejecutar/);
  assert.ok(m.registro.lineas.includes('[app] error del servidor: no se puede ejecutar'));
  const lento = montar({ topePuerto: 40 });
  await tic();
  assert.equal(await lento.estado.listo, false);
  assert.deepEqual(lento.salidas, [1]);
  assert.match(lento.dialogos[0].detail, /^el servidor no ha dicho su puerto en 0\.04 s/);
  assert.ok(lento.hijos[0].muerto, 'el hijo que no contesta se mata');
  // Un puerto que llegase tarde ya no cambia nada.
  lento.hijos[0].emit('message', { puerto: 1, token: 'x' }); await esperar(10);
  assert.equal(lento.ventanas[0].cargas.length, 1);
});

test('loadURL que falla: se reintenta una vez; si vuelve a fallar, fallo con el mensaje SIN el token (ni en el registro ni en el diálogo)', async () => {
  const error = () => Object.assign(new Error("ERR_CONNECTION_REFUSED (-102) loading 'http://localhost:7331/?t=f00d'"), { code: 'ERR_CONNECTION_REFUSED', errno: -102 });
  const unaVez = montar({ fallosURL: [error()] });
  await tic(); unaVez.hijos[0].escucha(7331, 'f00d');
  assert.equal(await unaVez.estado.listo, true);
  assert.equal(unaVez.pasos.filter(p => p.startsWith('loadURL')).length, 2, 'un reintento');
  assert.deepEqual(unaVez.ventanas[0].cargas.at(-1), { url: 'http://localhost:7331/?t=f00d' });
  assert.ok(unaVez.registro.lineas.includes("[app] la ventana no ha cargado (ERR_CONNECTION_REFUSED (-102) loading 'http://localhost:7331/?t=…'): se reintenta"));
  const dosVeces = montar({ fallosURL: [error(), error()] });
  await tic(); dosVeces.hijos[0].escucha(7331, 'f00d');
  assert.equal(await dosVeces.estado.listo, false);
  assert.deepEqual(dosVeces.salidas, [1]);
  assert.match(dosVeces.dialogos[0].detail, /^La ventana no ha podido cargar la app: ERR_CONNECTION_REFUSED \(-102\) loading 'http:\/\/localhost:7331\/\?t=…'/);
  for (const texto of [...dosVeces.registro.lineas, dosVeces.dialogos[0].detail]) assert.ok(!texto.includes('f00d'), `el token se ha filtrado: ${texto}`);
  assert.ok(dosVeces.hijos[0].muerto);
});

test('ERR_ABORTED en loadURL (otra carga la pisó: una recarga, un enlace) no es fallo: se anota y la app sigue; también tras un relanzado', async () => {
  const abortado = () => Object.assign(new Error("ERR_ABORTED (-3) loading 'http://localhost:7331/?t=f00d'"), { code: 'ERR_ABORTED', errno: -3 });
  const m = montar({ fallosURL: [abortado(), abortado()] });
  await tic(); m.hijos[0].escucha(7331, 'f00d');
  assert.equal(await m.estado.listo, true);
  assert.equal(m.dialogos.length, 0); assert.deepEqual(m.salidas, []);
  assert.ok(m.registro.lineas.some(l => l.startsWith('[app] carga de la ventana interrumpida por otra (no es fallo): ERR_ABORTED (-3) loading') && l.includes('?t=…') && !l.includes('f00d')));
  m.hijos[0].muere(1); await tic();
  m.hijos[1].escucha(7332, 'f00d'); await tic(); await tic(); await tic();
  assert.equal(m.dialogos.length, 0); assert.deepEqual(m.salidas, []);
  assert.equal(m.registro.lineas.filter(l => /interrumpida por otra/.test(l)).length, 2);
});

test('sinToken limpia cualquier ?t=<hex> de un texto y deja lo demás', () => {
  assert.equal(sinToken("loading 'http://localhost:7331/?t=0123456789abcdef' y otra ?t=ff"), "loading 'http://localhost:7331/?t=…' y otra ?t=…");
  assert.equal(sinToken('sin nada'), 'sin nada');
});

test('CUADERNO_SIN_DIALOGO: el diálogo se sustituye por una línea en el registro (para las pruebas sin nadie que lo cierre); un diálogo que falla tampoco para la salida', async () => {
  const m = montar({ env: { CUADERNO_SIN_DIALOGO: '1' } });
  await tic();
  m.hijos[0].muere(1);
  await m.estado.listo;
  assert.equal(m.dialogos.length, 0);
  assert.deepEqual(m.salidas, [1]);
  assert.ok(m.registro.lineas.includes('[app] diálogo saltado (CUADERNO_SIN_DIALOGO): El servidor del cuaderno ha fallado'));
  const roto = montar();
  roto.electron.dialog.showMessageBoxSync = () => { throw new Error('sin pantalla'); };
  await tic();
  roto.hijos[0].muere(1);
  await roto.estado.listo;
  assert.deepEqual(roto.salidas, [1]);
  assert.ok(roto.registro.lineas.includes('[app] no se ha podido enseñar el diálogo: sin pantalla'));
});

test('segunda instancia: sin el lock, sale sin crear nada; con el lock, second-instance trae la ventana al frente (y la restaura si está minimizada)', async () => {
  const segunda = montar({ lock: false });
  assert.equal(await segunda.estado.listo, false);
  assert.deepEqual(segunda.pasos, ['quit']);
  assert.equal(segunda.ventanas.length, 0); assert.equal(segunda.hijos.length, 0);
  assert.ok(segunda.registro.lineas.some(l => /ya hay otra instancia/.test(l)));
  const primera = montar();
  primera.electron.app.emitir('second-instance');   // antes de la ventana: no pasa nada
  await tic();
  primera.electron.app.emitir('second-instance');
  assert.equal(primera.ventanas[0].enfocada, 1);
  primera.ventanas[0].minimizada = true;
  primera.electron.app.emitir('second-instance');
  assert.deepEqual(primera.pasos.slice(-3), ['focus', 'restore', 'focus']);
  primera.hijos[0].escucha(7331); await primera.estado.listo;
});

test('sin CUADERNO_USERDATA no se toca userData; por defecto el tope es 15 s y la tregua un minuto', () => {
  const m = montar();
  assert.deepEqual(m.electron.app.rutas, {});
  const { TOPE_PUERTO, TREGUA } = require('../electron/app');
  assert.equal(TOPE_PUERTO, 15_000); assert.equal(TREGUA, 60_000);
  m.electron.app.emitir('will-quit');
});

test('con una carpeta en argv (saltando la app y los flags), el hijo arranca con ESA carpeta y no con el último reciente; y queda en el registro', async () => {
  const recientes = [{ ruta: '/cuadernos/ultimo', abierto: '2026-10-10' }];
  const m = montar({ config: configFalsa({ recientes }), argv: ['/apps/electron', '--inspect=0', '.', '--no-sandbox', '/cuadernos/pedido'], existe: r => r === '/cuadernos/pedido' || r === '/cuadernos/ultimo' });
  await tic();
  assert.equal(m.hijos[0].opciones.env.CUADERNO_CARPETA, '/cuadernos/pedido');
  m.hijos[0].escucha(7331, 't0k');
  assert.equal(await m.estado.listo, true);
  assert.deepEqual(m.peticiones, [], 'antes de arrancar no hace falta pedir nada al servidor: va en el entorno');
  assert.ok(m.registro.lineas.includes('[app] carpeta en los argumentos: /cuadernos/pedido'));
  assert.ok(m.registro.lineas.includes('[app] servidor en el puerto 7331; la carpeta: /cuadernos/pedido'));
  // Si el hijo se cae, el relanzado ya no lleva la carpeta de argv: vuelve al último reciente (abrirla la registró).
  m.hijos[0].muere(1); await tic();
  assert.equal(m.hijos[1].opciones.env.CUADERNO_CARPETA, '/cuadernos/ultimo');
});

test('open-file antes de arrancar (Mac: carpeta arrastrada al icono al abrir la app) sustituye al último reciente; open-file con la app abierta hace POST /api/abrir al hijo con la cookie del código y recarga la ventana', async () => {
  const antes = montar({ config: configFalsa({ recientes: [{ ruta: '/cuadernos/ultimo', abierto: '2026-10-10' }] }) });
  antes.electron.app.emitir('open-file', { preventDefault() {} }, '/cuadernos/arrastrada');   // llega antes de ready: la ventana aún no existe
  await tic();
  assert.equal(antes.hijos[0].opciones.env.CUADERNO_CARPETA, '/cuadernos/arrastrada');
  antes.hijos[0].escucha(7331); await antes.estado.listo;
  assert.deepEqual(antes.peticiones, []);
  const m = await arrancado({ config: configFalsa({ recientes: [{ ruta: '/cuadernos/a', abierto: '2026-10-10' }] }) });
  assert.equal(m.hijos[0].opciones.env.CUADERNO_CARPETA, '/cuadernos/a');
  m.ventanas[0].minimizada = true;
  m.electron.app.emitir('open-file', { preventDefault() {} }, '/cuadernos/otra');
  await tic(); await tic(); await tic();
  assert.equal(m.peticiones.length, 1);
  const p = m.peticiones[0];
  assert.equal(p.host, 'localhost'); assert.equal(p.port, 7331); assert.equal(p.method, 'POST'); assert.equal(p.path, '/api/abrir');
  assert.equal(p.headers.cookie, 'cuaderno=t0k');
  assert.deepEqual(JSON.parse(p.cuerpo), { ruta: '/cuadernos/otra' });
  assert.deepEqual(m.ventanas[0].cargas.at(-1), { url: 'http://localhost:7331/?t=t0k' }, 'la ventana vuelve a entrar por la URL de entrada');
  assert.deepEqual(m.pasos.slice(-3), ['restore', 'focus', 'loadURL http://localhost:7331/?t=t0k'], 'y pasa al frente');
  assert.equal(m.hijos.length, 1, 'el hijo es el mismo: no se relanza nada');
  assert.ok(m.registro.lineas.includes('[app] carpeta por open-file: /cuadernos/otra'));
  assert.ok(m.registro.lineas.includes('[app] cuaderno abierto en el servidor: /cuadernos/otra; se recarga la ventana'));
  for (const l of m.registro.lineas) assert.ok(!l.includes('t0k'), `el token en el registro: ${l}`);
});

test('la segunda instancia con una carpeta en sus argumentos la abre en el servidor (además de traer la ventana al frente); sin carpeta, solo el frente', async () => {
  const m = await arrancado({ existe: r => r.startsWith('/cuadernos/') });
  m.electron.app.emitir('second-instance', {}, ['/apps/electron', '.', 'relativa'], '/cuadernos');   // sin empaquetar, la segunda también lleva «.»
  await tic(); await tic(); await tic();
  assert.equal(m.peticiones.length, 1);
  assert.deepEqual(JSON.parse(m.peticiones[0].cuerpo), { ruta: '/cuadernos/relativa' }, 'relativa al directorio de la segunda instancia');
  assert.ok(m.registro.lineas.includes('[app] carpeta por segunda instancia: /cuadernos/relativa'));
  m.electron.app.emitir('second-instance', {}, ['/apps/electron', '.', '--flag'], '/cuadernos');
  await tic(); await tic();
  assert.equal(m.peticiones.length, 1, 'sin carpeta no se pide nada');
  assert.equal(m.pasos.at(-1), 'focus');
});

test('el canal IPC elegir-carpeta queda registrado y, desde nuestra pantalla, con CUADERNO_DIALOGO_PRUEBA devuelve esa ruta sin abrir diálogo', async () => {
  const m = await arrancado({ env: { CUADERNO_DIALOGO_PRUEBA: '/cuadernos/elegida' } });
  assert.equal(typeof m.canales['elegir-carpeta'], 'function');
  assert.equal(await m.canales['elegir-carpeta']({ senderFrame: { url: 'http://localhost:7331/' } }), '/cuadernos/elegida');
  await assert.rejects(m.canales['elegir-carpeta']({ senderFrame: { url: 'http://localhost:7332/' } }), /remitente no permitido/);
});

// ---------- T5: el menú (electron/menu.js enganchado por app.js; lo puro, en electron-menu.test.js)
const { URL_PLAN_VIVO } = require('../electron/menu');
const etiquetasDe = items => items.filter(e => e.type !== 'separator').map(e => e.label);

test('el menú se instala con la ventana, en castellano y con los recientes de config.json; se reconstruye cuando config.json cambia de recientes (el mismo vigilante que el tema) y no cuando solo cambia el tema', async () => {
  let recientes = [{ ruta: '/cuadernos/ultimo', nombre: 'Último', abierto: '2026-10-10' }];
  const m = await arrancado({ config: configFalsa({ recientes: () => recientes }) });
  assert.equal(m.menus.length, 1, 'instalado una vez al arrancar');
  assert.deepEqual(etiquetasDe(m.menu.items), ['Cuaderno', 'Edición', 'Ver', 'Ventana', 'Ayuda'], 'en Linux (donde corre el test) no hay menú de la app');
  assert.deepEqual(m.menu.getMenuItemById('recientes').submenu.map(e => e.label), ['Último']);
  assert.equal(m.menu.getMenuItemById('guardar').accelerator, 'CmdOrCtrl+S');
  // Abrir otro cuaderno lo registra como reciente y el hijo reescribe config.json: el vigilante avisa y el menú se rehace.
  recientes = [{ ruta: '/cuadernos/otro', nombre: 'Otro', abierto: '2026-10-11' }, ...recientes];
  m.vigilante.avisar('change', 'config.json');
  assert.equal(m.menus.length, 2);
  assert.deepEqual(m.menu.getMenuItemById('recientes').submenu.map(e => e.label), ['Otro', 'Último']);
  assert.ok(m.registro.lineas.includes('[app] menú reconstruido: 2 recientes'));
  m.vigilante.avisar('change', 'config.json');   // la misma lista (un cambio de tema o de ajustes): el menú no se toca
  assert.equal(m.menus.length, 2);
  m.vigilante.avisar('change', 'token');   // otro fichero de la carpeta: nada
  assert.equal(m.menus.length, 2);
  recientes = [];
  m.vigilante.avisar('rename', null);
  assert.equal(m.menus.length, 3);
  assert.deepEqual(m.menu.getMenuItemById('recientes').submenu.map(e => [e.label, e.enabled]), [['Sin recientes', false]]);
  assert.ok(m.registro.lineas.includes('[app] menú reconstruido: 0 recientes'));
  m.electron.app.emitir('will-quit');
});

test('si instalar el menú falla, se anota y se vuelve a intentar al siguiente cambio de config.json; un fallo en alCambiar no rompe el vigilante del tema', async () => {
  const m = montar();
  const bueno = m.electron.Menu.setApplicationMenu;
  m.electron.Menu.setApplicationMenu = () => { throw new Error('sin menú nativo'); };
  await tic(); m.hijos[0].escucha(7331); await m.estado.listo;
  assert.equal(m.menus.length, 0);
  assert.ok(m.registro.lineas.includes('[app] no se ha podido instalar el menú: sin menú nativo'));
  m.electron.Menu.setApplicationMenu = bueno;
  m.vigilante.avisar('change', 'config.json');
  assert.equal(m.menus.length, 1, 'con los mismos recientes, pero el anterior no llegó a instalarse');
  m.estado.menu.reconstruir = () => { throw new Error('roto'); };
  m.vigilante.avisar('change', 'config.json');
  assert.ok(m.registro.lineas.includes('[app] al cambiar config.json: roto'));
  m.electron.app.emitir('will-quit');
});

test('Abrir nota…, Buscar…, Nueva tarea, Guardar, Abrir carpeta… y Ajustes… mandan su nombre a la pantalla por el canal «accion» (y quedan en el registro); sin ventana se ignoran y se anota', async () => {
  const m = await arrancado();
  const wc = m.ventanas[0].webContents;
  for (const id of ['abrir-nota', 'buscar', 'nueva-tarea', 'guardar', 'abrir-carpeta', 'ajustes']) m.menu.getMenuItemById(id).click();
  assert.deepEqual(wc.mensajes, [['accion', 'abrir-nota'], ['accion', 'buscar'], ['accion', 'nueva-tarea'], ['accion', 'guardar'], ['accion', 'abrir-carpeta'], ['accion', 'ajustes']]);
  assert.ok(m.registro.lineas.includes('[app] menú: guardar'));
  m.estado.ventana = null;
  m.menu.getMenuItemById('guardar').click();
  assert.equal(wc.mensajes.length, 6);
  assert.ok(m.registro.lineas.includes('[app] acción del menú sin ventana, se ignora: guardar'));
  m.electron.app.emitir('will-quit');
});

test('un cuaderno de «Cuadernos recientes» se abre en el servidor (POST /api/abrir, como open-file) y la ventana se recarga', async () => {
  const m = await arrancado({ config: configFalsa({ recientes: [{ ruta: '/cuadernos/a', abierto: '2026-10-10' }, { ruta: '/cuadernos/viejo', nombre: 'Viejo', abierto: '2026-01-01' }] }) });
  const e = m.menu.getMenuItemById('reciente:/cuadernos/viejo');
  assert.equal(e.label, 'Viejo'); assert.equal(e.toolTip, '/cuadernos/viejo');
  e.click();
  await tic(); await tic(); await tic();
  assert.equal(m.peticiones.length, 1);
  assert.equal(m.peticiones[0].path, '/api/abrir'); assert.deepEqual(JSON.parse(m.peticiones[0].cuerpo), { ruta: '/cuadernos/viejo' });
  assert.deepEqual(m.ventanas[0].cargas.at(-1), { url: 'http://localhost:7331/?t=t0k' });
  assert.ok(m.registro.lineas.includes('[app] menú: cuaderno reciente /cuadernos/viejo'));
  assert.ok(m.registro.lineas.includes('[app] carpeta por menú: /cuadernos/viejo'));
  m.electron.app.emitir('will-quit');
});

test('Ayuda → Diagnóstico: un diálogo con versión de la app, Electron/Node/Chromium, sistema, puerto, si node-pty cargó (lo dice el hijo), PATH resuelto y su origen, carpeta de configuración y registro; nunca el token; «Copiar» lo lleva al portapapeles; y queda en el registro', async () => {
  const m = montar({ env: { CUADERNO_USERDATA: '/tmp/ud' } });
  await tic(); m.hijos[0].escucha(7331, 'f00d', true); assert.equal(await m.estado.listo, true);
  assert.equal(m.estado.pty, true, 'el hijo dijo que node-pty cargó');
  m.menu.getMenuItemById('diagnostico').click();
  await tic(); await tic();
  assert.equal(m.dialogos.length, 1);
  const d = m.dialogos[0];
  assert.equal(d.title, 'Diagnóstico'); assert.deepEqual(d.buttons, ['Copiar', 'Cerrar']); assert.equal(d.ventana, m.ventanas[0]);
  const lineas = d.detail.split('\n');
  assert.equal(lineas[0], `Cuaderno ${require('../package.json').version}`);
  assert.match(lineas[1], /^Electron \(fuera de Electron\) · Node \d+\.\d+\.\d+ · Chromium \?$/, 'en el test no hay Electron; en la app, sus tres versiones');
  assert.equal(lineas[2], `Sistema: ${process.platform} ${process.arch}`);
  assert.equal(lineas[3], 'Ejecutable: /apps/Cuaderno');
  assert.ok(lineas.includes('Puerto del servidor: 7331'));
  assert.ok(lineas.includes('node-pty cargado: sí'));
  assert.ok(lineas.includes('Entorno de la shell: shell -lc (/bin/zsh, 7 ms)'));
  assert.ok(lineas.includes('PATH: /shell/bin:/usr/bin'));
  assert.ok(lineas.includes(`Carpeta de configuración: ${carpetaConfig}`));
  assert.ok(lineas.includes('Registro: /config/registro.log'));
  assert.ok(!d.detail.includes('f00d'), 'el token en el diagnóstico');
  assert.deepEqual(m.portapapeles, [], 'Cerrar no copia');
  const anotado = m.registro.lineas.find(l => l.startsWith('[app] diagnóstico:\n'));
  assert.ok(anotado, 'el diagnóstico queda en el registro'); assert.ok(anotado.includes('Puerto del servidor: 7331') && !anotado.includes('f00d'));
  m.electron.dialog.respuesta = 0;   // Copiar
  m.menu.getMenuItemById('diagnostico').click();
  await tic(); await tic();
  assert.deepEqual(m.portapapeles, [d.detail]);
  m.electron.app.emitir('will-quit');
});

test('Diagnóstico sin servidor aún y sin saber de node-pty lo dice; con CUADERNO_SIN_DIALOGO se anota en vez de enseñarse; un diálogo que falla se anota y no rompe nada', async () => {
  const m = montar({ env: { CUADERNO_SIN_DIALOGO: '1' } });
  await tic();   // la ventana y el menú ya están; el hijo aún no ha dicho su puerto
  m.menu.getMenuItemById('diagnostico').click();
  await tic(); await tic();
  assert.equal(m.dialogos.length, 0);
  assert.ok(m.registro.lineas.includes('[app] diálogo saltado (CUADERNO_SIN_DIALOGO): Diagnóstico'));
  const anotado = m.registro.lineas.find(l => l.startsWith('[app] diagnóstico:\n'));
  assert.ok(anotado.includes('Puerto del servidor: (el servidor aún no escucha)') && anotado.includes('node-pty cargado: sin saber aún'), anotado);
  m.hijos[0].escucha(7331, 't0k', false); await m.estado.listo;
  assert.equal(m.estado.pty, false);
  m.electron.app.emitir('will-quit');
  const roto = await arrancado();
  roto.electron.dialog.showMessageBox = async () => { throw new Error('sin pantalla'); };
  roto.menu.getMenuItemById('diagnostico').click();
  await tic(); await tic();
  assert.ok(roto.registro.lineas.includes('[app] no se ha podido enseñar «Diagnóstico»: sin pantalla'));
  assert.deepEqual(roto.portapapeles, []);
  roto.electron.app.emitir('will-quit');
});

test('Ayuda → Plan vivo abre la URL del repo público en el navegador del sistema (sin token); Mostrar registro abre el fichero del registro; Acerca de enseña versión y repo; con CUADERNO_SIN_NAVEGADOR se anotan en vez de abrirse', async () => {
  const m = await arrancado();
  m.menu.getMenuItemById('plan-vivo').click(); await tic();
  assert.deepEqual(m.abiertos, [URL_PLAN_VIVO]);
  assert.match(URL_PLAN_VIVO, /^https:\/\/github\.com\/[^?#]+\/docs\/planes\/plan-vivo\.md$/);
  m.menu.getMenuItemById('mostrar-registro').click(); await tic();
  assert.deepEqual(m.rutasAbiertas, ['/config/registro.log']);
  m.menu.getMenuItemById('acerca-de').click(); await tic(); await tic();
  assert.equal(m.dialogos.length, 1);
  assert.equal(m.dialogos[0].title, 'Acerca de Cuaderno'); assert.equal(m.dialogos[0].message, 'Cuaderno');
  assert.match(m.dialogos[0].detail, new RegExp(`^Versión ${require('../package.json').version.replace(/\\./g, '\\.')}\\n`));
  assert.ok(m.dialogos[0].detail.includes('https://github.com/'));
  for (const texto of [...m.abiertos, ...m.rutasAbiertas, m.dialogos[0].detail]) assert.ok(!texto.includes('t0k'));
  // openPath devuelve un texto de error (así avisa Electron) o rechaza: las dos cosas quedan anotadas.
  m.electron.shell.openPath = async () => 'No existe';
  m.menu.getMenuItemById('mostrar-registro').click(); await tic();
  assert.ok(m.registro.lineas.includes('[app] no se ha podido abrir el registro /config/registro.log: No existe'));
  m.electron.shell.openPath = async () => { throw new Error('sin escritorio'); };
  m.menu.getMenuItemById('mostrar-registro').click(); await tic();
  assert.ok(m.registro.lineas.includes('[app] no se ha podido abrir el registro /config/registro.log: sin escritorio'));
  m.electron.shell.openExternal = async () => { throw new Error('sin navegador'); };
  m.menu.getMenuItemById('plan-vivo').click(); await tic();
  assert.ok(m.registro.lineas.includes('[app] no se ha podido abrir el plan vivo: sin navegador'));
  m.electron.app.emitir('will-quit');
  const sin = await arrancado({ env: { CUADERNO_SIN_NAVEGADOR: '1' } });
  sin.menu.getMenuItemById('plan-vivo').click(); sin.menu.getMenuItemById('mostrar-registro').click(); await tic();
  assert.deepEqual(sin.abiertos, []); assert.deepEqual(sin.rutasAbiertas, []);
  assert.ok(sin.registro.lineas.includes(`[app] navegador no abierto (CUADERNO_SIN_NAVEGADOR): ${URL_PLAN_VIVO}`));
  assert.ok(sin.registro.lineas.includes('[app] registro no abierto (CUADERNO_SIN_NAVEGADOR): /config/registro.log'));
  sin.electron.app.emitir('will-quit');
});
