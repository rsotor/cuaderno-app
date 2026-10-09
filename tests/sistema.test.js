'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sistema = require('../sistema');

test('mostrar en el gestor de archivos: macOS señala con open -R, Windows con explorer /select, Linux abre la carpeta', () => {
  assert.deepEqual(sistema.comandoMostrar({ abs: '/c/a.pdf', carpeta: false, plataforma: 'darwin' }), { cmd: 'open', args: ['-R', '/c/a.pdf'] });
  assert.deepEqual(sistema.comandoMostrar({ abs: '/c/mat', carpeta: true, plataforma: 'darwin' }), { cmd: 'open', args: ['/c/mat'] });
  assert.deepEqual(sistema.comandoMostrar({ abs: 'C:\\c\\a.pdf', carpeta: false, plataforma: 'win32' }), { cmd: 'explorer', args: ['/select,C:\\c\\a.pdf'] });
  assert.deepEqual(sistema.comandoMostrar({ abs: '/c/mat/a.pdf', carpeta: false, plataforma: 'linux' }), { cmd: 'xdg-open', args: ['/c/mat'] });
  assert.deepEqual(sistema.comandoMostrar({ abs: '/c/mat', carpeta: true, plataforma: 'linux' }), { cmd: 'xdg-open', args: ['/c/mat'] });
});

test('abrir una dirección en el navegador: open, explorer o xdg-open, con la dirección como argumento', () => {
  const url = 'http://localhost:7331/?t=ab';
  assert.deepEqual(sistema.comandoAbrirUrl({ url, plataforma: 'darwin' }), { cmd: 'open', args: [url] });
  assert.deepEqual(sistema.comandoAbrirUrl({ url, plataforma: 'win32' }), { cmd: 'explorer', args: [url] });
  assert.deepEqual(sistema.comandoAbrirUrl({ url, plataforma: 'linux' }), { cmd: 'xdg-open', args: [url] });
  const lanzado = [];
  sistema.abrirUrl({ url, plataforma: 'darwin', lanzar: (cmd, args) => lanzado.push({ cmd, args }) });
  assert.deepEqual(lanzado, [{ cmd: 'open', args: [url] }]);
});

test('papelera: la orden de cada sistema, con la ruta como argumento', () => {
  const abs = "/c/la nota de 'Ana'.md", hay = (...n) => x => n.includes(x);
  assert.deepEqual(sistema.comandoPapelera({ abs, plataforma: 'darwin', existe: hay('trash') }), { cmd: 'trash', args: [abs] });
  const mac = sistema.comandoPapelera({ abs, plataforma: 'darwin', existe: hay() });
  assert.equal(mac.cmd, 'osascript'); assert.equal(mac.args.at(-1), abs); assert.match(mac.args.join(' '), /Finder" to delete/);
  const win = sistema.comandoPapelera({ abs, plataforma: 'win32', existe: hay() });
  assert.equal(win.cmd, 'powershell'); assert.match(win.args.at(-1), /SendToRecycleBin/); assert.deepEqual(win.env, { CUADERNO_PAPELERA: abs });
  assert.ok(!win.args.join(' ').includes(abs), 'en Windows la ruta va en una variable de entorno, no en la orden');
  assert.deepEqual(sistema.comandoPapelera({ abs, plataforma: 'linux', existe: hay('gio', 'trash-put') }), { cmd: 'gio', args: ['trash', abs] });
  assert.deepEqual(sistema.comandoPapelera({ abs, plataforma: 'linux', existe: hay('trash-put') }), { cmd: 'trash-put', args: [abs] });
  assert.equal(sistema.comandoPapelera({ abs, plataforma: 'linux', existe: hay() }), null);
});

test('aPapelera: si el fichero sigue ahí después de la orden, falla con lo que dijo la orden', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'papelera-')), abs = path.join(dir, 'a.md');
  fs.writeFileSync(abs, '# A\n');
  assert.throws(() => sistema.aPapelera({ abs, plataforma: 'linux', existe: n => n === 'gio', ejecutar: () => { throw Object.assign(new Error('x'), { stderr: 'gio: sin papelera' }); } }), /no se ha podido mandar a la papelera: gio: sin papelera/);
  assert.throws(() => sistema.aPapelera({ abs, plataforma: 'linux', existe: () => false, ejecutar: () => {} }), /gio o trash-put/);
  let visto;
  sistema.aPapelera({ abs, plataforma: 'win32', env: {}, ejecutar: (cmd, args, o) => { visto = o.env.CUADERNO_PAPELERA; fs.rmSync(abs); } });
  assert.equal(visto, abs); assert.ok(!fs.existsSync(abs));
  fs.rmSync(dir, { recursive: true, force: true });
});
