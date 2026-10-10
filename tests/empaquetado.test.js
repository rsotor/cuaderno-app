'use strict';
// La configuración de electron-builder (electron-builder.js) y lo que la rodea, sin construir nada: las invariantes
// del plan de Electron (§2 fila Empaquetado, R3, R4, R6, R11, §9 objeciones 1, 5 y 11) que, si alguien las toca sin
// querer, rompen el .dmg (firma ad hoc), el kit (fuses) o meten el repo entero en el paquete; que cada módulo que
// requieren el proceso principal y el hijo está en `files`; los scripts y la versión exacta de electron-builder; y
// que el PNG del icono es el que electron-builder espera (1024 × 1024 con transparencia).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../electron-builder');
const paquete = require('../package.json');
const { leerPng } = require('../pruebas/icono');

const RAIZ = path.join(__dirname, '..');
const files = config.files;
const incluye = patron => files.includes(patron);

test('identidad del producto: appId sin dominio real, productName Cuaderno, nada que publicar', () => {
  assert.equal(config.appId, 'es.cuaderno.app');
  assert.equal(config.productName, 'Cuaderno');
  assert.equal(config.publish, null);
  assert.equal(config.directories.output, 'dist-app');
  assert.match(fs.readFileSync(path.join(RAIZ, '.gitignore'), 'utf8'), /^dist-app\/$/m, 'dist-app/ está en .gitignore');
});

test('sin asar en la primera versión y sin recompilar node-pty (prebuilds N-API)', () => {
  assert.equal(config.asar, false);
  assert.equal(config.npmRebuild, false);
});

test('los fuses no se tocan: sin electronFuses (runAsNode para el kit, nodeCliInspect para Playwright)', () => {
  assert.equal('electronFuses' in config, false);
  assert.match(fs.readFileSync(path.join(RAIZ, 'electron-builder.js'), 'utf8'), /FUSES SIN TOCAR: runAsNode y nodeCliInspect/);
});

test('Mac: firma ad hoc (identity "-") sin hardened runtime ni notarización; un .dmg por arquitectura, arm64 y x64, sin universal', () => {
  assert.equal(config.mac.identity, '-');
  assert.equal(config.mac.hardenedRuntime, false);
  assert.equal(config.mac.notarize, false);
  assert.deepEqual(config.mac.target, [{ target: 'dmg', arch: ['arm64', 'x64'] }]);
  assert.equal(config.mac.icon, 'electron/icono/icono.png');
});

test('Windows: NSIS x64 instalado por usuario, con sus pasos, sin pedir administrador ni dónde', () => {
  assert.deepEqual(config.win.target, [{ target: 'nsis', arch: ['x64'] }]);
  assert.equal(config.nsis.oneClick, false);
  assert.equal(config.nsis.perMachine, false);
  assert.equal(config.nsis.allowToChangeInstallationDirectory, false);
  assert.equal(config.win.icon, 'electron/icono/icono.png');
});

test('files acotado: fuera tests, docs, ejemplos, pruebas, cuadernos-prueba, la CI, dist-app, server.js, el propio builder y lo de desarrollo; dentro electron/, public/ y los módulos de la raíz', () => {
  for (const fuera of ['tests', 'docs', 'ejemplos', 'pruebas', 'cuadernos-prueba', '.github', 'dist-app']) assert.ok(incluye(`!${fuera}/**`), `!${fuera}/** está en files`);
  for (const fuera of ['!server.js', '!electron-builder.js', '!*.md', '!node_modules/electron/**', '!node_modules/electron-builder/**', '!node_modules/playwright/**', '!node_modules/playwright-core/**']) assert.ok(incluye(fuera), `${fuera} está en files`);
  assert.ok(incluye('electron/**') && incluye('public/**') && incluye('package.json'));
  assert.ok(incluye('!electron/icono/**'), 'el PNG del icono es para construir el .icns y el .ico, no para la app');
  // Ningún patrón positivo abre la puerta a todo: nada de '**', '*', '*.js' o similares en la raíz.
  for (const p of files.filter(p => !p.startsWith('!'))) assert.ok(/^(electron\/\*\*|public\/\*\*|package\.json|[a-z-]+\.js)$/.test(p), `patrón demasiado ancho: ${p}`);
});

// Los require('./x') y require('../x') de un fichero, resueltos a rutas relativas a la raíz (con su .js).
function requiresLocales(fichero) {
  const texto = fs.readFileSync(path.join(RAIZ, fichero), 'utf8');
  return [...texto.matchAll(/require\('(\.\.?\/[^']+)'\)/g)].map(m => path.relative(RAIZ, path.resolve(path.dirname(path.join(RAIZ, fichero)), m[1]))).map(r => (fs.existsSync(path.join(RAIZ, r)) && !fs.statSync(path.join(RAIZ, r)).isDirectory() ? r : `${r}.js`));
}

test('cada módulo que el proceso principal y el hijo requieren (recursivamente) está en files; y ningún módulo listado sobra', () => {
  const pendientes = ['electron/main.js', 'electron/servidor-hijo.js'], vistos = new Set();
  while (pendientes.length) {
    const f = pendientes.pop();
    if (vistos.has(f)) continue;
    vistos.add(f);
    assert.ok(fs.existsSync(path.join(RAIZ, f)), `${f} no existe`);
    if (f.endsWith('.js')) pendientes.push(...requiresLocales(f));
  }
  for (const f of vistos) {
    if (f.startsWith('electron/')) continue;   // los cubre electron/**
    assert.ok(incluye(f), `${f} lo requiere la app y no está en files`);
  }
  const listados = files.filter(p => /^[a-z-]+\.js$/.test(p));
  for (const l of listados) assert.ok(vistos.has(l), `${l} está en files pero la app no lo requiere`);
  assert.ok(vistos.has('servidor.js') && vistos.has('cuaderno.js') && vistos.has('config.js'));
});

test('scripts y versión: npm run empaquetar (--dir), empaquetar:instaladores (los targets del sistema donde corre) e icono; electron-builder con versión exacta y solo en desarrollo', () => {
  assert.equal(paquete.scripts.empaquetar, 'electron-builder --dir');
  assert.equal(paquete.scripts['empaquetar:instaladores'], 'electron-builder');
  assert.equal(paquete.scripts.icono, 'node pruebas/icono.js');
  assert.match(paquete.devDependencies['electron-builder'], /^\d+\.\d+\.\d+$/, 'versión exacta, sin ^ ni ~');
  assert.equal(paquete.dependencies['electron-builder'], undefined);
  assert.equal(paquete.devDependencies.electron.replace(/^\^/, '') , paquete.devDependencies.electron, 'electron también exacta');
});

test('el PNG del icono: 1024 × 1024, 8 bits, RGBA (electron-builder hace de él el .icns y el .ico)', () => {
  assert.deepEqual(leerPng(fs.readFileSync(path.join(RAIZ, 'electron', 'icono', 'icono.png'))), { anchura: 1024, altura: 1024, profundidad: 8, tipoColor: 6 });
});
