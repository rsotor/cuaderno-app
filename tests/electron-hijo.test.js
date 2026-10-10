'use strict';
// El servidor dentro del utilityProcess (electron/hijo.js) con un parentPort falso: manda { puerto, token, pty } solo al
// escuchar (pty: si node-pty cargó, para el Diagnóstico de T5); con el puerto ocupado, escucha en otro; abre el cuaderno del padre.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.CUADERNO_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cuaderno-config-'));
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { EventEmitter } = require('node:events');
const config = require('../config');
const { crearServidor } = require('../servidor');
const { arrancarHijo, PUERTO } = require('./../electron/hijo');
const { crearCuaderno } = require('./ayuda');

const cerrar = s => new Promise(r => s.close(r));
function padreFalso() {
  const puerto = new EventEmitter();
  puerto.mensajes = [];
  puerto.postMessage = m => { puerto.mensajes.push(m); puerto.emit('mensaje', m); };
  puerto.primerMensaje = () => new Promise(r => (puerto.mensajes.length ? r(puerto.mensajes[0]) : puerto.once('mensaje', r)));
  return puerto;
}
const registroFalso = () => { const lineas = []; return { lineas, escribir: l => lineas.push(l) }; };
test.after(() => fs.rmSync(process.env.CUADERNO_CONFIG_DIR, { recursive: true, force: true }));

test('escucha en el puerto pedido y manda { puerto, token } al padre al escuchar; el token es el de config', async () => {
  const parentPort = padreFalso(), registro = registroFalso();
  const server = arrancarHijo({ crearServidor, config, parentPort, registro, env: { PATH: process.env.PATH }, puerto: 0 });
  const m = await parentPort.primerMensaje();
  assert.equal(m.puerto, server.address().port);
  assert.equal(m.token, config.token());
  assert.equal(m.pty, false, 'sin node-pty, el padre lo sabe (Diagnóstico)');
  assert.ok(registro.lineas.some(l => /^\[hijo\] escuchando en el puerto \d+$/.test(l)), registro.lineas.join('\n'));
  assert.ok(registro.lineas.some(l => /^\[hijo\] node \d+/.test(l) && l.includes(`el kit corre con ${process.execPath}`)));
  await cerrar(server);
});

test('con el puerto ocupado (EADDRINUSE) escucha en uno libre y lo anota; el puerto por defecto es 7331', async () => {
  assert.equal(PUERTO, 7331);
  const ocupante = net.createServer();
  await new Promise(r => ocupante.listen(0, '127.0.0.1', r));
  const ocupado = ocupante.address().port;
  const parentPort = padreFalso(), registro = registroFalso();
  const server = arrancarHijo({ crearServidor, config, parentPort, registro, env: {}, puerto: ocupado });
  const m = await parentPort.primerMensaje();
  assert.notEqual(m.puerto, ocupado);
  assert.equal(m.puerto, server.address().port);
  assert.equal(parentPort.mensajes.length, 1, 'un solo mensaje: el puerto solo se manda al escuchar');
  assert.ok(registro.lineas.includes(`[hijo] el puerto ${ocupado} está ocupado: se escucha en uno libre`));
  await cerrar(server); await cerrar(ocupante);
});

test('abre el cuaderno que decidió el padre (CUADERNO_CARPETA) antes de escuchar; si no se puede, lo anota y arranca sin él', async () => {
  const c = crearCuaderno({ kit: false });
  const parentPort = padreFalso(), registro = registroFalso();
  const server = arrancarHijo({ crearServidor, config, parentPort, registro, env: { CUADERNO_CARPETA: c.raiz }, puerto: 0 });
  await parentPort.primerMensaje();
  assert.equal(server.estado.cuaderno.raiz, c.raiz);
  assert.equal(registro.lineas.indexOf(`[hijo] cuaderno abierto: ${c.raiz}`) < registro.lineas.findIndex(l => /escuchando/.test(l)), true, 'abre antes de escuchar');
  await cerrar(server); c.borrar();
  const noExiste = path.join(os.tmpdir(), 'cuaderno-que-no-existe');
  const parentPort2 = padreFalso(), registro2 = registroFalso();
  const server2 = arrancarHijo({ crearServidor, config, parentPort: parentPort2, registro: registro2, env: { CUADERNO_CARPETA: noExiste }, puerto: 0 });
  await parentPort2.primerMensaje();
  assert.equal(server2.estado.cuaderno, null);
  assert.ok(registro2.lineas.includes(`[hijo] no se puede abrir ${noExiste}: esa carpeta no existe`));
  await cerrar(server2);
});

test('el Node del kit que recibe crearServidor es el de CUADERNO_NODE con ELECTRON_RUN_AS_NODE, y la pty la que se le da', async () => {
  const recibido = [];
  const crearFalso = o => { recibido.push(o); const s = new EventEmitter(); s.listen = () => setImmediate(() => s.emit('listening')); s.address = () => ({ port: 4321 }); s.token = o.token; return s; };
  const parentPort = padreFalso();
  const pty = { spawn() {} };
  arrancarHijo({ crearServidor: crearFalso, config, parentPort, registro: registroFalso(), pty, env: { CUADERNO_NODE: '/apps/Cuaderno' }, puerto: 7331 });
  const m = await parentPort.primerMensaje();
  assert.deepEqual(m, { puerto: 4321, token: config.token(), pty: true });
  assert.deepEqual(recibido[0].ejecutarNode, { cmd: '/apps/Cuaderno', env: { ELECTRON_RUN_AS_NODE: '1' } });
  assert.equal(recibido[0].pty, pty);
  assert.equal(recibido[0].shellLogin, true, 'la terminal de la app lanza la shell de login');
  assert.equal(recibido[0].enApp, true, 'el 403 no manda a la terminal');
});

test('en la app nadie abre el navegador: ningún módulo de electron/ carga server.js ni llama a sistema.abrirUrl (el hijo usa crearServidor directamente)', () => {
  const dir = path.join(__dirname, '..', 'electron');
  for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.js'))) {
    const texto = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.doesNotMatch(texto, /require\(['"][./]*\/server['"]\)|require\(['"]\.\.\/server['"]\)/, `${f} carga server.js`);
    assert.doesNotMatch(texto, /abrirUrl/, `${f} llama a sistema.abrirUrl`);
  }
});

test('otro error al escuchar (no EADDRINUSE) se anota y sale con 1; el hijo no atiende órdenes del padre (lo para con kill)', async () => {
  const parentPort = padreFalso(), registro = registroFalso(), salidas = [];
  const server = arrancarHijo({ crearServidor, config, parentPort, registro, env: {}, puerto: 0, salir: c => salidas.push(c) });
  await parentPort.primerMensaje();
  assert.equal(parentPort.listenerCount('message'), 0, 'sin oyentes de mensajes del padre');
  server.emit('error', Object.assign(new Error('permiso denegado'), { code: 'EACCES' }));
  assert.deepEqual(salidas, [1]);
  assert.ok(registro.lineas.includes('[hijo] error del servidor: permiso denegado'));
  await cerrar(server);
});
