'use strict';
// El registro a fichero de la app de escritorio (electron/registro.js): escribe con hora, rota a 1 MB, lee.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { crearRegistro, TOPE } = require('../electron/registro');

const temporal = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cuaderno-registro-'));

test('escribe cada línea con su hora en registro.log (creando la carpeta) y la saca por consola', () => {
  const carpeta = path.join(temporal(), 'config');
  const consola = [];
  const r = crearRegistro({ carpeta, consola: l => consola.push(l), ahora: () => new Date('2026-10-10T10:00:00.000Z') });
  r.escribir('[app] arranca');
  r.escribir('[hijo] escuchando en el puerto 7331\n');
  assert.equal(r.ruta(), path.join(carpeta, 'registro.log'));
  assert.equal(fs.readFileSync(r.ruta(), 'utf8'), '2026-10-10T10:00:00.000Z [app] arranca\n2026-10-10T10:00:00.000Z [hijo] escuchando en el puerto 7331\n');
  assert.deepEqual(consola, ['2026-10-10T10:00:00.000Z [app] arranca', '2026-10-10T10:00:00.000Z [hijo] escuchando en el puerto 7331']);
  assert.equal(r.leer(), fs.readFileSync(r.ruta(), 'utf8'));
  fs.rmSync(path.dirname(carpeta), { recursive: true, force: true });
});

test('la carpeta puede ser una función (la de config.js se decide al escribir, no al cargar)', () => {
  const base = temporal();
  let actual = path.join(base, 'a');
  const r = crearRegistro({ carpeta: () => actual, consola: null });
  r.escribir('una');
  actual = path.join(base, 'b');
  r.escribir('dos');
  assert.match(fs.readFileSync(path.join(base, 'a', 'registro.log'), 'utf8'), /una\n$/);
  assert.match(fs.readFileSync(path.join(base, 'b', 'registro.log'), 'utf8'), /dos\n$/);
  fs.rmSync(base, { recursive: true, force: true });
});

test('al pasar del tope, lo que había pasa a registro.log.1 y leer() devuelve lo rotado y lo actual', () => {
  const carpeta = temporal();
  const r = crearRegistro({ carpeta, tope: 200, consola: null, ahora: () => new Date('2026-10-10T10:00:00.000Z') });
  const linea = 'x'.repeat(60);   // cada línea ocupa 25 (hora y espacio) + 60 + 1 = 86 bytes: la tercera rota
  r.escribir(`1 ${linea}`); r.escribir(`2 ${linea}`);
  assert.ok(!fs.existsSync(path.join(carpeta, 'registro.log.1')), 'con dos líneas no rota');
  r.escribir(`3 ${linea}`);
  const rotado = fs.readFileSync(path.join(carpeta, 'registro.log.1'), 'utf8'), actual = fs.readFileSync(path.join(carpeta, 'registro.log'), 'utf8');
  assert.equal(rotado.split('\n').filter(Boolean).length, 2);
  assert.equal(actual.split('\n').filter(Boolean).length, 1);
  assert.match(actual, /^2026-10-10T10:00:00\.000Z 3 x+\n$/);
  assert.equal(r.leer(), rotado + actual);
  // La segunda rotación sustituye el .1 anterior: nunca hay más de dos ficheros.
  r.escribir(`4 ${linea}`); r.escribir(`5 ${linea}`);
  assert.deepEqual(fs.readdirSync(carpeta).sort(), ['registro.log', 'registro.log.1']);
  assert.match(fs.readFileSync(path.join(carpeta, 'registro.log.1'), 'utf8'), /^[^\n]+ 3 x+\n[^\n]+ 4 x+\n$/);
  fs.rmSync(carpeta, { recursive: true, force: true });
});

test('rota de verdad a 1 MB con el tope por defecto', () => {
  const carpeta = temporal();
  const r = crearRegistro({ carpeta, consola: null });
  assert.equal(TOPE, 1024 * 1024);
  const grande = 'y'.repeat(1000);
  for (let i = 0; i < 1100; i++) r.escribir(grande);   // ~1,1 MB
  assert.ok(fs.existsSync(path.join(carpeta, 'registro.log.1')), 'ha rotado');
  assert.ok(fs.statSync(path.join(carpeta, 'registro.log.1')).size <= TOPE, 'lo rotado no pasa del tope');
  fs.rmSync(carpeta, { recursive: true, force: true });
});

test('con rotar: false (el hijo) nunca rota aunque pase del tope: solo el padre renombra', () => {
  const carpeta = temporal();
  const r = crearRegistro({ carpeta, tope: 100, rotar: false, consola: null });
  for (let i = 0; i < 10; i++) r.escribir('z'.repeat(50));
  assert.deepEqual(fs.readdirSync(carpeta), ['registro.log']);
  assert.ok(fs.statSync(path.join(carpeta, 'registro.log')).size > 500);
  assert.equal(r.leer().split('\n').filter(Boolean).length, 10);
  fs.rmSync(carpeta, { recursive: true, force: true });
});

test('el fichero es solo del usuario (0600, como el token: lleva rutas de cuadernos)', { skip: process.platform === 'win32' && 'en Windows los permisos los da la carpeta' }, () => {
  const carpeta = temporal();
  const r = crearRegistro({ carpeta, consola: null });
  r.escribir('una');
  assert.equal(fs.statSync(r.ruta()).mode & 0o777, 0o600);
  fs.rmSync(carpeta, { recursive: true, force: true });
});

test('sin dónde escribir no falla: la consola se queda con la línea y leer() devuelve vacío', () => {
  const consola = [];
  const r = crearRegistro({ carpeta: path.join(os.devNull, 'imposible'), consola: l => consola.push(l) });
  assert.doesNotThrow(() => r.escribir('nada'));
  assert.equal(consola.length, 1);
  assert.equal(r.leer(), '');
});

test('el registro por defecto escribe en la carpeta de configuración (CUADERNO_CONFIG_DIR)', () => {
  const carpeta = temporal();
  process.env.CUADERNO_CONFIG_DIR = carpeta;
  const registro = require('../electron/registro');
  assert.equal(registro.ruta(), path.join(carpeta, 'registro.log'));
  delete process.env.CUADERNO_CONFIG_DIR;
  fs.rmSync(carpeta, { recursive: true, force: true });
});
