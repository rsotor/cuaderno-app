'use strict';
// Las flashcards del kit como tarjetas: una pregunta en negrita, la respuesta en un callout plegado, dos casillas
// (✅ la sabía / ❌ no la sabía) y una línea con la caja. La app solo marca una de las dos casillas; el repaso
// (qué caja, cuándo toca) lo calcula el kit al guardar.
const PREGUNTA = /^\*\*(.+)\*\*\s*$/;
const CASILLA = /^-\s*\[([ xX])\]\s*(✅|❌)/;
const INFO = /^\*([^*].*)\*\s*$/;

function leerTarjetas(texto) {
  const lineas = texto.replace(/\r\n/g, '\n').split('\n');
  const tarjetas = [];
  let actual = null;
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    const p = PREGUNTA.exec(l);
    if (p) { actual = { pregunta: p[1].trim(), respuesta: [], lineaSabia: null, lineaNoSabia: null, sabia: null, info: '' }; tarjetas.push(actual); continue; }
    if (!actual) continue;
    if (/^>\s*\[!/.test(l)) continue;                                   // la cabecera del callout
    if (l.startsWith('>')) { actual.respuesta.push(l.replace(/^>\s?/, '')); continue; }
    const c = CASILLA.exec(l);
    if (c) { if (c[2] === '✅') actual.lineaSabia = i; else actual.lineaNoSabia = i; if (/x/i.test(c[1])) actual.sabia = c[2] === '✅'; continue; }
    const inf = INFO.exec(l);
    if (inf && !actual.info) actual.info = inf[1].trim();
  }
  return tarjetas.filter(t => t.lineaSabia != null && t.lineaNoSabia != null).map(t => ({ ...t, respuesta: t.respuesta.join('\n').trim() }));
}

module.exports = { leerTarjetas };
