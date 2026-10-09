'use strict';
// Recorrido de la medida de la línea: una nota larga (lectura/nota-larga.md) se lee a 18 px, con la columna de texto
// en unos 800 px y unos 99 caracteres por línea (revisión de diseño 2026-10-09, hallazgo 2; Roberto: «unos
// 800 como está ahora lo veo bien»). Medido: unos 99 caracteres por línea (más que los 80 de WCAG 1.4.8, decisión de
// Roberto: la anchura manda sobre la referencia). El techo vigila que no empeore. Si alguien toca la letra o la columna, este test dice cuánto mide ahora la línea.
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

test('lectura de una nota larga: 18 px, columna de unos 800 px y como mucho 105 caracteres por línea', async () => {
  await e.ir('#/n/lectura/nota-larga.md');
  await conTexto(e.pagina.locator('#nota h1'), /mercado de la plaza/, 'nota larga', 'el título');
  const m = await e.pagina.evaluate(`(() => { const medir = ${medirLineas.toString()}; const l = medir().sort((a, b) => a - b);
    const p = document.querySelector('#nota p:not(.resumen)'); const cs = getComputedStyle(p);
    return { lineas: l.length, mediana: l[Math.floor(l.length / 2)], min: l[0], max: l[l.length - 1], letra: parseFloat(cs.fontSize), interlineado: parseFloat(cs.lineHeight), ancho: Math.round(p.getBoundingClientRect().width) }; })()`);
  console.log(`# medida de la línea: mediana ${m.mediana} caracteres (de ${m.min} a ${m.max}, ${m.lineas} líneas), letra ${m.letra} px, interlineado ${m.interlineado} px, columna ${m.ancho} px`);
  assert.equal(m.letra, 18, `nota larga: la letra del cuerpo mide ${m.letra} px, no 18`);
  assert.ok(m.interlineado / m.letra >= 1.5 && m.interlineado / m.letra <= 1.8, `nota larga: el interlineado es ${m.interlineado} px para ${m.letra} px de letra`);
  assert.ok(m.ancho >= 700 && m.ancho <= 820, `nota larga: la columna de texto mide ${m.ancho} px; se esperaban unos 800`);
  assert.ok(m.lineas >= 20, `nota larga: solo se han medido ${m.lineas} líneas`);
  assert.ok(m.mediana >= 60 && m.mediana <= 105, `nota larga: la línea mide ${m.mediana} caracteres de mediana; el techo acordado es 105 (hoy ~99; la referencia de WCAG 1.4.8 es 80)`);
});

test('lectura: el ajuste «Letra» sigue mandando sobre el cuerpo de la nota (en em, no en px)', async () => {
  await e.ir('#/n/lectura/nota-larga.md');
  await e.pagina.evaluate(() => { document.documentElement.dataset.letra = 'grande'; });
  const grande = await e.pagina.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#nota p')).fontSize));
  await e.pagina.evaluate(() => { document.documentElement.dataset.letra = 'pequeña'; });
  const pequena = await e.pagina.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#nota p')).fontSize));
  assert.ok(grande > 18 && pequena < 18, `la letra «Grande» da ${grande} px y «Pequeña» ${pequena} px; se esperaba más y menos de 18`);
});
