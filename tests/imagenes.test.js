'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { resolver, aUrl } = require('../public/imagenes');

test('resolver: decodifica una vez la ruta del enlace y la normaliza desde la carpeta de la nota', () => {
  assert.equal(resolver('ini/nota.md', 'attachments/Mi%20captura.png'), 'ini/attachments/Mi captura.png');
  assert.equal(resolver('ini/nota.md', '../img/a.png'), 'img/a.png');
  assert.equal(resolver('ini/nota.md', './a.png'), 'ini/a.png');
  assert.equal(resolver('ini/nota.md', 'Foto%20%231.png'), 'ini/Foto #1.png');
  assert.equal(resolver('nota.md', 'a.png'), 'a.png');
});

test('resolver: un % suelto se deja tal cual y no rompe', () => {
  assert.equal(resolver('ini/nota.md', '100%.png'), 'ini/100%.png');
});

test('resolver: una URL o una ruta absoluta no es del cuaderno (null)', () => {
  assert.equal(resolver('ini/nota.md', 'https://x/a.png'), null);
  assert.equal(resolver('ini/nota.md', '/a.png'), null);
  assert.equal(resolver('ini/nota.md', 'data:image/png;base64,AAAA'), null);
});

test('aUrl: /fichero/ con cada tramo codificado', () => {
  assert.equal(aUrl('ini/Foto #1.png'), '/fichero/ini/Foto%20%231.png');
  assert.equal(aUrl('ini/attachments/Mi captura.png'), '/fichero/ini/attachments/Mi%20captura.png');
});
