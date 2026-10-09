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
  '&:focus-within': { outline: '2px solid var(--acento)', outlineOffset: '4px', borderRadius: 'var(--radio)' },
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

function construir(estado) {
  const doc = estado.doc, arbol = ensureSyntaxTree(estado, doc.length, 200) || syntaxTree(estado);
  const sel = estado.selection.main;
  const act0 = doc.lineAt(sel.from).from, act1 = doc.lineAt(sel.to).to;   // las líneas con el cursor: ahí se ve el crudo
  const activo = (a, b) => b >= act0 && a <= act1;
  const decos = [], codigos = [];
  for (let p = act0; p <= act1; ) { const l = doc.lineAt(p); decos.push(linea('live-activa').range(l.from)); p = l.to + 1; }
  arbol.iterate({
    enter(nodo) {
      const { name: nm, from, to } = nodo;
      if (nm === 'FencedCode' || nm === 'CodeBlock') { codigos.push([from, to]); return false; }   // el código en bloque es de otra tarea
      if (nm === 'Image') return false;
      const ac = activo(from, to);
      if (/^ATXHeading[1-6]$/.test(nm)) decos.push(linea('live-h' + nm.slice(-1)).range(doc.lineAt(from).from));
      else if (nm === 'HeaderMark') { const padre = nodo.node.parent; if (padre && /^ATXHeading/.test(padre.name) && !ac) decos.push(ocultar.range(from, Math.min(to + 1, doc.lineAt(from).to))); }
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
  // Lo que el árbol Markdown no conoce: [[wikilinks]] y #etiquetas, línea a línea y fuera del código.
  const enCodigo = p => codigos.some(([a, b]) => p >= a && p < b);
  for (let n = 1; n <= doc.lines; n++) {
    const l = doc.line(n);
    if (!l.text.includes('[[') && !l.text.includes('#')) continue;
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
  return Decoration.set(decos, true);
}

const vistaPrevia = StateField.define({
  create: construir,
  update(v, tr) { return tr.docChanged || tr.selection || syntaxTree(tr.state) !== syntaxTree(tr.startState) ? construir(tr.state) : v; },
  provide: f => EditorView.decorations.from(f),
});

let vista = null;

// Monta el editor en `contenedor` con `texto` (LF). `posicion`: el desplazamiento donde queda el cursor, y que se
// trae a la vista. `plano`: sin decoraciones (el Markdown tal cual).
export function montar(contenedor, texto, { plano = false, posicion = 0 } = {}) {
  destruir();
  const extensiones = [
    history(), drawSelection(), EditorView.lineWrapping,
    markdown({ extensions: [GFM] }),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    EditorView.contentAttributes.of({ 'aria-label': 'Editor de la nota', 'aria-multiline': 'true' }),
    tema,
  ];
  if (!plano) extensiones.push(vistaPrevia);
  const pos = Math.max(0, Math.min(posicion, texto.length));
  vista = new EditorView({ state: EditorState.create({ doc: texto, selection: { anchor: pos }, extensions: extensiones }), parent: contenedor });
  vista.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'start', yMargin: 80 }) });
  vista.focus();
  return vista;
}

export function destruir() { if (vista) { vista.destroy(); vista = null; } }
export const texto = () => vista ? vista.state.doc.toString() : null;
// El número de línea (desde 0) donde está el cursor.
export const lineaDelCursor = () => vista ? vista.state.doc.lineAt(vista.state.selection.main.head).number - 1 : null;
