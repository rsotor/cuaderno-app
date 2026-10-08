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
  assert.deepEqual(Object.keys(config.apariencia(c)).sort(), ['comando_agente', 'fuente', 'letra', 'panel', 'panel_alto', 'panel_ancho', 'tema']);
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
