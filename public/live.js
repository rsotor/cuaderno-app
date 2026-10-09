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
  constructor(marcada) { super(); this.marcada = marcada; }
  eq(o) { return o.marcada === this.marcada; }
  toDOM(vista) {
    const i = document.createElement('input');
    i.type = 'checkbox'; i.className = 'live-casilla'; i.checked = this.marcada; i.tabIndex = -1; i.setAttribute('aria-label', 'Casilla');
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
            decos.push(Decoration.replace({ widget: new Casilla(hecha) }).range(from, marcador.to));
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

let vista = null;

// Monta el editor en `contenedor` con `texto` (LF). `posicion`: el desplazamiento donde queda el cursor, y que se
// trae a la vista. `plano`: sin decoraciones (el Markdown tal cual).
export function montar(contenedor, texto, { plano = false, posicion = 0, ruta = '', propiedades = '', alCambiar = null } = {}) {
  destruir();
  contexto = { ruta, cache: new Map(), alturas: new Map(), propiedades };
  const extensiones = [
    history(), drawSelection(), EditorView.lineWrapping,
    markdown({ extensions: [GFM] }),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    EditorView.contentAttributes.of({ 'aria-label': 'Editor de la nota', 'aria-multiline': 'true' }),
    tema,
  ];
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
