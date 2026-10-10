'use strict';
// Cuadernos de mentira para los tests: el cuaderno de ejemplo (ejemplos/cuaderno-ejemplo) copiado a una carpeta temporal que se borra,
// con el andamiaje del kit si se pide.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Las notas del cuaderno de ejemplo (ejemplos/cuaderno-ejemplo), ruta → texto. Es el mismo cuaderno que se puede abrir con la app
// y el que ven los recorridos de navegador: una sola referencia, en el repo.
const EJEMPLOS = path.join(__dirname, '..', 'ejemplos');
function leerCarpeta(base, dir = '') {
  const out = {};
  for (const e of fs.readdirSync(path.join(base, dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = dir ? `${dir}/${e.name}` : e.name;
    // Los binarios (un PDF) se copian tal cual; el resto como texto, para poder pasarlo a CRLF. El texto se lee siempre
    // con LF: git en Windows lo saca con CRLF y el cuaderno de prueba no puede depender del checkout (CRLF solo con `crlf`).
    if (e.isDirectory()) Object.assign(out, leerCarpeta(base, rel)); else out[rel] = /\.(pdf|png|jpe?g)$/i.test(e.name) ? fs.readFileSync(path.join(base, rel)) : fs.readFileSync(path.join(base, rel), 'utf8').replace(/\r\n/g, '\n');
  }
  return out;
}
const NOTAS = leerCarpeta(path.join(EJEMPLOS, 'cuaderno-ejemplo'));
// Solo para probar el ignorado (.gitignore / .obsidianignore / ocultos): no son notas del curso y git no las dejaría entrar.
const RELLENO_IGNORADO = { 'node_modules/paquete/README.md': '# No soy una nota\n', 'oculta/.secreto.md': '# Oculta\n' };

// El cuaderno de ejemplo montado de una de dos formas (AGENTS.md, «Cuadernos de prueba»): sin kit (la base, notas en la
// raíz) o con kit (notas en estudio/, más .kit/ con su motor y adaptador y config/). 'sin-motor' es el curso del kit sin
// motor: estudio/ y config/ sin .kit/motor.json (un caso del modo con kit, con un solo test).
// opciones: { kit: false | true | 'sin-motor', crlf, ignorar: texto de .gitignore, obsidianignore }
function crearCuaderno({ crlf = false, kit = false, ignorar = '', obsidianignore = '' } = {}) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'cuaderno-test-'));
  const base = kit ? path.join(raiz, 'estudio') : raiz;
  for (const [rel, texto] of Object.entries({ ...NOTAS, ...RELLENO_IGNORADO })) {
    const abs = path.join(base, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, crlf && typeof texto === 'string' ? texto.replace(/\n/g, '\r\n') : texto);
  }
  if (kit) fs.mkdirSync(path.join(raiz, 'config'), { recursive: true });
  if (kit === true) {
    fs.mkdirSync(path.join(raiz, '.kit', 'adaptadores'), { recursive: true });
    fs.writeFileSync(path.join(raiz, '.kit', 'motor.json'), JSON.stringify({ repo: 'rsotor/profesor-kit', version_datos: 9 }));
    fs.writeFileSync(path.join(raiz, '.kit', 'adaptadores', 'claude-code.json'), JSON.stringify({ id: 'claude-code', comando: 'claude' }));
  }
  if (ignorar) fs.writeFileSync(path.join(raiz, '.gitignore'), ignorar);
  if (obsidianignore) fs.writeFileSync(path.join(base, '.obsidianignore'), obsidianignore);
  return { raiz, base, leer: rel => fs.readFileSync(path.join(base, rel), 'utf8'), borrar: () => fs.rmSync(raiz, { recursive: true, force: true }) };
}

// Un «otro Node» para probar ejecutarNode (plan de Electron, T3): una copia de process.execPath con otro nombre, así una
// herramienta falsa del kit puede decir con qué binario la han lanzado (process.execPath) y distinguirlo del de este
// proceso. Una copia por proceso de test; se borra al salir.
let nodeCopiado = null;
function otroNode() {
  if (nodeCopiado) return nodeCopiado;
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cuaderno-node-'));
  nodeCopiado = path.join(d, `node-del-kit${path.extname(process.execPath)}`);
  fs.copyFileSync(process.execPath, nodeCopiado);
  process.on('exit', () => fs.rmSync(d, { recursive: true, force: true }));
  return nodeCopiado;
}

// Herramientas del kit falsas que chivan con qué las han lanzado: { execPath, args, PATH, GIT_TERMINAL_PROMPT, LC_ALL,
// RUN_AS_NODE } en su salida y en .kit/herramientas/lanzado.json (para cuando la salida no llega al test: la revisión del
// examen, las rutas). Devuelve la función que lee ese fichero.
const CHIVATA = `const j = JSON.stringify({ execPath: process.execPath, args: process.argv.slice(2), PATH: process.env.PATH, GIT_TERMINAL_PROMPT: process.env.GIT_TERMINAL_PROMPT, LC_ALL: process.env.LC_ALL, RUN_AS_NODE: process.env.ELECTRON_RUN_AS_NODE });
require('fs').writeFileSync(require('path').join(__dirname, 'lanzado.json'), j); process.stdout.write(j);`;
function herramientasChivatas(raiz, nombres) {
  const dir = path.join(raiz, '.kit', 'herramientas');
  fs.mkdirSync(dir, { recursive: true });
  for (const n of nombres) fs.writeFileSync(path.join(dir, n), CHIVATA);
  return () => JSON.parse(fs.readFileSync(path.join(dir, 'lanzado.json'), 'utf8'));
}

module.exports = { crearCuaderno, NOTAS, EJEMPLOS, otroNode, herramientasChivatas };
