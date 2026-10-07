'use strict';
// Render de Markdown "del kit": wikilinks, callouts, casillas con su línea, matemáticas y bloques editables.
const MarkdownIt = require('markdown-it');

function crearRender(resolverWiki) {
  const md = new MarkdownIt({ html: false, linkify: true, typographer: false, breaks: false });

  // --- Matemáticas: $...$ y $$...$$ en línea; bloque $$ en líneas propias. Se entregan tal cual a KaTeX en el navegador.
  md.inline.ruler.before('escape', 'math', (state, silent) => {
    const src = state.src, pos = state.pos;
    if (src[pos] !== '$') return false;
    const doble = src[pos + 1] === '$';
    const abre = doble ? 2 : 1;
    if (!doble && /\s/.test(src[pos + 1] || ' ')) return false;
    const cierre = src.indexOf(doble ? '$$' : '$', pos + abre);
    if (cierre < 0) return false;
    const cuerpo = src.slice(pos + abre, cierre);
    if (!cuerpo.trim() || cuerpo.includes('\n')) return false;
    if (!silent) { const t = state.push(doble ? 'math_display' : 'math_inline', '', 0); t.content = cuerpo.trim(); }
    state.pos = cierre + abre;
    return true;
  });
  md.block.ruler.before('fence', 'math_block', (state, inicio, fin, silent) => {
    const linea = state.src.slice(state.bMarks[inicio] + state.tShift[inicio], state.eMarks[inicio]);
    if (!linea.startsWith('$$')) return false;
    if (linea.length > 2 && linea.endsWith('$$')) return false;   // $$ ... $$ en una línea: lo hace la regla inline
    let n = inicio + 1;
    for (; n < fin; n++) {
      const l = state.src.slice(state.bMarks[n] + state.tShift[n], state.eMarks[n]);
      if (l.trim().endsWith('$$')) break;
    }
    if (n >= fin) return false;
    if (silent) return true;
    const t = state.push('math_display', '', 0);
    t.block = true; t.map = [inicio, n + 1];
    t.content = state.getLines(inicio, n + 1, 0, false).replace(/^\s*\$\$/, '').replace(/\$\$\s*$/, '').trim();
    state.line = n + 1;
    return true;
  });
  md.renderer.rules.math_inline = (t, i) => `<span class="math" data-display="0">${md.utils.escapeHtml(t[i].content)}</span>`;
  md.renderer.rules.math_display = (t, i) => `<div class="math" data-display="1">${md.utils.escapeHtml(t[i].content)}</div>`;

  // --- Wikilinks: [[nota]], [[nota|alias]] y [[nota\|alias]] (el de las tablas de Obsidian).
  md.inline.ruler.before('link', 'wikilink', (state, silent) => {
    const src = state.src, pos = state.pos;
    if (src[pos] !== '[' || src[pos + 1] !== '[') return false;
    const cierre = src.indexOf(']]', pos + 2);
    if (cierre < 0) return false;
    const dentro = src.slice(pos + 2, cierre);
    if (!dentro || dentro.includes('\n')) return false;
    const [destinoBruto, ...resto] = dentro.replace(/\\\|/g, '|').split('|');
    const destino = destinoBruto.trim();
    const texto = (resto.join('|') || destino.split('/').pop()).trim();
    if (!silent) {
      const r = resolverWiki(destino);
      const t = state.push('wikilink', '', 0);
      t.content = texto; t.attrSet('href', r ? `#/n/${encodeURI(r)}` : ''); t.attrSet('data-roto', r ? '0' : '1'); t.attrSet('title', destino);
    }
    state.pos = cierre + 2;
    return true;
  });
  md.renderer.rules.wikilink = (t, i) => {
    const k = t[i];
    const roto = k.attrGet('data-roto') === '1';
    return `<a class="wiki${roto ? ' roto' : ''}" href="${roto ? '#' : k.attrGet('href')}" title="${md.utils.escapeHtml(k.attrGet('title'))}">${md.utils.escapeHtml(k.content)}</a>`;
  };

  // --- Callouts (> [!tipo]- Título) y casillas (- [ ] / - [x]), con la línea del fichero.
  md.core.ruler.after('block', 'kit', (state) => {
    const ts = state.tokens;
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i];
      if (t.type === 'blockquote_open' && ts[i + 1]?.type === 'paragraph_open' && ts[i + 2]?.type === 'inline') {
        const inl = ts[i + 2];
        const m = inl.content.match(/^\[!([\w-]+)\]([-+]?)[ \t]*([^\n]*)\n?([\s\S]*)$/);
        if (m) {
          t.attrSet('class', `callout callout-${m[1].toLowerCase()}${m[2] === '-' ? ' plegado' : ''}`);
          t.attrSet('data-tipo', m[1].toLowerCase());
          const titulo = new state.Token('callout_title', '', 0);
          titulo.content = m[3].trim() || m[1]; titulo.meta = { tipo: m[1].toLowerCase(), plegable: m[2] !== '' };
          inl.content = m[4];
          if (!m[4].trim()) { ts.splice(i + 1, 3, titulo); } else { ts.splice(i + 1, 0, titulo); }
        }
      }
      if (t.type === 'list_item_open' && ts[i + 1]?.type === 'paragraph_open' && ts[i + 2]?.type === 'inline') {
        const inl = ts[i + 2];
        const m = inl.content.match(/^\[([ xX])\][ \t]+/);
        if (m) {
          t.attrJoin('class', 'tarea');
          const c = new state.Token('casilla', '', 0);
          c.meta = { marcada: m[1] !== ' ', linea: t.map[0] };
          inl.content = inl.content.slice(m[0].length);
          ts.splice(i + 2, 0, c);
        }
      }
    }
  });
  md.renderer.rules.callout_title = (t, i) => {
    const { tipo, plegable } = t[i].meta;
    return `<div class="callout-titulo" data-tipo="${tipo}"${plegable ? ' data-plegable="1"' : ''}><span class="callout-icono"></span>${md.utils.escapeHtml(t[i].content)}</div>\n`;
  };
  md.renderer.rules.casilla = (t, i) => {
    const { marcada, linea } = t[i].meta;
    return `<input type="checkbox" class="casilla" data-linea="${linea}"${marcada ? ' checked' : ''}> `;
  };

  // --- Bloques editables: cada bloque de nivel 0 se envuelve con sus líneas de origen.
  md.core.ruler.push('bloques', (state) => {
    const ts = state.tokens, salida = [];
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i];
      if (t.level === 0 && t.map && (t.nesting === 1 || t.nesting === 0)) {
        let j = i;
        if (t.nesting === 1) { let prof = 0; for (j = i; j < ts.length; j++) { prof += ts[j].nesting; if (prof === 0) break; } }
        const abre = new state.Token('bloque_open', '', 0); abre.meta = { desde: t.map[0], hasta: t.map[1] };
        const cierra = new state.Token('bloque_close', '', 0);
        salida.push(abre, ...ts.slice(i, j + 1), cierra);
        i = j;
      } else salida.push(t);
    }
    state.tokens = salida;
  });
  md.renderer.rules.bloque_open = (t, i) => `<div class="bloque" data-desde="${t[i].meta.desde}" data-hasta="${t[i].meta.hasta}">`;
  md.renderer.rules.bloque_close = () => '</div>\n';

  return md;
}

// Frontmatter YAML sencillo (clave: valor, listas [a, b]). Devuelve { datos, lineas } (líneas que ocupa, 0 si no hay).
function leerFrontmatter(src) {
  src = src.replace(/\r\n/g, '\n');   // en Windows el fichero viene con CRLF; las líneas se cuentan igual
  if (!src.startsWith('---\n')) return { datos: null, lineas: 0 };
  const fin = src.indexOf('\n---', 4);
  if (fin < 0) return { datos: null, lineas: 0 };
  const cuerpo = src.slice(4, fin);
  const datos = {};
  for (const l of cuerpo.split('\n')) {
    const m = l.match(/^([\w-]+):\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v.startsWith('[') && v.endsWith(']')) v = v.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
    else if (v === 'true') v = true; else if (v === 'false') v = false;
    datos[m[1]] = v;
  }
  return { datos, lineas: cuerpo.split('\n').length + 2 };
}

module.exports = { crearRender, leerFrontmatter };
