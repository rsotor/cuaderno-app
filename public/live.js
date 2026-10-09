// El editor de la nota entera: CodeMirror 6 sin bundler (los paquetes se resuelven con el import map de index.html).
// El documento es el texto del fichero tal cual; la app solo lo escribe cuando se aplica (/api/nota/escribir).
// Dos modos sobre el mismo documento: «plano» (sin decoraciones: el Markdown tal cual, con la letra de la hoja) y
// «con vista» (live preview: la extensión `vistaPrevia` oculta los marcadores salvo en la línea del cursor y pinta
// títulos, énfasis, enlaces, etiquetas, viñetas, citas y casillas). Los bloques (fórmulas, callouts, tablas) son de
// una tarea posterior. Las decoraciones nunca cambian el texto: el fichero es lo que se ve en el modo plano.
import { EditorState, StateField } from '@codemirror/state';
import { EditorView, Decoration, WidgetType, keymap, drawSelection } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import { GFM } from '@lezer/markdown';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';

// Aspecto: todo de la hoja (tokens de estilo.css); sin bordes de editor ni números de línea.
const tema = EditorView.theme({
  '&': { background: 'transparent', color: 'var(--tinta)', fontSize: '16px', maxWidth: '800px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: 'inherit', overflow: 'visible' },
  '.cm-content': { fontFamily: 'inherit', padding: '0', caretColor: 'var(--tinta)' },
  '.cm-line': { padding: '0' },
  '.cm-cursor': { borderLeftColor: 'var(--tinta)' },
  '.cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': { background: 'var(--acento-suave)' },
  '&:focus-within': { outline: '2px solid var(--acento)', outlineOffset: '12px', borderRadius: 'var(--radio)' },
});

// ---------- live preview (inline)
class Vineta extends WidgetType {
  eq() { return true; }
  toDOM() { const s = document.createElement('span'); s.className = 'live-vineta'; s.textContent = '•'; return s; }
}
// «- [ ]» / «- [x]» como casilla de verdad: el clic cambia el texto del documento (no el fichero: eso es Aplicar).
class Casilla extends WidgetType {
  constructor(marcada, tarea = '') { super(); this.marcada = marcada; this.tarea = tarea; }
  eq(o) { return o.marcada === this.marcada && o.tarea === this.tarea; }
  toDOM(vista) {
    const i = document.createElement('input');
    i.type = 'checkbox'; i.className = 'live-casilla'; i.checked = this.marcada; i.tabIndex = -1; i.setAttribute('aria-label', this.tarea ? `Casilla: ${this.tarea}` : 'Casilla');   // con el texto de la tarea; con teclado se cambia el «[ ]» de la línea activa
    i.addEventListener('mousedown', e => e.preventDefault());   // no mueve el cursor
    i.addEventListener('click', e => {
      e.preventDefault();
      const pos = vista.posAtDOM(i), corchete = vista.state.doc.sliceString(pos, pos + 8).indexOf('[');
      if (corchete < 0) return;
      const c = pos + corchete + 1;
      vista.dispatch({ changes: { from: c, to: c + 1, insert: this.marcada ? ' ' : 'x' } });
    });
    return i;
  }
  ignoreEvent() { return true; }
}
const ocultar = Decoration.replace({});
const linea = c => Decoration.line({ class: c });
const marca = c => Decoration.mark({ class: c });
// Igual que cuaderno.js (RE_ETIQUETA): «#» tras un espacio, «(» o el principio, y una letra.
const RE_ETIQUETA = /(^|[\s(])#(\p{L}[\p{L}\p{N}_\-/]*)/gu;
const RE_WIKI = /\[\[([^\]\n]+)\]\]/g;

// ---------- live preview (bloques): fórmula, callout, tabla y código se pintan con el HTML de /api/render (el mismo render
// que la lectura); las propiedades (frontmatter) son una tabla de solo lectura. Con el cursor dentro de un bloque se ve el crudo.
let contexto = { ruta: '', cache: new Map(), alturas: new Map(), propiedades: '' };   // del editor montado; se vacía en destruir()
const pintarKatex = el => el.querySelectorAll('.math').forEach(m => { try { window.katex.render(m.textContent, m, { displayMode: m.dataset.display === '1', throwOnError: false }); } catch { /* se queda el texto */ } });
// Lo de la lectura que escribiría en el fichero desde dentro del widget (casillas de una tabla) o llevaría a otra nota: inerte.
const volverInerte = el => { el.querySelectorAll('input').forEach(i => { i.disabled = true; i.removeAttribute('data-linea'); }); el.addEventListener('click', e => { if (e.target.closest('a')) e.preventDefault(); }); };
// Un clic en el widget lleva el cursor al bloque (se ve el crudo), salvo en el título de un callout: ese lo pliega (app.js).
function alPulsar(d, vista, destino) {
  d.addEventListener('mousedown', e => {
    e.preventDefault();   // también en el título: sin esto el navegador mueve la selección al widget y entra el crudo
    if (e.target.closest('.callout-titulo[data-plegable="1"]')) return;   // ese el clic lo pliega (app.js)
    vista.dispatch({ selection: { anchor: destino(vista) }, scrollIntoView: false });
    vista.focus();
  });
}
class BloqueHtml extends WidgetType {
  constructor(texto, clase) { super(); this.texto = texto; this.clase = clase; }
  eq(o) { return o.texto === this.texto && o.clase === this.clase; }
  get estimatedHeight() { return contexto.alturas.get(this.texto) || 60; }   // lo que se midió la última vez, o 60: el clic cae donde se ve
  toDOM(vista) {
    const d = document.createElement('div'); d.className = `live-bloque ${this.clase}`;
    const ctx = contexto, texto = this.texto;
    const poner = html => { d.innerHTML = html; volverInerte(d); pintarKatex(d); vista.requestMeasure(); };
    if (ctx.cache.has(texto)) poner(ctx.cache.get(texto));
    else {
      d.textContent = '…';
      fetch('/api/render', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ texto, ruta: ctx.ruta }) })
        .then(r => r.ok ? r.json() : Promise.reject(new Error(String(r.status)))).then(r => { ctx.cache.set(texto, r.html); poner(r.html); })
        .catch(() => { d.textContent = texto; d.style.whiteSpace = 'pre-wrap'; });
    }
    // Las alturas cambian cuando llega el HTML y cuando KaTeX o las fuentes terminan: se miden otra vez y se recuerdan.
    d._observador = new ResizeObserver(() => { ctx.alturas.set(texto, d.offsetHeight); vista.requestMeasure(); });
    d._observador.observe(d);
    alPulsar(d, vista, v => v.posAtDOM(d));
    return d;
  }
  destroy(dom) { if (dom._observador) dom._observador.disconnect(); }
  ignoreEvent() { return true; }
}
class Propiedades extends WidgetType {
  constructor(html, cuerpo) { super(); this.html = html; this.cuerpo = cuerpo; }
  eq(o) { return o.html === this.html && o.cuerpo === this.cuerpo; }
  get estimatedHeight() { return 40; }
  toDOM(vista) {
    const d = document.createElement('div'); d.className = 'live-propiedades'; d.innerHTML = this.html;
    alPulsar(d, vista, () => this.cuerpo);   // las propiedades no se editan aquí: el clic deja el cursor en el cuerpo
    return d;
  }
  ignoreEvent() { return true; }
}

// El frontmatter: «---» en la primera línea y el siguiente «---». { from: 0, to: fin de la línea de cierre, cuerpo: donde empieza el cuerpo }.
export function frontmatterDe(doc) {
  if (doc.lines < 2 || doc.line(1).text !== '---') return null;
  for (let n = 2; n <= doc.lines; n++) if (doc.line(n).text === '---') { const to = doc.line(n).to; return { from: 0, to, cuerpo: Math.min(to + 1, doc.length) }; }
  return null;
}

function construir(estado) {
  const doc = estado.doc, arbol = ensureSyntaxTree(estado, doc.length, 200) || syntaxTree(estado);
  const sel = estado.selection.main;
  const act0 = doc.lineAt(sel.from).from, act1 = doc.lineAt(sel.to).to;   // las líneas con el cursor: ahí se ve el crudo
  const activo = (a, b) => b >= act0 && a <= act1;
  const dentroDe = (a, b) => sel.to >= a && sel.from <= b;   // el cursor (o la selección) toca el bloque
  const decos = [], codigos = [], bloques = [];
  const fm = frontmatterDe(doc);
  // Los bloques que se pintan como widget: de línea completa y sin anidar (uno dentro de una lista o una cita se queda en crudo).
  const completo = (a, b) => doc.lineAt(a).from === a && doc.lineAt(b).to === b;
  const libre = (a, b) => !(fm && a <= fm.to) && !bloques.some(x => a <= x.to && b >= x.from);
  const nuevo = (from, to, clase) => { if (completo(from, to) && libre(from, to)) bloques.push({ from, to, clase }); };
  arbol.iterate({
    enter(nodo) {
      const { name: nm, from, to } = nodo;
      if (nm === 'FencedCode') { nuevo(from, to, 'live-codigo'); codigos.push([from, to]); return false; }
      if (nm === 'CodeBlock') { codigos.push([from, to]); return false; }
      if (nm === 'Table') { nuevo(from, to, 'live-tabla'); return false; }
      if (nm === 'Blockquote' && /^>\s*\[!\w+\]/.test(doc.sliceString(from, to))) { nuevo(from, to, 'live-callout'); return false; }
    },
  });
  for (let n = 1; n <= doc.lines; n++) {   // fórmulas en bloque $$ … $$ (el árbol no las conoce)
    const l = doc.line(n);
    if (!/^\s*\$\$/.test(l.text) || !libre(l.from, l.to) || codigos.some(([a, b]) => l.from >= a && l.from <= b)) continue;
    let fin = 0;
    if (/^\s*\$\$.+\$\$\s*$/.test(l.text)) fin = n;
    else for (let k = n + 1; k <= doc.lines; k++) if (/^\s*\$\$\s*$/.test(doc.line(k).text)) { fin = k; break; }
    if (!fin) continue;
    nuevo(l.from, doc.line(fin).to, 'live-formula'); n = fin;
  }
  bloques.sort((a, b) => a.from - b.from);
  const dentro = p => (fm && p <= fm.to) || bloques.some(b => p >= b.from && p <= b.to);   // ahí no hay decoraciones en línea
  for (const b of bloques) {
    if (dentroDe(b.from, b.to)) { for (let p = b.from; p <= b.to; ) { const l = doc.lineAt(p); decos.push(linea('live-crudo').range(l.from)); p = l.to + 1; } }   // crudo, a la vista
    else decos.push(Decoration.replace({ widget: new BloqueHtml(doc.sliceString(b.from, b.to), b.clase), block: true }).range(b.from, b.to));
  }
  if (fm) decos.push(Decoration.replace({ widget: new Propiedades(contexto.propiedades, fm.cuerpo), block: true }).range(fm.from, fm.to));
  for (let n = 1; n <= doc.lines; n++) { const l = doc.line(n); if (l.text === '' && !dentro(l.from) && !activo(l.from, l.to)) decos.push(linea('live-vacia').range(l.from)); }   // las líneas en blanco, bajas
  for (let p = act0; p <= act1; ) { const l = doc.lineAt(p); if (!(fm && p <= fm.to) && !bloques.some(b => p >= b.from && p <= b.to && !dentroDe(b.from, b.to))) decos.push(linea('live-activa').range(l.from)); p = l.to + 1; }
  arbol.iterate({
    enter(nodo) {
      const { name: nm, from, to } = nodo;
      if (nm === 'Document') return;
      if (dentro(from)) return false;
      if (nm === 'FencedCode' || nm === 'CodeBlock') return false;   // el código en bloque, en crudo, no se decora
      if (nm === 'Image') return false;
      const ac = activo(from, to);
      if (/^ATXHeading[1-6]$/.test(nm)) decos.push(linea('live-h' + nm.slice(-1)).range(doc.lineAt(from).from));
      else if (nm === 'HeaderMark') { const padre = nodo.node.parent; if (padre && /^ATXHeading/.test(padre.name)) decos.push(ac ? marca('live-marca').range(from, Math.min(to + 1, doc.lineAt(from).to)) : ocultar.range(from, Math.min(to + 1, doc.lineAt(from).to))); }
      else if (nm === 'StrongEmphasis') decos.push(marca('live-negrita').range(from, to));
      else if (nm === 'Emphasis') decos.push(marca('live-cursiva').range(from, to));
      else if (nm === 'Strikethrough') decos.push(marca('live-tachado').range(from, to));
      else if (nm === 'InlineCode') { codigos.push([from, to]); decos.push(marca('live-codigo-en-linea').range(from, to)); }
      else if (nm === 'EmphasisMark' || nm === 'CodeMark' || nm === 'StrikethroughMark') { if (!ac) decos.push(ocultar.range(from, to)); }
      else if (nm === 'Link') {
        // Solo los enlaces con destino «[texto](url)»: «[[nota]]» el árbol lo toma por un enlace sin destino y se trata abajo.
        const marcas = nodo.node.getChildren('LinkMark');
        if (!nodo.node.getChild('URL') || marcas.length < 2) return;
        decos.push(marca('live-enlace').range(from, to));
        if (!ac) { decos.push(ocultar.range(marcas[0].from, marcas[0].to)); decos.push(ocultar.range(marcas[1].from, to)); }
      } else if (nm === 'Blockquote') { for (let p = from; p <= to; ) { const l = doc.lineAt(p); decos.push(linea('live-cita').range(l.from)); p = l.to + 1; } }
      else if (nm === 'QuoteMark') { if (!ac) decos.push(ocultar.range(from, Math.min(to + (doc.sliceString(to, to + 1) === ' ' ? 1 : 0), doc.length))); }
      else if (nm === 'ListMark') {
        const item = nodo.node.parent, lista = item && item.parent;
        if (!ac && lista && lista.name === 'BulletList') {
          const marcador = item.getChild('Task') && item.getChild('Task').getChild('TaskMarker');
          if (marcador) {
            const hecha = /[xX]/.test(doc.sliceString(marcador.from, marcador.to));
            decos.push(Decoration.replace({ widget: new Casilla(hecha, doc.lineAt(from).text.replace(/^\s*[-*+] \[[ xX]\]\s*/, '').slice(0, 80)) }).range(from, marcador.to));
            if (hecha) decos.push(linea('live-hecha').range(doc.lineAt(from).from));
          } else decos.push(Decoration.replace({ widget: new Vineta() }).range(from, to));
        }
      }
    },
  });
  // Lo que el árbol Markdown no conoce: [[wikilinks]] y #etiquetas, línea a línea y fuera del código y de los bloques.
  const enCodigo = p => codigos.some(([a, b]) => p >= a && p < b);
  for (let n = 1; n <= doc.lines; n++) {
    const l = doc.line(n);
    if ((!l.text.includes('[[') && !l.text.includes('#')) || dentro(l.from)) continue;
    const ac = activo(l.from, l.to);
    for (const m of l.text.matchAll(RE_WIKI)) {
      const a = l.from + m.index, b = a + m[0].length;
      if (enCodigo(a)) continue;
      decos.push(marca('live-wiki').range(a, b));
      if (!ac) { const barra = m[1].lastIndexOf('|'); decos.push(ocultar.range(a, a + 2 + (barra >= 0 ? barra + 1 : 0))); decos.push(ocultar.range(b - 2, b)); }
    }
    for (const m of l.text.matchAll(RE_ETIQUETA)) {
      const a = l.from + m.index + m[1].length;
      if (!enCodigo(a)) decos.push(marca('live-etiqueta').range(a, a + 1 + m[2].length));
    }
  }
  return { decos: Decoration.set(decos, true), fm };
}

const vistaPrevia = StateField.define({
  create: construir,
  update(v, tr) { return tr.docChanged || tr.selection || syntaxTree(tr.state) !== syntaxTree(tr.startState) ? construir(tr.state) : v; },
  provide: f => EditorView.decorations.from(f, v => v.decos),
});
// Las propiedades no se editan en el contenido: el cursor las salta, no se escribe en ellas y Ctrl+Inicio / Ctrl+A van al cuerpo.
const protegerPropiedades = [
  EditorView.atomicRanges.of(vista => { const fm = vista.state.field(vistaPrevia).fm; return fm ? Decoration.set([ocultar.range(fm.from, fm.to)]) : Decoration.none; }),
  EditorState.changeFilter.of(tr => { const fm = tr.startState.field(vistaPrevia).fm; return fm ? [fm.from, fm.cuerpo] : true; }),
  keymap.of([
    { key: 'Mod-Home', run: v => { const fm = v.state.field(vistaPrevia).fm; if (!fm) return false; v.dispatch({ selection: { anchor: fm.cuerpo }, scrollIntoView: true }); return true; } },
    { key: 'Mod-a', run: v => { const fm = v.state.field(vistaPrevia).fm; if (!fm) return false; v.dispatch({ selection: { anchor: fm.cuerpo, head: v.state.doc.length }, userEvent: 'select' }); return true; } },
  ]),
];


// ---------- formato: comandos sobre la selección principal (barra y atajos). Rodean o quitan según el estado actual,
// leído del árbol Markdown: si la selección ya está dentro de una negrita, el comando quita sus marcadores.
function nodoQue(estado, nombres, from, to) {
  const arbol = syntaxTree(estado);
  for (const [pos, lado] of [[from, 1], [from, -1], [to, -1]]) {
    for (let n = arbol.resolveInner(pos, lado); n; n = n.parent) if (nombres.includes(n.name) && n.from <= from && n.to >= to) return n;
  }
  return null;
}
// Los marcadores de un nodo (los de sus extremos): [primero, último] o null.
function marcasDe(nodo, nombre) {
  const marcas = nodo.getChildren(nombre);
  return marcas.length >= 2 && marcas[0].from === nodo.from && marcas[marcas.length - 1].to === nodo.to ? [marcas[0], marcas[marcas.length - 1]] : null;
}
const NODOS = { negrita: ['StrongEmphasis', 'EmphasisMark'], cursiva: ['Emphasis'], codigo: ['InlineCode'] };
function envolver(v, marca, nodos, nombreMarca) {
  const { from, to } = v.state.selection.main;
  const nodo = nodoQue(v.state, nodos, from, to), marcas = nodo && marcasDe(nodo, nombreMarca);
  if (marcas) { v.dispatch({ changes: [{ from: marcas[0].from, to: marcas[0].to }, { from: marcas[1].from, to: marcas[1].to }], userEvent: 'input.format' }); return true; }
  const n = marca.length;
  if (from === to) v.dispatch({ changes: { from, insert: marca + marca }, selection: { anchor: from + n }, userEvent: 'input.format' });   // sin selección: el cursor, dentro
  else v.dispatch({ changes: [{ from, insert: marca }, { from: to, insert: marca }], selection: { anchor: from + n, head: to + n }, userEvent: 'input.format' });
  return true;
}
const lineasDe = estado => {   // las líneas que toca la selección principal
  const { from, to } = estado.selection.main, ls = [];
  for (let n = estado.doc.lineAt(from).number; n <= estado.doc.lineAt(to).number; n++) ls.push(estado.doc.line(n));
  return ls;
};
const RE_ITEM = /^(\s*)[-*+] /, RE_TAREA = /^(\s*)[-*+] \[[ xX]\] /, RE_TITULO = /^(#{1,6}) /;
const objetivos = ls => { const con = ls.filter(l => l.text.trim() !== ''); return con.length ? con : ls; };   // las líneas en blanco no cuentan
function porLineas(v, cambiar) {   // cambiar(linea) → { from, to, insert } o null
  const cambios = lineasDe(v.state).map(cambiar).filter(Boolean);
  if (cambios.length) v.dispatch({ changes: cambios, userEvent: 'input.format' });
  return true;
}
// Título: sin título pone «## » (el «#» es el título de la nota); en uno ya puesto sube de nivel (## → ### → ####) y en «####» lo quita.
function titulo(v) {
  return porLineas(v, l => {
    const m = l.text.match(RE_TITULO);
    if (!m) return { from: l.from, insert: '## ' };
    return m[1].length >= 4 ? { from: l.from, to: l.from + m[0].length, insert: '' } : { from: l.from, to: l.from + m[1].length, insert: '#'.repeat(m[1].length + 1) };
  });
}
function lista(v) {
  const todas = objetivos(lineasDe(v.state)).every(l => RE_ITEM.test(l.text));
  return porLineas(v, l => {
    if (l.text.trim() === '') return null;
    if (todas) { const m = l.text.match(/^(\s*)[-*+] (\[[ xX]\] )?/); return { from: l.from, to: l.from + m[0].length, insert: m[1] }; }
    if (RE_ITEM.test(l.text)) return null;
    const sangria = l.text.match(/^\s*/)[0];
    return { from: l.from + sangria.length, insert: '- ' };
  });
}
function casilla(v) {
  const todas = objetivos(lineasDe(v.state)).every(l => RE_TAREA.test(l.text));
  return porLineas(v, l => {
    if (l.text.trim() === '') return null;
    if (todas) { const m = l.text.match(RE_TAREA); return { from: l.from, to: l.from + m[0].length, insert: m[1] }; }
    if (RE_TAREA.test(l.text)) return null;
    const m = l.text.match(RE_ITEM);
    if (m) return { from: l.from + m[0].length, insert: '[ ] ' };   // «- texto» → «- [ ] texto»
    const sangria = l.text.match(/^\s*/)[0];
    return { from: l.from + sangria.length, insert: '- [ ] ' };
  });
}
function enlace(v) {
  const { from, to } = v.state.selection.main, doc = v.state.doc;
  const nodo = nodoQue(v.state, ['Link'], from, to);
  if (nodo && nodo.getChild('URL')) {   // ya es un enlace: se queda el texto
    const marcas = nodo.getChildren('LinkMark'), texto = doc.sliceString(marcas[0].to, marcas[1].from);
    v.dispatch({ changes: { from: nodo.from, to: nodo.to, insert: texto }, selection: { anchor: nodo.from, head: nodo.from + texto.length }, userEvent: 'input.format' });
    return true;
  }
  const texto = from === to ? 'texto' : doc.sliceString(from, to), ancla = from + texto.length + 3;   // «[texto](» y la url queda seleccionada
  v.dispatch({ changes: { from, to, insert: `[${texto}](url)` }, selection: { anchor: ancla, head: ancla + 3 }, userEvent: 'input.format' });
  return true;
}
function codigo(v) {
  const { from, to } = v.state.selection.main, doc = v.state.doc;
  const bloque = nodoQue(v.state, ['FencedCode'], from, to);
  if (bloque) {   // dentro de un bloque: se quitan las vallas
    const a = doc.lineAt(bloque.from), b = doc.lineAt(bloque.to);
    v.dispatch({ changes: [{ from: a.from, to: Math.min(a.to + 1, doc.length) }, { from: Math.max(b.from - 1, a.to), to: b.to }], userEvent: 'input.format' });
    return true;
  }
  if (doc.lineAt(from).number !== doc.lineAt(to).number) {   // varias líneas: un bloque
    const a = doc.lineAt(from), b = doc.lineAt(to);
    v.dispatch({ changes: [{ from: a.from, insert: '```\n' }, { from: b.to, insert: '\n```' }], userEvent: 'input.format' });
    return true;
  }
  return envolver(v, '`', NODOS.codigo, 'CodeMark');
}
const COMANDOS = {
  negrita: v => envolver(v, '**', NODOS.negrita.slice(0, 1), 'EmphasisMark'),
  cursiva: v => envolver(v, '*', NODOS.cursiva, 'EmphasisMark'),
  titulo, lista, casilla, enlace, codigo,
};
export const FORMATOS = Object.keys(COMANDOS);
// Aplica un formato (o lo quita) en el editor montado.
export function formato(nombre) { return vista && COMANDOS[nombre] ? COMANDOS[nombre](vista) : false; }
// Qué formatos tiene la selección (para aria-pressed).
export function formatosActivos() {
  const r = Object.fromEntries(FORMATOS.map(f => [f, false]));
  if (!vista) return r;
  const st = vista.state, { from, to } = st.selection.main, ls = objetivos(lineasDe(st));
  r.negrita = !!nodoQue(st, ['StrongEmphasis'], from, to);
  r.cursiva = !!nodoQue(st, ['Emphasis'], from, to);
  r.titulo = ls.every(l => RE_TITULO.test(l.text));
  r.lista = ls.every(l => RE_ITEM.test(l.text));
  r.casilla = ls.every(l => RE_TAREA.test(l.text));
  const enlaceNodo = nodoQue(st, ['Link'], from, to);
  r.enlace = !!(enlaceNodo && enlaceNodo.getChild('URL'));
  r.codigo = !!nodoQue(st, ['InlineCode', 'FencedCode'], from, to);
  return r;
}
const atajosFormato = keymap.of([
  { key: 'Mod-b', run: v => COMANDOS.negrita(v) },
  { key: 'Mod-i', run: v => COMANDOS.cursiva(v) },   // gana a «seleccionar el padre» de defaultKeymap. Ctrl K (enlace) choca con el buscador de la app: sin atajo
]);

let vista = null;

// Monta el editor en `contenedor` con `texto` (LF). `posicion`: el desplazamiento donde queda el cursor, y que se
// trae a la vista. `plano`: sin decoraciones (el Markdown tal cual).
export function montar(contenedor, texto, { plano = false, posicion = 0, ruta = '', propiedades = '', alCambiar = null, alSeleccionar = null } = {}) {
  destruir();
  contexto = { ruta, cache: new Map(), alturas: new Map(), propiedades };
  const extensiones = [
    history(), drawSelection(), EditorView.lineWrapping,
    markdown({ extensions: [GFM] }),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    EditorView.contentAttributes.of({ 'aria-label': 'Editor de la nota', 'aria-multiline': 'true' }),
    tema,
  ];
  if (alSeleccionar) extensiones.push(EditorView.updateListener.of(u => { if (u.docChanged || u.selectionSet) alSeleccionar(); }));
  extensiones.unshift(atajosFormato);
  if (alCambiar) extensiones.push(EditorView.updateListener.of(u => { if (u.docChanged) alCambiar(); }));
  if (!plano) extensiones.unshift(protegerPropiedades, vistaPrevia);
  let pos = Math.max(0, Math.min(posicion, texto.length));
  if (!plano) { const lineas = texto.split('\n'); if (lineas[0] === '---') { const k = lineas.indexOf('---', 1); if (k > 0) pos = Math.max(pos, Math.min(lineas.slice(0, k + 1).join('\n').length + 1, texto.length)); } }   // nunca dentro de las propiedades
  vista = new EditorView({ state: EditorState.create({ doc: texto, selection: { anchor: pos }, extensions: extensiones }), parent: contenedor });
  vista.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'start', yMargin: 80 }) });
  vista.focus();
  return vista;
}

export function destruir() { if (vista) { vista.destroy(); vista = null; } contexto = { ruta: '', cache: new Map(), alturas: new Map(), propiedades: '' }; }
export const enfocar = () => { if (vista) vista.focus(); };
export const texto = () => vista ? vista.state.doc.toString() : null;
// El número de línea (desde 0) donde está el cursor.
export const lineaDelCursor = () => vista ? vista.state.doc.lineAt(vista.state.selection.main.head).number - 1 : null;
