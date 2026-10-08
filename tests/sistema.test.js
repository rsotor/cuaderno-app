'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const sistema = require('../sistema');

test('mostrar en el gestor de archivos: macOS señala con open -R, Windows con explorer /select, Linux abre la carpeta', () => {
  assert.deepEqual(sistema.comandoMostrar({ abs: '/c/a.pdf', carpeta: false, plataforma: 'darwin' }), { cmd: 'open', args: ['-R', '/c/a.pdf'] });
  assert.deepEqual(sistema.comandoMostrar({ abs: '/c/mat', carpeta: true, plataforma: 'darwin' }), { cmd: 'open', args: ['/c/mat'] });
  assert.deepEqual(sistema.comandoMostrar({ abs: 'C:\\c\\a.pdf', carpeta: false, plataforma: 'win32' }), { cmd: 'explorer', args: ['/select,C:\\c\\a.pdf'] });
  assert.deepEqual(sistema.comandoMostrar({ abs: '/c/mat/a.pdf', carpeta: false, plataforma: 'linux' }), { cmd: 'xdg-open', args: ['/c/mat'] });
  assert.deepEqual(sistema.comandoMostrar({ abs: '/c/mat', carpeta: true, plataforma: 'linux' }), { cmd: 'xdg-open', args: ['/c/mat'] });
});
