/* global katex, Terminal, FitAddon */
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let arbol = [], rutaActual = null, info = { cuaderno: null, configuracion: {} };
const cuaderno = () => info.cuaderno;

// En la app de escritorio (Electron) el preload deja window.cuadernoApp; sin él, la pantalla es la del navegador y nada cambia.
const enApp = () => !!window.cuadernoApp;
const enMac = /Mac/i.test(navigator.platform);
// Las pistas de teclado de la pantalla: en la web, las de la página («Ctrl K»); en la app de escritorio, las del menú
// (electron/menu.js), con ⌘ en Mac y Ctrl en los demás (crítica 2026-10-10, 10). `conAtajo` añade la pista a un título solo en la app.
const pista = (web, app) => (enApp() ? (enMac ? `⌘${app}` : `Ctrl ${app}`) : web);
const conAtajo = (texto, tecla) => (enApp() ? `${texto} (${pista('', tecla)})` : texto);
// El título de la ventana: en la web, «<cuaderno> · Cuaderno»; en la app, lo que está abierto («inicio.md — cuaderno-ejemplo»,
// «Tareas — cuaderno-ejemplo», «Cuadernos — Cuaderno»), que es lo que lee la barra de título y el selector de ventanas.
let vistaTitulo = null;
function pintarTitulo() {
  const c = cuaderno();
  if (!enApp()) { document.title = c ? `${c.nombre} · Cuaderno` : 'Cuaderno'; return; }
  document.title = vistaTitulo === 'Cuadernos' ? 'Cuadernos — Cuaderno' : !c ? 'Cuaderno' : vistaTitulo ? `${vistaTitulo} — ${c.nombre}` : c.nombre;
}
const ponerVista = v => { vistaTitulo = v; pintarTitulo(); };
// Lo que supone una terminal se dice de otra forma en la app: no hay terminal donde reiniciarla, se cierra y se vuelve a abrir.
if (enApp()) { const a = $('#aviso-reinicio'); for (const n of [...a.childNodes]) if (n.id !== 'aviso-cerrar') n.remove(); a.prepend('La app se ha actualizado mientras estaba abierta. Cierra y vuelve a abrir la app para que todo funcione. '); }
if (enApp()) { $('#buscador').placeholder = `Buscar… o + tarea  (${pista('Ctrl K', 'F')})`; $('#btn-nueva-nota').title = conAtajo('Crear una nota nueva', 'N'); $('#btn-ajustes').title = conAtajo('Ajustes de la app', ','); }
// El aviso de «la app se ha actualizado» se cierra y no vuelve en esta pestaña (Roberto, 2026-10-09).
let avisoCerrado = false;
$('#aviso-cerrar').addEventListener('click', () => { avisoCerrado = true; $('#aviso-reinicio').hidden = true; });

// Toda llamada a la API: GET sin cuerpo, POST con JSON. Un 409 significa que la nota cambió debajo: se recarga.
async function api(p, body) {
  const r = await fetch(p, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const d = await r.json().catch(() => ({ error: `respuesta ${r.status}` }));
  if (!r.ok) {
    if (r.status === 404 && p.startsWith('/api/') && !avisoCerrado) $('#aviso-reinicio').hidden = false;   // una ruta que el servidor no conoce: es de antes
    if (r.status === 403) avisarError(enApp() ? 'Esta ventana ha perdido el permiso: cierra y vuelve a abrir la app.' : 'Esta pestaña ha perdido el permiso: arranca la app desde la terminal y entra por la pestaña que abre.');
    if (r.status === 409 && rutaActual && !edicion) { avisarError('Esta nota cambió en el disco mientras la tenías abierta. La he vuelto a cargar: repite el cambio.'); abrirNota(rutaActual); }
    throw Object.assign(new Error(d.error || `error ${r.status}`), { status: r.status });
  }
  return d;
}
const textoFichero = ruta => fetch(`/fichero/${encodeURI(ruta)}`).then(r => r.text());
const lineasDe = texto => texto.split(/\r?\n/);
// Los avisos se apilan en una esquina. Uno informativo (Marcada, Ruta copiada) se va solo; un error no (hallazgo 12 de la
// revisión de diseño, 2026-10-09): dice qué pasó en cristiano, se queda hasta cerrarlo y pliega el detalle técnico.
const zonaAvisos = () => { let z = $('#avisos'); if (!z) { z = document.createElement('div'); z.id = 'avisos'; document.body.append(z); } return z; };
function avisar(msg) { const d = document.createElement('div'); d.className = 'aviso-flotante'; d.setAttribute('role', 'status'); d.textContent = msg; zonaAvisos().append(d); setTimeout(() => d.remove(), 2200); }
function avisarError(que, detalle) {
  const d = document.createElement('div'); d.className = 'aviso-flotante error'; d.setAttribute('role', 'alert');
  const texto = document.createElement('span'); texto.textContent = que; d.append(texto);
  const t = detalle ? String(detalle).trim() : '';
  if (t && t !== que) { const det = document.createElement('details'), sum = document.createElement('summary'), pre = document.createElement('pre'); sum.textContent = 'Ver detalle'; pre.textContent = t; det.append(sum, pre); d.append(det); }
  const x = document.createElement('button'); x.type = 'button'; x.className = 'cerrar-aviso'; x.setAttribute('aria-label', 'Cerrar el aviso'); x.textContent = '×'; x.onclick = () => d.remove(); d.append(x);
  zonaAvisos().append(d);
}
const nombreNota = p => p.split('/').pop().replace(/\.md$/, '');
const icono = n => `<svg class="icono" aria-hidden="true"><use href="#i-${n}"/></svg>`;
let titulos = {};   // ruta → título (# …) de cada nota, para enseñar títulos y no nombres de fichero
const tituloDe = p => titulos[p] || nombreNota(p);
// Carpeta del kit «modulo-01-fundamentos-del-dinero» o «1.1-el-dinero-y-sus-funciones»: el número separado del nombre
const nombreCarpeta = k => { const m = k.match(/^((?:modulo|m|bloque|semana|tema|unidad)-?\d+|\d+(?:\.\d+)*)-(.+)$/i); return m ? `<span class="num">${esc(m[1])}</span> ${esc(m[2].replace(/-/g, ' '))}` : esc(k); };

// ---------- árbol
const carpetasAbiertas = new Set();
$('#arbol').addEventListener('toggle', e => { const d = e.target; if (d.dataset && d.dataset.carpeta != null) { if (d.open) carpetasAbiertas.add(d.dataset.carpeta); else carpetasAbiertas.delete(d.dataset.carpeta); } }, true);
function pintarArbol(lista) {
  lista = lista.filter(p => p !== 'tareas.md');   // tareas.md se ve en el panel Tareas, no dos veces
  const raiz = {};
  // «carpeta/» es una carpeta sin nada que enseñar: sale, vacía, como en el Finder.
  for (const p of lista) { let n = raiz; const partes = p.split('/'); partes.forEach((s, i) => { if (i < partes.length - 1) n = (n[s] ??= {}); else if (s) (n.__f ??= []).push(p); }); }
  // Cada fichero, por su nombre (sin .md): la carpeta ya se ve encima y el título es de la nota (Roberto, 2026-10-09).
  // Plegadas por defecto (Roberto, 2026-10-09); abiertas las que abrió la persona (no se le cierran al repintar, en la
  // recarga en vivo) y las que llevan a la nota abierta (marcarActiva).
  const pintar = (n, abierto, prefijo = '') => Object.keys(n).filter(k => k !== '__f').sort((a, b) => a.localeCompare(b, 'es')).map(k => `<details data-carpeta="${esc(prefijo + k)}"${carpetasAbiertas.has(prefijo + k) ? ' open' : ''}><summary title="${esc(k)}"><span class="nombre">${nombreCarpeta(k)}</span>${botonesFila(prefijo + k, k)}</summary>${pintar(n[k], false, `${prefijo}${k}/`) || '<p class="carpeta-vacia">Vacía</p>'}</details>`).join('')
    + (n.__f || []).map(p => { const t = nombreNota(p); return `<div class="fila"><a class="hoja${p.endsWith('.md') ? '' : ' fichero'}" href="#/n/${encodeURI(p)}" data-ruta="${esc(p)}" title="${esc(p)}"><span class="nombre">${esc(t)}</span></a>${botonesFila(p, t, true)}</div>`; }).join('');
  $('#arbol').innerHTML = lista.length ? pintar(raiz, true) : '<p class="vacio">No hay notas en esta carpeta.</p>';
  pintarCarpetas(lista);
  marcarActiva();
}
function marcarActiva() {
  const actual = location.hash.split('?')[0];   // sin la consulta: #/tareas?estado=hechas sigue siendo Tareas
  document.querySelectorAll('#arbol a, .paginas a').forEach(a => { const activa = a.getAttribute('href') === actual; a.classList.toggle('activa', activa); if (activa) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const a = document.querySelector('#arbol a.activa'); if (a) { let d = a.parentElement; while (d && d.id !== 'arbol') { if (d.tagName === 'DETAILS') d.open = true; d = d.parentElement; } }
}

// ---------- nota nueva: botón «Nueva nota» (título y carpeta). El buscador solo busca; con «+», tarea (Roberto, 2026-10-08)
function pintarCarpetas(lista) {
  const carpetas = [...new Set(lista.map(p => p.split('/').slice(0, -1).join('/')).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  $('#nueva-nota-carpeta').innerHTML = `<option value="">(raíz del cuaderno)</option>` + carpetas.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
}
function abrirNuevaNota(titulo = '') {
  const carpeta = rutaActual ? rutaActual.split('/').slice(0, -1).join('/') : '';
  $('#nueva-nota-nombre').value = titulo; $('#nueva-nota-carpeta').value = carpeta;
  abrirModal('#nueva-nota', '#nueva-nota-nombre');
}
async function crearNota(titulo, carpeta) {
  let r; try { r = await api('/api/nota/nueva', { titulo, carpeta }); } catch (e) { avisarError('No se ha podido crear la nota.', e.message); return false; }
  cerrarModal('#nueva-nota'); $('#buscador').value = ''; buscar('');
  location.hash = `#/n/${encodeURI(r.ruta)}`;
  return true;
}
$('#btn-nueva-nota').onclick = () => abrirNuevaNota();
$('#nueva-nota-cancelar').onclick = () => cerrarModal('#nueva-nota');
$('#nueva-nota-form').addEventListener('submit', e => { e.preventDefault(); crearNota($('#nueva-nota-nombre').value, $('#nueva-nota-carpeta').value); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#nueva-nota').hidden) cerrarModal('#nueva-nota'); });

// ---------- buscador
let tBusqueda;
$('#buscador').addEventListener('input', e => { clearTimeout(tBusqueda); tBusqueda = setTimeout(() => buscar(e.target.value), 120); });
// El buscador también es el comando: lo que empieza por «+» no busca, Enter lo añade como tarea a tareas.md.
// Si se está leyendo una nota, la tarea la enlaza al final ([[ruta/sin/extensión]]).
const comandoTarea = q => (q.trimStart().startsWith('+') ? q.trimStart().slice(1).trim() : null);
const notaParaTarea = () => (rutaActual && rutaActual.endsWith('.md') ? rutaActual.replace(/\.md$/, '') : null);
function pintarComando(texto) {
  const nota = notaParaTarea();
  $('#arbol').innerHTML = `<div class="resultado comando" role="status">${texto ? `<kbd>Enter</kbd> añade la tarea: <b>${esc(texto)}</b>${nota ? `<small>enlazada a ${esc(tituloDe(rutaActual))}</small>` : ''}` : 'Escribe la tarea después del <b>+</b> y pulsa <kbd>Enter</kbd>.'}</div>`;
}
async function anadirTareaDesdeBuscador() {
  const texto = comandoTarea($('#buscador').value);
  if (!texto) return;
  const nota = notaParaTarea();
  try { await api('/api/tarea', { texto: nota ? `${texto} [[${nota}]]` : texto }); } catch (e) { if (e.status !== 409) avisarError('No se ha podido añadir la tarea.', e.message); return; }
  avisar('Tarea añadida');
  $('#buscador').value = ''; buscar('');   // vacía y sale del estado «buscando»: vuelven Inicio/Tareas/Comentarios y el árbol
  refrescarContadores();
  if (enTareas()) abrirTareas();
}
$('#buscador').addEventListener('keydown', e => { if (e.key === 'Enter' && comandoTarea(e.target.value) != null) { e.preventDefault(); clearTimeout(tBusqueda); anadirTareaDesdeBuscador(); } });
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
async function buscar(q) {
  $('#lateral').classList.toggle('buscando', !!q.trim());   // con algo escrito, Inicio/Tareas/Comentarios dejan sitio a los resultados
  if (!q.trim()) return pintarArbol(arbol);
  if (comandoTarea(q) != null) return pintarComando(comandoTarea(q));
  const r = await api(`/api/buscar?q=${encodeURIComponent(q)}`);
  const re = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig');
  const marcar = s => esc(s).replace(re, m => `<mark>${m}</mark>`);
  // Primero las notas (por título o nombre de fichero: para abrir una, no hace falta leer todo el texto); después las líneas.
  const notas = r.ficheros.map(p => `<a class="resultado" href="#/n/${encodeURI(p)}">${marcar(tituloDe(p))}<small>${marcar(p)}</small></a>`).join('');
  const porNota = new Map(); for (const l of r.lineas) { if (!porNota.has(l.ruta)) porNota.set(l.ruta, []); porNota.get(l.ruta).push(l); }
  const lineas = [...porNota].map(([ruta, ls]) => `<div class="grupo"><a class="resultado" href="#/n/${encodeURI(ruta)}">${esc(tituloDe(ruta))}<small>${esc(ruta)}</small></a>${ls.map(l => `<a class="resultado linea" href="#/n/${encodeURI(l.ruta)}?l=${l.linea}">${marcar(l.texto)}</a>`).join('')}</div>`).join('');
  const nada = !r.ficheros.length && !r.lineas.length;
  $('#arbol').innerHTML = `<div class="oculto" role="status">${nada ? `nada con «${esc(q.trim())}»` : `${plural(r.ficheros.length, 'nota', 'notas')} y ${plural(r.lineas.length, 'línea', 'líneas')}`}</div>`
    + (nada ? `<p class="vacio">Nada con «${esc(q.trim())}». Con <b>+</b> delante sería una tarea; «Nueva nota» crea una nota.</p>` : '')
    + (r.ficheros.length ? `<h3 class="tramo">${plural(r.ficheros.length, 'nota', 'notas')}</h3>${notas}` : '')
    + (r.lineas.length ? `<h3 class="tramo">En el texto <small>${plural(r.lineas.length, 'línea', 'líneas')} en ${plural(porNota.size, 'nota', 'notas')}</small></h3>${lineas}` : '');
}
// Teclado en el buscador: flecha abajo o Enter van al primer resultado (Enter lo abre); Escape vacía y vuelve al árbol.
$('#buscador').addEventListener('keydown', e => {
  if (comandoTarea(e.target.value) != null || !e.target.value.trim()) return;
  const primero = $('#arbol a.resultado');
  if (e.key === 'ArrowDown' && primero) { e.preventDefault(); primero.focus(); }
  if (e.key === 'Enter' && primero) { e.preventDefault(); primero.click(); }
  if (e.key === 'Escape') { e.preventDefault(); e.target.value = ''; buscar(''); }
});
$('#arbol').addEventListener('keydown', e => {
  const t = e.target;
  if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && t.matches('button[tabindex="-1"]')) {   // entre los botones de una fila; la izquierda del primero vuelve a la fila
    const hermanos = [...t.parentElement.querySelectorAll('button')], i = hermanos.indexOf(t);
    e.preventDefault();
    if (e.key === 'ArrowRight') { if (hermanos[i + 1]) hermanos[i + 1].focus(); } else if (i > 0) hermanos[i - 1].focus(); else (t.closest('.fila') ? t.closest('.fila').querySelector('a.hoja') : t.closest('summary')).focus();
    return;
  }
  if (e.key === 'ArrowRight' && t.matches('a.hoja, summary')) { const b = (t.closest('.fila') || t).querySelector('.acciones-fila button'); if (b) { e.preventDefault(); b.focus(); } return; }
  const a = e.target.closest('a.resultado'); if (!a || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
  e.preventDefault();
  const todos = [...$('#arbol').querySelectorAll('a.resultado')], i = todos.indexOf(a);
  if (e.key === 'ArrowDown' && todos[i + 1]) todos[i + 1].focus();
  else if (e.key === 'ArrowUp') (todos[i - 1] || $('#buscador')).focus();
});
// Ctrl K (y Buscar… en el menú de la app de escritorio): el buscador, desplegando la barra lateral si estaba plegada.
function enfocarBuscador() { if (lateralPlegado() && window.innerWidth > 760) plegarLateral(false, { enfocar: false }); const b = $('#buscador'); b.focus(); b.select(); return b; }
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); enfocarBuscador(); }
  if ((e.ctrlKey || e.metaKey) && e.key === '`') { e.preventDefault(); alternarTerminal(); }
});

// ---------- mostrar en el gestor de archivos del sistema (Finder, Explorador…)
const MAC = /Mac/i.test(navigator.platform);
const GESTOR = MAC ? 'el Finder' : /Win/i.test(navigator.platform) ? 'el Explorador' : 'la carpeta';
const botonMostrar = (ruta, nombre) => `<button type="button" class="mostrar" data-mostrar="${esc(ruta)}" title="Mostrar en ${GESTOR}" aria-label="Mostrar ${esc(String(nombre).replace(/<[^>]*>/g, ''))} en ${GESTOR}">${icono('carpeta')}</button>`;
const botonOcultar = (ruta, nombre) => `<button type="button" class="ocultar" data-ocultar="${esc(ruta)}" title="Ocultar aquí (solo en la app; se recupera en Ajustes)" aria-label="Ocultar ${esc(String(nombre).replace(/<[^>]*>/g, ''))}">${icono('ojo-tachado')}</button>`;
// En un fichero, además, la papelera, la última y algo separada (crítica 2026-10-08: sin confirmar, el hueco es lo que la protege).
// Los botones de la fila no son paradas de Tab (hallazgo 7, revisión de diseño 2026-10-09: cada carpeta eran tres): se llega a ellos con la flecha derecha desde la fila.
const botonesFila = (ruta, nombre, esFichero = false) => `<span class="acciones-fila">${(botonOcultar(ruta, nombre) + botonMostrar(ruta, nombre) + (esFichero ? botonPapelera(ruta, nombre) : '')).replace(/<button /g, '<button tabindex="-1" ')}</span>`;
// Ocultar (o volver a mostrar) una carpeta o un fichero del árbol y del buscador; solo en la app, por cuaderno.
async function ocultar(ruta, si) {
  try { await api('/api/ocultar', { ruta, ocultar: si }); } catch (e) { return avisarError(si ? 'No se ha podido ocultar.' : 'No se ha podido volver a mostrar.', e.message); }
  arbol = await api('/api/arbol');
  if (!$('#buscador').value.trim()) pintarArbol(arbol); else buscar($('#buscador').value);
  if (si) avisar(`«${ruta.split('/').pop()}» oculto aquí. Para verlo otra vez: Ajustes.`);
  if (!$('#ajustes').hidden) pintarOcultas();
}
document.addEventListener('click', e => {
  const b = e.target.closest('button[data-ocultar]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  ocultar(b.dataset.ocultar, true);
});
async function pintarOcultas() {
  const sec = $('#ajustes-ocultas');
  if (!cuaderno()) { sec.hidden = true; return; }
  const l = await api('/api/ocultas');
  sec.hidden = !l.length;
  $('#lista-ocultas').innerHTML = l.map(r => `<li><code>${esc(r)}</code><button type="button" class="secundario pequeno" data-mostrar-de-nuevo="${esc(r)}" aria-label="Mostrar ${esc(r)} otra vez">Mostrar</button></li>`).join('');
}
$('#lista-ocultas').addEventListener('click', e => { const b = e.target.closest('button[data-mostrar-de-nuevo]'); if (b) ocultar(b.dataset.mostrarDeNuevo, false); });
async function mostrarEnCarpeta(ruta) { try { await api('/api/mostrar-en-carpeta', { ruta }); } catch (e) { avisarError(`No se ha podido mostrarlo en ${GESTOR}.`, e.message); } }
document.addEventListener('click', e => {
  const b = e.target.closest('button[data-mostrar]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();   // dentro del summary de una carpeta: no la pliega
  mostrarEnCarpeta(b.dataset.mostrar);
});

// ---------- papelera: el fichero va a la papelera del sistema, sin confirmar (de allí se recupera; Roberto, 2026-10-08)
const PAPELERA = /Win/i.test(navigator.platform) ? 'la papelera de reciclaje' : 'la papelera';
// Copiar la ruta completa del fichero (para pegarla en la terminal, al profesor o en el Finder), con el separador
// del sistema donde corre la app.
const rutaCompleta = ruta => { const c = cuaderno(); if (!c.base || !c.sep) throw new Error('Reinicia la app: el servidor es de una versión anterior y no da la ruta completa'); return c.base + c.sep + ruta.split('/').join(c.sep); };
const botonCopiar = ruta => `<button type="button" class="copiar" data-copiar="${esc(ruta)}" title="Copiar la ruta del fichero" aria-label="Copiar la ruta de ${esc(ruta.split('/').pop())}">${icono('copiar')}</button>`;
async function copiarRuta(ruta) {
  let texto; try { texto = rutaCompleta(ruta); } catch (e) { return avisarError('No se ha podido copiar la ruta.', e.message); }
  try { await navigator.clipboard.writeText(texto); } catch {
    const t = document.createElement('textarea'); t.value = texto; document.body.append(t); t.select(); document.execCommand('copy'); t.remove();
  }
  avisar('Ruta copiada');
}
document.addEventListener('click', e => { const b = e.target.closest('button[data-copiar]'); if (!b) return; e.preventDefault(); copiarRuta(b.dataset.copiar); });
const botonPapelera = (ruta, nombre) => `<button type="button" class="papelera" data-papelera="${esc(ruta)}" title="Mandar a ${PAPELERA}" aria-label="Mandar ${esc(String(nombre).replace(/<[^>]*>/g, ''))} a ${PAPELERA}">${icono('papelera')}</button>`;
async function mandarAPapelera(ruta) {
  try { await api('/api/papelera', { ruta }); } catch (e) { avisarError(`No se ha podido mandar a ${PAPELERA}.`, e.message); return; }
  avisar(`«${ruta.split('/').pop()}» está en ${PAPELERA}`);
  [arbol, titulos] = await Promise.all([api('/api/arbol'), api('/api/titulos')]);
  if (!$('#buscador').value.trim()) pintarArbol(arbol);
  if (rutaActual === ruta) { rutaActual = null; location.hash = cuaderno().portada && cuaderno().portada !== ruta ? `#/n/${encodeURI(cuaderno().portada)}` : '#/'; }
  refrescarContadores();
}
document.addEventListener('click', e => {
  const b = e.target.closest('button[data-papelera]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  mandarAPapelera(b.dataset.papelera);
});

// ---------- ficheros que no son notas: PDF en el visor del navegador; imágenes a su tamaño (como mucho, el de la columna);
// vídeo y audio con su reproductor; JSON, CSV y texto tal cual, solo lectura. Lo que el navegador no sabe enseñar
// (un .docx, un .zip) lleva al fichero en su carpeta, en el Finder (Roberto, 2026-10-09).
const TOPE_TEXTO = 1e6;
const RE_VIDEO = /^(mp4|m4v|webm|mov|ogv)$/, RE_AUDIO = /^(mp3|m4a|aac|wav|ogg|oga|flac)$/, RE_TEXTO = /^(json|csv|txt)$/;
let ultimoMostrado = null;   // la recarga en vivo vuelve a pintar el fichero: el Finder se abre una vez por visita
async function abrirFichero(ruta, tipo) {
  const url = `/fichero/${encodeURI(ruta)}`, nombre = ruta.split('/').pop();
  ancho(!RE_TEXTO.test(tipo), tipo === 'pdf');   // sin hoja: PDF (a todo el ancho), imágenes, vídeo, audio y lo que la app no sabe enseñar (columna centrada); la hoja, solo para texto (Roberto, 2026-10-09)
  if (tipo === 'pdf') { $('#nota').innerHTML = `<iframe class="visor-pdf" src="${url}" title="${esc(nombre)}"></iframe>`; return; }
  if (/^(png|jpe?g|gif|webp|avif|svg)$/.test(tipo)) { $('#nota').innerHTML = `<h1>${esc(nombre)}</h1><img class="visor-imagen" src="${url}" alt="${esc(nombre)}">`; return; }
  if (RE_VIDEO.test(tipo)) { $('#nota').innerHTML = `<h1>${esc(nombre)}</h1><video class="visor-imagen" src="${url}" controls preload="metadata"></video>`; return; }
  if (RE_AUDIO.test(tipo)) { $('#nota').innerHTML = `<h1>${esc(nombre)}</h1><audio src="${url}" controls preload="metadata"></audio>`; return; }
  if (!RE_TEXTO.test(tipo)) {
    $('#nota').innerHTML = `<h1>${esc(nombre)}</h1><p class="resumen">La app no sabe enseñar este fichero: te lo señalo en ${GESTOR}, para abrirlo con su programa.</p><p><button type="button" class="secundario" data-mostrar="${esc(ruta)}">${icono('carpeta')} Mostrar en ${GESTOR}</button></p>`;
    if (ultimoMostrado !== ruta) { ultimoMostrado = ruta; mostrarEnCarpeta(ruta); }
    return;
  }
  let texto;
  try { const r = await fetch(url); if (!r.ok) throw new Error(`respuesta ${r.status}`); texto = await r.text(); } catch (e) { $('#nota').innerHTML = `<h1>No se puede abrir</h1><p><code>${esc(ruta)}</code>: ${esc(e.message)}</p>`; return; }
  const cortado = texto.length > TOPE_TEXTO;
  if (cortado) texto = texto.slice(0, TOPE_TEXTO);
  else if (tipo === 'json') { try { texto = JSON.stringify(JSON.parse(texto), null, 2); } catch { /* no es JSON válido: tal cual */ } }
  // Un CSV se lee mejor como tabla (la primera fila, de cabecera); el texto tal cual queda a un clic.
  const tabla = tipo === 'csv' && !cortado ? tablaCsv(texto) : '';
  $('#nota').innerHTML = `<h1>${esc(nombre)}</h1>` + (tabla ? `${tabla}<details class="como-texto"><summary>Ver como texto</summary><pre class="fichero-texto" data-tipo="csv">${esc(texto)}</pre></details>` : `<pre class="fichero-texto" data-tipo="${esc(tipo)}">${esc(texto)}</pre>`)
    + (cortado ? `<p class="resumen">Es muy largo: aquí va el principio. <a href="${url}" target="_blank" rel="noopener">Verlo entero en otra pestaña</a>.</p>` : '');
}

// Las filas de un CSV (comas o punto y coma; comillas dobles con "" dentro). Si no parece una tabla, nada.
function tablaCsv(texto) {
  const sep = (texto.split('\n')[0].match(/;/g) || []).length > (texto.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const filas = texto.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim()).map(l => { const c = []; let v = '', q = false; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (q) { if (ch === '"' && l[i + 1] === '"') { v += '"'; i++; } else if (ch === '"') q = false; else v += ch; } else if (ch === '"') q = true; else if (ch === sep) { c.push(v); v = ''; } else v += ch; } c.push(v); return c; });
  if (filas.length < 2 || filas[0].length < 2) return '';
  const num = v => /^-?\d+([.,]\d+)?$/.test(v.trim());
  return `<div class="tabla-csv"><table><thead><tr>${filas[0].map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${filas.slice(1).map(f => `<tr>${f.map(v => `<td${num(v) ? ' class="cifra"' : ''}>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
// Sin hoja, la misma columna centrada que la hoja; PDF y páginas HTML (todo=true) a todo el ancho, y la miga se alinea con ellos.
function ancho(si, todo = false) { $('#nota').classList.toggle('ancha', si); $('#nota').classList.toggle('todo', si && todo); $('.miga-barra').classList.toggle('todo', si && todo); }

// ---------- nota
function sinPortada() {
  $('#miga').innerHTML = '<strong>Cuaderno</strong>'; ponerVista(null);
  $('#nota').innerHTML = `<h1>${esc(cuaderno().nombre)}</h1><p class="resumen">Esta carpeta no tiene una nota de portada. Elige una nota en el árbol de la izquierda o busca con <kbd>${pista('Ctrl K', 'F')}</kbd>.</p>`;
}
// La tabla de propiedades (frontmatter) de la lectura; el editor pinta la misma, de solo lectura.
const htmlPropiedades = fm => fm ? `<dl class="propiedades">${Object.entries(fm).filter(([, v]) => v !== '' && v != null && !(Array.isArray(v) && !v.length)).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${Array.isArray(v) ? v.map(x => `<span class="etiqueta">${esc(x)}</span>`).join('') : esc(v)}</dd>`).join('')}</dl>` : '';
let propiedadesActual = '';   // las de la nota que se ve, para el editor
let turnoNota = 0, notaPintada = null, pendienteNota = null;   // la última petición de nota es la que pinta; y lo último pintado, para no repintar lo mismo
// `await abrirNota()` vuelve siempre con la nota pintada: una llamada superada por otra más nueva espera a la última antes de volver
// (lo que el llamante hace después, como refrescar el índice o saltar a una línea, necesita la nota en pantalla).
function abrirNota(ruta, lineaDestino, opciones) { return (pendienteNota = abrirNotaTurno(ruta, lineaDestino, opciones)); }
async function abrirNotaTurno(ruta, lineaDestino, { desdeCambios = false } = {}) {
  soltarEdicion();   // pintar una nota (otra, o esta recién escrita) cierra el editor que hubiera
  const turno = ++turnoNota;   // si mientras llega la respuesta se pide otra nota (o esta otra vez), esta ya no pinta: lo viejo no pisa lo nuevo
  // La misma nota otra vez (recarga en vivo, un comentario recién escrito) conserva el scroll; una nota nueva empieza arriba.
  const recarga = rutaActual === ruta && !$('#nota').hidden && lineaDestino == null;
  if (rutaActual !== ruta) { vistaNota = null; ultimoMostrado = null; notaPintada = null; }
  rutaActual = ruta;
  $('#panel').hidden = true; $('#nota').hidden = false; delete $('#nota').dataset.vista;
  let n;
  try { n = await api(`/api/nota?p=${encodeURIComponent(ruta)}`); } catch (e) { if (turno !== turnoNota) return pendienteNota; $('#nota').innerHTML = `<h1>No se puede abrir</h1><p><code>${esc(ruta)}</code>: ${esc(e.message)}</p>`; return; }
  if (turno !== turnoNota) return pendienteNota;
  ponerVista(ruta.split('/').pop());
  $('#miga').innerHTML = ruta.split('/').map((s, i, a) => i < a.length - 1 ? `<span>${esc(s)}</span> › ` : `<strong>${esc(n.esHtml ? tituloDe(ruta) : s)}</strong>`).join('') + botonMostrar(ruta, ruta.split('/').pop()) + botonCopiar(ruta) + (n.generado ? '' : botonPapelera(ruta, ruta.split('/').pop()));   // una nota que regenera el profesor no se manda a la papelera desde aquí
  ancho(!!n.esHtml, !!n.esHtml);
  propiedadesActual = htmlPropiedades(n.frontmatter);
  $('#btn-editar').hidden = !!(n.esFichero || n.esHtml);   // lo que no es Markdown no se edita aquí
  if (n.esFichero) return abrirFichero(ruta, n.tipo);
  const tipo = n.frontmatter && n.frontmatter.tipo;
  if (vistaNota !== ruta && tipo === 'examen') return abrirExamen(ruta);
  if (vistaNota !== ruta && tipo === 'flashcards') return abrirTarjetas(ruta);
  if (n.esHtml) { $('#nota').innerHTML = `<iframe class="ejercicio" sandbox="allow-scripts allow-forms allow-modals" src="/fichero/${encodeURI(ruta)}" title="${esc(nombreNota(ruta))}"></iframe>`; return; }
  // Las propiedades van debajo del título, no encima: el título es lo primero que se lee.
  const props = htmlPropiedades(n.frontmatter);
  const back = n.backlinks.length ? `<nav class="backlinks" aria-label="Notas que enlazan aquí">Enlazan aquí: ${n.backlinks.map(b => `<a class="wiki" href="#/n/${encodeURI(b)}" title="${esc(b)}">${esc(tituloDe(b))}</a>`).join('')}</nav>` : '';
  // «Tareas que la mencionan»: las casillas de otras notas que la enlazan o la nombran con #etiqueta, junto a los backlinks.
  let menciones = []; try { menciones = await api(`/api/tareas-de?p=${encodeURIComponent(ruta)}`); } catch { /* sin esta sección, la nota se lee igual */ }
  if (turno !== turnoNota) return pendienteNota;
  if (rutaActual !== ruta || edicion) return;   // mientras llegaba la respuesta se abrió otra nota (o esta otra vez), o se pulsó «Editar» (el editor no se pisa)
  const tareasMencion = menciones.length ? `<section class="menciones" aria-label="Tareas que la mencionan"><h2>Tareas que la mencionan <a class="wiki ver-en-tareas" href="#/tareas?nota=${encodeURIComponent(nombreNota(ruta))}">Ver en Tareas</a></h2>${menciones.map(i => `<label class="item${i.hecha ? ' hecha' : ''}"><input type="checkbox" class="casilla-mencion" data-ruta="${esc(i.ruta)}" data-linea="${i.linea}"${i.hecha ? ' checked' : ''}${i.generado ? ' disabled' : ''}><span>${i.html || esc(i.texto)}</span></label>`).join('')}</section>` : '';
  const html = n.html + tareasMencion + back;
  if (desdeCambios && recarga && html === notaPintada) { $('#nota').dataset.vista = 'nota'; return; }   // la recarga en vivo avisa de cualquier toque al fichero (también de lo que escribe la propia app): si la nota sale igual, no se repinta
  notaPintada = html;
  const scrollAntes = $('#centro').scrollTop;   // el de ahora: el lector pudo bajar mientras llegaba la respuesta
  $('#nota').innerHTML = html;
  const h1 = $('#nota .bloque > h1');
  if (props) (h1 ? h1.closest('.bloque') : $('#nota')).insertAdjacentHTML(h1 ? 'afterend' : 'afterbegin', props);
  $('#nota').querySelectorAll('.math').forEach(el => { try { katex.render(el.textContent, el, { displayMode: el.dataset.display === '1', throwOnError: false }); } catch { /* se queda el texto */ } });
  // Un solo punto de Tab en toda la nota (hallazgo 7): flechas entre bloques, C comenta (el texto seleccionado, o el bloque enfocado) y
  // E edita la nota entera. Ya no hay iconos por bloque (Roberto, 2026-10-09): comentar es seleccionar y el botón flotante o C.
  $('#nota').querySelectorAll('.bloque').forEach((b, i) => { b.tabIndex = i === 0 ? 0 : -1; });
  Comentar.pintar($('#nota'));   // subrayados de los comentarios con cita; sus callouts, ocultos
  $('#nota').dataset.vista = 'nota';   // una nota normal: el índice se puede mostrar (refrescarIndice)
  $('#centro').scrollTop = recarga ? scrollAntes : 0;
  if (lineaDestino != null && Comentar.hiloEnLinea(lineaDestino)) { const h = Comentar.hiloEnLinea(lineaDestino); h.botones[0].scrollIntoView({ block: 'center' }); h.botones[0].focus(); Comentar.abrirHilo(h, { enfocar: false }); }
  else if (lineaDestino != null) { const b = [...$('#nota').querySelectorAll('.bloque')].find(x => +x.dataset.desde <= lineaDestino && lineaDestino < +x.dataset.hasta); if (b) { b.scrollIntoView({ block: 'center' }); b.classList.add('resaltado'); setTimeout(() => b.classList.remove('resaltado'), 1500); } }
}
// ---------- el índice de la nota (dirección C de la revisión de diseño, Roberto 2026-10-09)
// Los h2/h3 de la nota, fijos en el margen derecho de la hoja, con la sección actual marcada. Solo si cabe: hoja entera
// (texto + márgenes) + hueco + índice sin encoger la hoja, en el ancho que le queda a #centro (sin barra lateral ni cajón).
// Sin él con menos de 3 títulos y en todo lo que no sea una nota normal (paneles, examen, tarjetas, ficheros).
const INDICE = { ancho: 200, hueco: 24, margen: 16, minimoTitulos: 3 };
let tituloIndice = [];   // los elementos h2/h3 de la nota
function refrescarIndice() {
  const idx = $('#indice'), centro = $('#centro'), nota = $('#nota');
  const titulos = nota.hidden || nota.dataset.vista !== 'nota' || nota.classList.contains('ancha') ? [] : [...nota.querySelectorAll('.bloque > h2, .bloque > h3')];
  const abierto = !$('#cajon').hidden && $('#app').classList.contains('cajon-capa');   // el cajón tapa todo: no hay sitio
  const hoja = parseFloat(getComputedStyle(centro).getPropertyValue('--texto')) + 2 * parseFloat(getComputedStyle(centro).getPropertyValue('--hoja-pad'));
  const cabe = !abierto && centro.clientWidth >= hoja + INDICE.hueco + INDICE.ancho + 2 * INDICE.margen;
  const mostrar = titulos.length >= INDICE.minimoTitulos && cabe;
  centro.classList.toggle('con-indice', mostrar);
  idx.hidden = !mostrar;
  if (!mostrar) { tituloIndice = []; idx.innerHTML = ''; return; }
  if (titulos.length !== tituloIndice.length || titulos.some((t, i) => t !== tituloIndice[i])) {
    tituloIndice = titulos;
    idx.innerHTML = `<p class="indice-titulo">En esta nota</p><ul>${titulos.map((t, i) => `<li class="${t.tagName.toLowerCase()}"><button type="button" data-i="${i}">${esc(t.textContent.trim())}</button></li>`).join('')}</ul>`;
  }
  const c = centro.getBoundingClientRect(), n = nota.getBoundingClientRect(), barra = $('.miga-barra').offsetHeight;
  idx.style.left = `${Math.round(n.right + INDICE.hueco)}px`;
  idx.style.top = `${Math.round(c.top + barra + 16)}px`;
  idx.style.maxHeight = `${Math.max(120, Math.round(c.height - barra - 32))}px`;
  marcarSeccion();
}
// La sección en la que estás: el último título que ya pasó de la barra de la miga (al final del todo, el último que se ve).
function marcarSeccion() {
  if (!tituloIndice.length) return;
  const c = $('#centro'), borde = c.getBoundingClientRect().top + $('.miga-barra').offsetHeight + 40;
  let actual = 0;
  tituloIndice.forEach((t, i) => { if (t.getBoundingClientRect().top <= borde) actual = i; });
  if (c.scrollTop + c.clientHeight >= c.scrollHeight - 2) { const v = c.getBoundingClientRect().bottom; tituloIndice.forEach((t, i) => { if (t.getBoundingClientRect().top < v - 24) actual = Math.max(actual, i); }); }
  $('#indice').querySelectorAll('button').forEach((b, i) => { if (i === actual) b.setAttribute('aria-current', 'location'); else b.removeAttribute('aria-current'); });
}
let marcaPendiente = false;
$('#centro').addEventListener('scroll', () => { if (marcaPendiente) return; marcaPendiente = true; requestAnimationFrame(() => { marcaPendiente = false; marcarSeccion(); }); }, { passive: true });
$('#indice').addEventListener('click', e => {
  const b = e.target.closest('button[data-i]'); if (!b) return;
  const t = tituloIndice[+b.dataset.i]; if (!t) return;
  t.scrollIntoView({ block: 'start' });
  $('#indice').querySelectorAll('button').forEach(x => x.removeAttribute('aria-current')); b.setAttribute('aria-current', 'location');
});
new ResizeObserver(refrescarIndice).observe($('#centro'));   // la ventana, la barra lateral y el cajón (derecha, abajo o cerrado) cambian su tamaño
new MutationObserver(refrescarIndice).observe($('#nota'), { childList: true, attributes: true, attributeFilter: ['hidden', 'data-vista', 'class'] });
async function marcarCasilla(ruta, linea, marcada, trasFallo) {
  const original = lineasDe(await textoFichero(ruta))[linea];
  try { await api('/api/casilla', { ruta, linea, marcada, original }); return true; } catch (e) { if (trasFallo) trasFallo(e); return false; }
}
$('#nota').addEventListener('click', async e => {
  const t = e.target;
  if (t.classList.contains('casilla-mencion')) { const ok = await marcarCasilla(t.dataset.ruta, +t.dataset.linea, t.checked, err => { if (err.status !== 409) avisarError('No se ha podido marcar la tarea.', err.message); abrirNota(rutaActual); }); if (ok) { t.closest('.item').classList.toggle('hecha', t.checked); avisar(t.checked ? 'Marcada' : 'Desmarcada'); refrescarContadores(); } return; }
  if (t.classList.contains('casilla')) { const ok = await marcarCasilla(rutaActual, +t.dataset.linea, t.checked, () => { t.checked = !t.checked; }); if (ok) { avisar(t.checked ? 'Marcada' : 'Desmarcada'); refrescarContadores(); } return; }
  if (t.closest('.callout-titulo')) { const c = t.closest('.callout'); if (c && c.querySelector('.callout-titulo').dataset.plegable) c.classList.toggle('plegado'); return; }
});
$('#nota').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList.contains('callout-titulo')) e.target.click(); });
$('#nota').addEventListener('focusin', e => { const b = e.target.closest('.bloque'); if (!b) return; $('#nota').querySelectorAll('.bloque[tabindex="0"]').forEach(x => { if (x !== b) x.tabIndex = -1; }); b.tabIndex = 0; });
$('#nota').addEventListener('keydown', e => {
  const b = e.target; if (!b.classList || !b.classList.contains('bloque') || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;   // Mayús + flechas es seleccionar texto
  const bs = [...$('#nota').querySelectorAll('.bloque')].filter(x => !x.hidden), i = bs.indexOf(b);   // los callouts de comentarios con subrayado no cuentan
  if (e.key === 'ArrowDown' && bs[i + 1]) { e.preventDefault(); bs[i + 1].focus(); }
  else if (e.key === 'ArrowUp' && bs[i - 1]) { e.preventDefault(); bs[i - 1].focus(); }
});

Comentar.iniciar({
  api, avisar, avisarError, zonaAvisos, textoFichero,
  ruta: () => rutaActual, recargar: () => abrirNota(rutaActual), contadores: () => refrescarContadores(),
  edicionActiva: () => !!edicion, dialogoAbierto: () => dialogoAbierto(), refrescarPanel: () => abrirComentarios(),
});

// ---------- examen como formulario
let vistaNota = null;   // ruta que el usuario quiere ver como nota normal aunque sea examen o flashcards
const verComoNota = ruta => `<p class="cambiar-vista"><button type="button" class="secundario pequeno" data-vista-nota="${esc(ruta)}">Ver como nota</button></p>`;
async function abrirExamen(ruta) {
  let ex; try { ex = await api(`/api/examen?p=${encodeURIComponent(ruta)}`); } catch (e) { $('#nota').innerHTML = `<p>${esc(e.message)}</p>`; return; }
  const fm = ex.frontmatter || {};
  const estado = fm.intentos && String(fm.intentos) !== '0' ? `<p class="resumen">Intentos: ${esc(fm.intentos)}${fm.nota !== '' && fm.nota != null ? `. Última nota: <b>${esc(fm.nota)}</b>` : ''}${fm.aprobado ? `. Se aprueba con ${esc(fm.aprobado)}` : ''}.</p>` : (fm.aprobado ? `<p class="resumen">Se aprueba con ${esc(fm.aprobado)}.</p>` : '');
  const form = ex.preguntas.map(q => `<fieldset class="pregunta" data-numero="${q.numero}"><legend><span class="numero">${q.numero}</span></legend><div class="enunciado">${q.enunciado}</div>${q.opciones.map(o => `<label class="opcion"><input type="${q.unica ? 'radio' : 'checkbox'}" name="p${q.numero}" value="${o.letra}"${o.marcada ? ' checked' : ''}><span class="letra">${o.letra})</span><span>${o.texto}</span></label>`).join('')}</fieldset>`).join('');
  const pie = ex.validable ? '<button type="submit" id="validar">Corregir</button><span class="pista">Guarda tus respuestas en la nota y las corrige con la herramienta del kit</span>'
    : `<button type="submit" id="validar" class="secundario">Guardar respuestas</button><span class="pista">${esc(ex.motivo || '')}</span>`;
  $('#nota').innerHTML = `${verComoNota(ruta)}${ex.cabecera}${estado}<form id="examen" class="examen">${form}<div class="examen-pie">${pie}</div></form>${ex.resto ? `<section class="historico">${ex.resto}</section>` : ''}`;
  $('#nota').querySelectorAll('.math').forEach(el => { try { katex.render(el.textContent, el, { displayMode: el.dataset.display === '1', throwOnError: false }); } catch { /* texto */ } });
  $('#centro').scrollTop = 0;
  $('#examen').addEventListener('submit', async e => {
    e.preventDefault();
    const respuestas = {};
    for (const f of $('#examen').querySelectorAll('fieldset')) respuestas[f.dataset.numero] = [...f.querySelectorAll('input:checked')].map(i => i.value);
    const sinContestar = Object.values(respuestas).filter(v => !v.length).length;
    if (ex.validable && sinContestar && !confirm(`Hay ${sinContestar} pregunta${sinContestar === 1 ? '' : 's'} sin contestar. ¿Corregir igualmente?`)) return;
    $('#validar').disabled = true; avisar(ex.validable ? 'Corrigiendo…' : 'Guardando…');
    let r; try { r = await api('/api/examen/validar', { ruta, respuestas }); } catch (err) { r = { codigo: 1, salida: err.message }; }
    await refrescarInfo(); refrescarContadores();
    abrirNota(ruta);
    mostrarResultado(r.corregido ? 'Examen corregido' : 'Respuestas guardadas', r);
  });
}
$('#nota').addEventListener('click', e => { const a = e.target.closest('[data-vista-nota]'); if (!a) return; e.preventDefault(); vistaNota = a.dataset.vistaNota; abrirNota(vistaNota); });

// ---------- flashcards en modo tarjeta
let tarjetasEstado = null;
async function abrirTarjetas(ruta) {
  let t; try { t = await api(`/api/flashcards?p=${encodeURIComponent(ruta)}`); } catch (e) { $('#nota').innerHTML = `<p>${esc(e.message)}</p>`; return; }
  if (!t.tarjetas.length) { vistaNota = ruta; return abrirNota(ruta); }
  const previo = tarjetasEstado && tarjetasEstado.ruta === ruta ? tarjetasEstado.indice : 0;
  tarjetasEstado = { ruta, indice: Math.min(previo, t.tarjetas.length - 1), destapada: false, tarjetas: t.tarjetas, titulo: t.titulo };
  pintarTarjeta();
}
function pintarTarjeta() {
  const s = tarjetasEstado, n = s.tarjetas.length, i = s.indice, t = s.tarjetas[i];
  const sabidas = s.tarjetas.filter(x => x.sabia === true).length, falladas = s.tarjetas.filter(x => x.sabia === false).length;
  const marca = t.sabia === true ? '<span class="marca ok">✅ la sabías</span>' : t.sabia === false ? '<span class="marca mal">❌ no la sabías</span>' : '';
  $('#nota').innerHTML = `${verComoNota(s.ruta)}<h1>${esc(s.titulo)}</h1><p class="resumen">${n} tarjetas: ${sabidas} sabidas, ${falladas} falladas</p>
    <section class="tarjeta" aria-live="polite" tabindex="-1">
      <div class="cabecera"><span>Tarjeta ${i + 1} de ${n}</span>${marca}</div>
      <div class="pregunta-tarjeta">${t.pregunta}</div>
      ${s.destapada ? `<div class="respuesta-tarjeta">${t.respuesta}</div><div class="botones"><button type="button" data-tarjeta="sabia">✅ La sabía</button><button type="button" data-tarjeta="no-sabia" class="secundario">❌ No la sabía</button></div>`
      : '<div class="botones"><button type="button" data-tarjeta="destapar">Destapar</button></div>'}
      <div class="pie"><button type="button" class="secundario pequeno" data-tarjeta="anterior"${i === 0 ? ' disabled' : ''}>Anterior</button><span class="pista">${esc(t.info)}</span><button type="button" class="secundario pequeno" data-tarjeta="siguiente"${i === n - 1 ? ' disabled' : ''}>Siguiente</button></div>
    </section><p class="pista">Teclado: espacio destapa, 1 la sabía, 2 no la sabía, flechas para cambiar de tarjeta</p>`;
  $('#nota').querySelectorAll('.math').forEach(el => { try { katex.render(el.textContent, el, { displayMode: el.dataset.display === '1', throwOnError: false }); } catch { /* texto */ } });
  $('#nota .tarjeta').focus();   // el foco va a la tarjeta, no a un botón: las teclas siguen funcionando y nada lleva anillo
}
async function accionTarjeta(que) {
  const s = tarjetasEstado; if (!s) return;
  const t = s.tarjetas[s.indice];
  if (que === 'destapar') { s.destapada = true; return pintarTarjeta(); }
  if (que === 'anterior' && s.indice > 0) { s.indice--; s.destapada = false; return pintarTarjeta(); }
  if (que === 'siguiente' && s.indice < s.tarjetas.length - 1) { s.indice++; s.destapada = false; return pintarTarjeta(); }
  if (que === 'sabia' || que === 'no-sabia') {
    if (!s.destapada) return;
    const sabia = que === 'sabia';
    const lineas = lineasDe(await textoFichero(s.ruta));
    try {
      await api('/api/casilla', { ruta: s.ruta, linea: sabia ? t.lineaSabia : t.lineaNoSabia, marcada: true, original: lineas[sabia ? t.lineaSabia : t.lineaNoSabia] });
      await api('/api/casilla', { ruta: s.ruta, linea: sabia ? t.lineaNoSabia : t.lineaSabia, marcada: false, original: lineas[sabia ? t.lineaNoSabia : t.lineaSabia] });
    } catch (e) { if (e.status !== 409) avisarError('No se ha podido escribir la respuesta en la nota.', e.message); return; }
    t.sabia = sabia;
    if (s.indice < s.tarjetas.length - 1) { s.indice++; s.destapada = false; } 
    pintarTarjeta();
    if (s.indice === s.tarjetas.length - 1 && t === s.tarjetas[s.indice]) avisar('Última tarjeta. Guarda cuando acabes.');
  }
}
$('#nota').addEventListener('click', e => { const b = e.target.closest('button[data-tarjeta]'); if (b) accionTarjeta(b.dataset.tarjeta); });
document.addEventListener('keydown', e => {
  if (!tarjetasEstado || rutaActual !== tarjetasEstado.ruta || !$('#resultado').hidden) return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
  const m = { ' ': 'destapar', '1': 'sabia', '2': 'no-sabia', 'ArrowLeft': 'anterior', 'ArrowRight': 'siguiente' }[e.key];
  if (m) { e.preventDefault(); accionTarjeta(m); }
});

// ---------- editor de la nota entera (CodeMirror, public/live.js; Roberto, 2026-10-09)
// «Editar» (botón de la miga o tecla E) cambia la hoja por el editor con el texto del fichero tal cual; «Aplicar» lo
// escribe entero (/api/nota/escribir) y vuelve a la lectura, en el mismo bloque. Hasta aplicar no se toca el fichero.
let escribiendo = false;   // Aplicar está escribiendo la nota
let edicion = null;   // { ruta, original (como lo sirve /fichero), texto0 (el mismo, con LF), linea (donde estaba el lector), hash (la ruta de la nota) }
let live = null;      // el módulo public/live.js, la primera vez que se edita
const teclaAplicar = MAC ? '⌘ Enter' : 'Ctrl Enter';
const teclaMod = MAC ? '⌘' : 'Ctrl';
// La barra de formato (role=toolbar): un solo botón con tabindex 0 y flechas entre ellos.
const FORMATOS_BARRA = [
  ['negrita', '<b>B</b>', 'Negrita', `${teclaMod} B`], ['cursiva', '<i>I</i>', 'Cursiva', `${teclaMod} I`], ['titulo', 'H', 'Título (cada pulsación sube el nivel: ##, ###, ####; en el último, lo quita)', ''],
  ['lista', '•', 'Lista', ''], ['casilla', '☐', 'Casilla', ''],
  ['enlace', '<svg class="icono" aria-hidden="true" viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>', 'Enlace', ''], ['codigo', '&lt;/&gt;', 'Código', ''],
];
const htmlBarra = () => `<div class="edicion-barra" role="toolbar" aria-label="Formato" aria-orientation="horizontal">${FORMATOS_BARRA.map(([id, icono, nombre, atajo], i) => `<button type="button" class="secundario" data-formato="${id}" aria-label="${nombre.replace(/ \(.*/, '')}" title="${nombre}${atajo ? ` (${atajo})` : ''}" aria-pressed="false" tabindex="${i === 0 ? 0 : -1}">${icono}</button>`).join('')}</div>`;
function actualizarBarra() {
  if (!edicion || !live) return;
  const activos = live.formatosActivos();
  document.querySelectorAll('.edicion-barra button').forEach(b => b.setAttribute('aria-pressed', String(!!activos[b.dataset.formato])));
}
function enlazarBarra() {
  const barra = $('.edicion-barra'), botones = () => [...barra.querySelectorAll('button')];
  barra.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });   // el editor no pierde el foco ni la selección
  barra.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; live.formato(b.dataset.formato); live.enfocar(); actualizarBarra(); });
  barra.addEventListener('keydown', e => {
    const bs = botones(), i = bs.indexOf(document.activeElement); if (i < 0) return;
    const j = { ArrowRight: (i + 1) % bs.length, ArrowLeft: (i - 1 + bs.length) % bs.length, Home: 0, End: bs.length - 1 }[e.key];
    if (j == null) return;
    e.preventDefault(); bs.forEach((b, k) => { b.tabIndex = k === j ? 0 : -1; }); bs[j].focus();
  });
}
const desplazamientoDeLinea = (texto, linea) => texto.split('\n').slice(0, linea).reduce((a, l) => a + l.length + 1, 0);
async function entrarEdicion() {
  if (edicion || !rutaActual || $('#nota').hidden || $('#btn-editar').hidden || dialogoAbierto()) return;
  const ruta = rutaActual, centro = $('#centro');
  // El bloque que se estaba leyendo (el primero que asoma bajo la miga): el cursor queda en su primera línea. Arriba del todo, al principio.
  const tope = $('.miga-barra').getBoundingClientRect().bottom;
  const bloque = centro.scrollTop > 0 ? [...$('#nota').querySelectorAll('.bloque')].find(b => b.getBoundingClientRect().bottom > tope + 4) : null;
  let original;
  try { original = await textoFichero(ruta); live = live || await import('/public/live.js'); } catch (e) { return avisarError('No se ha podido abrir el editor.', e.message); }
  if (rutaActual !== ruta || edicion) return;   // mientras llegaba se cambió de nota
  const texto = original.replace(/\r\n/g, '\n'), linea = bloque ? +bloque.dataset.desde : 0;
  edicion = { ruta, original, texto0: texto, linea, hash: location.hash };
  $('#btn-editar').hidden = true;
  $('#nota').dataset.vista = 'edicion';
  $('#nota').style.setProperty('--alto-miga', `${$('.miga-barra').offsetHeight}px`);
  $('#nota').innerHTML = `${htmlBarra()}<div id="edicion-cm"></div><div class="edicion-pie"><div id="franja-edicion" role="alert" hidden></div><button type="button" id="edicion-cancelar" class="secundario">Cancelar</button><button type="button" id="edicion-aplicar" class="primario" disabled>Aplicar</button><span class="pista">${teclaAplicar} aplica · Esc cancela</span></div>`;
  live.montar($('#edicion-cm'), texto, { plano: info.configuracion.editor === 'plano', ruta, propiedades: propiedadesActual, posicion: desplazamientoDeLinea(texto, linea), alCambiar: actualizarEstadoEdicion, alSeleccionar: actualizarBarra });
  enlazarBarra();
  $('#edicion-cancelar').onclick = pedirSalida;
  $('#edicion-aplicar').onclick = aplicarEdicion;
}
// Cierra el editor sin repintar (otra pantalla lo sustituye).
function soltarEdicion() { if (!edicion) return; edicion = null; if (live) live.destruir(); $('#editando').hidden = true; $('#editando-aviso').textContent = ''; }
async function salirEdicion() {
  if (!edicion) return;
  const { ruta, linea } = edicion;
  soltarEdicion();
  await abrirNota(ruta);
  const b = [...$('#nota').querySelectorAll('.bloque')].find(x => +x.dataset.desde <= linea && linea < +x.dataset.hasta);
  if (b && linea > 0) { b.scrollIntoView({ block: 'start' }); $('#centro').scrollTop -= $('.miga-barra').offsetHeight + 8; }
  if (!$('#btn-editar').hidden) $('#btn-editar').focus();
}
async function aplicarEdicion() {
  if (!edicion) return;
  const { ruta, original } = edicion, texto = live.texto();
  if (texto === original.replace(/\r\n/g, '\n')) return salirEdicion();   // nada que escribir
  escribiendo = true;   // la recarga en vivo que provoca esta escritura no repinta ni compara: salirEdicion repinta al acabar
  try {
    try { await api('/api/nota/escribir', { ruta, texto, original }); }
    catch (e) { if (e.status === 409) return mostrarFranja('conflicto'); return avisarError('No se ha podido escribir la nota.', e.message); }
    avisar('Nota escrita');
    await salirEdicion();
  } finally { escribiendo = false; }
  refrescarContadores();
}
$('#btn-editar').onclick = entrarEdicion;
// Esc cancela y Ctrl/⌘ Enter aplica, con el foco en el editor (en captura: el editor no debe insertar una línea con Mod-Enter).
$('#nota').addEventListener('keydown', e => {
  if (!edicion || !e.target.closest('#edicion-cm')) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); pedirSalida(); }
  else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.stopPropagation(); aplicarEdicion(); }
}, true);
// ---------- lo escrito no se pierde: sin aplicar, descartar, cambios en el disco y conflicto al aplicar
const normalizar = t => String(t).replace(/^﻿/, '').replace(/\r\n/g, '\n');   // como el servidor (escribirNota): sin BOM y con LF
const hayCambios = () => !!(edicion && live && live.texto() !== edicion.texto0);   // el texto, no si se pulsó una tecla: escribir y borrar no es cambiar
function actualizarEstadoEdicion() {
  if (!edicion) return;
  const c = hayCambios();
  $('#edicion-aplicar').disabled = !c;
  $('#editando').hidden = !c;
  $('#editando-aviso').textContent = c ? 'Editando: hay cambios sin aplicar' : '';   // lo anuncia el lector de pantalla (auditoría 2026-10-09, 5)
}
// Salir con Esc o Cancelar: con cambios, antes se pregunta.
function pedirSalida() { if (!edicion) return; if (hayCambios()) abrirDescartar(() => salirEdicion()); else salirEdicion(); }
let alDescartar = null, focoDescartar = null;
function abrirDescartar(fn) {
  if (!$('#descartar').hidden) return;
  focoDescartar = document.activeElement; alDescartar = fn;
  $('#descartar').hidden = false; sincronizarInerte(); $('#descartar-seguir').focus();
}
function cerrarDescartar(descartar) {
  const fn = alDescartar; alDescartar = null;
  $('#descartar').hidden = true; sincronizarInerte();
  if (descartar) { if (fn) fn(); return; }
  if (edicion && live) live.enfocar(); else if (focoDescartar && document.contains(focoDescartar)) focoDescartar.focus();
}
$('#descartar-seguir').onclick = () => cerrarDescartar(false);
$('#descartar-ok').onclick = () => cerrarDescartar(true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#descartar').hidden) { e.preventDefault(); cerrarDescartar(false); } });
window.addEventListener('beforeunload', e => { if (hayCambios()) { e.preventDefault(); e.returnValue = ''; } });
// La franja fija sobre los botones: la nota cambió en el disco (recarga en vivo) o el servidor dijo 409 al aplicar.
function mostrarFranja(tipo) {
  const f = $('#franja-edicion'); if (!f || !edicion) return;
  if (tipo === 'disco' && f.dataset.tipo === 'conflicto') return;   // el 409 es más grave y ya está a la vista
  f.dataset.tipo = tipo; f.hidden = false;
  f.innerHTML = tipo === 'disco'
    ? '<span class="franja-texto"><b>La nota cambió en el disco.</b> Lo que has escrito sigue aquí.</span><button type="button" id="franja-seguir" class="secundario">Seguir editando</button><button type="button" id="franja-recargar">Recargar (pierdes lo escrito)</button>'
    : '<span class="franja-texto"><b>No se ha podido aplicar: la nota cambió en el disco.</b> Lo que has escrito sigue aquí.</span><button type="button" id="franja-sobrescribir" class="primario">Sobrescribir</button><button type="button" id="franja-copiar">Copiar mi texto y recargar</button>';
}
async function recargarDesdeDisco() { const ruta = edicion.ruta; soltarEdicion(); await abrirNota(ruta); if (!$('#btn-editar').hidden) $('#btn-editar').focus(); }
document.addEventListener('click', async e => {
  const b = e.target.closest('#franja-edicion button'); if (!b || !edicion) return;
  if (b.id === 'franja-seguir') { $('#franja-edicion').hidden = true; live.enfocar(); }
  else if (b.id === 'franja-recargar') await recargarDesdeDisco();
  else if (b.id === 'franja-copiar') {
    const texto = live.texto();
    try { await navigator.clipboard.writeText(texto); } catch { const t = document.createElement('textarea'); t.value = texto; document.body.append(t); t.select(); document.execCommand('copy'); t.remove(); }
    avisar('Tu texto está copiado'); await recargarDesdeDisco();
  } else if (b.id === 'franja-sobrescribir') {
    const { ruta } = edicion, texto = live.texto();
    try { const original = await textoFichero(ruta); await api('/api/nota/escribir', { ruta, texto, original }); }
    catch (err) { return avisarError('No se ha podido escribir la nota.', err.message); }
    avisar('Nota escrita'); await salirEdicion(); refrescarContadores();
  }
});
// La recarga en vivo con el editor abierto no repinta: se vuelve a pedir el texto y solo si difiere del que se abrió hay franja.
async function comprobarDisco() {
  const ed = edicion; if (!ed) return;
  let disco; try { disco = await textoFichero(ed.ruta); } catch { return; }
  if (edicion === ed && normalizar(disco) !== normalizar(ed.original)) mostrarFranja('disco');
}
// E, con la nota a la vista y el foco fuera de un campo de texto, de otro panel o de un diálogo.
document.addEventListener('keydown', e => {
  if (e.key.toLowerCase() !== 'e' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.defaultPrevented) return;
  const t = e.target;
  if (t.closest('input, textarea, select, [contenteditable], .cm-editor, #lateral, #cajon, [role="dialog"]')) return;
  if (!$('#btn-editar').hidden) { e.preventDefault(); entrarEdicion(); }
});

// ---------- diálogos
let foco = null;
// «Guardar» es solo del repositorio (revisión de diseño 2026-10-09, hallazgo 3): la edición de la nota escribe en ella y lo dice con otro verbo («Aplicar»).
// Con un diálogo abierto, lo de detrás queda `inert` y el Tab da la vuelta dentro (hallazgo 8, WCAG 2.4.3): aria-modal no basta.
const DIALOGOS = ['#nueva-nota', '#guardar', '#resultado', '#ajustes', '#descartar'];
const dialogoAbierto = () => DIALOGOS.map($).find(d => d && !d.hidden) || null;
function sincronizarInerte() { const hay = !!dialogoAbierto(); for (const el of [$('#app'), $('.saltar'), $('#aviso-reinicio')]) el.inert = hay; }
document.addEventListener('keydown', e => {
  if (e.key !== 'Tab') return;
  const d = dialogoAbierto(); if (!d) return;
  const f = [...d.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent !== null);
  if (!f.length) return;
  const primero = f[0], ultimo = f[f.length - 1], ahora = document.activeElement;
  if (!d.contains(ahora)) { e.preventDefault(); primero.focus(); }
  else if (e.shiftKey && ahora === primero) { e.preventDefault(); ultimo.focus(); }
  else if (!e.shiftKey && ahora === ultimo) { e.preventDefault(); primero.focus(); }
});
document.querySelector('.saltar').addEventListener('click', e => { e.preventDefault(); const destino = $('#panel').hidden ? $('#nota') : $('#panel'); destino.tabIndex = -1; destino.focus(); });   // un enlace a #nota cambiaría la ruta

// ---------- paneles
// Los filtros del panel viven en el hash (#/tareas?nota=…&etiqueta=…&estado=…): así sobreviven a la recarga en vivo
// y a volver atrás. El filtrado es del navegador: el cuaderno no cambia.
const enTareas = () => location.hash.split('?')[0] === '#/tareas';
const filtrosTareas = () => { const q = new URLSearchParams(location.hash.split('?')[1] || ''); return { nota: q.get('nota') || '', etiqueta: q.get('etiqueta') || '', estado: ['pendientes', 'hechas'].includes(q.get('estado')) ? q.get('estado') : 'todas' }; };
const rutaDeNombre = nombre => arbol.find(p => p.replace(/\.md$/, '') === nombre) || arbol.find(p => nombreNota(p) === nombre) || null;
// Los filtros se recuerdan por cuaderno en este navegador (Roberto, 2026-10-09: «cambio de página y tengo que volver a
// seleccionar»): ir a Tareas sin filtros en la dirección recupera los últimos. Si el navegador no guarda, no pasa nada.
const claveFiltros = () => `cuaderno:filtros-tareas:${cuaderno() ? cuaderno().ruta : ''}`;
function recordarFiltros(q) { try { if (q) localStorage.setItem(claveFiltros(), q); else localStorage.removeItem(claveFiltros()); } catch { /* sin almacenamiento */ } }
function filtrosRecordados() { try { return localStorage.getItem(claveFiltros()) || ''; } catch { return ''; } }
async function abrirTareas() {
  if (location.hash === '#/tareas' && filtrosRecordados()) history.replaceState(null, '', `#/tareas?${filtrosRecordados()}`);
  $('#nota').hidden = true; $('#panel').hidden = false; rutaActual = null;
  $('#miga').innerHTML = '<strong>Tareas</strong>'; ponerVista('Tareas');
  const g = await api('/api/tareas');
  if (!enTareas()) return;   // mientras llegaba la respuesta se cambió de pantalla
  // Si el panel ya estaba pintado (recarga en vivo, tarea nueva), el foco y lo escrito en «Nueva tarea» se conservan.
  const activo = document.activeElement && $('#panel').contains(document.activeElement) ? document.activeElement.id : null;
  const borrador = $('#tarea-nueva') ? $('#tarea-nueva').value : '';
  const total = g.reduce((a, x) => a + x.items.length, 0), hechas = g.reduce((a, x) => a + x.items.filter(i => i.hecha).length, 0);
  const nota = cuaderno().kit !== 'carpeta' ? 'Lo que marcas aquí se escribe en su nota. Los exámenes y las flashcards se contestan en la suya.' : 'Tu lista propia, en <a href="#/n/tareas.md">tareas.md</a>.';
  const f = filtrosTareas();
  const notas = [...new Set([...g.flatMap(x => x.items.flatMap(i => i.enlaces || [])), ...(f.nota ? [f.nota] : [])])].sort((a, b) => a.localeCompare(b, 'es'));
  const etiquetas = [...new Set(g.flatMap(x => x.items.flatMap(i => i.etiquetas || [])))].sort((a, b) => a.localeCompare(b, 'es'));
  const opcion = (v, texto, actual) => `<option value="${esc(v)}"${v === actual ? ' selected' : ''}>${esc(texto)}</option>`;
  const filtros = `<form class="filtros" id="filtros-tareas" aria-label="Filtrar las tareas">`
    + (notas.length ? `<label for="filtro-nota">Nota</label><select id="filtro-nota" name="nota">${opcion('', 'Todas', f.nota)}${notas.map(n => opcion(n, rutaDeNombre(n) ? tituloDe(rutaDeNombre(n)) : n, f.nota)).join('')}</select>` : '')
    + (etiquetas.length ? `<label for="filtro-etiqueta">Etiqueta</label><select id="filtro-etiqueta" name="etiqueta">${opcion('', 'Todas', f.etiqueta)}${etiquetas.map(e => opcion(e, `#${e}`, f.etiqueta)).join('')}</select>` : '')
    + `<label for="filtro-estado">Estado</label><select id="filtro-estado" name="estado">${opcion('todas', 'Todas', f.estado)}${opcion('pendientes', 'Pendientes', f.estado)}${opcion('hechas', 'Hechas', f.estado)}</select>`
    + `<span class="pista" id="filtro-resumen" role="status"></span></form>`
    + `<p class="filtrando" id="filtrando" hidden><span id="filtrando-texto"></span><button type="button" class="secundario pequeno" id="filtro-quitar" data-quitar-filtros>Quitar filtros</button></p>`;
  $('#panel').innerHTML = `<h1>Tareas</h1><p class="resumen">${hechas} de ${total} hechas. ${nota}</p><form class="nueva-tarea" id="nueva-tarea"><label class="oculto" for="tarea-nueva">Nueva tarea</label><input id="tarea-nueva" placeholder="Nueva tarea para mí…" autocomplete="off"><button type="submit">Añadir</button></form>${filtros}`
    + g.map(gr => `<section class="grupo"><h2><a class="wiki" href="#/n/${encodeURI(gr.ruta)}" title="${esc(gr.ruta)}">${esc(tituloDe(gr.ruta))}</a>${gr.generado ? '<span class="solo-lectura">la escribe el profesor al guardar</span>' : ''}</h2>`
      + gr.items.map(i => `<label class="item${i.hecha ? ' hecha' : ''}" data-hecha="${i.hecha ? 1 : 0}" data-enlaces="${esc(JSON.stringify(i.enlaces || []))}" data-etiquetas="${esc(JSON.stringify(i.etiquetas || []))}" data-notas="${esc(JSON.stringify(i.notas || []))}"><input type="checkbox" data-ruta="${esc(gr.ruta)}" data-linea="${i.linea}"${i.hecha ? ' checked' : ''}${gr.generado ? ' disabled' : ''}><span>${i.html || esc(i.texto)}</span></label>`).join('') + '</section>').join('')
    + `<div class="vacio-filtro" id="filtro-vacio" hidden><p id="filtro-vacio-texto"></p><button type="button" class="secundario" data-quitar-filtros>Quitar filtros</button></div>`;
  aplicarFiltrosTareas();
  if (borrador && $('#tarea-nueva')) $('#tarea-nueva').value = borrador;
  if (activo && $(`#${activo}`)) $(`#${activo}`).focus();
}
// Filtra en el sitio (sin repintar: el foco se queda en el control) y deja los filtros en el hash sin añadir historial.
function aplicarFiltrosTareas() {
  const f = filtrosTareas();
  recordarFiltros(location.hash.split('?')[1] || '');
  const activos = !!(f.nota || f.etiqueta || f.estado !== 'todas');
  let visibles = 0, total = 0;
  const rutaF = f.nota ? rutaDeNombre(f.nota) : null;   // también cuentan las que la mencionan por #etiqueta o por carpeta
  document.querySelectorAll('#panel .item').forEach(it => {
    total++;
    const cumple = (!f.nota || JSON.parse(it.dataset.enlaces).includes(f.nota) || (rutaF && JSON.parse(it.dataset.notas).includes(rutaF))) && (!f.etiqueta || JSON.parse(it.dataset.etiquetas).includes(f.etiqueta))
      && (f.estado === 'todas' || (f.estado === 'hechas') === (it.dataset.hecha === '1'));
    it.hidden = !cumple; if (cumple) visibles++;
  });
  document.querySelectorAll('#panel .grupo').forEach(gr => { gr.hidden = ![...gr.querySelectorAll('.item')].some(it => !it.hidden); });
  const r = $('#filtro-resumen'); if (r) r.textContent = activos ? (visibles ? `${visibles} de ${total} tareas` : 'Ninguna tarea cumple los filtros') : '';
  // Señal de que hay filtros (los recuerda el navegador por cuaderno: revisión de diseño 2026-10-09, hallazgo 6) y un estado vacío con salida.
  const nombreNota = f.nota ? (rutaF ? tituloDe(rutaF) : f.nota) : '';
  const partes = [f.nota && `nota «${nombreNota}»`, f.etiqueta && `#${f.etiqueta}`, f.estado !== 'todas' && (f.estado === 'hechas' ? 'hechas' : 'pendientes')].filter(Boolean);
  const fi = $('#filtrando'); if (fi) { fi.hidden = !activos; $('#filtrando-texto').textContent = activos ? `Filtrando: ${partes.join(' · ')}` : ''; }
  const vacio = $('#filtro-vacio'); if (vacio) {
    vacio.hidden = !(activos && !visibles);
    $('#filtro-vacio-texto').textContent = `Ninguna tarea${f.estado === 'hechas' ? ' hecha' : f.estado === 'pendientes' ? ' pendiente' : ''}${f.etiqueta ? ` con #${f.etiqueta}` : ''}${f.nota ? ` que mencione «${nombreNota}»` : ''}.`;
  }
}
$('#panel').addEventListener('change', e => {
  const form = e.target.closest('#filtros-tareas'); if (!form) return;
  const q = new URLSearchParams();
  for (const [k, v] of new FormData(form)) if (v && v !== 'todas') q.set(k, v);
  history.replaceState(null, '', `#/tareas${q.size ? `?${q}` : ''}`);
  aplicarFiltrosTareas(); marcarActiva();
});
$('#panel').addEventListener('click', e => { if (e.target.closest('[data-quitar-filtros]')) { recordarFiltros(''); history.replaceState(null, '', '#/tareas'); abrirTareas().then(() => { const s = $('#filtro-estado'); if (s) s.focus(); }); } });
$('#panel').addEventListener('submit', async e => { if (e.target.id !== 'nueva-tarea') return; e.preventDefault(); const i = e.target.querySelector('input'); if (!i.value.trim()) return; await api('/api/tarea', { texto: i.value }); i.value = ''; avisar('Tarea añadida'); abrirTareas(); refrescarContadores(); });
$('#panel').addEventListener('change', async e => { const t = e.target; if (t.type !== 'checkbox') return; const ok = await marcarCasilla(t.dataset.ruta, +t.dataset.linea, t.checked, err => { if (err.status !== 409) avisarError('No se ha podido marcar la tarea.', err.message); abrirTareas(); }); if (ok) { t.closest('.item').classList.toggle('hecha', t.checked); refrescarContadores(); } });
let comentariosPanel = [];   // los que enseña el panel, para sus botones Editar y Cerrar
async function abrirComentarios() {
  $('#nota').hidden = true; $('#panel').hidden = false; rutaActual = null;
  $('#miga').innerHTML = '<strong>Comentarios</strong>'; ponerVista('Comentarios');
  const c = comentariosPanel = await api('/api/comentarios');
  const quien = x => esc(x.cita || String(x.texto).slice(0, 40));   // de qué comentario es el botón, para el lector de pantalla
  $('#panel').innerHTML = `<h1>Comentarios</h1><p class="resumen">Lo que has anotado en las notas. Tu profesor los ve en la siguiente sesión y los convierte en dudas o aportaciones.</p>`
    + (c.length ? c.map((x, i) => `<section class="grupo"><h2><a class="wiki" href="#/n/${encodeURI(x.ruta)}?l=${x.linea}" title="${esc(x.ruta)}">${esc(tituloDe(x.ruta))}</a> <span class="editor-lineas">${esc(x.autor ? `${x.autor} (${x.fecha})` : x.titulo)}</span></h2>${x.cita ? `<p class="cita"><i>«${esc(x.cita)}»</i></p>` : ''}<p>${esc(x.texto)}</p><p class="acciones-comentario"><button type="button" class="secundario pequeno" data-comentario-editar="${i}" aria-label="Editar el comentario «${quien(x)}»">Editar</button><button type="button" class="secundario pequeno" data-comentario-cerrar="${i}" aria-label="Cerrar el comentario «${quien(x)}»">Cerrar</button></p></section>`).join('') : '<section class="grupo"><p>Todavía no hay comentarios. En cualquier nota, selecciona un texto y pulsa <b>Comentar</b> (o la tecla <b>C</b>).</p></section>');
}
$('#panel').addEventListener('click', e => {
  const ed = e.target.closest('[data-comentario-editar]'), ce = e.target.closest('[data-comentario-cerrar]');
  if (ed) Comentar.editarDesdePanel(comentariosPanel[+ed.dataset.comentarioEditar], ed);
  else if (ce) Comentar.cerrarDesdePanel(comentariosPanel[+ce.dataset.comentarioCerrar]);
});
async function refrescarContadores() {
  if (!cuaderno()) return;
  const [t, c] = await Promise.all([api('/api/tareas'), api('/api/comentarios')]);
  const pend = t.reduce((a, g) => a + g.items.filter(i => !i.hecha).length, 0);
  $('#n-tareas').textContent = pend ? `(${pend})` : ''; $('#n-comentarios').textContent = c.length ? `(${c.length})` : '';
}

// ---------- el cajón: dónde va (derecha o abajo) y cuánto mide, siempre dejando sitio a la nota
const CAJON_DEFECTO = { derecha: 420, abajo: 320 }, CAJON_MIN = { derecha: 320, abajo: 180 }, NOTA_MIN = { derecha: 480, abajo: 240 }, LATERAL = 280;
const posicionCajon = () => info.configuracion.panel === 'abajo' ? 'abajo' : 'derecha';
// El tamaño máximo que cabe en esta ventana para esa posición (lo que queda tras la barra lateral y el mínimo de la nota).
const maximoCajon = pos => (pos === 'derecha' ? window.innerWidth - anchoLateral() : window.innerHeight) - NOTA_MIN[pos];
// El valor guardado está en píxeles y otra ventana u otro monitor pueden dejarlo fuera de rango: se acota al usarlo.
const acotarCajon = (valor, pos) => Math.round(Math.min(Math.max(Number(valor) || CAJON_DEFECTO[pos], CAJON_MIN[pos]), Math.max(maximoCajon(pos), CAJON_MIN[pos])));
const tamanoCajon = pos => acotarCajon(pos === 'derecha' ? info.configuracion.panel_ancho : info.configuracion.panel_alto, pos);
function aplicarCajon() {
  const app = $('#app'), pos = posicionCajon(), abierto = !$('#cajon').hidden;
  app.dataset.panel = pos;
  app.style.setProperty('--panel-ancho', `${tamanoCajon('derecha')}px`);
  app.style.setProperty('--panel-alto', `${tamanoCajon('abajo')}px`);
  const capa = window.innerWidth <= 760 || maximoCajon(pos) < CAJON_MIN[pos];
  app.classList.toggle('cajon-abierto', abierto && !capa);
  app.classList.toggle('cajon-capa', abierto && capa);
  refrescarIndice();
}
function abrirCajon() { $('#cajon').hidden = false; aplicarCajon(); }
function cerrarCajon() { $('#cajon').hidden = true; aplicarCajon(); $('#btn-terminal').focus(); }
window.addEventListener('resize', aplicarCajon);
// El asa: arrastrar cambia el tamaño en vivo (acotado), soltar lo guarda; las flechas lo mueven de 16 en 16; doble clic
// vuelve al de siempre. El valor se guarda redondeado: la validación del servidor solo admite enteros.
const ponerTamanoCajon = (pos, v) => $('#app').style.setProperty(pos === 'derecha' ? '--panel-ancho' : '--panel-alto', `${v}px`);
async function guardarTamanoCajon(pos, v) {
  v = acotarCajon(v, pos); ponerTamanoCajon(pos, v);
  info.configuracion = await api('/api/configuracion', pos === 'derecha' ? { panel_ancho: v } : { panel_alto: v });
  aplicarCajon();
}
{
  const asa = $('.cajon-asa'); let origen = null;
  asa.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const pos = posicionCajon();
    origen = { x: e.clientX, y: e.clientY, pos, tam: tamanoCajon(pos), ultimo: tamanoCajon(pos) };
    asa.setPointerCapture(e.pointerId); asa.classList.add('arrastrando'); document.body.classList.add('redimensionando'); document.body.dataset.panel = pos;
    e.preventDefault();
  });
  asa.addEventListener('pointermove', e => {
    if (!origen) return;
    origen.ultimo = acotarCajon(origen.pos === 'derecha' ? origen.tam + origen.x - e.clientX : origen.tam + origen.y - e.clientY, origen.pos);
    ponerTamanoCajon(origen.pos, origen.ultimo);
  });
  const soltar = () => { if (!origen) return; const { pos, ultimo } = origen; origen = null; asa.classList.remove('arrastrando'); document.body.classList.remove('redimensionando'); guardarTamanoCajon(pos, ultimo); };
  asa.addEventListener('pointerup', soltar); asa.addEventListener('pointercancel', soltar);
  asa.addEventListener('dblclick', () => guardarTamanoCajon(posicionCajon(), CAJON_DEFECTO[posicionCajon()]));
  asa.addEventListener('keydown', e => {
    const pos = posicionCajon(), paso = { ArrowLeft: 16, ArrowRight: -16, ArrowUp: 16, ArrowDown: -16 }[e.key];
    if (!paso || (pos === 'derecha') !== (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
    e.preventDefault(); guardarTamanoCajon(pos, tamanoCajon(pos) + paso);
  });
}

// ---------- terminal: varias sesiones (shell y Profesor) que conviven en el cajón; cada una es su xterm y su /pty
let sesiones = [], sesionActiva = null, numSesion = 0;
const wsUrl = ruta => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${ruta}`;
const variable = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const temaTerminal = () => ({ background: variable('--terminal-fondo'), foreground: '#d7dae0', cursor: '#7aa2f7', selectionBackground: '#3b4261', black: '#15161e', red: '#f7768e', green: '#9ece6a', yellow: '#e0af68', blue: '#7aa2f7', magenta: '#bb9af7', cyan: '#7dcfff', white: '#a9b1d6', brightBlack: '#414868', brightRed: '#f7768e', brightGreen: '#9ece6a', brightYellow: '#e0af68', brightBlue: '#7aa2f7', brightMagenta: '#bb9af7', brightCyan: '#7dcfff', brightWhite: '#c0caf5' });
// Una pestaña oculta mide 0: ni se ajusta ni se manda un tamaño de 0 columnas a la pty.
function redimensionar(s) {
  if (s.elemento.hidden || !s.elemento.clientWidth || !s.elemento.clientHeight) return;
  s.fit.fit();
  if (s.term.cols > 0 && s.term.rows > 0 && s.ws && s.ws.readyState === 1) s.ws.send('\u0001' + JSON.stringify({ cols: s.term.cols, rows: s.term.rows }));
}
function conectar(s) {
  s.cerrada = false; s.pendiente = ''; pintarSesiones();
  const ws = new WebSocket(wsUrl(s.modo === 'profesor' ? '/pty?profesor=1' : '/pty')); s.ws = ws;
  // Lo tecleado antes de que el canal abra no se pierde: espera y sale junto en cuanto abre.
  ws.onopen = () => { redimensionar(s); if (s.pendiente) { ws.send(s.pendiente); s.pendiente = ''; } };
  ws.onmessage = e => s.term.write(e.data);
  ws.onclose = () => { if (s.ws !== ws) return; s.cerrada = true; s.term.write('\r\n[terminal cerrada: Enter abre otra igual]\r\n'); pintarSesiones(); };
}
function crearSesion(modo) {
  const n = ++numSesion, elemento = document.createElement('div'); elemento.className = 'sesion'; elemento.hidden = true; $('#terminal').append(elemento);
  const term = new Terminal({ fontFamily: variable('--mono'), fontSize: 13.5, lineHeight: 1.25, cursorBlink: true, cursorStyle: 'bar', scrollback: 5000, allowProposedApi: true, theme: temaTerminal() });
  const fit = new FitAddon.FitAddon(); term.loadAddon(fit); term.open(elemento);
  const s = { id: n, modo, titulo: modo === 'profesor' ? 'Profesor' : (n === 1 ? 'Terminal' : `Terminal ${n}`), term, fit, ws: null, elemento, cerrada: false };
  term.attachCustomKeyEventHandler(e => {
    if ((e.ctrlKey || e.metaKey) && (e.key === '`' || e.key === '\\')) return false;   // Ctrl ` es de la app (abre y cierra el cajón); Ctrl \ la barra lateral
    // En la app de escritorio, los atajos del menú (Ctrl/⌘ S, O, F, T, N y coma; electron/menu.js) no se los queda xterm: en
    // Windows y Linux Ctrl S es XOFF para la terminal y se comería el acelerador del menú antes de que llegue. Ctrl [ y ] (Atrás y
    // Adelante del menú) sí se los queda: Ctrl [ es Escape en una terminal.
    if (enApp() && (e.ctrlKey || e.metaKey) && !e.altKey && ['s', 'o', 'f', 't', 'n', ','].includes(e.key.toLowerCase())) return false;
    // xterm manda lo mismo con Enter que con Shift+Enter, y Claude Code o Codex envían el mensaje. Shift u Option+Enter
    // mandan \n (Ctrl J), su salto de línea en cualquier terminal; en un shell es como Enter (Roberto, 2026-10-09).
    if (e.key === 'Enter' && (e.shiftKey || e.altKey) && !e.ctrlKey && !e.metaKey) {
      if (e.type === 'keydown') { e.preventDefault(); if (s.ws && s.ws.readyState === 1 && !s.cerrada) s.ws.send('\n'); }
      return false;
    }
    return true;
  });
  term.onData(d => { if (s.cerrada) { if (d === '\r') { s.term.reset(); conectar(s); } return; } if (s.ws && s.ws.readyState === 1) s.ws.send(d); else if (s.ws && s.ws.readyState === 0) s.pendiente += d; });
  conectar(s); sesiones.push(s);
  return s;
}
function activarSesion(s) {
  sesionActiva = s;
  for (const o of sesiones) o.elemento.hidden = o !== s;
  pintarSesiones();
  s.term.focus();   // ya, para teclear sin esperar; y otra vez tras medir, que el ajuste no se lo lleve
  requestAnimationFrame(() => { redimensionar(s); s.term.focus(); });
}
function cerrarSesion(s) {
  const ws = s.ws; s.ws = null; if (ws) ws.close();
  s.term.dispose(); s.elemento.remove();
  sesiones = sesiones.filter(o => o !== s);
  if (sesionActiva === s) { sesionActiva = null; if (sesiones.length) return activarSesion(sesiones[sesiones.length - 1]); }
  pintarSesiones();
}
function cerrarSesiones() { for (const s of [...sesiones]) cerrarSesion(s); }
function pintarSesiones() {
  $('.sesiones').innerHTML = sesiones.map(s => `<div class="sesion-pestana${s === sesionActiva ? ' activa' : ''}${s.cerrada ? ' cerrada' : ''}" role="tab" aria-selected="${s === sesionActiva}"><button type="button" data-activar="${s.id}">${esc(s.titulo)}</button><button type="button" data-cerrar="${s.id}" aria-label="Cerrar ${esc(s.titulo)}">×</button></div>`).join('');
  $('.sin-sesiones').hidden = sesiones.length > 0;
}
$('.sesiones').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const s = sesiones.find(o => o.id === +(b.dataset.activar || b.dataset.cerrar)); if (!s) return;
  if (b.dataset.cerrar) cerrarSesion(s); else activarSesion(s);
});
new ResizeObserver(() => { if (sesionActiva) redimensionar(sesionActiva); }).observe($('#terminal'));
// Abrir la terminal: el cajón y la sesión que toque. Un solo botón, Terminal (Roberto, 2026-10-08); al profesor se llega
// desde «Abrir con el profesor» cuando falla Guardar o Traer, que reutiliza su sesión si sigue viva y nunca mata un shell.
function abrirTerminal(modo) {
  abrirCajon();
  let s = modo === 'profesor' ? sesiones.find(o => o.modo === 'profesor' && !o.cerrada) : (sesionActiva || sesiones[0]);
  if (!s || (modo === 'nueva')) s = crearSesion(modo === 'profesor' ? 'profesor' : 'shell');
  activarSesion(s);
}
function alternarTerminal() { if ($('#cajon').hidden) abrirTerminal('shell'); else cerrarCajon(); }
$('#btn-terminal').onclick = () => alternarTerminal();
$('#btn-cerrar-terminal').onclick = () => cerrarCajon();
$('#btn-nueva-sesion').onclick = () => abrirTerminal('nueva');

// ---------- cuadernos (pantalla de inicio)
const hace = iso => { if (!iso) return 'nunca'; const d = (Date.now() - new Date(iso)) / 864e5; if (d < 1 / 24) return 'hace un momento'; if (d < 1) return `hace ${Math.round(d * 24)} h`; if (d < 30) return `hace ${Math.round(d)} día${Math.round(d) === 1 ? '' : 's'}`; return `el ${new Date(iso).toLocaleDateString('es')}`; };
const textoGit = g => !g ? 'sin repositorio' : `guardado ${hace(g.ultimo)}${g.cambios ? `, ${g.cambios} ${g.cambios === 1 ? 'cambio' : 'cambios'} por guardar` : ''}${g.sinSubir ? `, ${g.sinSubir} sin subir` : ''}`;
async function abrirCuadernos() {
  rutaActual = null; $('#nota').hidden = true; $('#panel').hidden = false;
  $('#miga').innerHTML = '<strong>Cuadernos</strong>'; ponerVista('Cuadernos');
  const lista = await api('/api/cuadernos');
  const recientes = lista.length ? lista.map(c => `<section class="grupo cuaderno${c.abiertoAhora ? ' abierto' : ''}${c.existe ? '' : ' ausente'}"><h2>${c.existe ? `<a href="#/" data-abrir="${esc(c.ruta)}">${esc(c.nombre)}</a>` : esc(c.nombre)}${c.abiertoAhora ? '<span class="solo-lectura">abierto ahora</span>' : ''}</h2><p class="ruta"><code>${esc(c.ruta)}</code></p><p class="detalle">${!c.existe ? 'La carpeta ya no está' : c.git ? textoGit(c.git) : 'No es un repositorio: desde aquí no se puede guardar'}</p><button type="button" class="secundario pequeno" data-olvidar="${esc(c.ruta)}">Quitar de la lista</button></section>`).join('')
    : '<section class="grupo"><p>Todavía no has abierto ningún cuaderno.</p></section>';
  if (enApp()) {
    // En la app de escritorio (crítica 2026-10-10, 4): los recientes primero, que es lo que se abre casi siempre, y debajo «Otro
    // cuaderno»: el diálogo del sistema («Elegir carpeta…») o la ruta escrita; un solo formulario y Enter es Abrir.
    $('#panel').innerHTML = `<h1>Cuadernos</h1><p class="resumen">Cada cuaderno es una carpeta de notas con su propio repositorio. Abre uno reciente o, abajo, otro cuaderno.</p>${recientes}
      <section class="grupo otro-cuaderno"><form class="nueva-tarea" id="abrir-carpeta"><span class="frase">Otro cuaderno:</span><button type="button" id="elegir-carpeta">Elegir carpeta…</button><span class="frase">o escribe la ruta</span><label class="oculto" for="ruta-carpeta">Ruta de la carpeta</label><input id="ruta-carpeta" placeholder="~/cursos/finanzas" autocomplete="off"><button type="submit">Abrir</button></form></section>`;
    return;
  }
  $('#panel').innerHTML = `<h1>Cuadernos</h1><p class="resumen">Cada cuaderno es una carpeta de notas con su propio repositorio. Abre uno reciente o escribe la ruta de otra carpeta.</p>
    <form class="nueva-tarea" id="abrir-carpeta"><label class="oculto" for="ruta-carpeta">Ruta de la carpeta</label><input id="ruta-carpeta" placeholder="Ruta de la carpeta del cuaderno, por ejemplo ~/cursos/finanzas" autocomplete="off"><button type="submit">Abrir</button></form>${recientes}`;
}
async function abrirCarpeta(ruta) {
  try { info = await api('/api/abrir', { ruta }); } catch (e) { avisarError('No se ha podido abrir esa carpeta.', e.message); return; }
  cerrarSesiones();   // las terminales eran del cuaderno anterior (el servidor ya ha matado sus ptys)
  await cargarCuaderno();
  location.hash = cuaderno().portada ? `#/n/${encodeURI(cuaderno().portada)}` : '#/';
  if (location.hash === '#/') enrutar();
}
// Solo en la app de escritorio: el diálogo del sistema (window.cuadernoApp, del preload de Electron) da la ruta, que se
// enseña en la casilla y sigue el camino de siempre (/api/abrir). Cancelar no hace nada.
async function elegirCarpeta() {
  let ruta = null;
  try { ruta = await window.cuadernoApp.elegirCarpeta(); } catch (e) { avisarError('No se ha podido abrir el diálogo de carpetas.', e.message); return; }
  if (!ruta) return;
  const campo = $('#ruta-carpeta'); if (campo) campo.value = ruta;
  await abrirCarpeta(ruta);
}
$('#panel').addEventListener('click', async e => {
  const a = e.target.closest('a[data-abrir]'); if (a) { e.preventDefault(); return abrirCarpeta(a.dataset.abrir); }
  if (e.target.closest('#elegir-carpeta')) return elegirCarpeta();
  const b = e.target.closest('button[data-olvidar]'); if (b) { await api('/api/olvidar', { ruta: b.dataset.olvidar }); abrirCuadernos(); }
});
$('#panel').addEventListener('submit', e => { if (e.target.id !== 'abrir-carpeta') return; e.preventDefault(); const v = e.target.querySelector('input').value.trim(); if (v) abrirCarpeta(v); });

// ---------- guardar / traer / deshacer
function abrirModal(id, primero) { foco = document.activeElement; $(id).hidden = false; sincronizarInerte(); if (primero) $(primero).focus(); }
function cerrarModal(id) { $(id).hidden = true; sincronizarInerte(); if (foco) foco.focus(); }
function mostrarResultado(titulo, r, { confirmar = null } = {}) {
  // Si falla: primero qué pasó en una frase, y la salida de la herramienta plegada en «Ver detalle» (hallazgo 12).
  $('#resultado-titulo').textContent = titulo; $('#resultado-texto').textContent = r.salida || (r.codigo ? 'Ha fallado sin decir por qué.' : 'Hecho.');
  const humano = r.codigo ? fraseDeFallo(titulo, r.salida) : '';
  $('#resultado-humano').textContent = humano; $('#resultado-humano').hidden = !humano;
  $('#resultado-detalle').open = !humano; $('#resultado-detalle').classList.toggle('sin-plegar', !humano);
  $('#resultado-profesor').hidden = !(r.codigo && cuaderno().profesor);
  $('#resultado-confirmar').hidden = !confirmar; alConfirmar = confirmar;
  abrirModal('#resultado', confirmar ? '#resultado-confirmar' : '#resultado-cerrar');
}
let alConfirmar = null;
const FALLOS = { 'Guardar': 'No se pudo guardar', 'Traer': 'No se pudo traer lo que cambió en otro sitio', 'Deshacer': 'No se pudo deshacer', 'Deshacer el último guardado': 'No se pudo deshacer' };
function fraseDeFallo(titulo, salida) {
  const base = FALLOS[titulo] || `No se pudo completar «${titulo}»`;
  if (/MODULE_NOT_FOUND|Cannot find module/.test(salida || '')) return `${base}: falta una herramienta del kit de este cuaderno.`;
  return `${base}. El detalle técnico está abajo, por si hay que enseñárselo al profesor.`;
}
$('#resultado-cerrar').onclick = () => cerrarModal('#resultado');
$('#resultado-profesor').onclick = () => { cerrarModal('#resultado'); abrirTerminal('profesor'); };
$('#resultado-confirmar').onclick = async () => { const fn = alConfirmar; cerrarModal('#resultado'); if (fn) await fn(); };
async function refrescarInfo() { info = await api('/api/info'); pintarEstado(); }
async function accion(ruta, body, titulo, opciones) {
  let r;
  try { r = await api(ruta, body || {}); } catch (e) { r = { codigo: 1, salida: e.message }; }
  await refrescarInfo();
  if (rutaActual) abrirNota(rutaActual); else if (enTareas()) abrirTareas();
  mostrarResultado(titulo, r, opciones);
  return r;
}
$('#btn-guardar').onclick = async () => {
  const p = await api('/api/guardar/propuesta');
  if (p.kit !== 'kit' && !p.repo) return mostrarResultado('Guardar', { codigo: 1, salida: 'Esta carpeta no es un repositorio: no hay dónde guardar.' });
  $('#guardar-cambios').textContent = p.cambios.length ? `${p.cambios.length} fichero${p.cambios.length === 1 ? '' : 's'} con cambios` : 'sin cambios desde el último guardado';
  $('#guardar-mensaje').value = p.mensaje || 'Sesión de estudio';
  abrirModal('#guardar', '#guardar-mensaje'); $('#guardar-mensaje').select();
};
$('#guardar-cancelar').onclick = () => cerrarModal('#guardar');
$('#guardar-ok').onclick = async () => { const mensaje = $('#guardar-mensaje').value.trim(); if (!mensaje) return; cerrarModal('#guardar'); avisar('Guardando…'); await accion('/api/guardar', { mensaje }, 'Guardar'); };
$('#guardar-mensaje').addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') $('#guardar-ok').click(); });
$('#btn-traer').onclick = async () => { avisar('Trayendo…'); await accion('/api/traer', {}, 'Traer'); };
$('#btn-deshacer').onclick = async () => {
  let r; try { r = await api('/api/deshacer', { ver: true }); } catch (e) { r = { codigo: 1, salida: e.message }; }
  mostrarResultado('Deshacer el último guardado', r, { confirmar: r.codigo ? null : () => accion('/api/deshacer', { ver: false }, 'Deshacer') });
};
document.addEventListener('keydown', e => { if (e.key === 'Escape') { for (const id of ['#guardar', '#resultado']) if (!$(id).hidden) cerrarModal(id); } });

// ---------- apariencia y ajustes del usuario (iguales para todos los cuadernos)
function aplicarApariencia(c) { const r = document.documentElement; r.dataset.tema = c.tema; r.dataset.letra = c.letra; r.dataset.fuente = c.fuente; }
function abrirAjustes() {
  const c = info.configuracion;
  $('#ajustes-tema').value = c.tema; $('#ajustes-letra').value = c.letra; $('#ajustes-fuente').value = c.fuente; $('#ajustes-editor').value = c.editor; $('#ajustes-panel').value = posicionCajon(); $('#ajustes-comando').value = c.comando_agente || '';
  foco = document.activeElement; $('#ajustes').hidden = false; sincronizarInerte(); $('#ajustes-tema').focus(); pintarOcultas();
}
function cerrarAjustes() { $('#ajustes').hidden = true; sincronizarInerte(); if (foco) foco.focus(); }
$('#btn-ajustes').onclick = abrirAjustes;
// Barra lateral plegable en escritorio (Roberto, 2026-10-09): un botón en la barra, otro en la miga para volver a abrirla, Ctrl+\ o Cmd+\
// y el estado recordado en este navegador. A ≤ 760 px sigue su menú de siempre (menuLateral); allí el plegado de escritorio no cuenta.
const CLAVE_LATERAL = 'cuaderno-lateral-plegado';
const lateralPlegado = () => $('#app').classList.contains('lateral-plegado');
const anchoLateral = () => (lateralPlegado() && window.innerWidth > 760 ? 0 : LATERAL);
function plegarLateral(plegar, { enfocar = true, recordar = true } = {}) {
  $('#app').classList.toggle('lateral-plegado', plegar);
  $('#btn-plegar').setAttribute('aria-expanded', String(!plegar)); $('#btn-desplegar').setAttribute('aria-expanded', String(!plegar));
  if (recordar) { try { if (plegar) localStorage.setItem(CLAVE_LATERAL, '1'); else localStorage.removeItem(CLAVE_LATERAL); } catch { /* sin almacenamiento: no se recuerda */ } }
  aplicarCajon();   // el cajón se acota con el ancho que queda y el índice de la nota recalcula
  if (enfocar && window.innerWidth > 760) $(plegar ? '#btn-desplegar' : '#btn-plegar').focus();
}
$('#btn-plegar').onclick = () => plegarLateral(true);
$('#btn-desplegar').onclick = () => plegarLateral(false);
document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key !== '\\' || window.innerWidth <= 760) return;
  if (e.target.closest && e.target.closest('#cajon')) return;   // en la terminal, Ctrl \ es SIGQUIT: no se toca
  e.preventDefault(); plegarLateral(!lateralPlegado());
});
try { if (localStorage.getItem(CLAVE_LATERAL) === '1') { $('#app').classList.add('lateral-plegado'); $('#btn-plegar').setAttribute('aria-expanded', 'false'); } } catch { /* sin almacenamiento */ }   // el cajón y el índice se acotan solos al arrancar (aplicarCajon)
function menuLateral(abrir) { const l = $('#lateral'); l.classList.toggle('abierto', abrir); $('#btn-menu').setAttribute('aria-expanded', String(abrir)); if (!abrir && window.innerWidth <= 760) $('#btn-menu').focus(); }
$('#btn-menu').onclick = () => menuLateral(!$('#lateral').classList.contains('abierto'));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#lateral').classList.contains('abierto')) menuLateral(false); });
$('#lateral').addEventListener('click', e => { if (e.target.closest('a') && window.innerWidth <= 760) menuLateral(false); });
$('#ajustes-cerrar').onclick = cerrarAjustes;
$('#ajustes form').addEventListener('change', async () => {
  info.configuracion = await api('/api/configuracion', { tema: $('#ajustes-tema').value, letra: $('#ajustes-letra').value, fuente: $('#ajustes-fuente').value, editor: $('#ajustes-editor').value, panel: $('#ajustes-panel').value, comando_agente: $('#ajustes-comando').value });
  aplicarApariencia(info.configuracion); aplicarCajon();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#ajustes').hidden) cerrarAjustes(); });

// ---------- acciones del menú de la app de escritorio (electron/menu.js → preload → aquí; en la web no hay menú y nada cambia)
// Cada acción hace lo que ya hace su botón o su tecla: Guardar es el botón Guardar (del repositorio, /api/guardar), Ajustes
// el de Ajustes, Abrir carpeta… el diálogo del sistema (elegirCarpeta), Abrir nota… y Buscar… lo de Ctrl K (el buscador) y Nueva tarea el
// camino de siempre: la casilla «Nueva tarea» si está la pantalla de Tareas, y si no el buscador con «+» delante (Enter la
// añade). Con un diálogo abierto la acción se ignora: ⌘S sobre el propio modal de Guardar no apila otro. Un atajo nuevo
// (plan de Electron, §8.1) es una fila en ATAJOS de menu.js y una aquí.
const ACCIONES_APP = {
  guardar: () => { const b = $('#btn-guardar'); if (!cuaderno()) return avisar('No hay ningún cuaderno abierto: nada que guardar.'); if (b.disabled) return avisar(b.title); b.click(); },
  ajustes: abrirAjustes,
  'abrir-carpeta': elegirCarpeta,
  // Abrir nota… y Buscar… hoy son lo mismo (el buscador busca por nombre de nota y de carpeta y por el texto; Enter abre);
  // son dos acciones porque divergirán (menu.js lo explica).
  buscar: () => { if (cuaderno()) enfocarBuscador(); },
  'abrir-nota': () => { if (cuaderno()) enfocarBuscador(); },
  'nueva-tarea': () => {
    if (!cuaderno()) return;
    const campo = $('#tarea-nueva');
    if (campo && !$('#panel').hidden) return campo.focus();
    const b = enfocarBuscador();
    if (comandoTarea(b.value) == null) { b.value = '+ '; b.dispatchEvent(new Event('input', { bubbles: true })); }
    b.setSelectionRange(b.value.length, b.value.length);
  },
  // Los de la crítica del 2026-10-10 (8): Nueva nota es el botón de la barra lateral; Barra lateral y Terminal, lo que ya
  // hacen Ctrl \ y Ctrl ` en la página (en Mac el menú se queda esas teclas antes que la página; con el foco en la
  // terminal, Ctrl \ no pliega nada, como en la web).
  'nueva-nota': () => { if (cuaderno()) $('#btn-nueva-nota').click(); },
  'barra-lateral': () => { if (window.innerWidth <= 760 || (document.activeElement && document.activeElement.closest('#cajon'))) return; plegarLateral(!lateralPlegado()); },
  terminal: () => { if (cuaderno()) alternarTerminal(); },
};
if (enApp()) window.cuadernoApp.alAccion(nombre => { if (dialogoAbierto()) return; const fn = ACCIONES_APP[nombre]; if (fn) fn(); });

function pintarEstado() {
  $('#aviso-reinicio').hidden = !info.desactualizada || avisoCerrado;
  const c = cuaderno();
  $('#lateral').classList.toggle('sin-cuaderno', !c);
  $('#nombre-curso').textContent = c ? c.nombre : 'Cuaderno';
  pintarTitulo();
  $('#estado-git').textContent = c ? textoGit(c.git) : '';
  $('#lateral').classList.toggle('sin-repo', !!c && !c.git && c.kit !== 'kit');
  $('#btn-guardar').disabled = $('#btn-traer').disabled = $('#btn-deshacer').disabled = !!c && c.kit === 'salida-sin-motor';
  $('#btn-guardar').title = c && c.kit === 'salida-sin-motor' ? 'Este cuaderno es una salida del kit sin motor: no se puede guardar desde aquí' : conAtajo('Guardar en el repositorio del cuaderno', 'S');
  $('#link-inicio').href = c && c.portada ? `#/n/${encodeURI(c.portada)}` : '#/';
}
async function cargarCuaderno() {
  pintarEstado();
  if (!cuaderno()) { arbol = []; $('#arbol').innerHTML = ''; return; }
  [arbol, titulos] = await Promise.all([api('/api/arbol'), api('/api/titulos')]); pintarArbol(arbol); refrescarContadores();
}

// ---------- rutas
function enrutar() {
  const h = location.hash;
  soltarEdicion(); $('#btn-editar').hidden = true;   // abrirNota lo vuelve a enseñar si la pantalla es una nota
  if (!cuaderno() || h === '#/cuadernos') { abrirCuadernos(); marcarActiva(); return; }
  if (enTareas()) abrirTareas(); else if (h === '#/comentarios') abrirComentarios();
  else if (h.startsWith('#/n/')) { const [ruta, q] = h.slice(4).split('?'); const l = q && new URLSearchParams(q).get('l'); abrirNota(decodeURI(ruta), l != null ? +l : null); }
  else if (cuaderno().portada) location.hash = `#/n/${encodeURI(cuaderno().portada)}`;
  else { rutaActual = null; $('#panel').hidden = true; $('#nota').hidden = false; sinPortada(); }
  marcarActiva();
}
// Con cambios sin aplicar, salir de la nota (otra nota, otra pantalla, atrás) pregunta: se vuelve a la dirección de la nota y,
// si se descarta, se va a la que se pedía.
window.addEventListener('hashchange', () => {
  if (edicion && location.hash !== edicion.hash && hayCambios()) {
    const destino = location.hash;
    history.replaceState(null, '', edicion.hash);
    abrirDescartar(() => { soltarEdicion(); location.hash = destino; });
    return;
  }
  enrutar();
});

// ---------- recarga en vivo
try { const c = new WebSocket(wsUrl('/cambios')); c.onmessage = async () => { if (!cuaderno()) return; const antes = cuaderno().ruta; info = await api('/api/info'); if (!cuaderno() || cuaderno().ruta !== antes) { avisar(cuaderno() ? `Este servidor ha abierto otro cuaderno: ${cuaderno().nombre}. Esta pestaña pasa a él.` : 'El cuaderno se ha cerrado en otra pestaña'); cerrarSesiones(); await cargarCuaderno(); location.hash = cuaderno() && cuaderno().portada ? `#/n/${encodeURI(cuaderno().portada)}` : '#/'; enrutar(); return; } pintarEstado(); [arbol, titulos] = await Promise.all([api('/api/arbol'), api('/api/titulos')]); if (!$('#buscador').value.trim()) pintarArbol(arbol); if (escribiendo) { /* lo está escribiendo la propia app: aplicarEdicion repinta al acabar */ } else if (rutaActual && !Comentar.ocupado() && !edicion && !(tarjetasEstado && tarjetasEstado.ruta === rutaActual)) abrirNota(rutaActual, null, { desdeCambios: true }); else if (edicion) comprobarDisco(); else if (enTareas()) abrirTareas(); refrescarContadores(); }; } catch { /* sin recarga */ }

(async () => {
  info = await api('/api/info');
  aplicarApariencia(info.configuracion); aplicarCajon();
  await cargarCuaderno();
  enrutar();
})();
