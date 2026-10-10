'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { guardar, traer, deshacer, proponerMensaje, cambios } = require('../guardar');
const { otroNode, herramientasChivatas } = require('./ayuda');

const git = (cwd, ...args) => { const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }); assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };
function repo() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cuaderno-repo-'));
  git(d, 'init', '-q', '-b', 'main'); git(d, 'config', 'user.name', 'Prueba'); git(d, 'config', 'user.email', 'prueba@example.com');
  fs.writeFileSync(path.join(d, 'inicio.md'), '# Hola\n'); git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'base');
  return d;
}
const CARPETA = { tipo: 'carpeta' }, SIN_MOTOR = { tipo: 'salida-sin-motor' }, KIT = { tipo: 'kit' };

test('sin kit: el mensaje propuesto sale de los ficheros cambiados', () => {
  const d = repo();
  assert.equal(proponerMensaje(d), '');
  fs.writeFileSync(path.join(d, 'inicio.md'), '# Hola\n\nmás\n'); fs.writeFileSync(path.join(d, 'nota.md'), 'x');
  assert.deepEqual(cambios(d).sort(), ['inicio.md', 'nota.md']);
  assert.equal(proponerMensaje(d), 'Cambios en inicio, nota');
  for (const n of ['a', 'b', 'c']) fs.writeFileSync(path.join(d, `${n}.md`), 'x');
  assert.equal(proponerMensaje(d), 'Cambios en inicio, a, b y 2 más');   // git lista primero lo modificado y luego lo nuevo
  fs.rmSync(d, { recursive: true, force: true });
});

test('sin kit: guardar hace commit; sin remoto lo dice; sin cambios no hace nada', () => {
  const d = repo();
  assert.equal(guardar(d, CARPETA, '').codigo, 1);
  assert.equal(guardar(d, CARPETA, 'nada').salida, 'No había nada nuevo que guardar.');
  fs.writeFileSync(path.join(d, 'nota.md'), 'x');
  const r = guardar(d, CARPETA, 'Mi guardado');
  assert.equal(r.codigo, 0); assert.match(r.salida, /Guardado en local.*no tiene remoto/);
  assert.equal(git(d, 'log', '-1', '--format=%s'), 'Mi guardado');
  assert.equal(git(d, 'status', '--porcelain'), '');
  fs.rmSync(d, { recursive: true, force: true });
});

test('sin kit: con remoto, guardar sube y traer baja; traer con cambios locales se niega', () => {
  const remoto = fs.mkdtempSync(path.join(os.tmpdir(), 'cuaderno-remoto-')); git(remoto, 'init', '-q', '--bare', '-b', 'main');
  const a = repo(); git(a, 'remote', 'add', 'origin', remoto); git(a, 'push', '-q', '-u', 'origin', 'main');
  fs.writeFileSync(path.join(a, 'nota.md'), 'x');
  assert.equal(guardar(a, CARPETA, 'Desde A').salida, 'Guardado y subido.');
  const b = fs.mkdtempSync(path.join(os.tmpdir(), 'cuaderno-b-')); git(b, 'clone', '-q', remoto, 'clon'); const bc = path.join(b, 'clon');
  git(bc, 'config', 'user.name', 'Prueba'); git(bc, 'config', 'user.email', 'prueba@example.com');
  fs.writeFileSync(path.join(a, 'otra.md'), 'y'); guardar(a, CARPETA, 'Otra desde A');
  fs.writeFileSync(path.join(bc, 'local.md'), 'z');
  assert.match(traer(bc, CARPETA).salida, /guarda primero/);
  guardar(bc, CARPETA, 'Local en B');
  const t = traer(bc, CARPETA);
  assert.equal(t.codigo, 1, 'divergen: no se puede hacer ff');
  git(bc, 'reset', '-q', '--hard', 'origin/main');
  assert.equal(traer(bc, CARPETA).salida, 'Traído lo último.');
  assert.ok(fs.existsSync(path.join(bc, 'otra.md')));
  for (const d of [remoto, a, b]) fs.rmSync(d, { recursive: true, force: true });
});

test('sin kit: deshacer enseña primero y revierte después; con cambios sin guardar se niega', () => {
  const d = repo();
  fs.writeFileSync(path.join(d, 'nota.md'), 'x'); guardar(d, CARPETA, 'Añade nota');
  fs.writeFileSync(path.join(d, 'sucio.md'), 'x');
  assert.match(deshacer(d, CARPETA).salida, /Guárdalos primero/);
  fs.unlinkSync(path.join(d, 'sucio.md'));
  const ver = deshacer(d, CARPETA, { ver: true });
  assert.equal(ver.codigo, 0); assert.equal(ver.salida, 'Esto deshace: Añade nota\nVolverían a como estaban:\n- nota.md (nuevo)');
  assert.ok(fs.existsSync(path.join(d, 'nota.md')));
  const r = deshacer(d, CARPETA, { ver: false });
  assert.equal(r.codigo, 0); assert.match(r.salida, /^Deshecho: Añade nota/);
  assert.ok(!fs.existsSync(path.join(d, 'nota.md')));
  assert.equal(git(d, 'status', '--porcelain'), '');
  fs.rmSync(d, { recursive: true, force: true });
});

test('salida del kit sin motor: nada se puede hacer, y se dice', () => {
  // El único test del curso del kit sin motor (plan del cuaderno de ejemplo, T5): nunca git directo sobre un curso del
  // kit, porque se saltaría lo que comprueba su guardar.js (remoto privado, no el repo del kit, secretos).
  const d = repo();
  fs.appendFileSync(path.join(d, 'inicio.md'), 'Un cambio sin guardar\n');
  const commits = () => git(d, 'rev-list', '--count', 'HEAD');
  const antes = commits();
  for (const r of [guardar(d, SIN_MOTOR, 'x'), traer(d, SIN_MOTOR), deshacer(d, SIN_MOTOR)]) { assert.equal(r.codigo, 1); assert.match(r.salida, /sin motor/); }
  assert.equal(commits(), antes, 'sin motor se ha hecho un commit o se ha revertido algo');
  assert.match(fs.readFileSync(path.join(d, 'inicio.md'), 'utf8'), /Un cambio sin guardar/, 'sin motor se ha tocado el cambio sin guardar');
  fs.rmSync(d, { recursive: true, force: true });
});

test('con kit: se lanzan sus herramientas con los argumentos justos y se devuelve lo que dicen', () => {
  const d = repo();
  fs.mkdirSync(path.join(d, '.kit', 'herramientas'), { recursive: true });
  const falsa = `process.stdout.write(require('path').basename(__filename) + ' ' + JSON.stringify(process.argv.slice(2))); process.exit(process.argv.includes('--traer') ? 1 : 0);`;
  fs.writeFileSync(path.join(d, '.kit', 'herramientas', 'guardar.js'), falsa);
  fs.writeFileSync(path.join(d, '.kit', 'herramientas', 'deshacer.js'), falsa);
  assert.deepEqual(guardar(d, KIT, 'Mi mensaje'), { codigo: 0, salida: 'guardar.js ["Mi mensaje"]' });
  assert.deepEqual(traer(d, KIT), { codigo: 1, salida: 'guardar.js ["--traer"]' });
  assert.deepEqual(deshacer(d, KIT, { ver: true }), { codigo: 0, salida: 'deshacer.js ["--ver"]' });
  assert.deepEqual(deshacer(d, KIT, { ver: false }), { codigo: 0, salida: 'deshacer.js []' });
  fs.rmSync(d, { recursive: true, force: true });
});

// Con qué Node y con qué entorno corren las herramientas del kit (plan de Electron, T3): por defecto, los de este proceso;
// la app de escritorio inyecta ejecutarNode = { cmd, env }. Las herramientas falsas chivan lo que reciben.
const lanzado = r => { assert.equal(r.codigo, 0, r.salida); return JSON.parse(r.salida); };

test('con kit: sin ejecutarNode, la herramienta corre con el Node de este proceso y el entorno de siempre, que ya no se congela al cargar', () => {
  const d = repo(); herramientasChivatas(d, ['guardar.js']);
  const pathAntes = process.env.PATH;
  try {
    const l = lanzado(guardar(d, KIT, 'Mi mensaje'));
    assert.equal(l.execPath, process.execPath);
    assert.equal(l.GIT_TERMINAL_PROMPT, '0'); assert.equal(l.LC_ALL, 'C.UTF-8'); assert.equal(l.RUN_AS_NODE, undefined);
    // guardar.js ya está cargado (el require de arriba): lo que cambie en process.env después tiene que llegar a la
    // herramienta. La app de escritorio recibe el PATH de la shell de login más tarde que la carga del módulo.
    const anadido = path.join(d, 'bin-de-prueba');
    process.env.PATH = `${pathAntes}${path.delimiter}${anadido}`;
    assert.ok(lanzado(traer(d, KIT)).PATH.endsWith(path.delimiter + anadido), 'la herramienta no ve el PATH cambiado después de cargar guardar.js');
  } finally { process.env.PATH = pathAntes; fs.rmSync(d, { recursive: true, force: true }); }
});

test('con kit: con ejecutarNode = { cmd, env }, las herramientas corren con ese Node y con su entorno sumado al de siempre', () => {
  const d = repo(); herramientasChivatas(d, ['guardar.js', 'deshacer.js']);
  const ejecutarNode = { cmd: otroNode(), env: { ELECTRON_RUN_AS_NODE: '1' } };
  try {
    const lanzadas = [guardar(d, KIT, 'Mi mensaje', { ejecutarNode }), traer(d, KIT, { ejecutarNode }), deshacer(d, KIT, { ver: true, ejecutarNode }), deshacer(d, KIT, { ver: false, ejecutarNode })].map(lanzado);
    assert.deepEqual(lanzadas.map(l => l.args), [['Mi mensaje'], ['--traer'], ['--ver'], []]);
    for (const l of lanzadas) {
      assert.equal(path.basename(l.execPath), path.basename(ejecutarNode.cmd)); assert.notEqual(l.execPath, process.execPath);
      assert.equal(l.RUN_AS_NODE, '1');   // lo que trae ejecutarNode.env
      assert.equal(l.GIT_TERMINAL_PROMPT, '0'); assert.equal(l.LC_ALL, 'C.UTF-8'); assert.equal(l.PATH, process.env.PATH);   // y lo de siempre sigue
    }
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

// Con un curso de verdad (motor del kit incluido) en CUADERNO_KIT_PRUEBA: guardar de verdad con guardar.js.
const kitReal = process.env.CUADERNO_KIT_PRUEBA;
test('guardar y deshacer con el kit de verdad', { skip: !kitReal && 'sin CUADERNO_KIT_PRUEBA' }, () => {
  fs.appendFileSync(path.join(kitReal, 'estudio', 'tareas.md'), `- [ ] Prueba ${Date.now()}\n`);
  const g = guardar(kitReal, KIT, 'Prueba desde la app');
  assert.equal(g.codigo, 0, g.salida); assert.match(g.salida, /Guardado/);
  const v = deshacer(kitReal, KIT, { ver: true });
  assert.equal(v.codigo, 0, v.salida); assert.match(v.salida, /Esto deshace: Prueba desde la app/);
  const r = deshacer(kitReal, KIT, { ver: false });
  assert.equal(r.codigo, 0, r.salida); assert.match(r.salida, /Deshecho/);
});
