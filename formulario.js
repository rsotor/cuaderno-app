'use strict';
// El examen tipo test como formulario: las preguntas y sus opciones con casilla, tal como las lee examen.js del
// kit (misma regla de numeración y de opción, para no desincronizarse). La app no corrige: marca las casillas en
// el fichero y lanza examen.js --corregir, que escribe el intento en el histórico.
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const NUMERO = /^(\d+\.\s|\*\*\d+\.\*\*)/;
const OPCION = /^-\s*\[([ xX])\]\s*([a-zA-Z])\)\s*(.*)$/;
const HISTORICO = '## Histórico de intentos';
const UNICA = /\(elige una\)|\(una sola\)|una sola correcta/i;

// Las preguntas del examen: enunciado (líneas entre el número y la primera opción), opciones y si admite una sola.
function leerExamen(texto) {
  const lineas = texto.replace(/\r\n/g, '\n').split('\n');
  const fin = lineas.indexOf(HISTORICO) >= 0 ? lineas.indexOf(HISTORICO) : lineas.length;
  const preguntas = [];
  for (let i = 0; i < fin; i++) {
    if (!NUMERO.test(lineas[i])) continue;
    let j = i + 1;
    const opciones = [], enunciado = [lineas[i]];
    while (j < fin) {
      const m = OPCION.exec(lineas[j]);
      if (m) { opciones.push({ linea: j, marcada: /x/i.test(m[1]), letra: m[2].toLowerCase(), texto: m[3].trim() }); j++; continue; }
      if (lineas[j].trim() === '') { if (!opciones.length) enunciado.push(''); j++; continue; }   // el caso y la pregunta van en párrafos distintos
      if (opciones.length || NUMERO.test(lineas[j]) || /^#/.test(lineas[j]) || lineas[j].startsWith('>')) break;
      enunciado.push(lineas[j]); j++;
    }
    if (opciones.length) preguntas.push({ numero: preguntas.length + 1, desde: i, hasta: j, enunciado: enunciado.join('\n').trim(), unica: UNICA.test(enunciado.join(' ')), opciones });
  }
  const cabecera = preguntas.length ? lineas.slice(0, preguntas[0].desde).join('\n') : lineas.slice(0, fin).join('\n');
  const resto = fin < lineas.length ? lineas.slice(fin).join('\n') : '';
  return { preguntas, cabecera, resto, lineaHistorico: fin < lineas.length ? fin : null };
}

// Escribe las respuestas en el fichero: respuestas = { "1": ["b"], "2": ["a", "c"] }. Lo que no viene, queda en blanco.
function marcar(texto, respuestas) {
  const eol = texto.includes('\r\n') ? '\r\n' : '\n';
  const lineas = texto.replace(/\r\n/g, '\n').split('\n');
  const { preguntas } = leerExamen(texto);
  for (const p of preguntas) {
    const elegidas = new Set((respuestas[p.numero] || respuestas[String(p.numero)] || []).map(l => String(l).toLowerCase()));
    for (const o of p.opciones) lineas[o.linea] = lineas[o.linea].replace(/^(-\s*)\[[ xX]\]/, `$1[${elegidas.has(o.letra) ? 'x' : ' '}]`);
  }
  return lineas.join(eol);
}

// ejecutarNode = { cmd, env }: con qué Node se lanza examen.js (la app de escritorio inyecta el de Electron); por defecto, el de este proceso.
const herramienta = (raiz, args, ejecutarNode = null) => {
  const r = spawnSync(ejecutarNode ? ejecutarNode.cmd : process.execPath, [path.join('.kit', 'herramientas', 'examen.js'), ...args], { cwd: raiz, encoding: 'utf8', timeout: 120_000, env: { ...process.env, ...(ejecutarNode ? ejecutarNode.env : {}) } });
  return { codigo: r.status ?? 1, salida: `${r.stdout || ''}${r.stderr || ''}`.trim() };
};
// ¿Se puede validar este examen con el kit? Solo con motor y, si es de módulo o final, con la revisión resuelta.
function validable(raiz, kit, relDesdeRaiz, frontmatter, { ejecutarNode = null } = {}) {
  if (kit.tipo !== 'kit') return { ok: false, motivo: kit.tipo === 'salida-sin-motor' ? 'Este cuaderno no trae el motor del kit: tus respuestas se guardan en la nota, pero aquí no se pueden corregir.' : 'Sin kit no hay quien corrija: las respuestas se guardan en la nota.' };
  if (!frontmatter || !frontmatter.tipo_examen || String(frontmatter.intentos ?? '0').trim() !== '0') return { ok: true, motivo: null };
  const r = herramienta(raiz, ['--revision', relDesdeRaiz], ejecutarNode);
  return r.codigo === 0 ? { ok: true, motivo: null } : { ok: false, motivo: 'Este examen aún no está revisado por el profesor: pídele que lo revise antes de hacerlo.' };
}
function corregir(raiz, relDesdeRaiz, { ejecutarNode = null } = {}) { return herramienta(raiz, ['--corregir', relDesdeRaiz], ejecutarNode); }

module.exports = { leerExamen, marcar, validable, corregir, HISTORICO };
