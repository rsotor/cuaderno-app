'use strict';
// Recorrido de la medida de la línea: una nota larga (lectura/mercado-de-la-plaza.md) se lee a 16 px, con el texto en
// como mucho 720 px dentro de una hoja que, con sus márgenes interiores, mide más de 800 (revisión de diseño 2026-10-09:
// hallazgo 2 y dirección A «Hoja»).
// CAMBIO DE ESPECIFICACIÓN decidido por Roberto el 2026-10-09: la tanda 1 puso 18 px y columna de 800 px (~99 caracteres
// por línea) y «uff, 18 queda muy grande, bájala a 16»; ahora 16 px y texto de ~720 px dentro de la hoja. Lo medido hoy
// (mediana de caracteres por línea) se anota en el plan vivo §6. El techo vigila que no empeore; la referencia de
// WCAG 1.4.8 son 80 caracteres y no se cumple (la anchura manda, decisión de Roberto). Si alguien toca la letra o la
// columna, este test dice cuánto mide ahora la línea.
const test = require('node:test');
const assert = require('node:assert/strict');
const { arrancar, conTexto } = require('./ayuda');

let e;
test.before(async () => { e = await arrancar({ kit: false }); });
test.after(async () => { if (e) await e.cerrar(); });

// Caracteres de cada línea de un párrafo: se recorre el texto letra a letra y se cuenta una línea nueva cada vez que
// la letra baja. La última línea de un párrafo no cuenta (casi nunca va llena).
const medirLineas = () => document.querySelectorAll('#nota p').length && [...document.querySelectorAll('#nota p')].filter(p => p.textContent.length > 400).flatMap(p => {
  const lineas = []; let top = null, n = 0;
  const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  for (let t = w.nextNode(); t; t = w.nextNode()) {
    for (let i = 0; i < t.length; i++) {
      const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + 1);
      const caja = r.getClientRects()[0]; if (!caja) { n++; continue; }
      if (top !== null && Math.abs(caja.top - top) > 4) { lineas.push(n); n = 0; }
      top = caja.top; n++;
    }
  }
  return lineas;   // sin la última (la que queda en n)
});

test('lectura de una nota larga: 16 px, texto de unos 720 px en una hoja de más de 800 y como mucho 105 caracteres por línea', async () => {
  await e.ir('#/n/lectura/mercado-de-la-plaza.md');
  await conTexto(e.pagina.locator('#nota h1'), /mercado de la plaza/, 'nota larga', 'el título');
  const m = await e.pagina.evaluate(`(() => { const medir = ${medirLineas.toString()}; const l = medir().sort((a, b) => a - b);
    const p = document.querySelector('#nota p:not(.resumen)'); const cs = getComputedStyle(p);
    return { lineas: l.length, mediana: l[Math.floor(l.length / 2)], min: l[0], max: l[l.length - 1], letra: parseFloat(cs.fontSize), interlineado: parseFloat(cs.lineHeight), ancho: Math.round(p.getBoundingClientRect().width), hoja: Math.round(document.querySelector('#nota').getBoundingClientRect().width) }; })()`);
  console.log(`# medida de la línea: mediana ${m.mediana} caracteres (de ${m.min} a ${m.max}, ${m.lineas} líneas), letra ${m.letra} px, interlineado ${m.interlineado} px, texto ${m.ancho} px, hoja ${m.hoja} px`);
  assert.equal(Math.round(m.letra * 100) / 100, 16, `nota larga: la letra del cuerpo mide ${m.letra} px, no 16`);
  assert.ok(m.interlineado / m.letra >= 1.5 && m.interlineado / m.letra <= 1.8, `nota larga: el interlineado es ${m.interlineado} px para ${m.letra} px de letra`);
  assert.ok(m.ancho >= 660 && m.ancho <= 730, `nota larga: el texto mide ${m.ancho} px; se esperaban unos 720 como máximo`);
  assert.ok(m.hoja > 800, `nota larga: la hoja mide ${m.hoja} px; con sus márgenes interiores tiene que pasar de 800`);
  assert.ok(m.lineas >= 20, `nota larga: solo se han medido ${m.lineas} líneas`);
  assert.ok(m.mediana >= 60 && m.mediana <= 105, `nota larga: la línea mide ${m.mediana} caracteres de mediana; el techo acordado es 105 (referencia de WCAG 1.4.8 es 80)`);
});

test('lectura: el ajuste «Letra» sigue mandando sobre el cuerpo de la nota (en em, no en px)', async () => {
  await e.ir('#/n/lectura/mercado-de-la-plaza.md');
  await e.pagina.evaluate(() => { document.documentElement.dataset.letra = 'grande'; });
  const grande = await e.pagina.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#nota p')).fontSize));
  await e.pagina.evaluate(() => { document.documentElement.dataset.letra = 'pequeña'; });
  const pequena = await e.pagina.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#nota p')).fontSize));
  assert.ok(grande > 16 && pequena < 16, `la letra «Grande» da ${grande} px y «Pequeña» ${pequena} px; se esperaba más y menos de 16`);
});
