'use strict';
// Cuaderno: abre una carpeta de notas en el navegador.
//   node server.js [carpeta-del-cuaderno] [puerto] [-n]
// Sin carpeta, arranca en la pantalla de cuadernos (los recientes y "abrir carpeta"). Abre una pestaña del navegador
// ya dentro de la app; con -n (--no-abrir), no.
const path = require('node:path');
const fs = require('node:fs');
const { crearServidor } = require('./servidor');
const sistema = require('./sistema');

const noAbrir = process.argv.slice(2).some(a => a === '-n' || a === '--no-abrir');
const argumentos = process.argv.slice(2).filter(a => !a.startsWith('-'));
const carpeta = argumentos[0] && !/^\d+$/.test(argumentos[0]) ? path.resolve(argumentos[0]) : null;
const puerto = Number(argumentos[1] || (/^\d+$/.test(argumentos[0] || '') ? argumentos[0] : 7331));
let pty = null;
try {
  pty = require('node-pty');
  // npm instala node-pty sin ejecutar su script cuando los tiene bloqueados y su ayudante queda sin permiso de ejecución:
  // la terminal fallaba con «posix_spawnp failed» (2026-10-08). Se repara aquí, que es donde se nota.
  const ayudante = path.join(__dirname, 'node_modules', 'node-pty', 'prebuilds', `${process.platform}-${process.arch}`, 'spawn-helper');
  try { if (process.platform !== 'win32' && fs.existsSync(ayudante)) fs.accessSync(ayudante, fs.constants.X_OK); } catch { try { fs.chmodSync(ayudante, 0o755); } catch { /* se verá al abrir la terminal */ } }
} catch { console.error('node-pty no está disponible: la app arranca sin terminal.'); }

// El código de la URL es el del usuario (config.token(): fijo entre arranques); CUADERNO_TOKEN lo cambia si se fija.
const config = require('./config');
const server = crearServidor({ pty, token: process.env.CUADERNO_TOKEN || config.token() });
if (carpeta) {
  try { server.abrir(carpeta); } catch (e) { console.error(`No se puede abrir ${carpeta}: ${e.message}`); process.exit(2); }
}
server.listen(puerto, '127.0.0.1', () => {
  const { cuaderno, kit } = server.estado;
  if (cuaderno) {
    const que = { kit: 'cuaderno con kit', 'salida-sin-motor': 'cuaderno del kit sin motor (no se puede guardar desde aquí)', carpeta: 'carpeta de notas sin kit' }[kit.tipo];
    console.log(`Cuaderno · ${kit.base} · ${que}${kit.tipo === 'kit' && !kit.comando ? ' · sin comando de profesor' : ''}`);
  } else console.log('Cuaderno · sin carpeta: elige uno en la pantalla de cuadernos');
  console.log(`Abre: ${server.url()}`);
  // La pestaña entra con el código y vuelve a la dirección de arriba; con -n, el código se imprime para la primera vez.
  if (noAbrir) console.log(`Primera vez en este navegador: ${server.urlEntrada()}`);
  else sistema.abrirUrl({ url: server.urlEntrada() });
});
