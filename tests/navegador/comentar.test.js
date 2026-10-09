'use strict';
// Comentar un texto seleccionado (plan «edición y comentarios», tarea 8): selección → botón flotante → caja → callout con cita
// en el fichero; el texto comentado sale subrayado, el callout no se ve y el hilo se abre al pulsar el subrayado.
// Sin kit: es la base de la app (AGENTS.md, principio 3).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { arrancar, hasta, visible, oculto, conTexto, ficheroCumple, hashCumple } = require('./ayuda');

let e;
test.before(async () => { e = await arrancar({ kit: false }); });
test.after(async () => { if (e) await e.cerrar(); });

const HOY = new Date().toISOString().slice(0, 10);
const fichero = nombre => path.join(e.c.base, nombre);
const leer = nombre => fs.readFileSync(fichero(nombre), 'utf8');
// Escribe la nota y la abre; el vigilante de ficheros avisa con retraso de lo escrito, así que se espera a que pase.
async function abrir(nombre, texto) {
  fs.writeFileSync(fichero(nombre), texto);
  await e.ir(`#/n/${nombre}`);
  await visible(e.pagina.locator('#nota .bloque').first(), nombre, 'la nota pintada');
  await e.pagina.waitForTimeout(1300);
}
// Selecciona `texto` (puede cruzar nodos) dentro del bloque, como lo haría el ratón: la selección real, con su selectionchange.
const seleccionar = (bloque, texto, ocurrencia = 0) => bloque.evaluate((b, [t, n]) => {
  const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT, { acceptNode: x => x.parentElement.closest('.katex-mathml') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const nodos = []; let todo = '';
  for (let x = w.nextNode(); x; x = w.nextNode()) { nodos.push([x, todo.length]); todo += x.data; }
  let i = -1; for (let k = 0; k <= n; k++) { i = todo.indexOf(t, i + 1); if (i < 0) throw new Error(`no está «${t}» en el bloque: ${todo}`); }
  const punto = p => { for (let k = nodos.length - 1; k >= 0; k--) if (nodos[k][1] <= p) return [nodos[k][0], p - nodos[k][1]]; };
  const [a, ao] = punto(i), [z, zo] = punto(i + t.length);
  const r = document.createRange(); r.setStart(a, ao); r.setEnd(z, zo);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}, [texto, ocurrencia]);
const bloqueDe = texto => e.pagina.locator('#nota .bloque:not(.comentario-oculto)', { hasText: texto }).first();
// Comenta la selección actual por la caja.
async function comentarSeleccion(texto) {
  await visible(e.pagina.locator('#comentar-boton'), 'comentar', 'el botón flotante «Comentar»');
  await e.pagina.locator('#comentar-boton').click();
  await visible(e.pagina.locator('#comentar-caja'), 'comentar', 'la caja de comentar');
  assert.equal(await e.pagina.locator('#comentar-enviar').isDisabled(), true, 'comentar: «Comentar» debe estar desactivado sin texto');
  await e.pagina.locator('#comentar-texto').fill(texto);
  await e.pagina.locator('#comentar-enviar').click();
  await oculto(e.pagina.locator('#comentar-caja'), 'comentar', 'la caja tras comentar');
}

test('comentar una selección: queda el callout con la cita tras el bloque, el texto sale subrayado y el panel lo lista con la cita', async () => {
  const antes = '# Nota\n\nEl capital inicial se multiplica cada año por el tipo.\n\nOtro párrafo.\n';
  await abrir('c1.md', antes);
  await seleccionar(bloqueDe('capital inicial'), 'capital inicial');
  await comentarSeleccion('¿Es lo mismo que el principal?');
  await ficheroCumple(e.c, 'c1.md', new RegExp(`^# Nota\\n\\nEl capital inicial se multiplica cada año por el tipo\\.\\n\\n> \\[!comment\\] Alumno \\(${HOY}\\) · «capital inicial»\\n> ¿Es lo mismo que el principal\\?\\n\\nOtro párrafo\\.\\n$`), 'comentar');
  const marca = e.pagina.locator('#nota button.comentado');
  await conTexto(marca, /^capital inicial$/, 'comentar', 'el texto comentado subrayado');
  assert.equal(await e.pagina.locator('#nota .callout-comment:visible').count(), 0, 'comentar: el callout se ve en lectura teniendo subrayado');
  // El panel lo lista con la cita en cursiva; pulsarlo salta a la nota y abre el hilo.
  await e.ir('#/comentarios');
  await conTexto(e.pagina.locator('#panel'), /capital inicial.*¿Es lo mismo que el principal\?/s, 'panel', 'la cita y el texto del comentario');
  assert.equal(await e.pagina.locator('#panel .grupo:has(a[title="c1.md"]) i', { hasText: 'capital inicial' }).count(), 1, 'panel: la cita no va en cursiva');
  await e.pagina.locator('#panel a.wiki[title="c1.md"]').click();
  await hashCumple(e.pagina, /^#\/n\/c1\.md/, 'panel');
  await visible(e.pagina.locator('#comentar-hilo'), 'panel', 'el hilo abierto al saltar desde el panel');
  await conTexto(e.pagina.locator('#comentar-hilo'), /¿Es lo mismo que el principal\?/, 'panel', 'el texto en el hilo');
  await e.pagina.keyboard.press('Escape');
});

test('comentar con el teclado: Shift+flechas y c', async () => {
  const antes = '# Nota\n\nEl capital inicial se multiplica cada año por el tipo.\n\nOtro párrafo.\n';
  await abrir('c2.md', antes);
  const bloque = bloqueDe('capital inicial');
  await bloque.locator('p').dblclick({ position: { x: 60, y: 8 } });   // selecciona «capital»
  for (let i = 0; i < 8; i++) await e.pagina.keyboard.press('Shift+ArrowRight');   // y se amplía con el teclado: «capital inicial»
  assert.equal(await e.pagina.evaluate(() => getSelection().toString()), 'capital inicial');
  await e.pagina.keyboard.press('c');
  await visible(e.pagina.locator('#comentar-caja'), 'teclado', 'la caja con la tecla c');
  assert.equal(await e.pagina.evaluate(() => document.activeElement.id), 'comentar-texto', 'teclado: el foco no está en el texto de la caja');
  await e.pagina.keyboard.press('Escape');
  await oculto(e.pagina.locator('#comentar-caja'), 'teclado', 'la caja tras Esc');
  assert.equal(await e.pagina.evaluate(() => document.activeElement.classList.contains('bloque')), true, 'teclado: Esc no devuelve el foco al bloque');
  // Con la selección otra vez: c, texto y Ctrl/⌘ Enter.
  await bloque.locator('p').dblclick({ position: { x: 60, y: 8 } });
  for (let i = 0; i < 8; i++) await e.pagina.keyboard.press('Shift+ArrowRight');
  await e.pagina.keyboard.press('c');
  await e.pagina.keyboard.type('Duda por teclado');
  await e.pagina.keyboard.press('ControlOrMeta+Enter');
  await ficheroCumple(e.c, 'c2.md', /· «capital inicial»\n> Duda por teclado\n/, 'teclado');
  await hasta(() => e.pagina.evaluate(() => document.activeElement.classList.contains('comentado')), 'teclado', 'tras comentar el foco no vuelve al texto comentado (se pierde en el body)');
  // c sin selección: comenta el bloque enfocado, sin cita.
  await e.pagina.locator('#nota .bloque', { hasText: 'Otro párrafo' }).focus();
  await e.pagina.keyboard.press('c');
  await visible(e.pagina.locator('#comentar-caja'), 'teclado', 'la caja de c sin selección');
  await e.pagina.keyboard.type('Sobre todo el bloque');
  await e.pagina.keyboard.press('ControlOrMeta+Enter');
  await ficheroCumple(e.c, 'c2.md', new RegExp(`Otro párrafo\\.\\n\\n> \\[!comment\\] Alumno \\(${HOY}\\)\\n> Sobre todo el bloque\\n`), 'teclado');
});

test('hilo: clic en el subrayado lo abre, Cerrar deja el fichero byte a byte como antes de comentar y Deshacer lo devuelve', async () => {
  const antes = '# Nota\n\nEl capital inicial se multiplica cada año por el tipo.\n\nOtro párrafo.\n';
  await abrir('c3.md', antes);
  await seleccionar(bloqueDe('capital inicial'), 'capital inicial');
  await comentarSeleccion('Una duda\ncon dos líneas');
  await ficheroCumple(e.c, 'c3.md', /«capital inicial»/, 'hilo');
  const comentado = leer('c3.md');
  const marca = e.pagina.locator('#nota button.comentado');
  await visible(marca, 'hilo', 'el subrayado');
  await marca.click();
  await visible(e.pagina.locator('#comentar-hilo'), 'hilo', 'el hilo');
  await conTexto(e.pagina.locator('#comentar-hilo'), /capital inicial/, 'hilo', 'la cita');
  await conTexto(e.pagina.locator('#comentar-hilo'), new RegExp(`Alumno.*${HOY}`), 'hilo', 'el autor y la fecha');
  await conTexto(e.pagina.locator('#comentar-hilo'), /Una duda\s+con dos líneas/, 'hilo', 'el texto');
  // Esc lo cierra y el foco vuelve al subrayado; Enter lo abre otra vez.
  await e.pagina.keyboard.press('Escape');
  await oculto(e.pagina.locator('#comentar-hilo'), 'hilo', 'el hilo tras Esc');
  assert.equal(await e.pagina.evaluate(() => document.activeElement.classList.contains('comentado')), true, 'hilo: Esc no devuelve el foco al subrayado');
  await e.pagina.keyboard.press('Enter');
  await visible(e.pagina.locator('#comentar-hilo'), 'hilo', 'el hilo con Enter');
  // Cerrar: el fichero vuelve a como estaba antes de comentar y el aviso ofrece Deshacer.
  await e.pagina.locator('#comentar-hilo .hilo-cerrar').click();
  await ficheroCumple(e.c, 'c3.md', /^# Nota\n\nEl capital inicial se multiplica cada año por el tipo\.\n\nOtro párrafo\.\n$/, 'hilo');
  assert.equal(leer('c3.md'), antes, 'hilo: Cerrar no deja el fichero byte a byte como antes de comentar');
  await oculto(e.pagina.locator('#nota button.comentado'), 'hilo', 'el subrayado tras cerrar');
  const aviso = e.pagina.locator('.aviso-flotante', { hasText: 'Comentario cerrado' });
  await visible(aviso, 'hilo', 'el aviso «Comentario cerrado»');
  await aviso.locator('button', { hasText: 'Deshacer' }).click();
  await ficheroCumple(e.c, 'c3.md', /«capital inicial»/, 'hilo');
  assert.equal(leer('c3.md'), comentado, 'hilo: Deshacer no devuelve el comentario tal como estaba');
  await visible(e.pagina.locator('#nota button.comentado'), 'hilo', 'el subrayado tras deshacer');
});

test('dos comentarios en el mismo párrafo: los dos subrayados apuntan bien', async () => {
  await abrir('c4.md', `# Nota\n\nEl capital inicial se multiplica por el tipo cada año.\n\n> [!comment] Alumno (2026-10-01) · «capital inicial»\n> Primer comentario.\n\n> [!comment] Alumno (2026-10-02) · «cada año»\n> Segundo comentario.\n\nOtro párrafo.\n`);
  const marcas = e.pagina.locator('#nota button.comentado');
  await hasta(async () => (await marcas.count()) === 2, 'dos comentarios', 'no hay dos subrayados');
  assert.deepEqual(await marcas.allTextContents(), ['capital inicial', 'cada año']);
  assert.equal(await e.pagina.locator('#nota .callout-comment:visible').count(), 0, 'dos comentarios: se ve algún callout');
  await marcas.nth(1).click();
  await conTexto(e.pagina.locator('#comentar-hilo'), /Segundo comentario\./, 'dos comentarios', 'el segundo hilo');
  await e.pagina.keyboard.press('Escape');
  await marcas.nth(0).click();
  await conTexto(e.pagina.locator('#comentar-hilo'), /Primer comentario\./, 'dos comentarios', 'el primer hilo');
  await e.pagina.keyboard.press('Escape');
});

test('cita repetida en el párrafo: la app la amplía y el subrayado cae en la frase elegida', async () => {
  await abrir('c5.md', '# Nota\n\nPrimero el interés simple, luego el interés compuesto, y al final el interés bancario.\n');
  await seleccionar(bloqueDe('Primero el interés'), 'interés', 1);   // la segunda
  await comentarSeleccion('¿Y este?');
  await ficheroCumple(e.c, 'c5.md', /· «interés compuesto,?»\n> ¿Y este\?/, 'repetida');
  const marca = e.pagina.locator('#nota button.comentado');
  await visible(marca, 'repetida', 'el subrayado');
  const dato = await marca.first().evaluate(b => ({ texto: b.textContent, antes: b.previousSibling.textContent.slice(-12) }));
  assert.match(dato.texto, /^interés compuesto/, 'repetida: el subrayado no es la frase ampliada');
  assert.match(dato.antes, /luego el $/, `repetida: el subrayado cayó en otra aparición (antes: «${dato.antes}»)`);
});

test('cita que es el alias de un wikilink', async () => {
  await abrir('c6.md', '# Nota\n\nMira [[conceptos/interes|el interés]] para saber más.\n');
  await seleccionar(bloqueDe('Mira'), 'el interés');
  await comentarSeleccion('Sobre el enlace');
  await ficheroCumple(e.c, 'c6.md', /· «el interés»\n> Sobre el enlace\n/, 'alias');
  const marca = e.pagina.locator('#nota button.comentado');
  await conTexto(marca.first(), /el interés/, 'alias', 'el subrayado sobre el alias del enlace');
  await marca.first().click();
  await visible(e.pagina.locator('#comentar-hilo'), 'alias', 'el hilo (y no la nota del enlace)');
  await hashCumple(e.pagina, /^#\/n\/c6\.md/, 'alias');
  await e.pagina.keyboard.press('Escape');
});

test('cita perdida: el hilo se ve con el aviso', async () => {
  await abrir('c7.md', '# Nota\n\nEste párrafo ya no habla de aquello.\n\n> [!comment] Alumno (2026-10-01) · «la inflación sube»\n> Esto no está ya.\n\nOtro.\n');
  const callout = e.pagina.locator('#nota .callout-comment');
  await visible(callout, 'cita perdida', 'el callout del comentario');
  await conTexto(callout, /la cita ya no está/i, 'cita perdida', 'el aviso');
  await conTexto(callout, /Esto no está ya\./, 'cita perdida', 'el texto');
  assert.equal(await e.pagina.locator('#nota button.comentado').count(), 0, 'cita perdida: hay subrayado');
});

test('comentario viejo sin cita se pinta como antes', async () => {
  await abrir('c8.md', '# Nota\n\nUn párrafo.\n\n> [!comment] Alumno (2026-09-30)\n> Un comentario de antes de las citas.\n');
  const callout = e.pagina.locator('#nota .callout-comment');
  await visible(callout, 'viejo', 'el callout');
  await conTexto(callout, /Un comentario de antes de las citas\./, 'viejo', 'el texto');
  assert.equal(await e.pagina.locator('#nota button.comentado').count(), 0, 'viejo: hay subrayado sin cita');
  assert.doesNotMatch(await callout.textContent(), /la cita ya no está/i, 'viejo: dice que falta una cita que nunca hubo');
});

test('comentario con subrayado: el callout no se ve en lectura y sí en el fichero', async () => {
  const texto = '# Nota\n\nEl capital inicial manda.\n\n> [!comment] Alumno (2026-10-01) · «capital inicial»\n> Visible solo en el fichero.\n';
  await abrir('c9.md', texto);
  await visible(e.pagina.locator('#nota button.comentado'), 'subrayado', 'el subrayado');
  assert.equal(await e.pagina.locator('#nota .callout-comment').first().isVisible(), false, 'subrayado: el callout se ve en lectura');
  assert.ok(!(await e.pagina.locator('#nota').innerText()).includes('Visible solo en el fichero.'), 'subrayado: el texto del callout está en la lectura');
  assert.equal(leer('c9.md'), texto, 'subrayado: leer ha cambiado el fichero');
  // Tampoco está en el orden de bloques (flechas) ni en el Tab: un solo punto de Tab.
  assert.equal(await e.pagina.locator('#nota .bloque[tabindex="0"]').count(), 1);
});

test('el cuaderno de ejemplo: la nota comentada tiene un subrayado, un callout viejo y un callout con la cita perdida', async () => {
  await e.ir('#/n/comentarios/nota-comentada.md');
  await visible(e.pagina.locator('#nota .bloque').first(), 'ejemplo', 'la nota pintada');
  await conTexto(e.pagina.locator('#nota button.comentado'), /^capital inicial$/, 'ejemplo', 'el subrayado de la cita que está');
  assert.equal(await e.pagina.locator('#nota button.comentado').count(), 1);
  const visibles = e.pagina.locator('#nota .callout-comment:visible');
  assert.equal(await visibles.count(), 2, 'ejemplo: deben verse el viejo y el de la cita perdida');
  await conTexto(visibles.nth(0), /Comentario viejo, sin cita/, 'ejemplo', 'el comentario viejo');
  await conTexto(visibles.nth(1), /la cita ya no está/i, 'ejemplo', 'el aviso de la cita perdida');
  await e.ir('#/comentarios');
  await conTexto(e.pagina.locator('#panel'), /capital inicial/, 'ejemplo', 'la cita en el panel');
});

test('selección solo con teclado: Mayús + flechas sobre un bloque enfocado crean la selección, y c comenta ese fragmento', async () => {
  await abrir('c10.md', '# Nota\n\nEl capital inicial se multiplica cada año por el tipo.\n\nOtro párrafo.\n');
  const bloque = bloqueDe('capital inicial');
  await bloque.focus();
  await e.pagina.evaluate(() => getSelection().removeAllRanges());
  for (let i = 0; i < 10; i++) await e.pagina.keyboard.press('Shift+ArrowRight');
  assert.equal(await e.pagina.evaluate(() => getSelection().toString()), 'El capital', 'teclado: Mayús + flecha derecha no crea la selección desde el principio del bloque');
  await visible(e.pagina.locator('#comentar-boton'), 'teclado', 'el botón flotante con la selección hecha con teclado');
  await e.pagina.keyboard.press('c');
  await visible(e.pagina.locator('#comentar-caja'), 'teclado', 'la caja con la selección hecha con teclado');
  await e.pagina.keyboard.press('Escape');
  // Desde el final, hacia la izquierda.
  await bloque.focus();
  await e.pagina.evaluate(() => getSelection().removeAllRanges());
  for (let i = 0; i < 5; i++) await e.pagina.keyboard.press('Shift+ArrowLeft');
  assert.equal(await e.pagina.evaluate(() => getSelection().toString()), 'tipo.', 'teclado: Mayús + flecha izquierda no crea la selección desde el final del bloque');
});
