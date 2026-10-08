'use strict';
// El cuaderno de ejemplo y su índice (ejemplos/cuaderno-ejemplo.md): todo lo que cita el índice existe, cada
// característica y cada caso de uso tiene su test, las notas son cortas y no hay nada real dentro.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const EJEMPLOS = path.join(__dirname, '..', 'ejemplos');
const CUADERNO = path.join(EJEMPLOS, 'cuaderno-ejemplo');
const indice = fs.readFileSync(path.join(EJEMPLOS, 'cuaderno-ejemplo.md'), 'utf8');
const tabla = (desde, hasta) => indice.slice(indice.indexOf(desde), hasta ? indice.indexOf(hasta) : undefined).split('\n').filter(l => /^\| (?!Característica|#|---)/.test(l)).map(l => l.split('|').map(c => c.trim()));
const filas = tabla('| Característica', '## Casos de uso');
const casos = tabla('## Casos de uso');
const rutasDe = celda => [...celda.matchAll(/`([^`]+)`/g)].map(m => m[1]);
function todos(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const abs = path.join(dir, e.name); if (e.isDirectory()) todos(abs, acc); else acc.push(abs); }
  return acc;
}

test('el índice cita notas y ficheros que existen, y tests que existen', () => {
  assert.ok(filas.length >= 10, `el índice tiene ${filas.length} filas`);
  for (const [, que, donde, prueba] of filas) {
    const rutas = rutasDe(donde);
    assert.ok(rutas.length, `«${que}» no dice dónde está`);
    for (const r of rutas) assert.ok(fs.existsSync(path.join(CUADERNO, r)), `«${que}»: no existe ${r}`);
    for (const t of rutasDe(prueba)) assert.ok(fs.existsSync(path.join(__dirname, '..', t)), `«${que}»: no existe el test ${t}`);
  }
});

test('las notas son cortas (40 líneas como mucho) y no llevan nada real (correos, rutas de usuario)', () => {
  for (const abs of todos(CUADERNO).filter(f => /\.(md|txt|csv|json|html)$/.test(f))) {
    const texto = fs.readFileSync(abs, 'utf8'), rel = path.relative(CUADERNO, abs);
    if (abs.endsWith('.md')) assert.ok(texto.split('\n').length <= 40, `${rel} pasa de 40 líneas`);
    assert.doesNotMatch(texto, /[\w.+-]+@[\w-]+\.[a-z]{2,}/i, `${rel} lleva un correo`);
    assert.doesNotMatch(texto, /\/(Users|home)\/[\w.-]+|[A-Z]:\\Users\\/, `${rel} lleva una ruta de usuario`);
  }
});

test('cada nota o fichero del cuaderno sale en el índice (directamente o por su carpeta)', () => {
  const citadas = filas.flatMap(([, , donde]) => rutasDe(donde));
  for (const abs of todos(CUADERNO)) {
    const rel = path.relative(CUADERNO, abs).split(path.sep).join('/');
    assert.ok(citadas.some(c => rel === c || rel.startsWith(c.replace(/\/?$/, '/'))) || /\.png$/.test(rel), `${rel} no sale en el índice`);
  }
});

test('cada característica nombra al menos un test (nada «TBD»)', () => {
  for (const [, que, , prueba] of filas) assert.ok(rutasDe(prueba).length, `«${que}» no tiene test`);
});

test('cada caso de uso tiene un recorrido que existe y empieza por su texto; o dice que no está implementado', () => {
  assert.ok(casos.length >= 13, `hay ${casos.length} casos de uso`);
  for (const [, n, caso, fichero, empieza, modo] of casos) {
    if (/no implementado/.test(modo)) continue;
    const [f] = rutasDe(fichero);
    assert.ok(f && fs.existsSync(path.join(__dirname, '..', f)), `caso ${n} «${caso}»: no existe ${f}`);
    const fuente = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    assert.ok(fuente.includes(`test('${empieza}`), `caso ${n} «${caso}»: ${f} no tiene un test que empiece por «${empieza}»`);
  }
});
