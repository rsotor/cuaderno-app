// El editor de la nota entera: CodeMirror 6 sin bundler (los paquetes se resuelven con el import map de index.html).
// El documento es el texto del fichero tal cual; la app solo lo escribe cuando se aplica (/api/nota/escribir).
// Por ahora solo el modo plano: el mismo editor sin decoraciones (letra de la hoja, no monoespaciada). El modo con
// vista (decoraciones y widgets sobre este mismo documento) llega en las tareas siguientes del bloque.
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, drawSelection } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
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

let vista = null;

// Monta el editor en `contenedor` con `texto` (LF). `posicion`: el desplazamiento donde queda el cursor, y que se
// trae a la vista. `plano`: sin decoraciones (hoy el único modo).
export function montar(contenedor, texto, { plano = false, posicion = 0 } = {}) {
  destruir();
  const extensiones = [
    history(), drawSelection(), EditorView.lineWrapping,
    markdown({ extensions: [GFM] }),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    EditorView.contentAttributes.of({ 'aria-label': 'Editor de la nota', 'aria-multiline': 'true' }),
    tema,
  ];
  void plano;   // por ahora el modo con vista y el plano son lo mismo
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
