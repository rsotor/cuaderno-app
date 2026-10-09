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

  // --- Imágenes: una ruta relativa se resuelve desde la carpeta de la nota y se sirve desde el cuaderno (/fichero/…).
  // Vale para ![texto](ruta) y para el embed de Obsidian ![[fichero.png]]. Las absolutas (http, /) se quedan como están.
  const rutaImagen = (env, src) => {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(src)) return src;
    const carpeta = (env && env.ruta ? env.ruta : '').split('/').slice(0, -1);
    for (const tramo of src.split('/')) { if (tramo === '..') carpeta.pop(); else if (tramo && tramo !== '.') carpeta.push(tramo); }
    return `/fichero/${encodeURI(carpeta.join('/'))}`;
  };
  // --- Enlaces relativos ([texto](otra-nota.md), [datos](datos.json)): a la vista de ese fichero en la app (#/n/…),
  // resueltos desde la carpeta de la nota. Las URL y las anclas (#sección) se quedan como están.
  const enlaceBase = md.renderer.rules.link_open || ((t, i, o, env, self) => self.renderToken(t, i, o));
  md.renderer.rules.link_open = (t, i, o, env, self) => {
    const href = t[i].attrGet('href') || '';
    if (href && !/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(href)) {
      const [ruta] = href.split('#');
      t[i].attrSet('href', `#/n/${rutaImagen(env, decodeURI(ruta)).slice('/fichero/'.length)}`);
    }
    return enlaceBase(t, i, o, env, self);
  };
  const imagenBase = md.renderer.rules.image;
  md.renderer.rules.image = (t, i, o, env, self) => { t[i].attrSet('src', rutaImagen(env, t[i].attrGet('src') || '')); return imagenBase(t, i, o, env, self); };
  md.inline.ruler.before('wikilink', 'imagen_wiki', (state, silent) => {
    const src = state.src, pos = state.pos;
    if (src[pos] !== '!' || src[pos + 1] !== '[' || src[pos + 2] !== '[') return false;
    const cierre = src.indexOf(']]', pos + 3);
    if (cierre < 0) return false;
    const dentro = src.slice(pos + 3, cierre);
    if (!dentro || dentro.includes('\n') || !/\.(png|jpe?g|gif|svg|webp)$/i.test(dentro.split('|')[0].trim())) return false;
    const [fichero, alt] = dentro.split('|').map(s => s.trim());
    if (!silent) { const t = state.push('imagen_wiki', '', 0); t.attrSet('src', rutaImagen(state.env, fichero)); t.content = alt || fichero; }
    state.pos = cierre + 2;
    return true;
  });
  md.renderer.rules.imagen_wiki = (t, i) => `<img src="${md.utils.escapeHtml(t[i].attrGet('src'))}" alt="${md.utils.escapeHtml(t[i].content)}">`;

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
          // La línea entera es la etiqueta de la casilla: clicar el texto marca, y la casilla tiene nombre accesible.
          if (ts[i + 4]?.type === 'paragraph_close') ts.splice(i + 4, 0, new state.Token('casilla_fin', '', 0));
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
    return `<label class="casilla-linea"><input type="checkbox" class="casilla" data-linea="${linea}"${marcada ? ' checked' : ''}> `;
  };
  md.renderer.rules.casilla_fin = () => '</label>';

  // --- Bloques editables: cada bloque de nivel 0 se envuelve con sus líneas de origen.
  md.core.ruler.push('bloques', (state) => {
    if (state.inlineMode) return;   // renderInline: sin envoltorios de bloque
    const ts = state.tokens, salida = [], lineas = state.src.split('\n');
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i];
      if (t.level === 0 && t.map && (t.nesting === 1 || t.nesting === 0)) {
        // markdown-it da a las listas la línea en blanco que las sigue: fuera, que el bloque sea solo la lista.
        let hasta = t.map[1]; while (hasta > t.map[0] + 1 && !(lineas[hasta - 1] || '').trim()) hasta--;
        let j = i;
        if (t.nesting === 1) { let prof = 0; for (j = i; j < ts.length; j++) { prof += ts[j].nesting; if (prof === 0) break; } }
        const abre = new state.Token('bloque_open', '', 0); abre.meta = { desde: t.map[0], hasta };
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
  let lista = null;   // la clave cuya lista viene en las líneas siguientes («etiquetas:» y debajo «  - una»), como escribe Obsidian
  for (const l of cuerpo.split('\n')) {
    const item = l.match(/^\s+-\s+(.*)$/);
    if (item && lista) { datos[lista].push(item[1].trim().replace(/^(["'])(.*)\1$/, '$2')); continue; }
    lista = null;
    const m = l.match(/^([\w-]+):\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v === '') { datos[m[1]] = []; lista = m[1]; continue; }
    if (v.startsWith('[') && v.endsWith(']')) v = v.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
    else if (v === 'true') v = true; else if (v === 'false') v = false;
    datos[m[1]] = v;
  }
  for (const k of Object.keys(datos)) if (Array.isArray(datos[k]) && !datos[k].length && !/^\s*[\w-]+:\s*\[\s*\]/m.test(cuerpo.split('\n').find(l => l.startsWith(k + ':')) || '')) datos[k] = '';   // «clave:» vacía sin lista debajo: vacía, no lista
  return { datos, lineas: cuerpo.split('\n').length + 2 };
}

module.exports = { crearRender, leerFrontmatter };
