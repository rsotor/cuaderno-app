'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Cuaderno, ErrorConflicto, ErrorPeticion } = require('../cuaderno');
const { crearCuaderno, NOTAS } = require('./ayuda');

const con = (opciones, fn) => async () => { const c = crearCuaderno(opciones); try { await fn(c, new Cuaderno(c.raiz, c.base)); } finally { c.borrar(); } };

test('el índice salta node_modules y lo que empieza por punto', con({}, (c, cu) => {
  const l = cu.listar();
  assert.ok(l.includes('conceptos/interes.md') && l.includes('tareas.md'));
  assert.ok(!l.some(p => p.includes('node_modules') || p.includes('.secreto')));
}));

test('el índice respeta .gitignore y una lista blanca en .obsidianignore', con({ ignorar: 'examenes/\n', obsidianignore: '/*\n!/*.md\n!/conceptos/\n' }, (c, cu) => {
  const l = cu.listar();
  assert.deepEqual(l, ['conceptos/capital.md', 'conceptos/interes.md', 'inicio.md', 'tareas.md']);
}));

test('una ruta fuera del cuaderno no se abre', con({}, (c, cu) => {
  assert.throws(() => cu.dentro('../../etc/passwd'), ErrorPeticion);
  assert.throws(() => cu.dentro(''), ErrorPeticion);
}));

test('nota: frontmatter, html, backlinks, líneas desplazadas por el frontmatter', con({}, (c, cu) => {
  const n = cu.nota('conceptos/interes.md');
  assert.equal(n.frontmatter.tipo, 'concepto');
  assert.match(n.html, /data-desde="5" data-hasta="6"><h1>Interés/);
  assert.match(n.html, /class="wiki roto" href="#" title="no-existe"/);
  assert.deepEqual(n.backlinks, ['conceptos/capital.md', 'sesiones/01-01-01-sesion.md']);
  assert.deepEqual(cu.nota('conceptos/capital.md').backlinks, ['conceptos/interes.md']);
}));

test('portada: inicio.md si existe; si no, la primera nota de la raíz; si no, null', con({}, (c, cu) => {
  assert.equal(cu.portada(), 'inicio.md');
  fs.unlinkSync(path.join(c.base, 'inicio.md')); cu.invalidar();
  assert.equal(cu.portada(), 'tareas.md');
  fs.unlinkSync(path.join(c.base, 'tareas.md')); cu.invalidar();
  assert.equal(cu.portada(), null);
}));

test('buscar sin acentos, por nombre y por línea', con({}, (c, cu) => {
  const r = cu.buscar('interes');
  assert.ok(r.ficheros.includes('conceptos/interes.md'));
  assert.ok(cu.buscar('módulo').ficheros.includes('examenes/01-examen.md'), 'una nota coincide también por su título (el fichero es 01-examen.md)');
  assert.ok(r.lineas.some(l => l.ruta === 'conceptos/capital.md' && l.texto.includes('interés')));
  assert.deepEqual(cu.buscar('  '), { ficheros: [], lineas: [] });
}));

test('tareas: por nota, sin exámenes, tareas.md primero; sin kit solo las propias', con({}, (c, cu) => {
  const g = cu.tareas();
  assert.equal(g[0].ruta, 'tareas.md');
  assert.ok(!g.some(x => x.ruta.startsWith('examenes/')));
  assert.deepEqual(g.find(x => x.ruta === 'sesiones/01-01-01-sesion.md').items.map(i => [i.linea, i.hecha, i.texto]), [[6, false, 'estudiada'], [10, false, 'Leer interes'], [11, true, 'Hecho ya']]);
  assert.deepEqual(cu.tareas({ soloPropias: true }).map(x => x.ruta), ['tareas.md']);
}));

test('tareas: enlaces y etiquetas de cada línea; no cuentan #1, «# título» ni lo que va en código', con({}, (c, cu) => {
  const items = cu.tareas().find(g => g.ruta === 'conceptos/interes.md').items;
  assert.deepEqual(items.map(i => [i.enlaces, i.etiquetas]), [[['capital', '01-01-01-sesion'], ['repaso', 'tema/dinero']], [[], []]]);
  assert.equal(items[0].texto, 'Repasar con capital y la sesión #repaso #tema/dinero');
  assert.equal(items[0].html, 'Repasar con capital y la sesión <span class="etiqueta">#repaso</span> <span class="etiqueta">#tema/dinero</span>');
  assert.equal(items[1].html, 'Apuntar <code>#codigo</code> #1 # ni esto');
  assert.deepEqual(cu.tareas().find(g => g.ruta === 'sesiones/01-01-01-sesion.md').items.map(i => i.enlaces), [[], ['interes'], []]);
  // una tarea añadida desde la app con la nota abierta: la ruta sin extensión resuelve a la nota
  cu.nuevaTarea('Releer esto [[conceptos/interes]] #ñandú');
  const nueva = cu.tareas()[0].items.at(-1);
  assert.deepEqual([nueva.texto, nueva.enlaces, nueva.etiquetas], ['Releer esto interes #ñandú', ['interes'], ['ñandú']]);
}));

test('editar un bloque deja el fichero como a mano y rechaza si cambió debajo', con({}, (c, cu) => {
  cu.escribirBloque('conceptos/capital.md', 2, 3, 'Lo que pones tú.', 'Lo que pones. Enlaza con [[interes|el interés]].');
  assert.equal(c.leer('conceptos/capital.md'), '# Capital\n\nLo que pones tú.\n');
  assert.throws(() => cu.escribirBloque('conceptos/capital.md', 2, 3, 'otra', 'Lo que pones. Enlaza con [[interes|el interés]].'), ErrorConflicto);
  assert.throws(() => cu.escribirBloque('conceptos/capital.md', 5, 9, 'x', null), ErrorPeticion);
}));

test('comentar deja el callout separado por líneas en blanco', con({}, (c, cu) => {
  cu.comentar('sesiones/01-01-01-sesion.md', 4, 5, 'No lo entiendo\nnada', '# 1.1 La sesión', '2026-10-07');
  assert.equal(c.leer('sesiones/01-01-01-sesion.md'), NOTAS['sesiones/01-01-01-sesion.md'].replace('# 1.1 La sesión\n', '# 1.1 La sesión\n\n> [!comment] Alumno (2026-10-07)\n> No lo entiendo\n> nada\n'));
  // si la línea siguiente no está en blanco, se añade una
  cu.comentar('conceptos/capital.md', 0, 1, 'ok', null, '2026-10-07');
  assert.equal(c.leer('conceptos/capital.md'), '# Capital\n\n> [!comment] Alumno (2026-10-07)\n> ok\n\n\nLo que pones. Enlaza con [[interes|el interés]].\n'.replace('> ok\n\n\nLo', '> ok\n\nLo'));
  assert.deepEqual(cu.comentarios().map(x => [x.ruta, x.linea, x.texto]), [['conceptos/capital.md', 2, 'ok'], ['sesiones/01-01-01-sesion.md', 6, 'No lo entiendo nada']]);
  assert.throws(() => cu.comentar('conceptos/capital.md', 0, 1, '   '), ErrorPeticion);
}));

test('marcar una casilla cambia solo esa línea y comprueba que sigue siendo ella', con({}, (c, cu) => {
  cu.marcarCasilla('sesiones/01-01-01-sesion.md', 10, true, '- [ ] Leer [[interes]]');
  assert.equal(c.leer('sesiones/01-01-01-sesion.md'), NOTAS['sesiones/01-01-01-sesion.md'].replace('- [ ] Leer', '- [x] Leer'));
  cu.marcarCasilla('sesiones/01-01-01-sesion.md', 11, false);
  assert.match(c.leer('sesiones/01-01-01-sesion.md'), /- \[ \] Hecho ya/);
  assert.throws(() => cu.marcarCasilla('sesiones/01-01-01-sesion.md', 7, true), ErrorConflicto);
  assert.throws(() => cu.marcarCasilla('sesiones/01-01-01-sesion.md', 10, true, '- [ ] Otra cosa'), ErrorConflicto);
}));

test('nueva tarea: se añade a tareas.md, o lo crea si no existe', con({}, (c, cu) => {
  cu.nuevaTarea('  Repasar  ');
  assert.equal(c.leer('tareas.md'), NOTAS['tareas.md'] + '- [ ] Repasar\n');
  fs.unlinkSync(path.join(c.base, 'tareas.md'));
  cu.nuevaTarea('Primera');
  assert.equal(c.leer('tareas.md'), '# Mis tareas\n\nLo que te apuntas tú. Tu profesor lo lee, pero no lo reescribe.\n\n- [ ] Primera\n');
  assert.throws(() => cu.nuevaTarea(''), ErrorPeticion);
}));

test('con CRLF: se lee igual y toda escritura conserva CRLF', con({ crlf: true }, (c, cu) => {
  const n = cu.nota('conceptos/interes.md');
  assert.equal(n.frontmatter.tipo, 'concepto');
  assert.match(n.html, /data-desde="5" data-hasta="6"><h1>Interés/);
  cu.escribirBloque('conceptos/capital.md', 2, 3, 'Nuevo\ntexto', 'Lo que pones. Enlaza con [[interes|el interés]].');
  assert.equal(c.leer('conceptos/capital.md'), '# Capital\r\n\r\nNuevo\r\ntexto\r\n');
  cu.comentar('conceptos/capital.md', 0, 1, 'duda', '# Capital', '2026-10-07');
  cu.marcarCasilla('tareas.md', 4, true);
  cu.nuevaTarea('Otra');
  for (const f of ['conceptos/capital.md', 'tareas.md']) assert.ok(!/[^\r]\n/.test(c.leer(f)), `${f} mezcla finales de línea`);
  assert.equal(c.leer('tareas.md'), NOTAS['tareas.md'].replace(/\n/g, '\r\n').replace('- [ ] Comprar', '- [x] Comprar') + '- [ ] Otra\r\n');
}));

test('nombre: cuaderno.json, luego nombre_curso del kit, luego la carpeta', con({ kit: true }, (c, cu) => {
  assert.equal(cu.nombre(), path.basename(c.raiz));
  fs.writeFileSync(path.join(c.raiz, 'config', 'ajustes.json'), JSON.stringify({ nombre_curso: 'Finanzas' }));
  assert.equal(new Cuaderno(c.raiz, c.base).nombre(), 'Finanzas');
  fs.writeFileSync(path.join(c.raiz, 'cuaderno.json'), JSON.stringify({ nombre: 'Mi cuaderno' }));
  assert.equal(new Cuaderno(c.raiz, c.base).nombre(), 'Mi cuaderno');
}));

test('títulos: el # de cada nota, sin wikilinks; las tareas llevan el Markdown en línea pintado', con({}, (c, cu) => {
  const t = cu.titulos();
  assert.equal(t['conceptos/interes.md'], 'Interés'); assert.equal(t['inicio.md'], 'Mi curso'); assert.equal(t['sesiones/01-01-01-sesion.md'], '1.1 La sesión');
  const item = cu.tareas().find(g => g.ruta === 'sesiones/01-01-01-sesion.md').items[1];
  assert.equal(item.texto, 'Leer interes'); assert.equal(item.html, 'Leer interes');
  assert.equal(cu.acortarRutas('Ver conceptos/interes y sesiones/01-01-01-sesion.md: regla 50/30/20, el 04/10/2026, IVA/IRPF y https://x.com/a'), 'Ver interes y 01-01-01-sesion: regla 50/30/20, el 04/10/2026, IVA/IRPF y https://x.com/a');
}));

test('recorrido: cuenta notas, enlaces rotos y fallos', con({}, (c, cu) => {
  const r = cu.recorrido();
  assert.equal(r.notas, 20);   // las 8 del curso demo, las 8 de cuaderno-ejemplo (render/, estructura/), las 3 de las menciones (personas/, iniciativas/mudanza/) y la nota larga de lectura/ (2026-10-09: una nota nueva en el ejemplo, no un valor arreglado); sus enlaces resuelven todos: el único roto sigue siendo el de interes.md
  assert.deepEqual(r.rotos, [{ ruta: 'conceptos/interes.md', destino: 'no-existe' }]);
  assert.deepEqual(r.fallos, []);
}));

test('nueva nota: el título es el nombre del fichero, en la carpeta que se diga; ni repetida ni fuera del cuaderno', con({}, (c, cu) => {
  assert.equal(cu.nuevaNota('Idea rápida: ¿qué es el interés?'), 'Idea rápida ¿qué es el interés.md', 'sin : ni ?, que Windows no admite en un nombre');
  assert.equal(c.leer('Idea rápida ¿qué es el interés.md'), '# Idea rápida: ¿qué es el interés?\n\n', 'el título se queda entero dentro');
  assert.equal(cu.nuevaNota('Dudas', 'conceptos'), 'conceptos/Dudas.md');
  assert.ok(cu.listar().includes('conceptos/Dudas.md'), 'el índice se invalida: la nota nueva aparece');
  assert.throws(() => cu.nuevaNota('Dudas', 'conceptos'), /ya hay una nota/);
  assert.throws(() => cu.nuevaNota('   '), /título/);
  assert.throws(() => cu.nuevaNota('x', 'no-existe'), /no existe la carpeta/);
  assert.throws(() => cu.nuevaNota('x', '..'), /fuera del cuaderno/);
}));

test('editar y comentar una lista: el original con línea en blanco final no es un conflicto (bug del 2026-10-08)', con({}, (c, cu) => {
  const ls = cu.lineas(c.leer('sesiones/01-01-01-sesion.md'));
  // La lista final («- [ ] Leer…», «- [x] Hecho ya») va de la línea 10 a la 12; el cliente antiguo mandaba también la 12 en blanco.
  assert.doesNotThrow(() => cu.comprobarOriginal(ls, 10, 12, ls.slice(10, 12).join('\n') + '\n'));
  cu.escribirBloque('sesiones/01-01-01-sesion.md', 10, 12, '- [ ] Leer [[interes]]\n- [x] Hecho ya\n- [ ] Otra', ls.slice(10, 12).join('\n') + '\n');
  assert.match(c.leer('sesiones/01-01-01-sesion.md'), /- \[x\] Hecho ya\n- \[ \] Otra\n$/);
}));

test('ficheros que no son notas: el árbol lista todos, como el Finder (también un .docx), menos los ocultos; el buscador los encuentra por nombre, no por dentro', con({}, (c, cu) => {
  fs.writeFileSync(path.join(c.base, 'material', 'apuntes.docx'), 'no soy texto');
  fs.writeFileSync(path.join(c.base, 'material', '.DS_Store'), 'oculto');
  cu.invalidar();
  const l = cu.listar();
  for (const f of ['material/extracto-octubre.pdf', 'material/gastos-octubre.json', 'material/gastos-octubre.csv', 'material/apuntes-de-clase.txt', 'material/calculadora-50-30-20.html', 'material/apuntes.docx']) assert.ok(l.includes(f), `falta ${f} en el árbol`);
  assert.ok(!l.includes('material/.DS_Store'), 'un fichero oculto sale en el árbol');
  const r = cu.buscar('extracto');
  assert.deepEqual(r.ficheros, ['material/extracto-octubre.pdf'], 'el PDF sale por su nombre');
  assert.ok(!cu.buscar('Supermercado').lineas.some(x => !x.ruta.endsWith('.md')), 'la búsqueda en el texto no entra en el JSON ni el CSV');
  assert.equal(cu.titulos()['material/calculadora-50-30-20.html'], 'Calculadora 50/30/20', 'una página HTML se titula con su <title>');
  assert.equal(cu.titulos()['material/extracto-octubre.pdf'], undefined);
}));

test('carpetas sin nada que enseñar (vacías o con solo un .gitkeep) salen en el árbol como «carpeta/»; las de «_», no', con({}, (c, cu) => {
  fs.mkdirSync(path.join(c.base, 'adjuntos', 'nueva'), { recursive: true });
  fs.writeFileSync(path.join(c.base, 'adjuntos', 'nueva', '.gitkeep'), '');
  fs.mkdirSync(path.join(c.base, 'vacia'));
  fs.mkdirSync(path.join(c.base, '_trastienda'));
  cu.invalidar();
  const a = cu.arbol();
  assert.ok(a.includes('adjuntos/nueva/'), 'la carpeta con solo un .gitkeep no sale');
  assert.ok(a.includes('vacia/'), 'la carpeta vacía no sale');
  assert.ok(!a.includes('adjuntos/'), 'la carpeta que contiene otra sale además como vacía');
  assert.ok(!a.includes('_trastienda/'), 'una carpeta de trastienda sale en el árbol');
  assert.ok(!cu.listar().some(p => p.endsWith('/')), 'las carpetas vacías entran en el índice de ficheros');
}));

test('enlaces a ficheros: [[x.json]] resuelve y [[x]] sin extensión no; un enlace relativo lleva a la vista del fichero; nota() no lee un PDF', con({}, (c, cu) => {
  assert.equal(cu.resolverWiki('gastos-octubre.json'), 'material/gastos-octubre.json');
  assert.equal(cu.resolverWiki('extracto-octubre.pdf'), 'material/extracto-octubre.pdf');
  assert.equal(cu.resolverWiki('gastos-octubre'), null, 'sin extensión, un fichero que no es nota no resuelve');
  assert.equal(cu.resolverWiki('capital'), 'conceptos/capital.md', 'las notas siguen resolviendo sin .md');
  const html = cu.nota('material/material.md').html;
  assert.match(html, /href="#\/n\/material\/gastos-octubre\.json"/, 'el enlace relativo [..](gastos-octubre.json) no lleva a la vista del fichero');
  assert.match(html, /href="#\/n\/material\/extracto-octubre\.pdf"/);
  assert.doesNotMatch(html, /wiki roto/);
  assert.deepEqual(cu.nota('material/extracto-octubre.pdf'), { ruta: 'material/extracto-octubre.pdf', tipo: 'pdf', esFichero: true });
}));

test('carpetas que empiezan por «_»: fuera del árbol y del buscador, dentro del índice (se enlazan y se abren)', con({}, (c, cu) => {
  fs.mkdirSync(path.join(c.base, '_meta')); fs.writeFileSync(path.join(c.base, '_meta', 'estado.md'), '# Estado del curso\n\nTrastienda.\n');
  fs.mkdirSync(path.join(c.base, 'conceptos', '_borradores')); fs.writeFileSync(path.join(c.base, 'conceptos', '_borradores', 'idea.md'), '# Idea suelta\n\nTrastienda.\n');
  fs.writeFileSync(path.join(c.base, 'conceptos', '_suelta.md'), '# Nota con guion bajo\n');   // un fichero con «_» no es una carpeta: se ve
  cu.invalidar();
  assert.ok(cu.listar().includes('_meta/estado.md') && cu.listar().includes('conceptos/_borradores/idea.md'), 'el índice las pierde');
  assert.ok(!cu.arbol().some(p => p.includes('_meta/') || p.includes('_borradores/')), 'el árbol enseña una carpeta con «_»');
  assert.ok(cu.arbol().includes('conceptos/_suelta.md'));
  const r = cu.buscar('trastienda');
  assert.deepEqual([r.ficheros, r.lineas], [[], []], 'el buscador entra en una carpeta con «_»');
  assert.deepEqual(cu.buscar('Estado del curso').ficheros, []);
  assert.equal(cu.resolverWiki('_meta/estado'), '_meta/estado.md');
  assert.equal(cu.resolverWiki('idea'), 'conceptos/_borradores/idea.md');
  assert.match(cu.nota('_meta/estado.md').html, /Estado del curso/);
}));

test('las imágenes salen en el índice como ficheros', con({}, (c, cu) => {
  assert.ok(cu.listar().includes('material/reparto-50-30-20.png'));
  for (const ext of ['jpg', 'jpeg', 'gif', 'webp', 'svg']) fs.writeFileSync(path.join(c.base, 'material', `foto.${ext}`), '');
  cu.invalidar();
  assert.deepEqual(cu.listar().filter(p => p.startsWith('material/foto.')), ['material/foto.gif', 'material/foto.jpeg', 'material/foto.jpg', 'material/foto.svg', 'material/foto.webp']);
  assert.deepEqual(cu.nota('material/reparto-50-30-20.png'), { ruta: 'material/reparto-50-30-20.png', tipo: 'png', esFichero: true });
}));

test('escribirNota conserva el salto final (o su falta), las líneas en blanco finales, el CRLF y el BOM', con({}, (c, cu) => {
  const abs = rel => path.join(c.base, rel);
  fs.writeFileSync(abs('sin-final.md'), '# A\n\ntexto');
  cu.escribirNota('sin-final.md', '# A\n\notro', '# A\n\ntexto');
  assert.equal(c.leer('sin-final.md'), '# A\n\notro');
  fs.writeFileSync(abs('blancos.md'), '# B\n\n\n');
  cu.escribirNota('blancos.md', '# B\n\nx\n\n\n', '# B\n\n\n');
  assert.equal(c.leer('blancos.md'), '# B\n\nx\n\n\n');
  assert.throws(() => cu.escribirNota('blancos.md', 'y', '# B\n\nx\n\n'), ErrorConflicto, 'la comparación es estricta con los blancos finales');
  fs.writeFileSync(abs('bom.md'), '\uFEFF# C\r\n\r\nuno\r\n');
  cu.escribirNota('bom.md', '# C\n\ndos\n', '# C\n\nuno\n');   // el navegador manda el original sin BOM y con LF
  assert.equal(c.leer('bom.md'), '\uFEFF# C\r\n\r\ndos\r\n');
}));

test('escribirNota en un fichero CRLF vuelve CRLF, sin ningún LF suelto', con({ crlf: true }, (c, cu) => {
  const antes = c.leer('conceptos/capital.md');
  assert.ok(antes.includes('\r\n'));
  cu.escribirNota('conceptos/capital.md', 'uno\ndos\r\ntres\n', antes);
  const despues = c.leer('conceptos/capital.md');
  assert.equal(despues, 'uno\r\ndos\r\ntres\r\n');
  assert.ok(!/(^|[^\r])\n/.test(despues));
}));

test('escribirNota: finales mezclados dan 422, un original distinto 409 y una ruta o texto malos 400', con({}, (c, cu) => {
  fs.writeFileSync(path.join(c.base, 'mezcla.md'), 'a\r\nb\nc\n');
  assert.throws(() => cu.escribirNota('mezcla.md', 'x', null), e => e instanceof ErrorPeticion && e.status === 422);
  assert.equal(c.leer('mezcla.md'), 'a\r\nb\nc\n');
  assert.throws(() => cu.escribirNota('tareas.md', 'x', 'otro texto'), ErrorConflicto);
  assert.throws(() => cu.escribirNota('tareas.md', 42, null), e => e instanceof ErrorPeticion && e.status === 400);
  assert.throws(() => cu.escribirNota('../fuera.md', 'x', null), ErrorPeticion);
  cu.escribirNota('tareas.md', 'sin comprobar', null);   // sin original no se comprueba
  assert.equal(c.leer('tareas.md'), 'sin comprobar');
}));

test('renderizar pinta igual que nota(): callout, fórmula e imagen relativa', con({}, (c, cu) => {
  const md = '> [!note] Aviso\n> cuerpo\n\n$$x^2 + 1$$\n\n![dibujo](img.png)\n';
  fs.mkdirSync(path.join(c.base, 'carpeta'));
  fs.writeFileSync(path.join(c.base, 'carpeta', 'n.md'), md);
  const esperado = cu.nota('carpeta/n.md').html;
  assert.ok(esperado.includes('/fichero/carpeta/img.png'));
  assert.equal(cu.renderizar(md, 'carpeta/n.md'), esperado);
  assert.equal(typeof cu.renderizar('hola', ''), 'string');
  assert.equal(typeof cu.renderizar('hola'), 'string');
}));
