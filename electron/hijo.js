'use strict';
// Lo que hace el servidor dentro del utilityProcess de la app de escritorio, como función para probarla en Node:
// el mismo crearServidor de la web, con el Node del kit inyectado (nodeDelKit) y el cuaderno que decidió el padre
// (CUADERNO_CARPETA); escucha en 7331 y, si está ocupado (una `npm start` abierta), en uno libre: comprobar antes
// tendría carrera, así que se escucha y se reacciona al EADDRINUSE. El puerto se manda al padre solo en 'listening',
// junto con el token (el padre no lee el fichero del token: lo recibe de aquí) y si node-pty cargó (para Ayuda →
// Diagnóstico: solo este proceso lo sabe). Para parar el servidor el padre mata
// el proceso (plan §2, filas «Dónde corre el servidor» y «Puerto»): no hay órdenes por parentPort.
const { nodeDelKit } = require('./entorno');

const PUERTO = 7331;

// Devuelve el servidor ya escuchando (o a punto). parentPort: process.parentPort (postMessage).
function arrancarHijo({ crearServidor, config, parentPort, registro, pty = null, env = process.env, puerto = PUERTO, salir = c => process.exit(c) }) {
  const anotar = linea => registro.escribir(`[hijo] ${linea}`);
  const ejecutarNode = nodeDelKit(env);
  anotar(`node ${process.versions.node}${process.versions.electron ? ` (electron ${process.versions.electron})` : ''}, pid ${process.pid}; el kit corre con ${ejecutarNode.cmd}`);
  const server = crearServidor({ pty, token: config.token(), ejecutarNode, shellLogin: true, enApp: true, anotar });   // siempre el token de config: CUADERNO_TOKEN (server.js) no vale en la app, a propósito; la terminal, shell de login; el 403 sin «desde la terminal»
  if (env.CUADERNO_CARPETA) {
    try { server.abrir(env.CUADERNO_CARPETA); anotar(`cuaderno abierto: ${env.CUADERNO_CARPETA}`); } catch (e) { anotar(`no se puede abrir ${env.CUADERNO_CARPETA}: ${e.message}`); }   // queda la pantalla de cuadernos
  }
  server.on('error', e => {
    if (e.code === 'EADDRINUSE') { anotar(`el puerto ${puerto} está ocupado: se escucha en uno libre`); return server.listen(0, '127.0.0.1'); }
    anotar(`error del servidor: ${e.message}`);
    salir(1);
  });
  server.on('listening', () => {
    anotar(`escuchando en el puerto ${server.address().port}`);
    parentPort.postMessage({ puerto: server.address().port, token: server.token, pty: !!pty });
  });
  server.listen(puerto, '127.0.0.1');
  return server;
}

module.exports = { arrancarHijo, PUERTO };
