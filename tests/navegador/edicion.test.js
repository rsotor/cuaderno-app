'use strict';
// Editar la nota entera (CodeMirror, public/live.js): entrar con el botón «Editar» o con E, salir con Aplicar o Esc,
// y que el fichero quede exactamente como se escribió. Sin kit: es la base de la app (AGENTS.md, principio 3).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { arrancar, hasta, visible, oculto, conTexto, ficheroCumple, hashCumple } = require('./ayuda');

let e;
test.before(async () => { e = await arrancar({ kit: false }); });
test.after(async () => { if (e) await e.cerrar(); });

// Una nota larga (en la carpeta temporal del test, nunca en ejemplos/): para que haya scroll y un bloque visible.
const larga = () => '# Nota larga\n\n' + Array.from({ length: 60 }, (_, i) => `Párrafo ${i + 1}. ${'Texto de relleno para que ocupe espacio. '.repeat(3)}`).join('\n\n') + '\n';

test('editar la nota: Editar abre el editor en el bloque visible, Aplicar escribe el fichero tal cual y vuelve a lectura', async () => {
  const antes = larga();
  fs.writeFileSync(path.join(e.c.base, 'larga.md'), antes);
  await e.ir('#/n/larga.md');
  await visible(e.pagina.locator('#nota .bloque', { hasText: 'Párrafo 60.' }), 'nota larga', 'el último párrafo');
  // Se baja hasta el párrafo 30 y se anota qué bloques están a la vista (su primera línea en el fichero).
  await e.pagina.locator('#nota .bloque', { hasText: 'Párrafo 30.' }).scrollIntoViewIfNeeded();
  const aLaVista = await e.pagina.evaluate(() => {
    const tope = document.querySelector('.miga-barra').getBoundingClientRect().bottom;
    return [...document.querySelectorAll('#nota .bloque')].filter(b => { const r = b.getBoundingClientRect(); return r.bottom > tope && r.top < innerHeight; }).map(b => +b.dataset.desde);
  });
  assert.ok(aLaVista.length >= 2, 'nota larga: debería haber varios bloques a la vista');
  await e.pagina.locator('#btn-editar').click();
  await visible(e.pagina.locator('#edicion-cm .cm-content'), 'editor', 'el editor de la nota');
  await oculto(e.pagina.locator('#btn-editar'), 'editor', 'el botón «Editar» mientras se edita');
  assert.equal(await e.pagina.locator('#edicion-cm .cm-content').getAttribute('aria-label'), 'Editor de la nota');
  assert.equal(await e.pagina.locator('#edicion-cm .cm-lineNumbers').count(), 0, 'editor: no lleva números de línea');
  assert.equal(await e.pagina.evaluate(() => document.activeElement.closest('#edicion-cm') !== null), true, 'editor: el foco no está en el editor');
  // El cursor está en la primera línea de un bloque que se estaba leyendo, y esa línea se ve.
  await e.pagina.keyboard.type('ZZ');
  const cursor = await e.pagina.evaluate(() => { const r = document.querySelector('#edicion-cm .cm-cursor').getBoundingClientRect(); return { arriba: r.top, abajo: r.bottom, alto: innerHeight }; });
  assert.ok(cursor.abajo > 0 && cursor.arriba < cursor.alto, `editor: la línea del cursor no se ve (${JSON.stringify(cursor)})`);
  await e.pagina.locator('#edicion-aplicar').click();
  await visible(e.pagina.locator('.aviso-flotante', { hasText: 'Nota escrita' }), 'editor', 'el aviso «Nota escrita»');
  await oculto(e.pagina.locator('#edicion-cm'), 'editor', 'el editor tras aplicar');
  // El fichero: una sola línea distinta, la primera de un bloque que se leía, con ZZ delante; el resto, byte a byte.
  const despues = fs.readFileSync(path.join(e.c.base, 'larga.md'), 'utf8');
  const a = antes.split('\n'), d = despues.split('\n');
  assert.equal(d.length, a.length, 'fichero: cambia el número de líneas');
  const distintas = a.map((l, i) => (l === d[i] ? -1 : i)).filter(i => i >= 0);
  assert.equal(distintas.length, 1, `fichero: cambian ${distintas.length} líneas`);
  assert.equal(d[distintas[0]], 'ZZ' + a[distintas[0]]);
  assert.ok(aLaVista.includes(distintas[0]), `fichero: el cursor estaba en la línea ${distintas[0] + 1}, que no era el principio de un bloque a la vista (${aLaVista.join(', ')})`);
  // Vuelta a lectura: la nota repintada con el cambio, el foco en «Editar» y el mismo bloque a la vista.
  await conTexto(e.pagina.locator('#nota'), /ZZPárrafo/, 'nota larga', 'el cambio en la lectura');
  await hasta(() => e.pagina.evaluate(() => document.activeElement.id === 'btn-editar'), 'nota larga', 'el foco no vuelve al botón «Editar»');
  const bloqueVisible = await e.pagina.evaluate(() => { const b = [...document.querySelectorAll('#nota .bloque')].find(x => x.textContent.includes('ZZPárrafo')); const r = b.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
  assert.equal(bloqueVisible, true, 'lectura: el bloque editado no está a la vista al volver');
});

test('editar con el teclado: e entra, Esc sale sin escribir, Ctrl/⌘ Enter aplica y el foco vuelve a Editar', async () => {
  await e.ir('#/n/conceptos/capital.md');
  const fichero = () => fs.readFileSync(path.join(e.c.base, 'conceptos/capital.md'), 'utf8');
  const original = fichero();
  await e.pagina.locator('#nota .bloque').first().focus();
  await e.pagina.keyboard.press('e');
  await visible(e.pagina.locator('#edicion-cm .cm-content'), 'teclado', 'el editor con la tecla E');
  await e.pagina.keyboard.type('eee');   // dentro del editor, la «e» es una letra más, no entra ni sale
  await e.pagina.keyboard.press('Escape');
  await visible(e.pagina.locator('#descartar'), 'teclado', '«¿Descartar lo escrito?» con Esc y cambios');
  await e.pagina.locator('#descartar-ok').click();
  await oculto(e.pagina.locator('#edicion-cm'), 'teclado', 'el editor tras descartar');
  assert.equal(await e.pagina.evaluate(() => document.activeElement.id), 'btn-editar', 'teclado: el foco no vuelve a «Editar»');
  assert.equal(fichero(), original, 'teclado: Esc ha escrito en el fichero');
  // Con el foco en «Editar», Enter entra también (es un botón) y Ctrl/⌘ Enter aplica.
  await e.pagina.keyboard.press('Enter');
  await visible(e.pagina.locator('#edicion-cm .cm-content'), 'teclado', 'el editor con Enter sobre el botón');
  await e.pagina.keyboard.type('Hola. ');
  await e.pagina.keyboard.press('ControlOrMeta+Enter');
  await ficheroCumple(e.c, 'conceptos/capital.md', /^Hola\. # Capital\n/, 'teclado');
  await oculto(e.pagina.locator('#edicion-cm'), 'teclado', 'el editor tras Ctrl Enter');
  assert.equal(await e.pagina.evaluate(() => document.activeElement.id), 'btn-editar', 'teclado: tras aplicar, el foco no vuelve a «Editar»');
  assert.equal((fichero().match(/\n\n/g) || []).length, (original.match(/\n\n/g) || []).length, 'teclado: Ctrl Enter ha metido una línea en blanco');
});

test('editar: el botón solo está en las notas; E no hace nada fuera de ellas ni dentro de un campo de texto', async () => {
  await e.ir('#/tareas');
  await oculto(e.pagina.locator('#btn-editar'), 'tareas', 'el botón «Editar» en el panel de Tareas');
  await e.pagina.keyboard.press('e');
  assert.equal(await e.pagina.locator('#edicion-cm').count(), 0, 'tareas: E ha abierto un editor');
  await e.ir('#/n/conceptos/capital.md');
  await visible(e.pagina.locator('#btn-editar'), 'nota', 'el botón «Editar» en una nota');
  await e.pagina.locator('#buscador').focus();
  await e.pagina.keyboard.type('e');
  assert.equal(await e.pagina.locator('#edicion-cm').count(), 0, 'buscador: teclear una «e» ha abierto el editor');
  assert.equal(await e.pagina.locator('#buscador').inputValue(), 'e');
});

test('ajuste «Editor»: con vista o Markdown plano se guarda con los demás ajustes y el editor abre igual', async () => {
  await e.ir('#/n/conceptos/capital.md');
  await e.pagina.click('#btn-ajustes');
  await e.pagina.selectOption('#ajustes-editor', 'plano');
  await hasta(() => e.pagina.evaluate(() => fetch('/api/info').then(r => r.json()).then(i => i.configuracion.editor === 'plano')), 'ajustes', 'el ajuste «Editor» no se guarda como «plano»');
  await e.pagina.keyboard.press('Escape');
  await e.pagina.reload();
  await e.pagina.click('#btn-ajustes');
  assert.equal(await e.pagina.locator('#ajustes-editor').inputValue(), 'plano', 'ajustes: el valor no sobrevive a recargar');
  await e.pagina.keyboard.press('Escape');
  await e.pagina.locator('#btn-editar').click();
  await visible(e.pagina.locator('#edicion-cm .cm-content'), 'editor', 'el editor en modo plano');
  await e.pagina.keyboard.press('Escape');
});

// ---------- live preview (lo inline): el editor «con vista» pinta la nota y enseña el Markdown crudo solo donde está el cursor
const VIVA = '# Título de la nota\n\nUn párrafo con **negrita**, *cursiva*, ~~tachado~~, `código`, [un enlace](https://example.com), [[interes|el interés]] y #etiqueta.\n\n- Una viñeta\n\n> Una cita\n\n- [ ] Una casilla\n- [x] Otra hecha\n';
const ajustarEditor = async (valor, ruta) => {
  await e.ir('#/');
  await e.pagina.evaluate(v => fetch('/api/configuracion', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ editor: v }) }), valor);
  await e.ir(`#/n/${ruta}`);
};
const lineaCm = n => e.pagina.locator('#edicion-cm .cm-line').nth(n);
const textoLinea = n => lineaCm(n).evaluate(l => l.textContent);
const tamano = loc => loc.evaluate(l => parseFloat(getComputedStyle(l).fontSize));
const aBlanco = async () => { await e.pagina.keyboard.press('Escape'); };

test('live preview: los marcadores solo se ven en la línea del cursor y un título se pinta como título', async () => {
  fs.writeFileSync(path.join(e.c.base, 'viva.md'), VIVA);
  await ajustarEditor('vista', 'viva.md');
  await e.pagina.locator('#btn-editar').click();
  await visible(e.pagina.locator('#edicion-cm .cm-content'), 'live', 'el editor de la nota');
  // El cursor empieza en el título (arriba del todo): su «#» se ve, y solo esa línea está marcada como activa.
  assert.equal(await textoLinea(0), '# Título de la nota', 'live: con el cursor en el título, el «#» debe verse');
  assert.equal(await e.pagina.locator('#edicion-cm .live-activa').count(), 1, 'live: debe haber una sola línea activa');
  // Dos líneas más abajo, en el párrafo: el título pierde el «#» y los marcadores del párrafo se ven.
  await e.pagina.keyboard.press('ArrowDown'); await e.pagina.keyboard.press('ArrowDown');
  assert.equal(await textoLinea(0), 'Título de la nota', 'live: con el cursor en otra línea, el «#» no debe estar en el DOM');
  const crudo = await textoLinea(2);
  for (const m of ['**negrita**', '*cursiva*', '~~tachado~~', '`código`', '[un enlace](https://example.com)', '[[interes|el interés]]']) assert.ok(crudo.includes(m), `live: en la línea del cursor falta ${m}: «${crudo}»`);
  // Fuera de esa línea, el párrafo se lee sin marcadores.
  await e.pagina.keyboard.press('ArrowDown'); await e.pagina.keyboard.press('ArrowDown');
  assert.equal(await textoLinea(2), 'Un párrafo con negrita, cursiva, tachado, código, un enlace, el interés y #etiqueta.', 'live: el párrafo con el cursor fuera aún enseña marcadores');
  // El título es un título: más grande que el párrafo, en negrita; la negrita, cursiva y tachado se pintan; enlaces y etiquetas se distinguen.
  assert.ok(await tamano(lineaCm(0)) > await tamano(lineaCm(2)) + 8, 'live: el título no es más grande que el párrafo');
  const estilos = await lineaCm(2).evaluate(l => {
    const de = c => { const x = l.querySelector(c); return x ? getComputedStyle(x) : null; };
    return { negrita: de('.live-negrita')?.fontWeight, cursiva: de('.live-cursiva')?.fontStyle, tachado: de('.live-tachado')?.textDecorationLine, enlace: de('.live-enlace')?.color, wiki: de('.live-wiki')?.color, etiqueta: de('.live-etiqueta')?.color, texto: getComputedStyle(l).color };
  });
  assert.ok(+estilos.negrita >= 600, `live: negrita ${estilos.negrita}`);
  assert.equal(estilos.cursiva, 'italic'); assert.match(estilos.tachado, /line-through/);
  assert.notEqual(estilos.enlace, estilos.texto, 'live: el enlace no se distingue del texto');
  assert.equal(estilos.wiki, estilos.enlace, 'live: el wikilink no tiene el color de los enlaces');
  assert.equal(estilos.etiqueta, estilos.enlace, 'live: la etiqueta no tiene el color de acento');
  // La viñeta y la cita: sin «-» ni «>» crudos fuera de su línea.
  assert.ok(!(await textoLinea(4)).includes('- '), 'live: la viñeta enseña el «-»'); assert.equal(await textoLinea(6), 'Una cita');
  // Al volver al título, el «#» vuelve.
  for (let i = 0; i < 4; i++) await e.pagina.keyboard.press('ArrowUp');
  assert.equal(await textoLinea(0), '# Título de la nota', 'live: al volver al título, el «#» no reaparece');
  await aBlanco();
});

test('live preview: marcar una casilla desde el editor cambia el texto y Aplicar deja solo esa línea cambiada', async () => {
  const antes = '# Casillas\n\n- [ ] Primera\n- [x] Segunda\n- [ ] Tercera\n';
  fs.writeFileSync(path.join(e.c.base, 'casillas.md'), antes);
  await ajustarEditor('vista', 'casillas.md');
  await e.pagina.locator('#btn-editar').click();
  await visible(e.pagina.locator('#edicion-cm .live-casilla').first(), 'live', 'las casillas del editor');
  assert.equal(await e.pagina.locator('#edicion-cm .live-casilla').count(), 3);
  assert.deepEqual(await e.pagina.locator('#edicion-cm .live-casilla').evaluateAll(l => l.map(i => i.checked)), [false, true, false]);
  await e.pagina.locator('#edicion-cm .live-casilla').nth(2).click();
  assert.deepEqual(await e.pagina.locator('#edicion-cm .live-casilla').evaluateAll(l => l.map(i => i.checked)), [false, true, true], 'live: el clic no marca la casilla en el editor');
  assert.equal(fs.readFileSync(path.join(e.c.base, 'casillas.md'), 'utf8'), antes, 'live: marcar en el editor escribe el fichero antes de aplicar');
  await e.pagina.locator('#edicion-aplicar').click();
  await oculto(e.pagina.locator('#edicion-cm'), 'live', 'el editor tras aplicar');
  const a = antes.split('\n'), d = fs.readFileSync(path.join(e.c.base, 'casillas.md'), 'utf8').split('\n');
  assert.equal(d.length, a.length);
  const distintas = a.map((l, i) => (l === d[i] ? -1 : i)).filter(i => i >= 0);
  assert.deepEqual(distintas, [4], `fichero: cambian las líneas ${distintas}`);
  assert.equal(d[4], '- [x] Tercera');
});

test('Markdown plano: con el ajuste, el editor enseña los marcadores siempre', async () => {
  fs.writeFileSync(path.join(e.c.base, 'viva.md'), VIVA);
  await ajustarEditor('plano', 'viva.md');
  try {
    await e.pagina.locator('#btn-editar').click();
    await visible(e.pagina.locator('#edicion-cm .cm-content'), 'plano', 'el editor de la nota');
    await e.pagina.keyboard.press('ArrowDown'); await e.pagina.keyboard.press('ArrowDown'); await e.pagina.keyboard.press('ArrowDown'); await e.pagina.keyboard.press('ArrowDown');
    assert.equal(await textoLinea(0), '# Título de la nota', 'plano: el «#» debe verse con el cursor en otra línea');
    assert.ok((await textoLinea(2)).includes('**negrita**') && (await textoLinea(2)).includes('[[interes|el interés]]'), 'plano: faltan marcadores en el párrafo');
    assert.equal(await textoLinea(8), '- [ ] Una casilla', 'plano: la casilla debe verse como texto');
    for (const c of ['.live-activa', '.live-casilla', '.live-negrita', '.live-h1']) assert.equal(await e.pagina.locator(`#edicion-cm ${c}`).count(), 0, `plano: no debe haber ${c}`);
    assert.ok(Math.abs(await tamano(lineaCm(0)) - await tamano(lineaCm(2))) < 0.5, 'plano: el título no debe ser más grande');
    await aBlanco();
  } finally { await ajustarEditor('vista', 'viva.md'); }
});

// ---------- live preview (bloques): fórmula, callout, tabla, código y las propiedades se pintan como widget
const BLOQUES = [
  '# Bloques', '',
  '$$', 'A = C \\left(1 + \\frac{r}{n}\\right)^{nt}', '$$', '',
  '> [!note] Una nota', '> Un callout de tipo nota.', '',
  '> [!tip]- Plegado', '> Un consejo que empieza plegado.', '',
  '| Concepto | Valor |', '|---|---|', '| Capital | 1000 |', '| Interés | 3 % |', '',
  '```js', 'const ahorro = ingresos => ingresos * 0.2;', '```', '',
  'Párrafo final, debajo de todos los bloques.', '',
].join('\n');

test('widgets: fórmula, callout y tabla se ven pintados y el cursor dentro enseña el crudo', async () => {
  fs.writeFileSync(path.join(e.c.base, 'bloques.md'), BLOQUES);
  await ajustarEditor('vista', 'bloques.md');
  await e.pagina.locator('#btn-editar').click();
  await visible(e.pagina.locator('#edicion-cm .live-formula .katex'), 'widgets', 'la fórmula pintada');
  await visible(e.pagina.locator('#edicion-cm .live-callout .callout'), 'widgets', 'el callout pintado');
  await visible(e.pagina.locator('#edicion-cm .live-tabla table'), 'widgets', 'la tabla pintada');
  await visible(e.pagina.locator('#edicion-cm .live-codigo pre'), 'widgets', 'el bloque de código pintado');
  const crudo = () => e.pagina.locator('#edicion-cm .cm-line').allTextContents().then(l => l.join('\n'));
  let texto = await crudo();
  for (const c of ['\\frac', '[!note]', '|---|', '```js']) assert.ok(!texto.includes(c), `widgets: el crudo «${c}» se ve con el cursor fuera`);
  // El callout plegado se abre al clic en su título, sin entrar en el crudo.
  const plegado = e.pagina.locator('#edicion-cm .live-callout .callout.plegado');
  await visible(plegado, 'widgets', 'el callout que empieza plegado');
  await plegado.locator('.callout-titulo').click();
  await oculto(e.pagina.locator('#edicion-cm .callout.plegado'), 'widgets', 'el callout plegado tras el clic en su título');
  assert.equal(await e.pagina.locator('#edicion-cm .live-callout').count(), 2, 'widgets: abrir un callout lo ha convertido en crudo');
  // Clic dentro de la tabla: el cursor entra, la tabla se ve en crudo y los demás bloques siguen pintados.
  await e.pagina.locator('#edicion-cm .live-tabla').click();
  await hasta(async () => (await crudo()).includes('| Concepto | Valor |'), 'widgets', 'con el cursor en la tabla no se ve su Markdown');
  assert.equal(await e.pagina.locator('#edicion-cm .live-tabla').count(), 0, 'widgets: la tabla con el cursor dentro sigue pintada');
  await visible(e.pagina.locator('#edicion-cm .live-formula .katex'), 'widgets', 'la fórmula sigue pintada');
  // Fuera otra vez: el cursor va al párrafo final y la tabla vuelve a pintarse.
  await lineaCmTexto('Párrafo final').click();
  await visible(e.pagina.locator('#edicion-cm .live-tabla table'), 'widgets', 'la tabla pintada al salir el cursor');
  await aBlanco();
});

const lineaCmTexto = t => e.pagina.locator('#edicion-cm .cm-line', { hasText: t });

test('clic bajo una tabla: el cursor cae en el párrafo pulsado', async () => {
  fs.writeFileSync(path.join(e.c.base, 'bloques.md'), BLOQUES + '\nOtro párrafo, el último de la nota.\n');
  await ajustarEditor('vista', 'bloques.md');
  await e.pagina.locator('#btn-editar').click();
  await visible(e.pagina.locator('#edicion-cm .live-tabla table'), 'clic', 'la tabla pintada');
  await visible(e.pagina.locator('#edicion-cm .live-formula .katex'), 'clic', 'la fórmula pintada');
  // Se espera a que las alturas de los widgets se asienten (KaTeX, fuentes) antes de pulsar.
  let alto = -1;
  await hasta(async () => { const a = await e.pagina.evaluate(() => document.querySelector('#edicion-cm .cm-content').getBoundingClientRect().height); const igual = a === alto; alto = a; return igual; }, 'clic', 'la altura del editor no se asienta');
  for (const t of ['Párrafo final', 'Otro párrafo']) {
    await lineaCmTexto(t).click({ position: { x: 20, y: 6 } });
    await hasta(async () => (await e.pagina.locator('#edicion-cm .live-activa').allTextContents()).join('').includes(t), 'clic', `el cursor no ha caído en el párrafo «${t}»; la línea activa es «${await e.pagina.locator('#edicion-cm .live-activa').allTextContents()}»`);
  }
  await aBlanco();
});

const FM = '---\ntitulo: Presupuesto de octubre\netiquetas:\n  - presupuesto\n  - mensual\nrevisado: true\n---\n';

test('propiedades: se ven como tabla, Ctrl+Inicio deja el cursor en la primera línea del cuerpo y escribir no las cambia', async () => {
  const antes = FM + '# Propiedades\n\nUn párrafo.\n';
  fs.writeFileSync(path.join(e.c.base, 'props.md'), antes);
  await ajustarEditor('vista', 'props.md');
  await e.pagina.locator('#btn-editar').click();
  await visible(e.pagina.locator('#edicion-cm dl.propiedades'), 'propiedades', 'la tabla de propiedades en el editor');
  await conTexto(e.pagina.locator('#edicion-cm dl.propiedades'), /titulo.*Presupuesto de octubre/, 'propiedades', 'el título del frontmatter');
  await visible(e.pagina.locator('#edicion-cm dl.propiedades .etiqueta', { hasText: 'mensual' }), 'propiedades', 'las etiquetas como en lectura');
  assert.ok(!(await e.pagina.locator('#edicion-cm .cm-content').textContent()).includes('titulo:'), 'propiedades: el frontmatter crudo está en el editor');
  // Con las propiedades delante, el resto de la nota se pinta igual: el título pierde el «#» al bajar el cursor.
  await e.pagina.keyboard.press('ArrowDown'); await e.pagina.keyboard.press('ArrowDown');
  await hasta(async () => (await e.pagina.locator('#edicion-cm .live-h1').textContent()) === 'Propiedades', 'propiedades', 'el título no se pinta como título con el frontmatter delante');
  // El cursor no puede estar en las propiedades: Ctrl+Inicio y escribir ponen la letra al principio del cuerpo.
  await e.pagina.keyboard.press('ControlOrMeta+Home');
  await e.pagina.keyboard.type('X');
  await e.pagina.keyboard.press('Backspace'); await e.pagina.keyboard.press('Backspace');   // el segundo no puede comerse el frontmatter
  await e.pagina.keyboard.type('X');
  await e.pagina.keyboard.press('ControlOrMeta+a');
  await e.pagina.keyboard.type('Cuerpo nuevo');
  await e.pagina.locator('#edicion-aplicar').click();
  await oculto(e.pagina.locator('#edicion-cm'), 'propiedades', 'el editor tras aplicar');
  assert.equal(fs.readFileSync(path.join(e.c.base, 'props.md'), 'utf8'), FM + 'Cuerpo nuevo', 'propiedades: el frontmatter debe quedar byte a byte y el cuerpo, lo escrito');
});

test('examen del ejemplo: abrir el editor, Aplicar sin tocar, el fichero no cambia', async () => {
  const fichero = path.join(e.c.base, 'examenes/01-examen.md');
  const antes = fs.readFileSync(fichero, 'utf8');
  await ajustarEditor('vista', 'examenes/01-examen.md');
  await e.pagina.locator('#btn-editar').click();
  await visible(e.pagina.locator('#edicion-cm dl.propiedades'), 'examen', 'las propiedades del examen como tabla');
  await visible(e.pagina.locator('#edicion-cm .cm-line', { hasText: 'Tienes 100' }), 'examen', 'el texto de la primera pregunta');
  assert.equal(await e.pagina.locator('#edicion-aplicar').isDisabled(), true, 'examen: Aplicar debe estar desactivado sin cambios');
  await e.pagina.keyboard.press('ControlOrMeta+Enter');   // Ctrl Enter sin cambios sale sin escribir
  await oculto(e.pagina.locator('#edicion-cm'), 'examen', 'el editor tras aplicar sin tocar');
  assert.equal(fs.readFileSync(fichero, 'utf8'), antes, 'examen: Aplicar sin tocar ha cambiado el fichero');
  // Y con una edición que se deshace (escribir y borrar), igual: el texto manda y el frontmatter no se toca.
  await e.pagina.locator('#btn-editar').click();
  await visible(e.pagina.locator('#edicion-cm dl.propiedades'), 'examen', 'las propiedades del examen la segunda vez');
  await e.pagina.keyboard.press('ControlOrMeta+Home'); await e.pagina.keyboard.type('X'); await e.pagina.keyboard.press('Backspace');
  await e.pagina.keyboard.press('ControlOrMeta+Enter');
  await oculto(e.pagina.locator('#edicion-cm'), 'examen', 'el editor tras Ctrl Enter');
  assert.equal(fs.readFileSync(fichero, 'utf8'), antes, 'examen: escribir y borrar ha cambiado el fichero');
  await conTexto(e.pagina.locator('#nota'), /Examen · Módulo 1/, 'examen', 'el examen otra vez en su vista de formulario');
});

// ---------- lo escrito no se pierde: sin aplicar, descartar, navegar, cambios en el disco y conflicto al aplicar
const cuerpoCm = () => e.pagina.locator('#edicion-cm .cm-line').allTextContents().then(l => l.join('\n'));
const salirDescartando = async () => {   // deja el editor cerrado sin dejar cambios que bloqueen la siguiente recarga
  await e.pagina.keyboard.press('Escape');
  if (await e.pagina.locator('#descartar').isVisible()) await e.pagina.locator('#descartar-ok').click();
  await oculto(e.pagina.locator('#edicion-cm'), 'salir', 'el editor cerrado');
};

test('sin aplicar: Aplicar se activa solo con cambios, la miga dice «Editando» y escribir y borrar lo vuelve a desactivar', async () => {
  fs.writeFileSync(path.join(e.c.base, 'estado.md'), '# Estado\n\nUn párrafo.\n');
  await e.ir('#/n/estado.md');
  await e.pagina.locator('#btn-editar').click();
  await visible(e.pagina.locator('#edicion-cm .cm-content'), 'estado', 'el editor');
  assert.equal(await e.pagina.locator('#edicion-aplicar').isDisabled(), true, 'estado: Aplicar debe empezar desactivado');
  await oculto(e.pagina.locator('#editando'), 'estado', 'la señal «Editando» sin cambios');
  await e.pagina.keyboard.type('x');
  assert.equal(await e.pagina.locator('#edicion-aplicar').isDisabled(), false, 'estado: Aplicar debe activarse con un cambio');
  await conTexto(e.pagina.locator('#editando'), /Editando/, 'estado', 'la señal «Editando» con cambios');
  assert.match(await e.pagina.locator('#editando-aviso[role="status"]').textContent(), /Editando.*sin aplicar/, 'estado: el lector de pantalla no recibe «Editando» (región status)');
  await e.pagina.keyboard.press('Backspace');
  assert.equal(await e.pagina.locator('#edicion-aplicar').isDisabled(), true, 'estado: escribir y borrar debe desactivar Aplicar otra vez');
  await oculto(e.pagina.locator('#editando'), 'estado', 'la señal «Editando» tras deshacer el cambio');
  assert.equal(await e.pagina.locator('#editando-aviso').textContent(), '', 'estado: el aviso para lector de pantalla se queda tras deshacer');
  // La señal de salida: el evento beforeunload solo se frena con cambios.
  const frena = () => e.pagina.evaluate(() => { const ev = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(ev); return ev.defaultPrevented; });
  assert.equal(await frena(), false, 'estado: beforeunload frena sin cambios');
  await e.pagina.keyboard.type('x');
  assert.equal(await frena(), true, 'estado: beforeunload no frena con cambios');
  await salirDescartando();
  assert.equal(await frena(), false, 'estado: beforeunload frena tras salir');
});

test('descartar: Esc con cambios pregunta, sin cambios sale', async () => {
  fs.writeFileSync(path.join(e.c.base, 'descartar.md'), '# Descartar\n\nUn párrafo.\n');
  await e.ir('#/n/descartar.md');
  await e.pagina.locator('#btn-editar').click();
  await visible(e.pagina.locator('#edicion-cm .cm-content'), 'descartar', 'el editor');
  await e.pagina.keyboard.press('Escape');   // sin cambios: sale directo
  await oculto(e.pagina.locator('#edicion-cm'), 'descartar', 'el editor sin cambios tras Esc');
  assert.equal(await e.pagina.locator('#descartar').isVisible(), false, 'descartar: pregunta sin cambios');
  await e.pagina.locator('#btn-editar').click();
  await visible(e.pagina.locator('#edicion-cm .cm-content'), 'descartar', 'el editor otra vez');
  await e.pagina.keyboard.type('ZZ');
  await e.pagina.keyboard.press('Escape');
  await visible(e.pagina.locator('#descartar'), 'descartar', '«¿Descartar lo escrito?»');
  assert.equal(await e.pagina.evaluate(() => document.querySelector('#app').inert), true, 'descartar: lo de detrás no está inerte');
  // Seguir editando: el editor sigue con lo escrito y el foco vuelve a él.
  await e.pagina.locator('#descartar-seguir').click();
  await oculto(e.pagina.locator('#descartar'), 'descartar', 'el diálogo tras «Seguir editando»');
  assert.ok((await cuerpoCm()).includes('ZZ# Descartar'), 'descartar: «Seguir editando» ha perdido lo escrito');
  assert.equal(await e.pagina.evaluate(() => !!document.activeElement.closest('#edicion-cm')), true, 'descartar: el foco no vuelve al editor');
  // Cancelar pregunta igual; Descartar sale sin escribir.
  await e.pagina.locator('#edicion-cancelar').click();
  await visible(e.pagina.locator('#descartar'), 'descartar', 'el diálogo con Cancelar');
  await e.pagina.locator('#descartar-ok').click();
  await oculto(e.pagina.locator('#edicion-cm'), 'descartar', 'el editor tras descartar');
  assert.equal(fs.readFileSync(path.join(e.c.base, 'descartar.md'), 'utf8'), '# Descartar\n\nUn párrafo.\n', 'descartar: ha escrito el fichero');
  assert.equal(await e.pagina.evaluate(() => document.activeElement.id), 'btn-editar', 'descartar: el foco no vuelve a «Editar»');
});

test('navegar con cambios pregunta: Seguir editando deja el editor y la ruta; Descartar navega', async () => {
  await e.ir('#/n/conceptos/capital.md');
  await e.pagina.locator('#btn-editar').click();
  await visible(e.pagina.locator('#edicion-cm .cm-content'), 'navegar', 'el editor');
  await e.pagina.keyboard.type('ZZ');
  const otra = e.pagina.locator('#arbol a.hoja[data-ruta="conceptos/interes.md"]');
  if (!(await otra.isVisible())) await e.pagina.locator('#arbol summary', { hasText: 'conceptos' }).click();
  await otra.click();
  await visible(e.pagina.locator('#descartar'), 'navegar', '«¿Descartar lo escrito?» al clicar otra nota');
  await e.pagina.locator('#descartar-seguir').click();
  await hashCumple(e.pagina, /^#\/n\/conceptos\/capital\.md/, 'navegar');
  assert.ok((await cuerpoCm()).includes('ZZ'), 'navegar: «Seguir editando» ha perdido lo escrito');
  assert.equal(await e.pagina.locator('#arbol a.hoja.activa').getAttribute('data-ruta'), 'conceptos/capital.md', 'navegar: el árbol marca otra nota');
  // Otra pantalla (Tareas) también pregunta; Descartar navega y el fichero no cambia.
  await e.pagina.locator('a[data-pagina="tareas"]').click();
  await visible(e.pagina.locator('#descartar'), 'navegar', 'el diálogo al ir a Tareas');
  await e.pagina.locator('#descartar-ok').click();
  await hashCumple(e.pagina, /^#\/tareas/, 'navegar');
  await oculto(e.pagina.locator('#edicion-cm'), 'navegar', 'el editor tras descartar');
  assert.ok(!fs.readFileSync(path.join(e.c.base, 'conceptos/capital.md'), 'utf8').includes('ZZ'), 'navegar: ha escrito el fichero');
});

test('conflicto: cambiar el fichero desde fuera con el editor abierto no borra lo escrito; Sobrescribir lo escribe', async () => {
  const ruta = path.join(e.c.base, 'conflicto.md');
  fs.writeFileSync(ruta, '# Conflicto\n\nUn párrafo.\n');
  await e.ir('#/n/conflicto.md');
  await e.pagina.locator('#btn-editar').click();
  await visible(e.pagina.locator('#edicion-cm .cm-content'), 'conflicto', 'el editor');
  await e.pagina.keyboard.type('ZZ');
  fs.writeFileSync(ruta, '# Conflicto\n\nOtro texto, escrito desde fuera.\n');
  await conTexto(e.pagina.locator('#franja-edicion'), /La nota cambió en el disco/, 'conflicto', 'la franja de cambio en el disco');
  assert.ok((await cuerpoCm()).includes('ZZ# Conflicto'), 'conflicto: la recarga en vivo ha repintado el editor y ha perdido lo escrito');
  // «Seguir editando» la cierra; Aplicar da 409 y la franja pasa a ofrecer Sobrescribir.
  await e.pagina.locator('#franja-seguir').click();
  await oculto(e.pagina.locator('#franja-edicion'), 'conflicto', 'la franja tras «Seguir editando»');
  await e.pagina.locator('#edicion-aplicar').click();
  await visible(e.pagina.locator('#franja-sobrescribir'), 'conflicto', '«Sobrescribir» tras el 409');
  assert.ok((await cuerpoCm()).includes('ZZ# Conflicto'), 'conflicto: el 409 ha recargado la nota y perdido lo escrito');
  assert.match(fs.readFileSync(ruta, 'utf8'), /desde fuera/, 'conflicto: el 409 ha escrito el fichero');
  await e.pagina.locator('#franja-sobrescribir').click();
  await oculto(e.pagina.locator('#edicion-cm'), 'conflicto', 'el editor tras sobrescribir');
  assert.equal(fs.readFileSync(ruta, 'utf8'), 'ZZ# Conflicto\n\nUn párrafo.\n', 'conflicto: Sobrescribir no ha escrito lo del editor');
});

test('conflicto: «Copiar mi texto y recargar» copia lo escrito y enseña la nota del disco; «Recargar» descarta', async () => {
  const ruta = path.join(e.c.base, 'conflicto2.md');
  fs.writeFileSync(ruta, '# Conflicto dos\n\nUn párrafo.\n');
  await e.ir('#/n/conflicto2.md');
  await e.pagina.evaluate(() => { window.__copiado = null; Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { window.__copiado = t; return Promise.resolve(); } }, configurable: true }); });
  await e.pagina.locator('#btn-editar').click();
  await visible(e.pagina.locator('#edicion-cm .cm-content'), 'conflicto', 'el editor');
  await e.pagina.keyboard.type('ZZ');
  fs.writeFileSync(ruta, '# Conflicto dos\n\nDel disco.\n');
  await e.pagina.locator('#edicion-aplicar').click();   // 409 directo, sin esperar a la franja del disco
  await visible(e.pagina.locator('#franja-copiar'), 'conflicto', '«Copiar mi texto y recargar»');
  await e.pagina.locator('#franja-copiar').click();
  await oculto(e.pagina.locator('#edicion-cm'), 'conflicto', 'el editor tras copiar y recargar');
  assert.equal(await e.pagina.evaluate(() => window.__copiado), 'ZZ# Conflicto dos\n\nUn párrafo.\n', 'conflicto: no ha copiado lo escrito');
  await conTexto(e.pagina.locator('#nota'), /Del disco\./, 'conflicto', 'la nota del disco tras recargar');
  // «Recargar (pierdes lo escrito)» de la franja del disco.
  await e.pagina.locator('#btn-editar').click();
  await visible(e.pagina.locator('#edicion-cm .cm-content'), 'conflicto', 'el editor otra vez');
  await e.pagina.keyboard.type('YY');
  fs.writeFileSync(ruta, '# Conflicto dos\n\nOtra vez del disco.\n');
  await visible(e.pagina.locator('#franja-recargar'), 'conflicto', '«Recargar» en la franja del disco');
  await e.pagina.locator('#franja-recargar').click();
  await oculto(e.pagina.locator('#edicion-cm'), 'conflicto', 'el editor tras recargar');
  await conTexto(e.pagina.locator('#nota'), /Otra vez del disco\./, 'conflicto', 'la nota del disco tras recargar');
});

test('otra nota cambia en el disco mientras editas: ninguna franja', async () => {
  fs.writeFileSync(path.join(e.c.base, 'propia.md'), '# Propia\n\nUn párrafo.\n');
  await e.ir('#/n/propia.md');
  await e.pagina.locator('#btn-editar').click();
  await visible(e.pagina.locator('#edicion-cm .cm-content'), 'otra nota', 'el editor');
  await e.pagina.keyboard.type('ZZ');
  fs.writeFileSync(path.join(e.c.base, 'ajena.md'), '# Ajena\n\nCambia mientras editas otra.\n');
  await e.pagina.waitForTimeout(2000);   // el vigilante de ficheros avisa con retraso: que el mensaje ya haya llegado
  assert.equal(await e.pagina.locator('#franja-edicion').isVisible(), false, 'otra nota: franja sin que cambie la nota editada');
  assert.ok((await cuerpoCm()).includes('ZZ# Propia'), 'otra nota: el editor ha perdido lo escrito');
  // Un cambio en la propia nota que solo cambia los finales de línea (CRLF) no cuenta como cambio.
  fs.writeFileSync(path.join(e.c.base, 'propia.md'), '# Propia\r\n\r\nUn párrafo.\r\n');
  await e.pagina.waitForTimeout(2000);
  assert.equal(await e.pagina.locator('#franja-edicion').isVisible(), false, 'otra nota: franja por un cambio solo de finales de línea');
  await salirDescartando();
});

// ---------- barra de formato y atajos
const textoEditor = () => e.pagina.evaluate(async () => (await import('/public/live.js')).texto());
const boton = n => e.pagina.locator(`.edicion-barra [data-formato="${n}"]`);
const FORMATO = '# Formato\n\nUna frase con palabra para negrita.\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\nOtro párrafo.\n';
// Pone el cursor al principio de la línea que contiene `t` y selecciona `n` letras tras `desde` letras.
const seleccionar = async (t, desde, n) => {
  await lineaCmTexto(t).click({ position: { x: 5, y: 6 } });
  await e.pagina.keyboard.press('Home');
  for (let i = 0; i < desde; i++) await e.pagina.keyboard.press('ArrowRight');
  for (let i = 0; i < n; i++) await e.pagina.keyboard.press('Shift+ArrowRight');
};

test('formato: Negrita rodea la selección y volver a pulsar la quita; Ctrl Z lo deshace con un widget en la nota', async () => {
  const ruta = path.join(e.c.base, 'formato.md');
  fs.writeFileSync(ruta, FORMATO);
  await ajustarEditor('vista', 'formato.md');
  await e.pagina.locator('#btn-editar').click();
  await visible(e.pagina.locator('#edicion-cm .live-tabla table'), 'formato', 'la tabla pintada');
  await seleccionar('Una frase', 14, 7);   // «palabra»
  await boton('negrita').click();
  assert.equal(await textoEditor(), FORMATO.replace('palabra', '**palabra**'), 'formato: Negrita no rodea la selección');
  assert.equal(await boton('negrita').getAttribute('aria-pressed'), 'true', 'formato: Negrita no sale pulsada con la selección en negrita');
  await boton('negrita').click();
  assert.equal(await textoEditor(), FORMATO, 'formato: volver a pulsar Negrita no quita los marcadores');
  assert.equal(await boton('negrita').getAttribute('aria-pressed'), 'false');
  // Ctrl Z tras aplicar un formato deshace solo el formato y la tabla sigue pintada.
  await boton('negrita').click();
  assert.equal(await textoEditor(), FORMATO.replace('palabra', '**palabra**'));
  await e.pagina.keyboard.press('ControlOrMeta+z');
  assert.equal(await textoEditor(), FORMATO, 'formato: Ctrl Z no deshace el formato');
  await visible(e.pagina.locator('#edicion-cm .live-tabla table'), 'formato', 'la tabla sigue pintada tras deshacer');
  await e.pagina.keyboard.press('ControlOrMeta+Shift+z');
  assert.equal(await textoEditor(), FORMATO.replace('palabra', '**palabra**'), 'formato: rehacer no devuelve el formato');
  await e.pagina.locator('#edicion-aplicar').click();
  await oculto(e.pagina.locator('#edicion-cm'), 'formato', 'el editor tras aplicar');
  assert.equal(fs.readFileSync(ruta, 'utf8'), FORMATO.replace('palabra', '**palabra**'), 'formato: el fichero no tiene la negrita');
});

test('formato por teclado: Ctrl/⌘ B e I rodean y quitan; sin selección dejan el cursor dentro', async () => {
  fs.writeFileSync(path.join(e.c.base, 'formato.md'), FORMATO);
  await ajustarEditor('vista', 'formato.md');
  await e.pagina.locator('#btn-editar').click();
  await visible(e.pagina.locator('#edicion-cm .cm-content'), 'teclado', 'el editor');
  await seleccionar('Una frase', 14, 7);
  await e.pagina.keyboard.press('ControlOrMeta+b');
  assert.equal(await textoEditor(), FORMATO.replace('palabra', '**palabra**'), 'teclado: Ctrl B no pone negrita');
  await e.pagina.keyboard.press('ControlOrMeta+i');
  assert.equal(await textoEditor(), FORMATO.replace('palabra', '***palabra***'), 'teclado: Ctrl I no pone cursiva sobre la negrita');
  assert.equal(await boton('cursiva').getAttribute('aria-pressed'), 'true');
  await e.pagina.keyboard.press('ControlOrMeta+i');
  assert.equal(await textoEditor(), FORMATO.replace('palabra', '**palabra**'), 'teclado: Ctrl I no quita la cursiva y deja la negrita');
  await e.pagina.keyboard.press('ControlOrMeta+b');
  assert.equal(await textoEditor(), FORMATO, 'teclado: Ctrl B no quita la negrita');
  // Sin selección: los marcadores y el cursor dentro.
  await e.pagina.keyboard.press('ArrowRight');   // colapsa la selección al final de «palabra»
  await e.pagina.keyboard.press('ControlOrMeta+b');
  await e.pagina.keyboard.type('hola');
  assert.equal(await textoEditor(), FORMATO.replace('palabra', 'palabra**hola**'), 'teclado: sin selección, Ctrl B no deja el cursor entre los marcadores');
  await salirDescartando();
});

test('barra: flechas mueven el foco entre botones, aria-pressed sigue a la selección y el clic devuelve el foco al editor', async () => {
  fs.writeFileSync(path.join(e.c.base, 'formato.md'), FORMATO.replace('palabra', '**palabra**'));
  await ajustarEditor('vista', 'formato.md');
  await e.pagina.locator('#btn-editar').click();
  await visible(e.pagina.locator('.edicion-barra[role="toolbar"]'), 'barra', 'la barra de formato');
  assert.equal(await e.pagina.locator('.edicion-barra').getAttribute('aria-label'), 'Formato');
  const botones = e.pagina.locator('.edicion-barra button');
  const nombres = await botones.evaluateAll(l => l.map(b => b.dataset.formato));
  assert.deepEqual(nombres, ['negrita', 'cursiva', 'titulo', 'lista', 'casilla', 'enlace', 'codigo']);
  for (const b of await botones.all()) { assert.ok(await b.getAttribute('aria-label'), 'barra: un botón sin aria-label'); assert.ok(await b.getAttribute('title'), 'barra: un botón sin pista'); }
  assert.match(await boton('negrita').getAttribute('title'), /(Ctrl|⌘) B/, 'barra: la pista de Negrita no dice el atajo');
  // Una sola parada de Tab (roving tabindex), flechas, Inicio y Fin.
  const parada = () => e.pagina.locator('.edicion-barra button[tabindex="0"]').evaluateAll(l => l.map(b => b.dataset.formato));
  assert.deepEqual(await parada(), ['negrita']);
  await boton('negrita').focus();
  await e.pagina.keyboard.press('ArrowRight');
  assert.equal(await e.pagina.evaluate(() => document.activeElement.dataset.formato), 'cursiva', 'barra: la flecha derecha no pasa al botón siguiente');
  assert.deepEqual(await parada(), ['cursiva'], 'barra: el tabindex no sigue al foco');
  await e.pagina.keyboard.press('End');
  assert.equal(await e.pagina.evaluate(() => document.activeElement.dataset.formato), 'codigo');
  await e.pagina.keyboard.press('ArrowRight');
  assert.equal(await e.pagina.evaluate(() => document.activeElement.dataset.formato), 'negrita', 'barra: la flecha derecha en el último no vuelve al primero');
  await e.pagina.keyboard.press('ArrowLeft');
  assert.equal(await e.pagina.evaluate(() => document.activeElement.dataset.formato), 'codigo');
  await e.pagina.keyboard.press('Home');
  assert.equal(await e.pagina.evaluate(() => document.activeElement.dataset.formato), 'negrita');
  // aria-pressed sigue a la selección: dentro de la negrita sí, en otra línea no; el título también.
  await lineaCmTexto('Una frase').click({ position: { x: 5, y: 6 } });
  await e.pagina.keyboard.press('Home'); for (let i = 0; i < 17; i++) await e.pagina.keyboard.press('ArrowRight');   // dentro de «palabra»
  await hasta(async () => (await boton('negrita').getAttribute('aria-pressed')) === 'true', 'barra', 'Negrita no sale pulsada con el cursor dentro de la negrita');
  assert.equal(await boton('cursiva').getAttribute('aria-pressed'), 'false');
  await lineaCmTexto('Otro párrafo').click({ position: { x: 5, y: 6 } });
  await hasta(async () => (await boton('negrita').getAttribute('aria-pressed')) === 'false', 'barra', 'Negrita sigue pulsada fuera de la negrita');
  await lineaCmTexto('Formato').click({ position: { x: 5, y: 6 } });
  await hasta(async () => (await boton('titulo').getAttribute('aria-pressed')) === 'true', 'barra', 'Título no sale pulsado en un título');
  // El clic en un botón devuelve el foco al editor.
  await boton('cursiva').click();
  assert.equal(await e.pagina.evaluate(() => !!document.activeElement.closest('#edicion-cm')), true, 'barra: el clic no devuelve el foco al editor');
  await salirDescartando();
  // En el modo plano también hay barra.
  await ajustarEditor('plano', 'formato.md');
  try {
    await e.pagina.locator('#btn-editar').click();
    await visible(e.pagina.locator('.edicion-barra[role="toolbar"]'), 'barra', 'la barra en el modo plano');
    await e.pagina.keyboard.press('Escape');
  } finally { await ajustarEditor('vista', 'formato.md'); }
});

test('formato: título, lista, casilla, enlace y código', async () => {
  const antes = '# T\n\nuno\ndos\n\ntexto de enlace\n\ncodigo\n';
  fs.writeFileSync(path.join(e.c.base, 'formato2.md'), antes);
  await ajustarEditor('vista', 'formato2.md');
  await e.pagina.locator('#btn-editar').click();
  await visible(e.pagina.locator('#edicion-cm .cm-content'), 'formato', 'el editor');
  // Título: pone ##, sube a ###, a ####, y quita.
  await lineaCmTexto('uno').click({ position: { x: 5, y: 6 } });
  for (const esperado of ['## uno', '### uno', '#### uno', 'uno']) { await boton('titulo').click(); assert.ok((await textoEditor()).includes(`\n${esperado}\ndos`) || (await textoEditor()).includes(`\n\n${esperado}\ndos`), `título: ${esperado}`); }
  // Lista y casilla sobre dos líneas; volver a pulsar quita.
  await lineaCmTexto('uno').click({ position: { x: 5, y: 6 } });
  await e.pagina.keyboard.press('Home'); await e.pagina.keyboard.press('Shift+ArrowDown');
  await boton('lista').click();
  assert.ok((await textoEditor()).includes('\n- uno\n- dos\n'), 'lista: no pone «- » en las dos líneas');
  assert.equal(await boton('lista').getAttribute('aria-pressed'), 'true');
  await boton('casilla').click();
  assert.ok((await textoEditor()).includes('\n- [ ] uno\n- [ ] dos\n'), 'casilla: no convierte la lista en casillas');
  await boton('casilla').click();
  assert.ok((await textoEditor()).includes('\nuno\ndos\n'), 'casilla: volver a pulsar no quita las casillas');
  await boton('lista').click(); await boton('lista').click();
  assert.ok((await textoEditor()).includes('\nuno\ndos\n'), 'lista: poner y quitar no deja el texto como estaba');
  // Enlace: rodea la selección con el cursor (seleccionada) en la url.
  await seleccionar('texto de enlace', 0, 5);
  await boton('enlace').click();
  assert.ok((await textoEditor()).includes('\n[texto](url) de enlace\n'), 'enlace: no rodea la selección');
  await e.pagina.keyboard.type('https://ejemplo.org');
  assert.ok((await textoEditor()).includes('\n[texto](https://ejemplo.org) de enlace\n'), 'enlace: la url no queda seleccionada para escribirla');
  // Código: en línea con selección; bloque con varias líneas.
  await seleccionar('codigo', 0, 6);
  await boton('codigo').click();
  assert.ok((await textoEditor()).endsWith('\n`codigo`\n'), 'código: no rodea con comillas inversas');
  await boton('codigo').click();
  assert.ok((await textoEditor()).endsWith('\ncodigo\n'), 'código: volver a pulsar no quita las comillas');
  await lineaCmTexto('uno').click({ position: { x: 5, y: 6 } });
  await e.pagina.keyboard.press('Home'); await e.pagina.keyboard.press('Shift+ArrowDown');
  await boton('codigo').click();
  assert.ok((await textoEditor()).includes('\n```\nuno\ndos\n```\n'), 'código: la selección multilínea no pasa a bloque');
  await salirDescartando();
});

test('accesibilidad: la casilla del editor se llama como su tarea y en colores forzados la barra distingue el botón pulsado', async () => {
  fs.writeFileSync(path.join(e.c.base, 'a11y.md'), '# A11y\n\n- [ ] Llamar a Ana\n- [x] Pagar el recibo\n\nUna **frase**.\n');
  await ajustarEditor('vista', 'a11y.md');
  await e.pagina.locator('#btn-editar').click();
  await visible(e.pagina.locator('#edicion-cm .live-casilla').first(), 'a11y', 'las casillas del editor');
  assert.deepEqual(await e.pagina.locator('#edicion-cm .live-casilla').evaluateAll(l => l.map(i => i.getAttribute('aria-label'))), ['Casilla: Llamar a Ana', 'Casilla: Pagar el recibo']);
  await e.pagina.emulateMedia({ forcedColors: 'active' });
  try {
    await lineaCmTexto('Una').click({ position: { x: 40, y: 6 } });
    await e.pagina.keyboard.press('Home'); for (let i = 0; i < 6; i++) await e.pagina.keyboard.press('ArrowRight');   // dentro de «frase»
    await hasta(async () => (await boton('negrita').getAttribute('aria-pressed')) === 'true', 'a11y', 'Negrita no sale pulsada');
    const estilo = b => b.evaluate(x => { const c = getComputedStyle(x); return [c.borderTopWidth, c.color, c.backgroundColor].join('|'); });
    assert.notEqual(await estilo(boton('negrita')), await estilo(boton('cursiva')), 'forced-colors: el botón pulsado se ve igual que el que no lo está');
  } finally { await e.pagina.emulateMedia({ forcedColors: 'none' }); }
  await salirDescartando();
});

test('feedback de uso: las barras con fondo translúcido y sombra, el marco de foco en la hoja y la línea activa sin fondo', async () => {
  fs.writeFileSync(path.join(e.c.base, 'feedback.md'), '# Feedback\n\n' + Array.from({ length: 40 }, (_, i) => `Párrafo ${i + 1} con texto.`).join('\n\n') + '\n');
  await ajustarEditor('vista', 'feedback.md');
  await e.pagina.locator('#btn-editar').click();
  await visible(e.pagina.locator('#edicion-cm .cm-content'), 'feedback', 'el editor');
  const e1 = await e.pagina.evaluate(() => {
    const est = q => { const c = getComputedStyle(document.querySelector(q)); return { fondo: c.backgroundColor, difuminado: c.backdropFilter, sombra: c.boxShadow }; };
    const hoja = getComputedStyle(document.querySelector('#nota')), cm = getComputedStyle(document.querySelector('.cm-editor'));
    return { barra: est('.edicion-barra'), pie: est('.edicion-pie'), hojaContorno: hoja.outlineStyle, cmContorno: cm.outlineStyle, activa: getComputedStyle(document.querySelector('#edicion-cm .live-activa')).backgroundColor };
  });
  for (const k of ['barra', 'pie']) {
    assert.match(e1[k].difuminado, /blur/, `${k}: sin difuminado`);
    assert.notEqual(e1[k].sombra, 'none', `${k}: sin sombra`);
    assert.match(e1[k].fondo, /\/ 0\.\d+\)|rgba\(.*0\.\d+\)/, `${k}: el fondo no es translúcido (${e1[k].fondo})`);
  }
  assert.equal(e1.hojaContorno, 'solid', 'el marco de foco no está en la hoja');
  assert.equal(e1.cmContorno, 'none', 'el editor sigue con su propio marco, pegado al texto');
  assert.match(e1.activa, /rgba\(0, 0, 0, 0\)|transparent/, 'la línea activa tiene fondo');
  await salirDescartando();
});
