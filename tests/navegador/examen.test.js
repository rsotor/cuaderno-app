'use strict';
// Recorrido del examen como formulario. Sin examen.js del kit la app solo guarda las marcas en la nota (y lo dice);
// con un examen.js de mentira en .kit/herramientas/ el botón es «Corregir» y enseña la salida de la herramienta.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { arrancar, visible, oculto, conTexto, ficheroCumple } = require('./ayuda');

let e;
test.before(async () => { e = await arrancar({ kit: true }); });
test.after(async () => { if (e) await e.cerrar(); });

const RUTA = 'examenes/01-examen.md';

test('examen sin examen.js: el formulario, «Guardar respuestas» escribe las casillas y explica por qué no corrige', async () => {
  await e.ir(`#/n/${RUTA}`);
  await visible(e.pagina.locator('#examen'), 'examen', 'el formulario');
  await conTexto(e.pagina.locator('#nota h1'), /^Examen · Módulo 1$/, 'examen', 'el título');
  assert.equal(await e.pagina.locator('#examen fieldset.pregunta').count(), 2, 'examen: no hay dos preguntas');
  assert.equal(await e.pagina.locator('#examen input[name="p1"]').first().getAttribute('type'), 'radio', 'examen: la pregunta «elige una» debería ir con radios');
  assert.equal(await e.pagina.locator('#examen input[name="p2"]').first().getAttribute('type'), 'checkbox', 'examen: la pregunta de varias debería ir con casillas');
  await conTexto(e.pagina.locator('#validar'), /^Guardar respuestas$/, 'examen', 'el botón sin kit que corrija');
  await conTexto(e.pagina.locator('.examen-pie .pista'), /no está revisado por el profesor/, 'examen', 'el motivo de que no se pueda corregir');
  await e.pagina.locator('#examen input[name="p1"][value="b"]').check();
  await e.pagina.locator('#examen input[name="p2"][value="a"]').check();
  await e.pagina.locator('#examen input[name="p2"][value="b"]').check();
  await e.pagina.locator('#validar').click();
  await visible(e.pagina.locator('#resultado'), 'examen', 'el diálogo de resultado');
  await conTexto(e.pagina.locator('#resultado-titulo'), /^Respuestas guardadas$/, 'resultado', 'el título');
  await conTexto(e.pagina.locator('#resultado-texto'), /Respuestas guardadas en la nota/, 'resultado', 'la explicación');
  await ficheroCumple(e.c, RUTA, /- \[ \] a\) Sube\n- \[x\] b\) Baja\n- \[ \] c\) Igual/, 'examen');
  await ficheroCumple(e.c, RUTA, /- \[x\] a\) Medio de cambio\n- \[x\] b\) Unidad de cuenta\n- \[ \] c\) Fuente de inflación/, 'examen');
  assert.match(e.c.leer(RUTA), /^---\ntipo: examen\n/, 'examen: el frontmatter se ha perdido al marcar');
  await e.pagina.locator('#resultado-cerrar').click();
  await oculto(e.pagina.locator('#resultado'), 'resultado', 'el diálogo tras cerrarlo');
  await visible(e.pagina.locator('#examen input[name="p1"][value="b"]:checked'), 'examen', 'la respuesta marcada al volver a pintar el formulario');
});

test('con examen.js en el kit: el botón es «Corregir» y el resultado enseña la salida de la herramienta', async () => {
  const falsa = `const a = process.argv.slice(2); if (a[0] === '--revision') { process.stdout.write('Revisión resuelta'); process.exit(0); } process.stdout.write('Nota: 10 sobre 10 · ' + JSON.stringify(a)); process.exit(0);`;
  fs.mkdirSync(path.join(e.c.raiz, '.kit', 'herramientas'), { recursive: true });
  fs.writeFileSync(path.join(e.c.raiz, '.kit', 'herramientas', 'examen.js'), falsa);
  await e.ir(`#/n/${RUTA}`);
  await conTexto(e.pagina.locator('#validar'), /^Corregir$/, 'examen con kit', 'el botón «Corregir»');
  await conTexto(e.pagina.locator('.examen-pie .pista'), /corrige con la herramienta del kit/, 'examen con kit', 'la pista del botón');
  await e.pagina.locator('#examen input[name="p1"][value="a"]').check();   // cambia de opinión: radio, una sola
  await e.pagina.locator('#validar').click();
  await visible(e.pagina.locator('#resultado'), 'examen con kit', 'el diálogo de resultado');
  await conTexto(e.pagina.locator('#resultado-titulo'), /^Examen corregido$/, 'resultado', 'el título');
  await conTexto(e.pagina.locator('#resultado-texto'), /Nota: 10 sobre 10 · \["--corregir","estudio\/examenes\/01-examen\.md"\]/, 'resultado', 'la salida de examen.js');
  await ficheroCumple(e.c, RUTA, /- \[x\] a\) Sube\n- \[ \] b\) Baja/, 'examen con kit');
});
