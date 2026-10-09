/* global katex, Terminal, FitAddon */
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let arbol = [], rutaActual = null, info = { cuaderno: null, configuracion: {} };
const cuaderno = () => info.cuaderno;

// El aviso de «la app se ha actualizado» se cierra y no vuelve en esta pestaña (Roberto, 2026-10-09).
let avisoCerrado = false;
$('#aviso-cerrar').addEventListener('click', () => { avisoCerrado = true; $('#aviso-reinicio').hidden = true; });

// Toda llamada a la API: GET sin cuerpo, POST con JSON. Un 409 significa que la nota cambió debajo: se recarga.
async function api(p, body) {
  const r = await fetch(p, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const d = await r.json().catch(() => ({ error: `respuesta ${r.status}` }));
  if (!r.ok) {
    if (r.status === 404 && p.startsWith('/api/') && !avisoCerrado) $('#aviso-reinicio').hidden = false;   // una ruta que el servidor no conoce: es de antes
    if (r.status === 403) avisar('Esta pestaña ha perdido el permiso: arranca la app desde la terminal y entra por la pestaña que abre.');
    if (r.status === 409 && rutaActual) { avisar('Esta nota cambió en el disco mientras la tenías abierta. La he vuelto a cargar: repite el cambio.'); abrirNota(rutaActual); }
    throw Object.assign(new Error(d.error || `error ${r.status}`), { status: r.status });
  }
  return d;
}
const textoFichero = ruta => fetch(`/fichero/${encodeURI(ruta)}`).then(r => r.text());
const lineasDe = texto => texto.split(/\r?\n/);
function avisar(msg) { const d = document.createElement('div'); d.className = 'aviso-flotante'; d.setAttribute('role', 'status'); d.textContent = msg; document.body.append(d); setTimeout(() => d.remove(), 2200); }
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
  let r; try { r = await api('/api/nota/nueva', { titulo, carpeta }); } catch (e) { avisar(e.message); return false; }
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
  try { await api('/api/tarea', { texto: nota ? `${texto} [[${nota}]]` : texto }); } catch (e) { if (e.status !== 409) avisar(e.message); return; }
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
  const a = e.target.closest('a.resultado'); if (!a || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
  e.preventDefault();
  const todos = [...$('#arbol').querySelectorAll('a.resultado')], i = todos.indexOf(a);
  if (e.key === 'ArrowDown' && todos[i + 1]) todos[i + 1].focus();
  else if (e.key === 'ArrowUp') (todos[i - 1] || $('#buscador')).focus();
});
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#buscador').focus(); $('#buscador').select(); }
  if ((e.ctrlKey || e.metaKey) && e.key === '`') { e.preventDefault(); alternarTerminal(); }
  if (e.key === 'Escape' && !$('#editor').hidden) cerrarEditor();
});

// ---------- mostrar en el gestor de archivos del sistema (Finder, Explorador…)
const GESTOR = /Mac/i.test(navigator.platform) ? 'el Finder' : /Win/i.test(navigator.platform) ? 'el Explorador' : 'la carpeta';
const botonMostrar = (ruta, nombre) => `<button type="button" class="mostrar" data-mostrar="${esc(ruta)}" title="Mostrar en ${GESTOR}" aria-label="Mostrar ${esc(String(nombre).replace(/<[^>]*>/g, ''))} en ${GESTOR}">${icono('carpeta')}</button>`;
const botonOcultar = (ruta, nombre) => `<button type="button" class="ocultar" data-ocultar="${esc(ruta)}" title="Ocultar aquí (solo en la app; se recupera en Ajustes)" aria-label="Ocultar ${esc(String(nombre).replace(/<[^>]*>/g, ''))}">${icono('ojo-tachado')}</button>`;
// En un fichero, además, la papelera, la última y algo separada (crítica 2026-10-08: sin confirmar, el hueco es lo que la protege).
const botonesFila = (ruta, nombre, esFichero = false) => `<span class="acciones-fila">${botonOcultar(ruta, nombre)}${botonMostrar(ruta, nombre)}${esFichero ? botonPapelera(ruta, nombre) : ''}</span>`;
// Ocultar (o volver a mostrar) una carpeta o un fichero del árbol y del buscador; solo en la app, por cuaderno.
async function ocultar(ruta, si) {
  try { await api('/api/ocultar', { ruta, ocultar: si }); } catch (e) { return avisar(e.message); }
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
async function mostrarEnCarpeta(ruta) { try { await api('/api/mostrar-en-carpeta', { ruta }); } catch (e) { avisar(e.message); } }
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
  let texto; try { texto = rutaCompleta(ruta); } catch (e) { return avisar(e.message); }
  try { await navigator.clipboard.writeText(texto); } catch {
    const t = document.createElement('textarea'); t.value = texto; document.body.append(t); t.select(); document.execCommand('copy'); t.remove();
  }
  avisar('Ruta copiada');
}
document.addEventListener('click', e => { const b = e.target.closest('button[data-copiar]'); if (!b) return; e.preventDefault(); copiarRuta(b.dataset.copiar); });
const botonPapelera = (ruta, nombre) => `<button type="button" class="papelera" data-papelera="${esc(ruta)}" title="Mandar a ${PAPELERA}" aria-label="Mandar ${esc(String(nombre).replace(/<[^>]*>/g, ''))} a ${PAPELERA}">${icono('papelera')}</button>`;
async function mandarAPapelera(ruta) {
  try { await api('/api/papelera', { ruta }); } catch (e) { avisar(e.message); return; }
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
  ancho(tipo === 'pdf');
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
// PDF y páginas HTML a todo el ancho: la miga se alinea con ellos, no con la columna de lectura.
function ancho(si) { $('#nota').classList.toggle('ancha', si); $('.miga-barra').classList.toggle('ancha', si); }

// ---------- nota
function sinPortada() {
  $('#miga').innerHTML = '<strong>Cuaderno</strong>';
  $('#nota').innerHTML = `<h1>${esc(cuaderno().nombre)}</h1><p class="resumen">Esta carpeta no tiene una nota de portada. Elige una nota en el árbol de la izquierda o busca con <kbd>Ctrl K</kbd>.</p>`;
}
async function abrirNota(ruta, lineaDestino) {
  // La misma nota otra vez (recarga en vivo, un comentario recién escrito) conserva el scroll; una nota nueva empieza arriba.
  const recarga = rutaActual === ruta && !$('#nota').hidden && lineaDestino == null, scrollAntes = $('#centro').scrollTop;
  if (rutaActual !== ruta) { vistaNota = null; ultimoMostrado = null; }
  rutaActual = ruta;
  $('#panel').hidden = true; $('#nota').hidden = false;
  let n;
  try { n = await api(`/api/nota?p=${encodeURIComponent(ruta)}`); } catch (e) { $('#nota').innerHTML = `<h1>No se puede abrir</h1><p><code>${esc(ruta)}</code>: ${esc(e.message)}</p>`; return; }
  $('#miga').innerHTML = ruta.split('/').map((s, i, a) => i < a.length - 1 ? `<span>${esc(s)}</span> › ` : `<strong>${esc(n.esHtml ? tituloDe(ruta) : s)}</strong>`).join('') + botonMostrar(ruta, ruta.split('/').pop()) + botonCopiar(ruta) + (n.generado ? '' : botonPapelera(ruta, ruta.split('/').pop()));   // una nota que regenera el profesor no se manda a la papelera desde aquí
  ancho(!!n.esHtml);
  if (n.esFichero) return abrirFichero(ruta, n.tipo);
  const tipo = n.frontmatter && n.frontmatter.tipo;
  if (vistaNota !== ruta && tipo === 'examen') return abrirExamen(ruta);
  if (vistaNota !== ruta && tipo === 'flashcards') return abrirTarjetas(ruta);
  if (n.esHtml) { $('#nota').innerHTML = `<iframe class="ejercicio" sandbox="allow-scripts allow-forms allow-modals" src="/fichero/${encodeURI(ruta)}" title="${esc(nombreNota(ruta))}"></iframe>`; return; }
  // Las propiedades van debajo del título, no encima: el título es lo primero que se lee.
  const props = n.frontmatter ? `<dl class="propiedades">${Object.entries(n.frontmatter).filter(([, v]) => v !== '' && v != null && !(Array.isArray(v) && !v.length)).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${Array.isArray(v) ? v.map(x => `<span class="etiqueta">${esc(x)}</span>`).join('') : esc(v)}</dd>`).join('')}</dl>` : '';
  const back = n.backlinks.length ? `<nav class="backlinks" aria-label="Notas que enlazan aquí">Enlazan aquí: ${n.backlinks.map(b => `<a class="wiki" href="#/n/${encodeURI(b)}" title="${esc(b)}">${esc(tituloDe(b))}</a>`).join('')}</nav>` : '';
  $('#nota').innerHTML = n.html + back;
  const h1 = $('#nota .bloque > h1');
  if (props) (h1 ? h1.closest('.bloque') : $('#nota')).insertAdjacentHTML(h1 ? 'afterend' : 'afterbegin', props);
  $('#nota').querySelectorAll('.math').forEach(el => { try { katex.render(el.textContent, el, { displayMode: el.dataset.display === '1', throwOnError: false }); } catch { /* se queda el texto */ } });
  // acciones por bloque: editar y comentar, dos iconos en el margen izquierdo; el bloque no cambia de color (Roberto,
  // 2026-10-08: el fondo al pasar el ratón distraía). Con teclado: Tab hasta el bloque y aparecen.
  $('#nota').querySelectorAll('.bloque').forEach(b => {
    b.tabIndex = 0;
    const acc = document.createElement('div'); acc.className = 'acciones';
    acc.innerHTML = `<button type="button" data-accion="editar" aria-label="Editar este bloque" title="Editar">${icono('lapiz')}</button><button type="button" data-accion="comentar" aria-label="Comentar este bloque" title="Comentar">${icono('comentar')}</button>`;
    b.prepend(acc);
  });
  $('#centro').scrollTop = recarga ? scrollAntes : 0;
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
    } catch (e) { if (e.status !== 409) avisar(e.message); return; }
    t.sabia = sabia;
    if (s.indice < s.tarjetas.length - 1) { s.indice++; s.destapada = false; } 
    pintarTarjeta();
    if (s.indice === s.tarjetas.length - 1 && t === s.tarjetas[s.indice]) avisar('Última tarjeta. Guarda cuando acabes.');
  }
}
$('#nota').addEventListener('click', e => { const b = e.target.closest('button[data-tarjeta]'); if (b) accionTarjeta(b.dataset.tarjeta); });
document.addEventListener('keydown', e => {
  if (!tarjetasEstado || rutaActual !== tarjetasEstado.ruta || !$('#editor').hidden || !$('#resultado').hidden) return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
  const m = { ' ': 'destapar', '1': 'sabia', '2': 'no-sabia', 'ArrowLeft': 'anterior', 'ArrowRight': 'siguiente' }[e.key];
  if (m) { e.preventDefault(); accionTarjeta(m); }
});

// ---------- editor modal
let alGuardar = null, foco = null;
function abrirEditor(titulo, texto, lineas, cb) { foco = document.activeElement; $('#editor-titulo').textContent = titulo; $('#editor-lineas').textContent = lineas; $('#editor-texto').value = texto; alGuardar = cb; $('#editor').hidden = false; $('#editor-texto').focus(); }
function cerrarEditor() { $('#editor').hidden = true; alGuardar = null; if (foco) foco.focus(); }
$('#editor-cancelar').onclick = cerrarEditor;
$('#editor-guardar').onclick = async () => { const cb = alGuardar; const v = $('#editor-texto').value; cerrarEditor(); if (cb) { try { await cb(v); } catch (e) { if (e.status !== 409) avisar(e.message); } } };
$('#editor-texto').addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') $('#editor-guardar').click(); });

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
  $('#miga').innerHTML = '<strong>Tareas</strong>';
  const g = await api('/api/tareas');
  if (!enTareas()) return;   // mientras llegaba la respuesta se cambió de pantalla
  // Si el panel ya estaba pintado (recarga en vivo, tarea nueva), el foco y lo escrito en «Nueva tarea» se conservan.
  const activo = document.activeElement && $('#panel').contains(document.activeElement) ? document.activeElement.id : null;
  const borrador = $('#tarea-nueva') ? $('#tarea-nueva').value : '';
  const total = g.reduce((a, x) => a + x.items.length, 0), hechas = g.reduce((a, x) => a + x.items.filter(i => i.hecha).length, 0);
  const nota = cuaderno().kit !== 'carpeta' ? 'Lo que marcas aquí se escribe en su nota. Los exámenes y las flashcards se contestan en la suya.' : 'Tu lista propia, en <a href="#/n/tareas.md">tareas.md</a>.';
  const f = filtrosTareas();
  const notas = [...new Set(g.flatMap(x => x.items.flatMap(i => i.enlaces || [])))].sort((a, b) => a.localeCompare(b, 'es'));
  const etiquetas = [...new Set(g.flatMap(x => x.items.flatMap(i => i.etiquetas || [])))].sort((a, b) => a.localeCompare(b, 'es'));
  const opcion = (v, texto, actual) => `<option value="${esc(v)}"${v === actual ? ' selected' : ''}>${esc(texto)}</option>`;
  const filtros = `<form class="filtros" id="filtros-tareas" aria-label="Filtrar las tareas">`
    + (notas.length ? `<label for="filtro-nota">Nota</label><select id="filtro-nota" name="nota">${opcion('', 'Todas', f.nota)}${notas.map(n => opcion(n, rutaDeNombre(n) ? tituloDe(rutaDeNombre(n)) : n, f.nota)).join('')}</select>` : '')
    + (etiquetas.length ? `<label for="filtro-etiqueta">Etiqueta</label><select id="filtro-etiqueta" name="etiqueta">${opcion('', 'Todas', f.etiqueta)}${etiquetas.map(e => opcion(e, `#${e}`, f.etiqueta)).join('')}</select>` : '')
    + `<label for="filtro-estado">Estado</label><select id="filtro-estado" name="estado">${opcion('todas', 'Todas', f.estado)}${opcion('pendientes', 'Pendientes', f.estado)}${opcion('hechas', 'Hechas', f.estado)}</select>`
    + `<span class="pista" id="filtro-resumen" role="status"></span><button type="button" class="secundario pequeno" id="filtro-quitar" hidden>Quitar filtros</button></form>`;
  $('#panel').innerHTML = `<h1>Tareas</h1><p class="resumen">${hechas} de ${total} hechas. ${nota}</p><form class="nueva-tarea" id="nueva-tarea"><label class="oculto" for="tarea-nueva">Nueva tarea</label><input id="tarea-nueva" placeholder="Nueva tarea para mí…" autocomplete="off"><button type="submit">Añadir</button></form>${filtros}`
    + g.map(gr => `<section class="grupo"><h2><a class="wiki" href="#/n/${encodeURI(gr.ruta)}" title="${esc(gr.ruta)}">${esc(tituloDe(gr.ruta))}</a>${gr.generado ? '<span class="solo-lectura">la escribe el profesor al guardar</span>' : ''}</h2>`
      + gr.items.map(i => `<label class="item${i.hecha ? ' hecha' : ''}" data-hecha="${i.hecha ? 1 : 0}" data-enlaces="${esc(JSON.stringify(i.enlaces || []))}" data-etiquetas="${esc(JSON.stringify(i.etiquetas || []))}"><input type="checkbox" data-ruta="${esc(gr.ruta)}" data-linea="${i.linea}"${i.hecha ? ' checked' : ''}${gr.generado ? ' disabled' : ''}><span>${i.html || esc(i.texto)}</span></label>`).join('') + '</section>').join('');
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
  document.querySelectorAll('#panel .item').forEach(it => {
    total++;
    const cumple = (!f.nota || JSON.parse(it.dataset.enlaces).includes(f.nota)) && (!f.etiqueta || JSON.parse(it.dataset.etiquetas).includes(f.etiqueta))
      && (f.estado === 'todas' || (f.estado === 'hechas') === (it.dataset.hecha === '1'));
    it.hidden = !cumple; if (cumple) visibles++;
  });
  document.querySelectorAll('#panel .grupo').forEach(gr => { gr.hidden = ![...gr.querySelectorAll('.item')].some(it => !it.hidden); });
  const r = $('#filtro-resumen'); if (r) r.textContent = activos ? (visibles ? `${visibles} de ${total} tareas` : 'Ninguna tarea cumple los filtros') : '';
  const q = $('#filtro-quitar'); if (q) q.hidden = !activos;
}
$('#panel').addEventListener('change', e => {
  const form = e.target.closest('#filtros-tareas'); if (!form) return;
  const q = new URLSearchParams();
  for (const [k, v] of new FormData(form)) if (v && v !== 'todas') q.set(k, v);
  history.replaceState(null, '', `#/tareas${q.size ? `?${q}` : ''}`);
  aplicarFiltrosTareas(); marcarActiva();
});
$('#panel').addEventListener('click', e => { if (e.target.id === 'filtro-quitar') { recordarFiltros(''); history.replaceState(null, '', '#/tareas'); abrirTareas().then(() => { const s = $('#filtro-estado'); if (s) s.focus(); }); } });
$('#panel').addEventListener('submit', async e => { if (e.target.id !== 'nueva-tarea') return; e.preventDefault(); const i = e.target.querySelector('input'); if (!i.value.trim()) return; await api('/api/tarea', { texto: i.value }); i.value = ''; avisar('Tarea añadida'); abrirTareas(); refrescarContadores(); });
$('#panel').addEventListener('change', async e => { const t = e.target; if (t.type !== 'checkbox') return; const ok = await marcarCasilla(t.dataset.ruta, +t.dataset.linea, t.checked, err => { avisar(err.message); abrirTareas(); }); if (ok) { t.closest('.item').classList.toggle('hecha', t.checked); refrescarContadores(); } });
async function abrirComentarios() {
  $('#nota').hidden = true; $('#panel').hidden = false; rutaActual = null;
  $('#miga').innerHTML = '<strong>Comentarios</strong>';
  const c = await api('/api/comentarios');
  $('#panel').innerHTML = `<h1>Comentarios</h1><p class="resumen">Lo que has anotado en las notas. Tu profesor los ve en la siguiente sesión y los convierte en dudas o aportaciones.</p>`
    + (c.length ? c.map(x => `<section class="grupo"><h2><a class="wiki" href="#/n/${encodeURI(x.ruta)}?l=${x.linea}" title="${esc(x.ruta)}">${esc(tituloDe(x.ruta))}</a> <span class="editor-lineas">${esc(x.titulo)}</span></h2><p>${esc(x.texto)}</p></section>`).join('') : '<section class="grupo"><p>Todavía no hay comentarios. En cualquier nota, pasa por un párrafo (o llega a él con Tab) y pulsa <b>comentar</b>.</p></section>');
}
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
const maximoCajon = pos => (pos === 'derecha' ? window.innerWidth - LATERAL : window.innerHeight) - NOTA_MIN[pos];
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
    if ((e.ctrlKey || e.metaKey) && e.key === '`') return false;   // Ctrl ` es de la app: abre y cierra el cajón
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
const textoGit = g => !g ? 'sin repositorio' : `guardado ${hace(g.ultimo)}${g.cambios ? `, ${g.cambios} sin guardar` : ''}${g.sinSubir ? `, ${g.sinSubir} sin subir` : ''}`;
async function abrirCuadernos() {
  rutaActual = null; $('#nota').hidden = true; $('#panel').hidden = false;
  $('#miga').innerHTML = '<strong>Cuadernos</strong>';
  const lista = await api('/api/cuadernos');
  $('#panel').innerHTML = `<h1>Cuadernos</h1><p class="resumen">Cada cuaderno es una carpeta de notas con su propio repositorio. Abre uno reciente o escribe la ruta de otra carpeta.</p>
    <form class="nueva-tarea" id="abrir-carpeta"><label class="oculto" for="ruta-carpeta">Ruta de la carpeta</label><input id="ruta-carpeta" placeholder="Ruta de la carpeta del cuaderno, por ejemplo ~/cursos/finanzas" autocomplete="off"><button type="submit">Abrir</button></form>`
    + (lista.length ? lista.map(c => `<section class="grupo cuaderno${c.abiertoAhora ? ' abierto' : ''}${c.existe ? '' : ' ausente'}"><h2>${c.existe ? `<a href="#/" data-abrir="${esc(c.ruta)}">${esc(c.nombre)}</a>` : esc(c.nombre)}${c.abiertoAhora ? '<span class="solo-lectura">abierto ahora</span>' : ''}</h2><p class="ruta"><code>${esc(c.ruta)}</code></p><p class="detalle">${!c.existe ? 'La carpeta ya no está' : c.git ? textoGit(c.git) : 'No es un repositorio: desde aquí no se puede guardar'}</p><button type="button" class="secundario pequeno" data-olvidar="${esc(c.ruta)}">Quitar de la lista</button></section>`).join('')
      : '<section class="grupo"><p>Todavía no has abierto ningún cuaderno.</p></section>');
}
async function abrirCarpeta(ruta) {
  try { info = await api('/api/abrir', { ruta }); } catch (e) { avisar(e.message); return; }
  cerrarSesiones();   // las terminales eran del cuaderno anterior (el servidor ya ha matado sus ptys)
  await cargarCuaderno();
  location.hash = cuaderno().portada ? `#/n/${encodeURI(cuaderno().portada)}` : '#/';
  if (location.hash === '#/') enrutar();
}
$('#panel').addEventListener('click', async e => {
  const a = e.target.closest('a[data-abrir]'); if (a) { e.preventDefault(); return abrirCarpeta(a.dataset.abrir); }
  const b = e.target.closest('button[data-olvidar]'); if (b) { await api('/api/olvidar', { ruta: b.dataset.olvidar }); abrirCuadernos(); }
});
$('#panel').addEventListener('submit', e => { if (e.target.id !== 'abrir-carpeta') return; e.preventDefault(); const v = e.target.querySelector('input').value.trim(); if (v) abrirCarpeta(v); });

// ---------- guardar / traer / deshacer
function abrirModal(id, primero) { foco = document.activeElement; $(id).hidden = false; if (primero) $(primero).focus(); }
function cerrarModal(id) { $(id).hidden = true; if (foco) foco.focus(); }
function mostrarResultado(titulo, r, { confirmar = null } = {}) {
  $('#resultado-titulo').textContent = titulo; $('#resultado-texto').textContent = r.salida || (r.codigo ? 'Ha fallado sin decir por qué.' : 'Hecho.');
  $('#resultado-profesor').hidden = !(r.codigo && cuaderno().profesor);
  $('#resultado-confirmar').hidden = !confirmar; alConfirmar = confirmar;
  abrirModal('#resultado', confirmar ? '#resultado-confirmar' : '#resultado-cerrar');
}
let alConfirmar = null;
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
  $('#ajustes-tema').value = c.tema; $('#ajustes-letra').value = c.letra; $('#ajustes-fuente').value = c.fuente; $('#ajustes-panel').value = posicionCajon(); $('#ajustes-comando').value = c.comando_agente || '';
  foco = document.activeElement; $('#ajustes').hidden = false; $('#ajustes-tema').focus(); pintarOcultas();
}
function cerrarAjustes() { $('#ajustes').hidden = true; if (foco) foco.focus(); }
$('#btn-ajustes').onclick = abrirAjustes;
function menuLateral(abrir) { const l = $('#lateral'); l.classList.toggle('abierto', abrir); $('#btn-menu').setAttribute('aria-expanded', String(abrir)); if (!abrir && window.innerWidth <= 760) $('#btn-menu').focus(); }
$('#btn-menu').onclick = () => menuLateral(!$('#lateral').classList.contains('abierto'));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#lateral').classList.contains('abierto')) menuLateral(false); });
$('#lateral').addEventListener('click', e => { if (e.target.closest('a') && window.innerWidth <= 760) menuLateral(false); });
$('#ajustes-cerrar').onclick = cerrarAjustes;
$('#ajustes form').addEventListener('change', async () => {
  info.configuracion = await api('/api/configuracion', { tema: $('#ajustes-tema').value, letra: $('#ajustes-letra').value, fuente: $('#ajustes-fuente').value, panel: $('#ajustes-panel').value, comando_agente: $('#ajustes-comando').value });
  aplicarApariencia(info.configuracion); aplicarCajon();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#ajustes').hidden) cerrarAjustes(); });

function pintarEstado() {
  $('#aviso-reinicio').hidden = !info.desactualizada || avisoCerrado;
  const c = cuaderno();
  $('#lateral').classList.toggle('sin-cuaderno', !c);
  $('#nombre-curso').textContent = c ? c.nombre : 'Cuaderno';
  document.title = c ? `${c.nombre} · Cuaderno` : 'Cuaderno';
  $('#estado-git').textContent = c ? textoGit(c.git) : '';
  $('#lateral').classList.toggle('sin-repo', !!c && !c.git && c.kit !== 'kit');
  $('#btn-guardar').disabled = $('#btn-traer').disabled = $('#btn-deshacer').disabled = !!c && c.kit === 'salida-sin-motor';
  $('#btn-guardar').title = c && c.kit === 'salida-sin-motor' ? 'Este cuaderno es una salida del kit sin motor: no se puede guardar desde aquí' : 'Guardar en el repositorio del cuaderno';
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
  if (!cuaderno() || h === '#/cuadernos') { abrirCuadernos(); marcarActiva(); return; }
  if (enTareas()) abrirTareas(); else if (h === '#/comentarios') abrirComentarios();
  else if (h.startsWith('#/n/')) { const [ruta, q] = h.slice(4).split('?'); const l = q && new URLSearchParams(q).get('l'); abrirNota(decodeURI(ruta), l != null ? +l : null); }
  else if (cuaderno().portada) location.hash = `#/n/${encodeURI(cuaderno().portada)}`;
  else { rutaActual = null; $('#panel').hidden = true; $('#nota').hidden = false; sinPortada(); }
  marcarActiva();
}
window.addEventListener('hashchange', enrutar);

// ---------- recarga en vivo
try { const c = new WebSocket(wsUrl('/cambios')); c.onmessage = async () => { if (!cuaderno()) return; const antes = cuaderno().ruta; info = await api('/api/info'); if (!cuaderno() || cuaderno().ruta !== antes) { avisar(cuaderno() ? `Este servidor ha abierto otro cuaderno: ${cuaderno().nombre}. Esta pestaña pasa a él.` : 'El cuaderno se ha cerrado en otra pestaña'); cerrarSesiones(); await cargarCuaderno(); location.hash = cuaderno() && cuaderno().portada ? `#/n/${encodeURI(cuaderno().portada)}` : '#/'; enrutar(); return; } pintarEstado(); [arbol, titulos] = await Promise.all([api('/api/arbol'), api('/api/titulos')]); if (!$('#buscador').value.trim()) pintarArbol(arbol); if (rutaActual && $('#editor').hidden && !(tarjetasEstado && tarjetasEstado.ruta === rutaActual)) abrirNota(rutaActual); else if (enTareas()) abrirTareas(); refrescarContadores(); }; } catch { /* sin recarga */ }

(async () => {
  info = await api('/api/info');
  aplicarApariencia(info.configuracion); aplicarCajon();
  await cargarCuaderno();
  enrutar();
})();
