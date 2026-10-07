'use strict';
// Cuaderno: abre una carpeta de notas en el navegador.
//   node server.js <carpeta-del-cuaderno> [puerto]
const path = require('node:path');
const { Cuaderno } = require('./cuaderno');
const { detectar } = require('./kit');
const { crearServidor } = require('./servidor');

const raiz = path.resolve(process.argv[2] || '.');
const puerto = Number(process.argv[3] || 7331);
const kit = detectar(raiz);
const cuaderno = new Cuaderno(raiz, kit.base);
let pty = null;
try { pty = require('node-pty'); } catch { console.error('node-pty no está disponible: la app arranca sin terminal.'); }

const server = crearServidor({ cuaderno, kit, pty });
server.listen(puerto, '127.0.0.1', () => {
  const que = { kit: 'cuaderno con kit', 'salida-sin-motor': 'cuaderno del kit sin motor (no se puede guardar desde aquí)', carpeta: 'carpeta de notas sin kit' }[kit.tipo];
  console.log(`Cuaderno · ${kit.base} · ${que}${kit.tipo === 'kit' && !kit.comando ? ' · sin comando de profesor' : ''}`);
  console.log(`Abre: ${server.url()}`);
});
