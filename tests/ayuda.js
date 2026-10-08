'use strict';
// Cuadernos de mentira para los tests: el curso de ejemplo de ejemplos/curso-demo copiado a una carpeta temporal que se borra,
// con el andamiaje del kit si se pide.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Las notas del curso de ejemplo (ejemplos/curso-demo), ruta → texto. Es el mismo cuaderno que se puede abrir con la app
// y el que ven los recorridos de navegador: una sola referencia, en el repo.
const EJEMPLOS = path.join(__dirname, '..', 'ejemplos');
function leerCarpeta(base, dir = '') {
  const out = {};
  for (const e of fs.readdirSync(path.join(base, dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = dir ? `${dir}/${e.name}` : e.name;
    // Los binarios (un PDF) se copian tal cual; el resto como texto, para poder pasarlo a CRLF.
    if (e.isDirectory()) Object.assign(out, leerCarpeta(base, rel)); else out[rel] = /\.(pdf|png|jpe?g)$/i.test(e.name) ? fs.readFileSync(path.join(base, rel)) : fs.readFileSync(path.join(base, rel), 'utf8');
  }
  return out;
}
const NOTAS = leerCarpeta(path.join(EJEMPLOS, 'curso-demo'));
// Solo para probar el ignorado (.gitignore / .obsidianignore / ocultos): no son notas del curso y git no las dejaría entrar.
const RELLENO_IGNORADO = { 'node_modules/paquete/README.md': '# No soy una nota\n', 'oculta/.secreto.md': '# Oculta\n' };

// opciones: { crlf, kit: 'kit' | 'salida-sin-motor' | 'carpeta', ignorar: texto de .gitignore, obsidianignore }
function crearCuaderno({ crlf = false, kit = 'carpeta', ignorar = '', obsidianignore = '' } = {}) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'cuaderno-test-'));
  const base = kit === 'carpeta' ? raiz : path.join(raiz, 'estudio');
  for (const [rel, texto] of Object.entries({ ...NOTAS, ...RELLENO_IGNORADO })) {
    const abs = path.join(base, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, crlf && typeof texto === 'string' ? texto.replace(/\n/g, '\r\n') : texto);
  }
  if (kit !== 'carpeta') fs.mkdirSync(path.join(raiz, 'config'), { recursive: true });
  if (kit === 'kit') {
    fs.mkdirSync(path.join(raiz, '.kit', 'adaptadores'), { recursive: true });
    fs.writeFileSync(path.join(raiz, '.kit', 'motor.json'), JSON.stringify({ repo: 'rsotor/profesor-kit', version_datos: 9 }));
    fs.writeFileSync(path.join(raiz, '.kit', 'adaptadores', 'claude-code.json'), JSON.stringify({ id: 'claude-code', comando: 'claude' }));
  }
  if (ignorar) fs.writeFileSync(path.join(raiz, '.gitignore'), ignorar);
  if (obsidianignore) fs.writeFileSync(path.join(base, '.obsidianignore'), obsidianignore);
  return { raiz, base, leer: rel => fs.readFileSync(path.join(base, rel), 'utf8'), borrar: () => fs.rmSync(raiz, { recursive: true, force: true }) };
}

module.exports = { crearCuaderno, NOTAS, EJEMPLOS };
