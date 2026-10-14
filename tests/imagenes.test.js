'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { resolver, aUrl, enlaceDe, limpiarNombre, libre, EXTENSIONES, CARPETAS, TOPE_IMAGEN } = require('../public/imagenes');

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

test('enlaceDe: ruta relativa a la nota con solo lo que rompe un enlace codificado; los acentos se quedan', () => {
  assert.equal(enlaceDe('a/n.md', 'a/attachments/Mi captura (1).png'), 'attachments/Mi%20captura%20%281%29.png');
  assert.equal(enlaceDe('a/b/n.md', 'img/x.png'), '../../img/x.png');
  assert.equal(enlaceDe('a/n.md', 'a/b/x.png'), 'b/x.png');
  assert.equal(enlaceDe('n.md', 'x.png'), 'x.png');
  assert.equal(enlaceDe('a/n.md', 'a/Foto #1 100%?<>.png'), 'Foto%20%231%20100%25%3F%3C%3E.png');
  assert.equal(enlaceDe('a/n.md', 'a/imagenes/ñandú.png'), 'imagenes/ñandú.png');
});

test('enlaceDe es la inversa de resolver', () => {
  const rel = 'a/attachments/Foto #1 (b) 100%.png';
  assert.equal(resolver('a/n.md', enlaceDe('a/n.md', rel)), rel);
});

test('limpiarNombre: quita lo prohibido, colapsa espacios, nada que empiece por punto; vacío → imagen', () => {
  assert.equal(limpiarNombre('../a:b?.png'), 'imagen.png');
  assert.equal(limpiarNombre('Mi   captura  "1".png'), 'Mi captura 1.png');
  assert.equal(limpiarNombre('a\\b/c|d*e.png'), 'abcde.png');
  assert.equal(limpiarNombre('.png'), 'imagen.png');
  assert.equal(limpiarNombre(''), 'imagen');
});

test('libre: x.png, x-2.png, x-3.png… contra lo que ya existe', () => {
  assert.equal(libre('x.png', () => false), 'x.png');
  assert.equal(libre('x.png', n => ['x.png', 'x-2.png'].includes(n)), 'x-3.png');
  assert.equal(libre('sin-extension', n => n === 'sin-extension'), 'sin-extension-2');
});

test('constantes: extensiones, carpetas conocidas y tope de 25 MB', () => {
  assert.deepEqual(EXTENSIONES, ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif']);
  assert.deepEqual(CARPETAS, ['attachments', 'adjuntos', 'imagenes', 'images', 'assets']);
  assert.equal(TOPE_IMAGEN, 25 * 1024 * 1024);
});
