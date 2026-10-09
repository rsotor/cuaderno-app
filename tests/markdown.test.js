'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { crearRender, leerFrontmatter } = require('../markdown');

const md = crearRender(d => (d === 'capital' || d === 'conceptos/capital' ? 'conceptos/capital.md' : null));

test('wikilinks: simple, con alias, con \\| de tabla y roto', () => {
  const html = md.render('[[capital]] [[capital|el capital]] [[no-existe]]\n\n| a |\n|---|\n| [[capital\\|en tabla]] |\n');
  assert.match(html, /<a class="wiki" href="#\/n\/conceptos\/capital.md" title="capital">capital<\/a>/);
  assert.match(html, /title="capital">el capital<\/a>/);
  assert.match(html, /<a class="wiki roto" href="#" title="no-existe">no-existe<\/a>/);
  assert.match(html, /<td><a class="wiki"[^>]*>en tabla<\/a><\/td>/);
});

test('callouts: tipo, título, plegable', () => {
  const html = md.render('> [!warning]- Ojo\n> Cuerpo del aviso.\n');
  assert.match(html, /<blockquote class="callout callout-warning plegado" data-tipo="warning">/);
  assert.match(html, /<div class="callout-titulo" data-tipo="warning" data-plegable="1">.*Ojo<\/div>/);
  assert.match(html, /Cuerpo del aviso/);
  assert.match(md.render('> [!info]\n> Sin título.\n'), /callout-titulo[^>]*>.*info<\/div>/);
});

test('casillas llevan la línea del fichero y marcado', () => {
  const html = md.render('Intro\n\n- [ ] una\n- [x] dos\n');
  // Cambio de especificación decidido (revisión de diseño 2026-10-09, hallazgo 10; plan vivo §6): la línea entera es la
  // etiqueta de la casilla, para que clicar el texto marque y la casilla tenga nombre accesible.
  assert.match(html, /<li class="tarea"><label class="casilla-linea"><input type="checkbox" class="casilla" data-linea="2"> una<\/label>/);
  assert.match(html, /<input type="checkbox" class="casilla" data-linea="3" checked> dos<\/label>/);
});

test('matemáticas en línea y en bloque se entregan a KaTeX sin tocar', () => {
  const html = md.render('Con $i = 5\\%$ y\n\n$$\nI = C \\cdot i\n$$\n');
  assert.match(html, /<span class="math" data-display="0">i = 5\\%<\/span>/);
  assert.match(html, /<div class="math" data-display="1">I = C \\cdot i<\/div>/);
  assert.doesNotMatch(md.render('cuesta 5$ y 6$'), /class="math"/);
});

test('cada bloque de nivel 0 lleva sus líneas de origen', () => {
  const html = md.render('# T\n\nPárrafo\nde dos líneas.\n\n- a\n- b\n');
  assert.match(html, /<div class="bloque" data-desde="0" data-hasta="1"><h1>T<\/h1>/);
  assert.match(html, /<div class="bloque" data-desde="2" data-hasta="4"><p>Párrafo/);
  assert.match(html, /<div class="bloque" data-desde="5" data-hasta="7"><ul>/);
});

test('frontmatter: claves, listas, booleanos, y las líneas que ocupa; igual con CRLF', () => {
  const src = '---\ntipo: concepto\nalias: [a, b]\nestudiada: true\n---\n# T\n';
  const lf = leerFrontmatter(src);
  assert.deepEqual(lf.datos, { tipo: 'concepto', alias: ['a', 'b'], estudiada: true });
  assert.equal(lf.lineas, 5);
  assert.deepEqual(leerFrontmatter(src.replace(/\n/g, '\r\n')), lf);
  assert.deepEqual(leerFrontmatter('# Sin frontmatter\n'), { datos: null, lineas: 0 });
});

test('el HTML crudo de una nota no se ejecuta', () => {
  assert.doesNotMatch(md.render('<script>alert(1)</script>'), /<script>/);
});

test('imágenes: la ruta relativa se resuelve desde la carpeta de la nota y se sirve desde el cuaderno', () => {
  const md = crearRender(() => null);
  const html = md.render('![Plan](../capturas/01.png) ![[foto.png|La foto]] ![web](https://x.org/a.png) [[nota]]\n', { ruta: 'docs/planes/plan.md' });
  assert.match(html, /<img src="\/fichero\/docs\/capturas\/01\.png" alt="Plan">/);
  assert.match(html, /<img src="\/fichero\/docs\/planes\/foto\.png" alt="La foto">/);
  assert.match(html, /<img src="https:\/\/x\.org\/a\.png" alt="web">/);
  assert.match(html, /class="wiki roto"/, 'el wikilink normal sigue siendo un enlace');
});

test('bloques: una lista seguida de línea en blanco acaba donde acaba la lista, no en la línea en blanco', () => {
  const md = crearRender(() => null);
  const html = md.render('# T\n\n- uno\n- dos\n\nPárrafo.\n');
  assert.match(html, /data-desde="2" data-hasta="4">\s*<ul/, 'la lista ocupa las líneas 2 y 3; markdown-it le daba también la 4 (en blanco)');
  assert.match(html, /data-desde="5" data-hasta="6">\s*<p/);
});

test('propiedades: una lista en varias líneas (como la escribe Obsidian) es una lista; una clave vacía, vacía', () => {
  const { datos } = leerFrontmatter('---\netiquetas:\n  - presupuesto\n  - "mensual"\nvacia:\nn: 3\n---\n# T\n');
  assert.deepEqual(datos.etiquetas, ['presupuesto', 'mensual']);
  assert.equal(datos.vacia, '');
  assert.equal(datos.n, '3');
});
