'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.CUADERNO_CONFIG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cuaderno-config-'));
const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../config');

test('sin fichero: valores por defecto; lo que no vale se descarta', () => {
  assert.deepEqual(config.leer(), config.POR_DEFECTO);
  fs.writeFileSync(path.join(config.carpeta(), 'config.json'), JSON.stringify({ tema: 'morado', letra: 'grande', recientes: 'no', extra: 1 }));
  const c = config.leer();
  assert.equal(c.tema, 'auto'); assert.equal(c.letra, 'grande'); assert.deepEqual(c.recientes, []);
  fs.writeFileSync(path.join(config.carpeta(), 'config.json'), '{roto');
  assert.deepEqual(config.leer(), config.POR_DEFECTO);
});

test('panel: posición y tamaños se validan; lo que no vale vuelve al valor por defecto', () => {
  fs.writeFileSync(path.join(config.carpeta(), 'config.json'), JSON.stringify({ panel: 'izquierda', panel_ancho: 50, panel_alto: 'x' }));
  let c = config.leer();
  assert.equal(c.panel, 'derecha'); assert.equal(c.panel_ancho, 420); assert.equal(c.panel_alto, 320);
  c = config.ajustar({ panel: 'abajo', panel_ancho: 500 });
  assert.equal(c.panel, 'abajo'); assert.equal(c.panel_ancho, 500); assert.equal(c.panel_alto, 320);
  c = config.ajustar({ panel_ancho: 99999, panel_alto: 180.7 });
  assert.equal(c.panel_ancho, 500, 'fuera de rango: se ignora'); assert.equal(c.panel_alto, 320, 'no entero: se ignora');
  assert.deepEqual(Object.keys(config.apariencia(c)).sort(), ['comando_agente', 'editor', 'fuente', 'letra', 'panel', 'panel_alto', 'panel_ancho', 'tema']);
});

test('editor: «con vista» o «plano»; lo que no vale vuelve a «con vista»', () => {
  assert.equal(config.leer().editor, 'vista');
  assert.equal(config.ajustar({ editor: 'plano' }).editor, 'plano');
  assert.equal(config.ajustar({ editor: 'otro' }).editor, 'plano', 'un valor raro se ignora');
  fs.writeFileSync(path.join(config.carpeta(), 'config.json'), JSON.stringify({ editor: 'raro' }));
  assert.equal(config.leer().editor, 'vista');
});

test('el código de la URL: se crea una vez, solo lo lee el usuario y se reutiliza en cada arranque', () => {
  const t = config.token();
  assert.match(t, /^[0-9a-f]{32}$/);
  assert.equal(config.token(), t, 'el segundo arranque cambia el código');
  if (process.platform !== 'win32') assert.equal(fs.statSync(path.join(config.carpeta(), 'token')).mode & 0o777, 0o600, 'el fichero del código lo pueden leer otros usuarios');
  fs.writeFileSync(path.join(config.carpeta(), 'token'), 'roto');
  assert.match(config.token(), /^[0-9a-f]{32}$/, 'un fichero roto no se usa como código');
});

test('ocultar: por cuaderno, sin repetir, y se recupera; otro cuaderno no se entera', () => {
  assert.deepEqual(config.ocultar('/c/a', 'plan', true), ['plan']);
  assert.deepEqual(config.ocultar('/c/a', 'notas/borrador.md', true), ['notas/borrador.md', 'plan']);
  assert.deepEqual(config.ocultar('/c/a', 'plan', true), ['notas/borrador.md', 'plan'], 'ocultar dos veces repite');
  assert.deepEqual(config.ocultas('/c/b'), []);
  assert.deepEqual(config.ocultar('/c/a', 'plan', false), ['notas/borrador.md']);
  assert.deepEqual(config.ocultar('/c/a', 'notas/borrador.md', false), []);
  assert.deepEqual(config.leer().ocultas, {}, 'un cuaderno sin ocultas deja su clave');
});

test('ajustar solo toca la apariencia y el comando; recientes van del más nuevo al más viejo, sin repetir', () => {
  const c = config.ajustar({ tema: 'oscuro', fuente: 'serif', letra: 'enorme', comando_agente: '  claude ', recientes: ['x'] });
  assert.equal(c.tema, 'oscuro'); assert.equal(c.fuente, 'serif'); assert.equal(c.letra, 'media'); assert.equal(c.comando_agente, 'claude'); assert.deepEqual(c.recientes, []);
  config.registrarReciente('/a', 'A'); config.registrarReciente('/b', 'B'); config.registrarReciente('/a', 'A');
  assert.deepEqual(config.leer().recientes.map(r => r.ruta), ['/a', '/b']);
  config.olvidarReciente('/b');
  assert.deepEqual(config.leer().recientes.map(r => r.ruta), ['/a']);
  assert.equal(config.leer().tema, 'oscuro');
  fs.rmSync(process.env.CUADERNO_CONFIG_DIR, { recursive: true, force: true });
});

test('cuadernoAlArrancar: la carpeta pasada manda; si no, el reciente más nuevo que exista; -e o nada, pantalla de cuadernos', () => {
  const recientes = [{ ruta: '/a', abierto: '2026-01-01' }, { ruta: '/b', abierto: '2026-03-01' }, { ruta: '/c', abierto: '2026-02-01' }];
  const todas = () => true, sinB = r => r !== '/b';
  assert.deepEqual(config.cuadernoAlArrancar('/x', recientes, todas), { carpeta: '/x', origen: 'argumento' });
  assert.deepEqual(config.cuadernoAlArrancar(null, recientes, todas), { carpeta: '/b', origen: 'reciente' });
  assert.deepEqual(config.cuadernoAlArrancar(null, recientes, sinB), { carpeta: '/c', origen: 'reciente' });
  assert.deepEqual(config.cuadernoAlArrancar(null, recientes, () => { throw new Error('x'); }), { carpeta: null, origen: null });
  assert.deepEqual(config.cuadernoAlArrancar(null, [], todas), { carpeta: null, origen: null });
  assert.deepEqual(config.cuadernoAlArrancar(null, recientes, todas, true), { carpeta: null, origen: null });
  assert.deepEqual(config.cuadernoAlArrancar('/x', recientes, todas, true), { carpeta: '/x', origen: 'argumento' });
});

test('ventana (la de la app de escritorio): se guarda con guardarVentana y se lee; lo que no es {x, y, width, height} entero, o es más pequeño que 760 × 480, vuelve a null; ajustar no la toca', () => {
  assert.equal(config.leer().ventana, null);
  assert.deepEqual(config.VENTANA_MINIMA, { width: 760, height: 480 });
  const c = config.guardarVentana({ x: 40, y: 60, width: 1456, height: 900, extra: 'fuera' });
  assert.deepEqual(c.ventana, { x: 40, y: 60, width: 1456, height: 900 });
  assert.deepEqual(config.leer().ventana, { x: 40, y: 60, width: 1456, height: 900 });
  assert.deepEqual(config.ajustar({ tema: 'claro', ventana: { x: 0, y: 0, width: 800, height: 600 } }).ventana, { x: 40, y: 60, width: 1456, height: 900 }, 'el navegador no cambia la ventana');
  for (const mala of [null, 'grande', [1, 2, 3, 4], { x: 0, y: 0 }, { x: 0.5, y: 0, width: 800, height: 600 }, { x: 0, y: 0, width: 759, height: 600 }, { x: 0, y: 0, width: 800, height: 479 }, { x: -10, y: 0, width: '800', height: 600 }]) {
    assert.deepEqual(config.guardarVentana(mala).ventana, { x: 40, y: 60, width: 1456, height: 900 }, `no se guarda ${JSON.stringify(mala)}`);
  }
  assert.deepEqual(config.guardarVentana({ x: -10, y: 0, width: 760, height: 480 }).ventana, { x: -10, y: 0, width: 760, height: 480 }, 'x negativa vale (segunda pantalla a la izquierda); el mínimo justo vale');
  fs.writeFileSync(path.join(config.carpeta(), 'config.json'), JSON.stringify({ ventana: { x: 0, y: 0, width: 100, height: 100 } }));
  assert.equal(config.leer().ventana, null, 'lo que hay escrito y no vale se lee como null');
  fs.rmSync(process.env.CUADERNO_CONFIG_DIR, { recursive: true, force: true });
});
