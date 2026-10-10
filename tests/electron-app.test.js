'use strict';
// El proceso principal de la app de escritorio (electron/app.js) con un Electron falso y un hijo falso: el orden del
// arranque (ventana antes del entorno), qué recibe el hijo, la URL de entrada, el relanzado del hijo que muere, el
// cierre (sin relanzar) y los fallos con diálogo y salida.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { arrancar, FONDO } = require('../electron/app');

const tic = () => new Promise(r => setImmediate(r));
const esperar = ms => new Promise(r => setTimeout(r, ms));

// Un Electron de mentira: lo que app.js usa de app, BrowserWindow, utilityProcess y dialog, anotando cada paso en `pasos`.
function electronFalso({ lock = true } = {}) {
  const pasos = [], ventanas = [], hijos = [], dialogos = [], salidas = [];
  const eventos = new EventEmitter();
  let pid = 100;
  class BrowserWindow {
    constructor(opciones) { this.opciones = opciones; this.cargas = []; this.minimizada = false; this.enfocada = 0; ventanas.push(this); pasos.push('ventana'); }
    async loadFile(f) { this.cargas.push({ fichero: f }); pasos.push('loadFile'); }
    async loadURL(u) { this.cargas.push({ url: u }); pasos.push(`loadURL ${u}`); }
    isMinimized() { return this.minimizada; }
    restore() { this.minimizada = false; pasos.push('restore'); }
    focus() { this.enfocada++; pasos.push('focus'); }
    static getAllWindows() { return ventanas; }
  }
  // El hijo falso: EventEmitter con pid, kill() (sale con null un instante después, como el de verdad) y los mensajes que mande el test.
  const utilityProcess = { fork(ruta, args, opciones) {
    const h = new EventEmitter();
    Object.assign(h, { ruta, args, opciones, pid: ++pid, muerto: false, kill() { if (h.muerto) return false; h.muerto = true; pasos.push(`kill ${h.pid}`); setImmediate(() => h.emit('exit', null)); return true; },
      escucha(puerto, token = 'abc123') { setImmediate(() => { h.emit('spawn'); h.emit('message', { puerto, token }); }); },
      muere(codigo) { h.muerto = true; h.emit('exit', codigo); } });
    hijos.push(h); pasos.push(`fork ${h.pid}`);
    return h;
  } };
  const app = {
    rutas: {}, setPath(k, v) { this.rutas[k] = v; }, requestSingleInstanceLock() { return lock; },
    whenReady() { return Promise.resolve(); }, on(e, f) { eventos.on(e, f); }, emitir(e, ...a) { eventos.emit(e, ...a); },
    quit() { pasos.push('quit'); salidas.push('quit'); eventos.emit('before-quit'); }, exit(c) { pasos.push(`exit ${c}`); salidas.push(c); },
  };
  const dialog = { showMessageBoxSync(o) { dialogos.push(o); pasos.push('diálogo'); return 0; } };
  return { electron: { app, BrowserWindow, utilityProcess, dialog }, pasos, ventanas, hijos, dialogos, salidas };
}
const configFalsa = ({ tema = 'auto', recientes = [] } = {}) => ({ leer: () => ({ tema, recientes }), cuadernoAlArrancar: require('../config').cuadernoAlArrancar });
const registroFalso = () => { const lineas = []; return { lineas, escribir: l => lineas.push(l), ruta: () => '/config/registro.log' }; };
// Un entorno de la shell de mentira: anota cuántas ventanas había al llamarlo y devuelve un PATH propio.
const entornoFalso = (f, { PATH = '/shell/bin:/usr/bin' } = {}) => ({ env }) => { f.vistas = f.ventanas.length; return { env: { ...env, PATH, LANG: 'es_ES.UTF-8' }, origen: 'shell -lc', ms: 7, shell: '/bin/zsh' }; };

function montar({ env = {}, config = configFalsa(), topePuerto = 500, ...resto } = {}) {
  const f = electronFalso(resto);
  const registro = registroFalso();
  const entorno = entornoFalso(f);
  const estado = arrancar({ electron: f.electron, config, env: { PATH: '/usr/bin', ...env }, entorno, registro, topePuerto, execPath: '/apps/Cuaderno', existe: () => true, ...resto });
  return { ...f, registro, estado, get vistas() { return f.vistas; } };
}

test('arranca en orden: userData de pruebas, instancia única, ventana con el fondo del tema y «Arrancando…» ANTES del entorno, hijo con el entorno resuelto, CUADERNO_NODE y el último cuaderno; loadURL con la URL de entrada al llegar { puerto, token }', async () => {
  const recientes = [{ ruta: '/cuadernos/viejo', nombre: 'Viejo', abierto: '2026-01-01' }, { ruta: '/cuadernos/ultimo', nombre: 'Último', abierto: '2026-10-10' }];
  const m = montar({ env: { CUADERNO_USERDATA: '/tmp/ud' }, config: configFalsa({ tema: 'oscuro', recientes }) });
  await tic();
  assert.deepEqual(m.electron.app.rutas, { userData: '/tmp/ud' });
  assert.equal(m.ventanas.length, 1);
  const v = m.ventanas[0];
  assert.equal(v.opciones.backgroundColor, FONDO.oscuro);
  assert.equal(v.opciones.title, 'Cuaderno');
  assert.deepEqual(v.opciones.webPreferences, { contextIsolation: true, nodeIntegration: false, sandbox: true, partition: 'cuaderno' });
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
  assert.deepEqual(m.estado.entorno, { origen: 'shell -lc', ms: 7, shell: '/bin/zsh', error: undefined, PATH: '/shell/bin:/usr/bin' });
  assert.equal(m.estado.puerto, 7331);
  assert.deepEqual(m.pasos, ['ventana', 'loadFile', `fork ${h.pid}`, 'loadURL http://localhost:7331/?t=f00d']);
  assert.ok(m.registro.lineas.some(l => l === '[app] entorno de la shell: shell -lc, 7 ms'), m.registro.lineas.join('\n'));
  assert.ok(m.registro.lineas.includes('[app] servidor en el puerto 7331; el último cuaderno: /cuadernos/ultimo'));
  assert.ok(m.registro.lineas.includes(`[app] servidor lanzado (pid ${h.pid})`));
});

test('sin recientes, el hijo arranca sin CUADERNO_CARPETA (pantalla de cuadernos); con tema claro o auto, fondo blanco', async () => {
  const m = montar({ config: configFalsa({ tema: 'claro' }) });
  await tic();
  assert.equal('CUADERNO_CARPETA' in m.hijos[0].opciones.env, false);
  assert.equal(m.ventanas[0].opciones.backgroundColor, '#ffffff');
  m.hijos[0].escucha(40000);
  await m.estado.listo;
  assert.ok(m.registro.lineas.includes('[app] servidor en el puerto 40000; sin cuaderno: pantalla de cuadernos'));
});

test('si el hijo muere después de arrancar, se relanza una vez con el mismo entorno y la ventana se recarga en la URL nueva (el puerto puede cambiar)', async () => {
  const m = montar();
  await tic();
  m.hijos[0].escucha(7331, 't0k');
  await m.estado.listo;
  m.hijos[0].muere(1);
  await tic();
  assert.equal(m.hijos.length, 2, 'relanzado');
  assert.deepEqual(m.hijos[1].opciones.env, m.hijos[0].opciones.env);
  assert.equal(m.estado.hijo, m.hijos[1]);
  m.hijos[1].escucha(45000, 't0k');
  await tic(); await tic();
  assert.deepEqual(m.ventanas[0].cargas.at(-1), { url: 'http://localhost:45000/?t=t0k' });
  assert.equal(m.estado.puerto, 45000);
  assert.deepEqual(m.salidas, [], 'la app sigue');
  assert.ok(m.registro.lineas.includes('[app] el servidor ha salido con código 1'));
  assert.ok(m.registro.lineas.includes('[app] se relanza el servidor con el mismo entorno'));
  assert.ok(m.registro.lineas.includes('[app] servidor relanzado en el puerto 45000: se recarga la ventana'));
});

test('si vuelve a morir en menos de un minuto: diálogo y salir con 1; pasado el minuto, se vuelve a relanzar', async () => {
  let reloj = 1_000_000;
  const m = montar({ ahora: () => reloj });
  await tic();
  m.hijos[0].escucha(7331);
  await m.estado.listo;
  m.hijos[0].muere(139); await tic();
  m.hijos[1].escucha(7332); await tic(); await tic();
  reloj += 61_000;   // más de un minuto después: la tregua ha pasado
  m.hijos[1].muere(139); await tic();
  assert.equal(m.hijos.length, 3, 'tercera vida: la muerte anterior ya es vieja');
  assert.deepEqual(m.salidas, []);
  m.hijos[2].escucha(7333); await tic(); await tic();
  reciente: {
    reloj += 10_000;
    m.hijos[2].muere(139); await tic();
    assert.equal(m.hijos.length, 3, 'no se relanza');
    assert.deepEqual(m.salidas, [1]);
    assert.equal(m.dialogos.length, 1);
    assert.equal(m.dialogos[0].message, 'El servidor del cuaderno ha fallado');
    assert.match(m.dialogos[0].detail, /se ha caído dos veces en menos de un minuto \(código 139\)/);
    assert.match(m.dialogos[0].detail, /El registro está en \/config\/registro\.log/);
    assert.ok(m.registro.lineas.some(l => l.startsWith('[app] FALLO: El servidor se ha caído dos veces')));
  }
});

test('no relanza si el hijo sale durante el cierre: before-quit marca cerrando (lo vio el spike: app.quit() mata al hijo con 0)', async () => {
  const m = montar();
  await tic();
  m.hijos[0].escucha(7331);
  await m.estado.listo;
  m.electron.app.emitir('before-quit');
  assert.equal(m.estado.cerrando, true);
  assert.ok(m.hijos[0].muerto, 'al salir, el padre mata al hijo');
  await tic(); await tic();
  m.hijos[0].muere(0); await tic();
  assert.equal(m.hijos.length, 1, 'sin relanzado');
  assert.deepEqual(m.salidas, []);
  assert.equal(m.dialogos.length, 0);
});

test('cerrar la última ventana: mata al hijo, sale, y la salida del hijo no cuenta como caída', async () => {
  const m = montar();
  await tic();
  m.hijos[0].escucha(7331);
  await m.estado.listo;
  m.electron.app.emitir('window-all-closed');
  assert.deepEqual(m.pasos.slice(-2), [`kill ${m.hijos[0].pid}`, 'quit']);
  await tic(); await tic();
  assert.equal(m.hijos.length, 1);
  assert.deepEqual(m.salidas, ['quit']);
  assert.ok(m.registro.lineas.includes('[app] el servidor ha salido con código null'));
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
  m.electron.app.emitir('before-quit');
});
