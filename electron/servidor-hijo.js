// SPIKE 2026-10-10: se reescribe en la tarea T1 con sus tests (docs/planes/electron.md §6)
'use strict';
// El servidor de la app dentro de un utilityProcess de Electron: el mismo crearServidor de la web, escuchando en
// 7331 (o en uno libre) y mandando el puerto al padre por parentPort solo cuando ya escucha (plan §2).
const path = require('node:path');
const fs = require('node:fs');
const { crearServidor } = require('../servidor');
const config = require('../config');
const { nodeDelKit } = require('./entorno');

const log = (...a) => console.error('[hijo]', ...a);
log(`execPath=${process.execPath} node=${process.versions.node} electron=${process.versions.electron || '-'} pid=${process.pid}`);
log(`PATH=${process.env.PATH}`);

let pty = null;
try {
  pty = require('node-pty');
  // Copiado de server.js: npm puede dejar el ayudante sin permiso de ejecución.
  const ayudante = path.join(__dirname, '..', 'node_modules', 'node-pty', 'prebuilds', `${process.platform}-${process.arch}`, 'spawn-helper');
  try { if (process.platform !== 'win32' && fs.existsSync(ayudante)) fs.accessSync(ayudante, fs.constants.X_OK); } catch { try { fs.chmodSync(ayudante, 0o755); } catch { /* se verá al abrir la terminal */ } }
  log('node-pty cargado');
} catch (e) { log(`node-pty no está disponible: ${e.message}`); }

const ejecutarNode = nodeDelKit(process.env);
log(`nodeDelKit: ${ejecutarNode.cmd}`);
const server = crearServidor({ pty, token: config.token(), ejecutarNode });
const carpeta = process.env.CUADERNO_SPIKE_CARPETA;
if (carpeta) { try { server.abrir(carpeta); log(`abierto ${carpeta}`); } catch (e) { log(`no se puede abrir ${carpeta}: ${e.message}`); } }

// Puerto fijo si está libre; si no, uno libre. Comprobar antes tendría carrera: se escucha y se reacciona al error.
server.on('error', e => {
  if (e.code === 'EADDRINUSE') { log('7331 ocupado: se escucha en uno libre'); server.listen(0, '127.0.0.1'); } else { log(`error del servidor: ${e.message}`); process.exit(1); }
});
server.on('listening', () => {
  const puerto = server.address().port;
  log(`escuchando en ${puerto}`);
  process.parentPort.postMessage({ puerto });
});
process.parentPort.on('message', ({ data }) => { if (data && data.orden === 'cerrar') { server.close(); process.exit(0); } });
server.listen(Number(process.env.CUADERNO_SPIKE_PUERTO || 7331), '127.0.0.1');
