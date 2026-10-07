/* global katex, Terminal, FitAddon */
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let arbol = [], rutaActual = null, info = { portada: null, kit: 'carpeta', profesor: false };

// Toda llamada a la API: GET sin cuerpo, POST con JSON. Un 409 significa que la nota cambió debajo: se recarga.
async function api(p, body) {
  const r = await fetch(p, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const d = await r.json().catch(() => ({ error: `respuesta ${r.status}` }));
  if (!r.ok) {
    if (r.status === 409 && rutaActual) { avisar(d.error || 'La nota cambió; recargada'); abrirNota(rutaActual); }
    throw Object.assign(new Error(d.error || `error ${r.status}`), { status: r.status });
  }
  return d;
}
const textoFichero = ruta => fetch(`/fichero/${encodeURI(ruta)}`).then(r => r.text());
const lineasDe = texto => texto.split(/\r?\n/);
function avisar(msg) { const d = document.createElement('div'); d.className = 'aviso-flotante'; d.setAttribute('role', 'status'); d.textContent = msg; document.body.append(d); setTimeout(() => d.remove(), 2200); }
const nombreNota = p => p.split('/').pop().replace(/\.md$/, '');

// ---------- árbol
function pintarArbol(lista) {
  const raiz = {};
  for (const p of lista) { let n = raiz; const partes = p.split('/'); partes.forEach((s, i) => { if (i === partes.length - 1) (n.__f ??= []).push(p); else n = (n[s] ??= {}); }); }
  const pintar = (n, abierto) => Object.keys(n).filter(k => k !== '__f').sort((a, b) => a.localeCompare(b, 'es')).map(k => `<details${abierto ? ' open' : ''}><summary>${esc(k)}</summary>${pintar(n[k], false)}</details>`).join('')
    + (n.__f || []).map(p => `<a class="hoja" href="#/n/${encodeURI(p)}" data-ruta="${esc(p)}">${esc(nombreNota(p))}</a>`).join('');
  $('#arbol').innerHTML = lista.length ? pintar(raiz, true) : '<p class="vacio">No hay notas en esta carpeta.</p>';
  marcarActiva();
}
function marcarActiva() {
  document.querySelectorAll('#arbol a, .paginas a').forEach(a => { const activa = a.getAttribute('href') === location.hash; a.classList.toggle('activa', activa); if (activa) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
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
  $('#arbol').innerHTML = `<div class="resultado" role="status"><small>${r.ficheros.length} notas · ${r.lineas.length} líneas</small></div>`
    + r.ficheros.map(p => `<a class="resultado" href="#/n/${encodeURI(p)}">${marcar(nombreNota(p))}<small>${esc(p)}</small></a>`).join('')
    + r.lineas.map(l => `<a class="resultado" href="#/n/${encodeURI(l.ruta)}?l=${l.linea}">${esc(nombreNota(l.ruta))}<small>${marcar(l.texto)}</small></a>`).join('');
}
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#buscador').focus(); $('#buscador').select(); }
  if ((e.ctrlKey || e.metaKey) && e.key === '`') { e.preventDefault(); alternarTerminal(); }
  if (e.key === 'Escape' && !$('#editor').hidden) cerrarEditor();
});

// ---------- nota
function sinPortada() {
  $('#miga').innerHTML = '<strong>Cuaderno</strong>';
  $('#nota').innerHTML = `<h1>${esc(info.nombre)}</h1><p class="resumen">Esta carpeta no tiene una nota de portada. Elige una nota en el árbol de la izquierda o busca con <kbd>Ctrl K</kbd>.</p>`;
}
async function abrirNota(ruta, lineaDestino) {
  rutaActual = ruta;
  $('#panel').hidden = true; $('#nota').hidden = false;
  let n;
  try { n = await api(`/api/nota?p=${encodeURIComponent(ruta)}`); } catch (e) { $('#nota').innerHTML = `<h1>No se puede abrir</h1><p><code>${esc(ruta)}</code>: ${esc(e.message)}</p>`; return; }
  $('#miga').innerHTML = ruta.split('/').map((s, i, a) => i < a.length - 1 ? `<span>${esc(s)}</span> › ` : `<strong>${esc(s)}</strong>`).join('');
  if (n.esHtml) { $('#nota').innerHTML = `<iframe class="ejercicio" sandbox="allow-scripts allow-forms allow-modals" src="/fichero/${encodeURI(ruta)}" title="${esc(nombreNota(ruta))}"></iframe>`; return; }
  // Las propiedades van debajo del título, no encima: el título es lo primero que se lee.
  const props = n.frontmatter ? `<dl class="propiedades">${Object.entries(n.frontmatter).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${Array.isArray(v) ? v.map(x => `<span class="etiqueta">${esc(x)}</span>`).join('') : esc(v)}</dd>`).join('')}</dl>` : '';
  const back = n.backlinks.length ? `<nav class="backlinks" aria-label="Notas que enlazan aquí">Enlazan aquí: ${n.backlinks.map(b => `<a class="wiki" href="#/n/${encodeURI(b)}">${esc(nombreNota(b))}</a>`).join('')}</nav>` : '';
  $('#nota').innerHTML = n.html + back;
  const h1 = $('#nota .bloque > h1');
  if (props) (h1 ? h1.closest('.bloque') : $('#nota')).insertAdjacentHTML(h1 ? 'afterend' : 'afterbegin', props);
  $('#nota').querySelectorAll('.math').forEach(el => { try { katex.render(el.textContent, el, { displayMode: el.dataset.display === '1', throwOnError: false }); } catch { /* se queda el texto */ } });
  // acciones por bloque: editar y comentar. Con teclado: Tab hasta el bloque y las acciones aparecen.
  $('#nota').querySelectorAll('.bloque').forEach(b => {
    b.tabIndex = 0;
    const acc = document.createElement('div'); acc.className = 'acciones';
    acc.innerHTML = '<button type="button" data-accion="editar" aria-label="Editar este bloque">✎ editar</button><button type="button" data-accion="comentar" aria-label="Comentar este bloque">💬 comentar</button>';
    b.prepend(acc);
  });
  $('#centro').scrollTop = 0;
  if (lineaDestino != null) { const b = [...$('#nota').querySelectorAll('.bloque')].find(x => +x.dataset.desde <= lineaDestino && lineaDestino < +x.dataset.hasta); if (b) { b.scrollIntoView({ block: 'center' }); b.classList.add('resaltado'); setTimeout(() => b.classList.remove('resaltado'), 1500); } }
}
async function marcarCasilla(ruta, linea, marcada, trasFallo) {
  const original = lineasDe(await textoFichero(ruta))[linea];
  try { await api('/api/casilla', { ruta, linea, marcada, original }); return true; } catch (e) { if (trasFallo) trasFallo(e); return false; }
}
$('#nota').addEventListener('click', async e => {
  const t = e.target;
  if (t.classList.contains('casilla')) { const ok = await marcarCasilla(rutaActual, +t.dataset.linea, t.checked, () => { t.checked = !t.checked; }); if (ok) { avisar(t.checked ? 'Marcada' : 'Desmarcada'); refrescarContadores(); } return; }
  if (t.closest('.callout-titulo')) { const c = t.closest('.callout'); if (c && c.querySelector('.callout-titulo').dataset.plegable) c.classList.toggle('plegado'); return; }
  const btn = t.closest('button[data-accion]'); if (!btn) return;
  const b = btn.closest('.bloque'); const desde = +b.dataset.desde, hasta = +b.dataset.hasta;
  const original = lineasDe(await textoFichero(rutaActual)).slice(desde, hasta).join('\n');
  if (btn.dataset.accion === 'editar') abrirEditor('Editar bloque', original, `líneas ${desde + 1}–${hasta}`, async texto => { await api('/api/bloque', { ruta: rutaActual, desde, hasta, texto, original }); avisar('Guardado'); abrirNota(rutaActual); });
  if (btn.dataset.accion === 'comentar') abrirEditor('Comentar este bloque', '', 'se guarda en la nota, debajo del bloque', async texto => { if (!texto.trim()) return; await api('/api/comentario', { ruta: rutaActual, desde, hasta, texto, original }); avisar('Comentario guardado'); abrirNota(rutaActual); refrescarContadores(); });
});
$('#nota').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList.contains('callout-titulo')) e.target.click(); });

// ---------- editor modal
let alGuardar = null, foco = null;
function abrirEditor(titulo, texto, lineas, cb) { foco = document.activeElement; $('#editor-titulo').textContent = titulo; $('#editor-lineas').textContent = lineas; $('#editor-texto').value = texto; alGuardar = cb; $('#editor').hidden = false; $('#editor-texto').focus(); }
function cerrarEditor() { $('#editor').hidden = true; alGuardar = null; if (foco) foco.focus(); }
$('#editor-cancelar').onclick = cerrarEditor;
$('#editor-guardar').onclick = async () => { const cb = alGuardar; const v = $('#editor-texto').value; cerrarEditor(); if (cb) { try { await cb(v); } catch (e) { if (e.status !== 409) avisar(e.message); } } };
$('#editor-texto').addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') $('#editor-guardar').click(); });

// ---------- paneles
async function abrirTareas() {
  $('#nota').hidden = true; $('#panel').hidden = false; rutaActual = null;
  $('#miga').innerHTML = '<strong>Tareas</strong>';
  const g = await api('/api/tareas');
  const total = g.reduce((a, x) => a + x.items.length, 0), hechas = g.reduce((a, x) => a + x.items.filter(i => i.hecha).length, 0);
  const nota = info.kit !== 'carpeta' ? 'Lo que marcas aquí se escribe en su nota. Los exámenes y las flashcards se contestan en la suya.' : 'Tu lista propia, en <code>tareas.md</code>.';
  $('#panel').innerHTML = `<h1>Tareas</h1><p class="resumen">${hechas} de ${total} hechas. ${nota}</p><form class="nueva-tarea" id="nueva-tarea"><label class="oculto" for="tarea-nueva">Nueva tarea</label><input id="tarea-nueva" placeholder="Nueva tarea para mí…" autocomplete="off"><button type="submit">Añadir</button></form>`
    + g.map(gr => `<section class="grupo"><h2><a class="wiki" href="#/n/${encodeURI(gr.ruta)}">${esc(gr.ruta)}</a>${gr.generado ? '<span class="solo-lectura">la escribe el profesor al guardar</span>' : ''}</h2>`
      + gr.items.map(i => `<label class="item${i.hecha ? ' hecha' : ''}"><input type="checkbox" data-ruta="${esc(gr.ruta)}" data-linea="${i.linea}"${i.hecha ? ' checked' : ''}${gr.generado ? ' disabled' : ''}><span>${esc(i.texto)}</span></label>`).join('') + '</section>').join('');
}
$('#panel').addEventListener('submit', async e => { if (e.target.id !== 'nueva-tarea') return; e.preventDefault(); const i = e.target.querySelector('input'); if (!i.value.trim()) return; await api('/api/tarea', { texto: i.value }); avisar('Tarea añadida'); abrirTareas(); refrescarContadores(); });
$('#panel').addEventListener('change', async e => { const t = e.target; if (t.type !== 'checkbox') return; const ok = await marcarCasilla(t.dataset.ruta, +t.dataset.linea, t.checked, err => { avisar(err.message); abrirTareas(); }); if (ok) { t.closest('.item').classList.toggle('hecha', t.checked); refrescarContadores(); } });
async function abrirComentarios() {
  $('#nota').hidden = true; $('#panel').hidden = false; rutaActual = null;
  $('#miga').innerHTML = '<strong>Comentarios</strong>';
  const c = await api('/api/comentarios');
  $('#panel').innerHTML = `<h1>Comentarios</h1><p class="resumen">Lo que has anotado en las notas. Tu profesor los ve en la siguiente sesión y los convierte en dudas o aportaciones.</p>`
    + (c.length ? c.map(x => `<section class="grupo"><h2><a class="wiki" href="#/n/${encodeURI(x.ruta)}?l=${x.linea}">${esc(x.ruta)}</a> · ${esc(x.titulo)}</h2><p>${esc(x.texto)}</p></section>`).join('') : '<section class="grupo"><p>Todavía no hay comentarios. En cualquier nota, pasa por un párrafo (o llega a él con Tab) y pulsa <b>comentar</b>.</p></section>');
}
async function refrescarContadores() {
  const [t, c] = await Promise.all([api('/api/tareas'), api('/api/comentarios')]);
  const pend = t.reduce((a, g) => a + g.items.filter(i => !i.hecha).length, 0);
  $('#n-tareas').textContent = pend ? `(${pend})` : ''; $('#n-comentarios').textContent = c.length ? `(${c.length})` : '';
}

// ---------- terminal
let term, fit, ws, modoTerminal = null;
const wsUrl = ruta => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${ruta}`;
function abrirTerminal(modo) {
  if (term && modoTerminal !== modo) { ws && ws.close(); term.dispose(); term = null; }
  const panel = $('#terminal-panel'); panel.hidden = false;
  if (!term) {
    modoTerminal = modo;
    term = new Terminal({ fontFamily: getComputedStyle(document.documentElement).getPropertyValue('--mono'), fontSize: 13.5, lineHeight: 1.25, cursorBlink: true, cursorStyle: 'bar', scrollback: 5000, allowProposedApi: true,
      theme: { background: getComputedStyle(document.documentElement).getPropertyValue('--terminal-fondo').trim(), foreground: '#d7dae0', cursor: '#7aa2f7', selectionBackground: '#3b4261', black: '#15161e', red: '#f7768e', green: '#9ece6a', yellow: '#e0af68', blue: '#7aa2f7', magenta: '#bb9af7', cyan: '#7dcfff', white: '#a9b1d6', brightBlack: '#414868', brightRed: '#f7768e', brightGreen: '#9ece6a', brightYellow: '#e0af68', brightBlue: '#7aa2f7', brightMagenta: '#bb9af7', brightCyan: '#7dcfff', brightWhite: '#c0caf5' } });
    fit = new FitAddon.FitAddon(); term.loadAddon(fit); term.open($('#terminal'));
    ws = new WebSocket(wsUrl(modo === 'profesor' ? '/pty?profesor=1' : '/pty'));
    ws.onmessage = e => term.write(e.data);
    ws.onclose = () => term && term.write('\r\n\x1b[90m[terminal cerrada]\x1b[0m\r\n');
    term.onData(d => ws.readyState === 1 && ws.send(d));
    const redim = () => { fit.fit(); ws.readyState === 1 && ws.send('\u0001' + JSON.stringify({ cols: term.cols, rows: term.rows })); };
    ws.onopen = redim; new ResizeObserver(redim).observe($('#terminal'));
    $('#terminal-titulo').textContent = modo === 'profesor' ? 'Profesor' : 'Terminal';
  }
  setTimeout(() => { fit && fit.fit(); term && term.focus(); }, 30);
}
function alternarTerminal() { const panel = $('#terminal-panel'); if (panel.hidden) abrirTerminal(modoTerminal || 'shell'); else { panel.hidden = true; $('#btn-terminal').focus(); } }
$('#btn-terminal').onclick = () => alternarTerminal();
$('#btn-cerrar-terminal').onclick = () => alternarTerminal();
$('#btn-profesor').onclick = () => abrirTerminal('profesor');

// ---------- rutas
function enrutar() {
  const h = location.hash;
  if (h === '#/tareas') abrirTareas(); else if (h === '#/comentarios') abrirComentarios();
  else if (h.startsWith('#/n/')) { const [ruta, q] = h.slice(4).split('?'); const l = q && new URLSearchParams(q).get('l'); abrirNota(decodeURI(ruta), l != null ? +l : null); }
  else if (info.portada) location.hash = `#/n/${encodeURI(info.portada)}`;
  else { rutaActual = null; $('#panel').hidden = true; $('#nota').hidden = false; sinPortada(); }
  marcarActiva();
}
window.addEventListener('hashchange', enrutar);

// ---------- recarga en vivo
try { const c = new WebSocket(wsUrl('/cambios')); c.onmessage = async () => { arbol = await api('/api/arbol'); if (!$('#buscador').value.trim()) pintarArbol(arbol); if (rutaActual && $('#editor').hidden) abrirNota(rutaActual); else if (location.hash === '#/tareas') abrirTareas(); refrescarContadores(); }; } catch { /* sin recarga */ }

(async () => {
  info = await api('/api/info');
  $('#nombre-curso').textContent = info.nombre; document.title = `${info.nombre} · Cuaderno`;
  $('#btn-profesor').hidden = !info.profesor;
  $('#link-inicio').href = info.portada ? `#/n/${encodeURI(info.portada)}` : '#/';
  arbol = await api('/api/arbol'); pintarArbol(arbol); refrescarContadores(); enrutar();
})();
