/* global katex, Terminal, FitAddon */
'use strict';
const $ = s => document.querySelector(s);
const api = (p, body) => fetch(p, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined).then(r => r.json());
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let arbol = [], rutaActual = null;

function avisar(msg) { const d = document.createElement('div'); d.className = 'aviso-flotante'; d.textContent = msg; document.body.append(d); setTimeout(() => d.remove(), 1800); }

// ---------- árbol
function pintarArbol(lista) {
  const raiz = {};
  for (const p of lista) { let n = raiz; const partes = p.split('/'); partes.forEach((s, i) => { if (i === partes.length - 1) (n.__f ??= []).push(p); else n = (n[s] ??= {}); }); }
  const pintar = (n, abierto) => Object.keys(n).filter(k => k !== '__f').sort((a, b) => a.localeCompare(b, 'es')).map(k => `<details${abierto ? ' open' : ''}><summary>${esc(k)}</summary>${pintar(n[k], false)}</details>`).join('')
    + (n.__f || []).map(p => `<a class="hoja" href="#/n/${encodeURI(p)}" data-ruta="${esc(p)}">${esc(p.split('/').pop().replace(/\.md$/, ''))}</a>`).join('');
  $('#arbol').innerHTML = pintar(raiz, true);
  marcarActiva();
}
function marcarActiva() {
  document.querySelectorAll('#arbol a, .paginas a').forEach(a => a.classList.toggle('activa', a.getAttribute('href') === location.hash));
  const a = document.querySelector('#arbol a.activa'); if (a) { let d = a.parentElement; while (d && d.id !== 'arbol') { if (d.tagName === 'DETAILS') d.open = true; d = d.parentElement; } }
}

// ---------- buscador
let tBusqueda;
$('#buscador').addEventListener('input', e => { clearTimeout(tBusqueda); tBusqueda = setTimeout(() => buscar(e.target.value), 120); });
async function buscar(q) {
  if (!q.trim()) return pintarArbol(arbol);
  const r = await api(`/api/buscar?q=${encodeURIComponent(q)}`);
  const re = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig');
  const marcar = s => esc(s).replace(re, m => `<mark>${m}</mark>`);
  $('#arbol').innerHTML = `<div class="resultado"><small>${r.ficheros.length} notas · ${r.lineas.length} líneas</small></div>`
    + r.ficheros.map(p => `<a class="resultado" href="#/n/${encodeURI(p)}">${marcar(p.split('/').pop().replace(/\.md$/, ''))}<small>${esc(p)}</small></a>`).join('')
    + r.lineas.map(l => `<a class="resultado" href="#/n/${encodeURI(l.ruta)}?l=${l.linea}">${esc(l.ruta.split('/').pop().replace(/\.md$/, ''))}<small>${marcar(l.texto)}</small></a>`).join('');
}
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#buscador').focus(); $('#buscador').select(); }
  if ((e.ctrlKey || e.metaKey) && e.key === '`') { e.preventDefault(); alternarTerminal(); }
  if (e.key === 'Escape' && !$('#editor').hidden) cerrarEditor();
});

// ---------- nota
async function abrirNota(ruta, lineaDestino) {
  rutaActual = ruta;
  $('#panel').hidden = true; $('#nota').hidden = false;
  const n = await api(`/api/nota?p=${encodeURIComponent(ruta)}`);
  if (n.error) { $('#nota').innerHTML = `<p>No se puede abrir <code>${esc(ruta)}</code>: ${esc(n.error)}</p>`; return; }
  $('#miga').innerHTML = ruta.split('/').map((s, i, a) => i < a.length - 1 ? `<span>${esc(s)}</span> › ` : `<strong>${esc(s)}</strong>`).join('');
  if (n.esHtml) { $('#nota').innerHTML = `<iframe src="/fichero/${encodeURI(ruta)}" style="width:100%;height:75vh;border:1px solid var(--linea);border-radius:10px;background:#fff"></iframe>`; return; }
  let props = '';
  if (n.frontmatter) props = `<dl class="propiedades">${Object.entries(n.frontmatter).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${Array.isArray(v) ? v.map(x => `<span class="etiqueta">${esc(x)}</span>`).join('') : esc(v)}</dd>`).join('')}</dl>`;
  const back = n.backlinks.length ? `<div class="backlinks">Enlazan aquí: ${n.backlinks.map(b => `<a class="wiki" href="#/n/${encodeURI(b)}">${esc(b.split('/').pop().replace(/\.md$/, ''))}</a>`).join('')}</div>` : '';
  $('#nota').innerHTML = props + n.html + back;
  $('#nota').querySelectorAll('.math').forEach(el => { try { katex.render(el.textContent, el, { displayMode: el.dataset.display === '1', throwOnError: false }); } catch { /* se queda el texto */ } });
  // acciones por bloque: editar y comentar
  $('#nota').querySelectorAll('.bloque').forEach(b => {
    const acc = document.createElement('div'); acc.className = 'acciones';
    acc.innerHTML = '<button data-accion="editar" title="Editar este bloque">✎ editar</button><button data-accion="comentar" title="Comentar este bloque">💬 comentar</button>';
    b.prepend(acc);
  });
  $('#centro').scrollTop = 0;
  if (lineaDestino != null) { const b = [...$('#nota').querySelectorAll('.bloque')].find(x => +x.dataset.desde <= lineaDestino && lineaDestino < +x.dataset.hasta); if (b) { b.scrollIntoView({ block: 'center' }); b.style.background = 'var(--acento-suave)'; setTimeout(() => b.style.background = '', 1500); } }
}
$('#nota').addEventListener('click', async e => {
  const t = e.target;
  if (t.classList.contains('casilla')) { await api('/api/casilla', { ruta: rutaActual, linea: +t.dataset.linea, marcada: t.checked }); avisar(t.checked ? 'Marcada' : 'Desmarcada'); refrescarContadores(); return; }
  if (t.classList.contains('callout-titulo') || t.closest('.callout-titulo')) { const c = t.closest('.callout'); if (c && c.querySelector('.callout-titulo').dataset.plegable) c.classList.toggle('plegado'); return; }
  const btn = t.closest('button[data-accion]'); if (!btn) return;
  const b = btn.closest('.bloque'); const desde = +b.dataset.desde, hasta = +b.dataset.hasta;
  if (btn.dataset.accion === 'editar') { const raw = await (await fetch(`/fichero/${encodeURI(rutaActual)}`)).text(); abrirEditor('Editar bloque', raw.split('\n').slice(desde, hasta).join('\n'), `líneas ${desde + 1}–${hasta}`, async texto => { await api('/api/bloque', { ruta: rutaActual, desde, hasta, texto }); avisar('Guardado'); abrirNota(rutaActual); }); }
  if (btn.dataset.accion === 'comentar') { abrirEditor('Comentar este bloque', '', 'se guarda en la nota, debajo del bloque', async texto => { if (!texto.trim()) return; await api('/api/comentario', { ruta: rutaActual, tras: hasta, texto }); avisar('Comentario guardado'); abrirNota(rutaActual); refrescarContadores(); }); }
});

// ---------- editor modal
let alGuardar = null;
function abrirEditor(titulo, texto, lineas, cb) { $('#editor-titulo').textContent = titulo; $('#editor-lineas').textContent = lineas; $('#editor-texto').value = texto; alGuardar = cb; $('#editor').hidden = false; $('#editor-texto').focus(); }
function cerrarEditor() { $('#editor').hidden = true; alGuardar = null; }
$('#editor-cancelar').onclick = cerrarEditor;
$('#editor-guardar').onclick = async () => { const cb = alGuardar; cerrarEditor(); if (cb) await cb($('#editor-texto').value); };
$('#editor-texto').addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') $('#editor-guardar').click(); });

// ---------- paneles
async function abrirTareas() {
  $('#nota').hidden = true; $('#panel').hidden = false; rutaActual = null;
  $('#miga').innerHTML = '<strong>Tareas</strong>';
  const g = await api('/api/tareas');
  const total = g.reduce((a, x) => a + x.items.length, 0), hechas = g.reduce((a, x) => a + x.items.filter(i => i.hecha).length, 0);
  $('#panel').innerHTML = `<h1>☑ Tareas</h1><p class="resumen">${hechas} de ${total} hechas. Lo que marcas aquí se escribe en su nota. Los exámenes y las flashcards se contestan en la suya.</p><form class="nueva-tarea" id="nueva-tarea"><input placeholder="Nueva tarea para mí… (Enter)" autocomplete="off"><button>Añadir</button></form>`
    + g.map(gr => `<div class="grupo"><h3><a class="wiki" href="#/n/${encodeURI(gr.ruta)}">${esc(gr.ruta)}</a>${gr.generado ? '<span class="solo-lectura">la escribe el profesor al guardar</span>' : ''}</h3>`
      + gr.items.map(i => `<label class="item${i.hecha ? ' hecha' : ''}"><input type="checkbox" data-ruta="${esc(gr.ruta)}" data-linea="${i.linea}"${i.hecha ? ' checked' : ''}${gr.generado ? ' disabled' : ''}><span>${esc(i.texto)}</span></label>`).join('') + '</div>').join('');
}
$('#panel').addEventListener('submit', async e => { if (e.target.id !== 'nueva-tarea') return; e.preventDefault(); const i = e.target.querySelector('input'); if (!i.value.trim()) return; await api('/api/tarea', { texto: i.value }); avisar('Tarea añadida'); abrirTareas(); refrescarContadores(); });
$('#panel').addEventListener('change', async e => { const t = e.target; if (t.type !== 'checkbox') return; await api('/api/casilla', { ruta: t.dataset.ruta, linea: +t.dataset.linea, marcada: t.checked }); t.closest('.item').classList.toggle('hecha', t.checked); refrescarContadores(); });
async function abrirComentarios() {
  $('#nota').hidden = true; $('#panel').hidden = false; rutaActual = null;
  $('#miga').innerHTML = '<strong>Comentarios</strong>';
  const c = await api('/api/comentarios');
  $('#panel').innerHTML = `<h1>💬 Comentarios</h1><p class="resumen">Lo que has anotado en las notas. Tu profesor los ve en la siguiente sesión y los convierte en dudas o aportaciones.</p>`
    + (c.length ? c.map(x => `<div class="grupo"><h3><a class="wiki" href="#/n/${encodeURI(x.ruta)}?l=${x.linea}">${esc(x.ruta)}</a> · ${esc(x.titulo)}</h3><p>${esc(x.texto)}</p></div>`).join('') : '<div class="grupo"><p>Todavía no hay comentarios. Pasa el ratón por un párrafo de cualquier nota y pulsa <b>comentar</b>.</p></div>');
}
async function refrescarContadores() {
  const [t, c] = await Promise.all([api('/api/tareas'), api('/api/comentarios')]);
  const pend = t.reduce((a, g) => a + g.items.filter(i => !i.hecha).length, 0);
  $('#n-tareas').textContent = pend ? `(${pend})` : ''; $('#n-comentarios').textContent = c.length ? `(${c.length})` : '';
}

// ---------- terminal
let term, fit, ws;
function alternarTerminal(forzar) {
  const panel = $('#terminal-panel'); panel.hidden = forzar === true ? false : !panel.hidden;
  if (!panel.hidden && !term) {
    term = new Terminal({ fontFamily: getComputedStyle(document.documentElement).getPropertyValue('--mono'), fontSize: 13.5, lineHeight: 1.25, cursorBlink: true, cursorStyle: 'bar', scrollback: 5000, allowProposedApi: true,
      theme: { background: getComputedStyle(document.documentElement).getPropertyValue('--terminal-fondo').trim(), foreground: '#d7dae0', cursor: '#7aa2f7', selectionBackground: '#3b4261', black: '#15161e', red: '#f7768e', green: '#9ece6a', yellow: '#e0af68', blue: '#7aa2f7', magenta: '#bb9af7', cyan: '#7dcfff', white: '#a9b1d6', brightBlack: '#414868', brightRed: '#f7768e', brightGreen: '#9ece6a', brightYellow: '#e0af68', brightBlue: '#7aa2f7', brightMagenta: '#bb9af7', brightCyan: '#7dcfff', brightWhite: '#c0caf5' } });
    fit = new FitAddon.FitAddon(); term.loadAddon(fit); term.open($('#terminal'));
    ws = new WebSocket(`ws://${location.host}/pty`);
    ws.onmessage = e => term.write(e.data);
    ws.onclose = () => term.write('\r\n\x1b[90m[terminal cerrada]\x1b[0m\r\n');
    term.onData(d => ws.readyState === 1 && ws.send(d));
    const redim = () => { fit.fit(); ws.readyState === 1 && ws.send('\u0001' + JSON.stringify({ cols: term.cols, rows: term.rows })); };
    ws.onopen = redim; new ResizeObserver(redim).observe($('#terminal'));
  }
  if (!panel.hidden) { setTimeout(() => { fit && fit.fit(); term && term.focus(); }, 30); }
}
$('#btn-terminal').onclick = () => alternarTerminal();
$('#btn-cerrar-terminal').onclick = () => alternarTerminal();
$('#btn-profesor').onclick = () => { alternarTerminal(true); setTimeout(() => ws && ws.readyState === 1 && ws.send('claude\r'), 400); };

// ---------- rutas
function enrutar() {
  const h = location.hash || '#/n/inicio.md';
  if (h === '#/tareas') abrirTareas(); else if (h === '#/comentarios') abrirComentarios();
  else if (h.startsWith('#/n/')) { const [ruta, q] = h.slice(4).split('?'); const l = q && new URLSearchParams(q).get('l'); abrirNota(decodeURI(ruta), l != null ? +l : null); }
  marcarActiva();
}
window.addEventListener('hashchange', enrutar);

// ---------- recarga en vivo
try { const c = new WebSocket(`ws://${location.host}/cambios`); c.onmessage = () => { if (rutaActual && $('#editor').hidden) abrirNota(rutaActual); refrescarContadores(); }; } catch { /* sin recarga */ }

(async () => {
  const info = await api('/api/info'); $('#nombre-curso').textContent = info.nombre; $('#terminal-cwd').textContent = info.kit;
  arbol = await api('/api/arbol'); pintarArbol(arbol); refrescarContadores(); enrutar();
})();
