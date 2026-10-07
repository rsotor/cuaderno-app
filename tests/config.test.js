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
