'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const terminal = require('../terminal');

const nunca = () => false, siempre = () => true;

test('macOS: la terminal que arrancó la app (TERM_PROGRAM) o Terminal; el comando va en un .command', () => {
  assert.deepEqual(terminal.elegir({ plataforma: 'darwin', env: { TERM_PROGRAM: 'ghostty' } }), { nombre: 'Ghostty', tipo: 'mac' });
  assert.deepEqual(terminal.elegir({ plataforma: 'darwin', env: { TERM_PROGRAM: 'iTerm.app' } }), { nombre: 'iTerm', tipo: 'mac' });
  assert.deepEqual(terminal.elegir({ plataforma: 'darwin', env: {} }), { nombre: 'Terminal', tipo: 'mac' });
  assert.deepEqual(terminal.elegir({ plataforma: 'darwin', env: { TERM_PROGRAM: 'vscode' } }), { nombre: 'Terminal', tipo: 'mac' }, 'VS Code no es una terminal: Terminal.app');
  // Sin comando: la app abre la carpeta y la terminal pone su shell. Con comando: el .command que lo lanza.
  const e = terminal.elegir({ plataforma: 'darwin', env: { TERM_PROGRAM: 'ghostty' } });
  assert.deepEqual(terminal.comandoDe(e, { carpeta: '/c/curso' }), { cmd: 'open', args: ['-a', 'Ghostty', '/c/curso'], cwd: '/c/curso' });
  assert.deepEqual(terminal.comandoDe(e, { carpeta: '/c/curso', comando: ['claude'], script: '/tmp/x/claude.command' }), { cmd: 'open', args: ['-a', 'Ghostty', '/tmp/x/claude.command'], cwd: '/c/curso' });
  const s = terminal.scriptMac("/c/mi curso/d'o", ['claude', '--model', 'sonnet']);
  assert.match(s, /^#!\/bin\/sh\n/); assert.match(s, /cd '\/c\/mi curso\/d'\\''o' \|\| exit 1/); assert.match(s, /exec 'claude' '--model' 'sonnet'\n$/);
  assert.match(terminal.scriptMac('/c', null), /exec "\$\{SHELL:-\/bin\/zsh\}" -l/);
});

test('Windows: Windows Terminal si está, si no la consola; el comando se queda abierto (/k)', () => {
  const wt = terminal.elegir({ plataforma: 'win32', env: {}, existe: n => n === 'wt' });
  assert.equal(wt.nombre, 'Windows Terminal');
  assert.deepEqual(terminal.comandoDe(wt, { carpeta: 'C:\\curso', comando: ['claude'] }), { cmd: 'wt', args: ['-d', 'C:\\curso', 'cmd', '/k', 'claude'], cwd: 'C:\\curso' });
  assert.deepEqual(terminal.comandoDe(wt, { carpeta: 'C:\\curso' }).args, ['-d', 'C:\\curso']);
  const cmd = terminal.elegir({ plataforma: 'win32', env: {}, existe: nunca });
  assert.equal(cmd.nombre, 'la consola');
  assert.deepEqual(terminal.comandoDe(cmd, { carpeta: 'C:\\curso', comando: ['claude'] }).args, ['/c', 'start', '', '/d', 'C:\\curso', 'cmd', '/k', 'claude']);
});

test('Linux: xdg-terminal-exec, $TERMINAL, x-terminal-emulator o la primera conocida; sin ninguna, un error que dice cuáles busca', () => {
  const xdg = terminal.elegir({ plataforma: 'linux', env: {}, existe: siempre });
  assert.equal(xdg.nombre, 'xdg-terminal-exec');
  assert.deepEqual(terminal.comandoDe(xdg, { carpeta: '/c', comando: ['claude'] }), { cmd: 'xdg-terminal-exec', args: ['claude'], cwd: '/c' });
  const propia = terminal.elegir({ plataforma: 'linux', env: { TERMINAL: 'foot' }, existe: n => n === 'foot' });
  assert.deepEqual(terminal.comandoDe(propia, { carpeta: '/c', comando: ['claude', '-x'] }).args, ['-e', 'claude', '-x']);
  const gnome = terminal.elegir({ plataforma: 'linux', env: {}, existe: n => n === 'gnome-terminal' });
  assert.deepEqual(terminal.comandoDe(gnome, { carpeta: '/c', comando: ['claude'] }).args, ['--working-directory=/c', '--', 'claude']);
  assert.deepEqual(terminal.comandoDe(gnome, { carpeta: '/c' }).args, ['--working-directory=/c']);
  assert.equal(terminal.elegir({ plataforma: 'linux', env: {}, existe: nunca }), null);
  assert.throws(() => terminal.abrir({ carpeta: '/c', plataforma: 'linux', env: {}, existe: nunca, lanzar: () => {} }), /ninguna terminal.*gnome-terminal/);
});

test('abrir: lanza el proceso con la carpeta como cwd y devuelve el nombre; en macOS escribe el .command ejecutable', () => {
  const llamadas = [];
  const lanzar = (cmd, args, o) => llamadas.push({ cmd, args, cwd: o.cwd });
  assert.equal(terminal.abrir({ carpeta: '/c', plataforma: 'win32', env: {}, existe: n => n === 'wt', lanzar }), 'Windows Terminal');
  assert.deepEqual(llamadas[0], { cmd: 'wt', args: ['-d', '/c'], cwd: '/c' });
  assert.equal(terminal.abrir({ carpeta: '/c', comando: '  claude  --model sonnet ', plataforma: 'darwin', env: { TERM_PROGRAM: 'ghostty' }, lanzar }), 'Ghostty');
  const [, , script] = llamadas[1].args;
  assert.match(script, /claude\.command$/);
  assert.match(fs.readFileSync(script, 'utf8'), /exec 'claude' '--model' 'sonnet'/);
  assert.ok(fs.statSync(script).mode & 0o100, 'el .command no es ejecutable');
  fs.rmSync(require('node:path').dirname(script), { recursive: true, force: true });
});
