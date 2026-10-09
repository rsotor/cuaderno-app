'use strict';
// Comentar un texto seleccionado (plan «edición y comentarios», tarea 8). Script clásico: app.js le da la mano con
// `Comentar.iniciar(anfitrión)` y llama a `Comentar.pintar(#nota)` cada vez que pinta una nota.
//
//  · Seleccionar texto en la lectura → botón flotante «Comentar» → caja → `POST /api/comentario` con la cita.
//  · Un callout `comment` con cita se pinta como subrayado (`button.comentado`) sobre esa cita en el bloque de arriba, y el
//    callout se oculta (sigue en el fichero). Sin cita, o con una cita que ya no está, el callout se ve como siempre.
//  · Pulsar el subrayado abre el hilo (popover); «Cerrar comentario» borra el callout (`/api/comentario/cerrar`) y ofrece Deshacer.
//
// La cita es el texto VISIBLE de la selección, como lo normaliza el servidor (cuaderno.js: normalizarCita). La unicidad la
// decide este fichero sobre el DOM: es el mismo texto donde luego se busca (alias de un wikilink, KaTeX…).
(() => {
  let host = null;              // { api, avisar, avisarError, zonaAvisos, ruta, textoFichero, recargar, contadores, edicionActiva, dialogoAbierto }
  let hilos = [];               // los comentarios de la nota pintada
  let ctx = null;               // lo que la caja va a comentar: { bloque, cita, desde, hasta }
  let hiloAbierto = null, botonSel = null, cajaAbierta = false;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const RE_TITULO = /^(.*?) \((\d{4}-\d{2}-\d{2})\)(?: · «(.*)»)?\s*$/;   // el mismo que cuaderno.js (RE_TITULO_COMENTARIO)
  const lineasDe = t => t.split(/\r?\n/);

  // ---------- el texto visible de un bloque, normalizado como el servidor, con el nodo y el desplazamiento de cada carácter
  const normalizar = s => String(s).replace(/[«»]/g, ' ').replace(/\s+/g, ' ').trim();
  function comoServidor(c) {   // lo que guardará cuaderno.js: 120 caracteres como mucho, cortado en el último espacio y con …
    c = normalizar(c);
    if (c.length > 120) { c = c.slice(0, 120); const sp = c.lastIndexOf(' '); c = (sp > 0 ? c.slice(0, sp) : c).trimEnd() + '…'; }
    return c;
  }
  const sinPuntos = c => c.endsWith('…') ? c.slice(0, -1).trimEnd() : c;
  function textoVisible(raiz) {
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement && n.parentElement.closest('.katex-mathml, script, style') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    let texto = '', blanco = true; const mapa = [];
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      for (let i = 0; i < n.data.length; i++) {
        const c = n.data[i] === '«' || n.data[i] === '»' ? ' ' : n.data[i];
        if (/\s/.test(c)) { if (blanco) continue; texto += ' '; mapa.push([n, i]); blanco = true; }
        else { texto += c; mapa.push([n, i]); blanco = false; }
      }
    }
    if (texto.endsWith(' ')) { texto = texto.slice(0, -1); mapa.pop(); }
    return { texto, mapa };
  }
  const cuantas = (texto, c) => { let n = 0, i = -1; while ((i = texto.indexOf(c, i + 1)) >= 0) n++; return n; };
  // La cita de la selección [a, b) del texto del bloque: si aparece más de una vez se amplía con las palabras siguientes
  // hasta ser única; si no se consigue (se acaba el bloque), '' = comentar el bloque sin cita.
  function decidirCita(texto, a, b) {
    while (a < b && texto[a] === ' ') a++;
    while (b > a && texto[b - 1] === ' ') b--;
    if (a >= b) return '';
    for (let fin = b; ;) {
      const c = comoServidor(texto.slice(a, fin));
      if (!c) return '';
      if (cuantas(texto, sinPuntos(c)) === 1) return c;
      const sig = texto.slice(fin).match(/^\s*\S+/);
      if (!sig) return '';
      fin += sig[0].length;
    }
  }

  // ---------- subrayar la cita en un bloque
  function envolverCita(bloque, cita, id) {
    const { texto, mapa } = textoVisible(bloque), base = sinPuntos(cita);
    const i = base ? texto.indexOf(base) : -1;
    if (i < 0) return [];
    const grupos = [];   // un tramo por nodo de texto: la cita puede cruzar enlaces, negritas…
    for (let k = i; k < i + base.length; k++) {
      const [n, o] = mapa[k], g = grupos[grupos.length - 1];
      if (g && g.n === n) g.b = o + 1; else grupos.push({ n, a: o, b: o + 1 });
    }
    const botones = [];
    for (const g of grupos) {
      let { a, b } = g; const d = g.n.data;
      while (a < b && /\s/.test(d[a])) a++;
      while (b > a && /\s/.test(d[b - 1])) b--;
      if (a >= b) continue;
      const r = document.createRange(); r.setStart(g.n, a); r.setEnd(g.n, b);
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'comentado'; btn.dataset.hilo = String(id); btn.title = 'Ver el comentario';
      if (botones.length) { btn.tabIndex = -1; btn.setAttribute('aria-hidden', 'true'); }   // un solo punto de Tab por comentario
      r.surroundContents(btn); botones.push(btn);
    }
    return botones;
  }

  // ---------- pintar la nota: subrayados y callouts ocultos
  function pintar(raiz) {
    ocultarBoton(); cerrarHilo(false);
    hilos = [];
    const bloques = [...raiz.querySelectorAll('.bloque')];
    const esComentario = b => !!b.querySelector(':scope > .callout-comment');
    bloques.forEach((b, i) => {
      const cal = b.querySelector(':scope > .callout-comment'); if (!cal) return;
      const titulo = (cal.querySelector('.callout-titulo') || {}).textContent || '', m = titulo.match(RE_TITULO);
      const h = { id: hilos.length, linea: +b.dataset.desde, bloque: b, cal, autor: m ? m[1] : titulo, fecha: m ? m[2] : '', cita: m && m[3] ? m[3] : '', botones: [], original: null };
      h.cuerpo = [...cal.children].filter(c => !c.classList.contains('callout-titulo')).map(c => c.outerHTML).join('');
      hilos.push(h);
      if (!h.cita) return;   // sin cita: el callout, como siempre
      let k = i - 1; while (k >= 0 && esComentario(bloques[k])) k--;
      const padre = bloques[k];
      if (padre) {
        h.padre = padre; h.desde = +padre.dataset.desde; h.hasta = +padre.dataset.hasta;
        h.botones = envolverCita(padre, h.cita, h.id);
      }
      if (h.botones.length) { b.hidden = true; b.classList.add('comentario-oculto'); }
      else cal.querySelector('.callout-titulo').insertAdjacentHTML('afterend', '<p class="cita-perdida">La cita ya no está en el texto.</p>');
    });
  }
  const hiloEnLinea = linea => hilos.find(h => h.linea === linea && h.botones.length) || null;

  // Devuelve el foco a `el`. Tras un Esc el navegador pinta el anillo de foco aunque lo de antes fuera el ratón; si venimos del ratón se
  // marca el elemento para que no lo enseñe hasta que se pulse otra tecla (`focusVisible: false` aún no lo respeta Chrome).
  function enfocar(el, conAnillo) {
    if (conAnillo) return el.focus();
    el.dataset.sinAnillo = '1';
    const quitar = () => { delete el.dataset.sinAnillo; document.removeEventListener('keydown', alTeclear, true); el.removeEventListener('blur', quitar); };
    const alTeclear = e => { if (e.key !== 'Escape') quitar(); };
    document.addEventListener('keydown', alTeclear, true); el.addEventListener('blur', quitar);
    el.focus();
  }

  // ---------- colocar un popover junto a un rectángulo de la pantalla, dentro de #centro (se mueve con el scroll)
  function colocar(el, rect, hueco = 6) {
    const centro = $('#centro'), c = centro.getBoundingClientRect();
    if (el.parentElement !== centro) centro.append(el);
    el.style.left = '0px'; el.style.top = '0px';
    const ancho = el.offsetWidth, alto = el.offsetHeight;
    let izq = rect.left - c.left + centro.scrollLeft;
    izq = Math.max(8, Math.min(izq, centro.clientWidth - ancho - 8));
    let arriba = rect.bottom - c.top + centro.scrollTop + hueco;
    if (rect.bottom + alto + 12 > window.innerHeight && rect.top - alto - 12 > 0) arriba = rect.top - c.top + centro.scrollTop - alto - hueco;
    el.style.left = `${izq}px`; el.style.top = `${arriba}px`;
  }
  const rectDe = el => { const r = el.getClientRects(); return r.length ? r[r.length - 1] : el.getBoundingClientRect(); };

  // ---------- la selección → botón flotante
  const enLectura = () => { const n = $('#nota'); return !n.hidden && n.dataset.vista === 'nota' && !(host.edicionActiva && host.edicionActiva()) && !(host.dialogoAbierto && host.dialogoAbierto()); };
  // La selección dentro de UN bloque de texto de la nota: { bloque, cita, desde, hasta } o null.
  function analizar(sel) {
    if (!sel || !sel.rangeCount || sel.isCollapsed) return null;
    const r = sel.getRangeAt(0), de = n => (n.nodeType === 1 ? n : n.parentElement);
    const a = de(r.startContainer), z = de(r.endContainer);
    if (!a || !z) return null;
    const b = a.closest('#nota .bloque');
    if (!b || b !== z.closest('#nota .bloque') || b.querySelector(':scope > .callout-comment') || a.closest('button, input, textarea, select')) return null;
    const { texto, mapa } = textoVisible(b);
    let ini = -1, fin = -1;
    for (let k = 0; k < mapa.length; k++) { if (r.isPointInRange(mapa[k][0], mapa[k][1])) { if (ini < 0) ini = k; fin = k + 1; } }
    if (ini < 0) return null;
    return { bloque: b, cita: decidirCita(texto, ini, fin), desde: +b.dataset.desde, hasta: +b.dataset.hasta, rango: r };
  }
  function ocultarBoton() { if (botonSel) { botonSel.remove(); botonSel = null; } }
  let pendiente = 0;
  function alCambiarSeleccion() {
    cancelAnimationFrame(pendiente);
    pendiente = requestAnimationFrame(() => {
      if (!host || cajaAbierta || !enLectura()) return ocultarBoton();
      const info = analizar(getSelection());
      if (!info) return ocultarBoton();
      if (!botonSel) {
        botonSel = document.createElement('button');
        botonSel.type = 'button'; botonSel.id = 'comentar-boton'; botonSel.textContent = 'Comentar';
        botonSel.addEventListener('mousedown', e => e.preventDefault());   // no pierde la selección
        botonSel.addEventListener('click', () => { const i = analizar(getSelection()); ocultarBoton(); if (i) abrirCaja(i, { teclado: false }); });
        $('#centro').append(botonSel);
      }
      botonSel.dataset.scroll = String($('#centro').scrollTop);
      colocar(botonSel, rectDe(info.rango), 12);   // con aire: que no tape el callout de debajo (crítica 2026-10-09, 4)
      if (document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('comentado')) document.activeElement.blur();   // un solo elemento activo
    });
  }

  // ---------- la caja de comentar (popover, no modal)
  function abrirCaja(info, { teclado = true } = {}) {
    cerrarHilo(false); cerrarCaja(false);
    ctx = info; ctx.teclado = teclado; cajaAbierta = true;
    const f = document.createElement('form');
    f.id = 'comentar-caja'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-label', 'Comentar');
    const edicion = !!info.editar;
    f.setAttribute('aria-label', edicion ? 'Editar comentario' : 'Comentar');
    f.innerHTML = (edicion ? '<p class="caja-titulo">Editar comentario</p>' : '')
      + `${info.cita ? `<p class="caja-cita"><i>«${esc(info.cita)}»</i></p>` : (edicion ? '' : '<p class="caja-cita">Comentario sobre este bloque</p>')}`
      + '<label class="oculto" for="comentar-texto">Tu comentario</label><textarea id="comentar-texto" rows="3" placeholder="Tu comentario…" spellcheck="true"></textarea>'
      + `<div class="caja-pie"><span class="pista">${/Mac/i.test(navigator.platform) ? '⌘' : 'Ctrl'} Enter ${edicion ? 'guarda' : 'comenta'} · Esc cierra</span><button type="button" id="comentar-cancelar" class="secundario">Cancelar</button><button type="submit" id="comentar-enviar" class="primario" disabled>${edicion ? 'Guardar' : 'Comentar'}</button></div>`;
    $('#centro').append(f);
    colocar(f, info.rect || (info.rango ? rectDe(info.rango) : info.bloque.getBoundingClientRect()));
    const ta = f.querySelector('textarea');
    if (edicion) { ta.value = textoDe(info.editar.original); f.querySelector('#comentar-enviar').disabled = !ta.value.trim(); }
    ta.addEventListener('input', () => { f.querySelector('#comentar-enviar').disabled = !ta.value.trim(); });
    ta.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (ta.value.trim()) f.requestSubmit(); } });
    f.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrarCaja(true); } });
    f.querySelector('#comentar-cancelar').onclick = () => cerrarCaja(true);
    f.addEventListener('submit', async e => { e.preventDefault(); await enviar(ta.value); });
    ta.focus();
  }
  function cerrarCaja(devolverFoco) {
    const f = $('#comentar-caja'); if (f) f.remove();
    const c = ctx; cajaAbierta = false; ctx = null;
    // Con el teclado el foco vuelve con su borde; abierta con el ratón vuelve sin él (Roberto, 2026-10-09: «me remarca con borde ese bloque»).
    const vuelve = c && (c.volver || c.bloque);
    if (devolverFoco && vuelve && vuelve.isConnected) enfocar(vuelve, !!c.teclado);
  }
  async function enviar(texto) {
    const c = ctx, ruta = host.ruta();
    if (!c || !texto.trim()) return;
    if (c.editar) return guardarEdicion(c, texto);
    cerrarCaja(false);
    try {
      const original = lineasDe(await host.textoFichero(ruta)).slice(c.desde, c.hasta).join('\n');
      await host.api('/api/comentario', { ruta, desde: c.desde, hasta: c.hasta, texto, original, cita: c.cita });
    } catch (err) { if (err.status !== 409) host.avisarError('No se ha podido añadir el comentario.', err.message); return; }
    host.avisar('Comentario añadido a la nota');
    await host.recargar(); host.contadores();
    // La nota se repinta: el foco vuelve al texto comentado (o al bloque) en vez de perderse en el body (auditoría 2026-10-09, 3).
    if (host.ruta() === ruta) {
      const h = hilos.filter(x => x.cita && x.cita === c.cita && x.desde === c.desde).pop();
      const destino = (h && h.botones[0]) || [...$('#nota').querySelectorAll('.bloque')].find(b => +b.dataset.desde === c.desde);
      if (destino) destino.focus();
    }
  }

  // ---------- editar un comentario (desde el hilo o el panel): se reescribe solo el cuerpo del callout
  // El texto de un comentario tal como está en el fichero: las líneas «> » bajo el título, sin el «> ».
  const textoDe = original => original.split('\n').slice(1).map(l => l.replace(/^>\s?/, '')).join('\n');
  // Vuelve a pedir el comentario (el mismo título) para tener su línea y su texto de ahora.
  async function refrescarEdicion(e) {
    const todos = await host.api('/api/comentarios'), titulo = e.original.split('\n')[0];
    const x = todos.find(y => y.ruta === e.ruta && y.original.split('\n')[0] === titulo);
    if (x) { e.linea = x.linea; e.original = x.original; }
    return !!x;
  }
  async function guardarEdicion(c, texto) {
    const e = c.editar, lineas = e.original.split('\n');
    const cuerpo = texto.trim().replace(/\r\n/g, '\n').split('\n').map(l => `> ${l}`);
    try { await host.api('/api/bloque', { ruta: e.ruta, desde: e.linea, hasta: e.linea + lineas.length, texto: [lineas[0], ...cuerpo].join('\n'), original: e.original }); }
    catch (err) {
      if (err.status !== 409) { host.avisarError('No se ha podido guardar el comentario.', err.message); return; }
      // El comentario cambió en el disco: la caja sigue con lo escrito y el siguiente Guardar usa lo que hay ahora.
      if (!host.ruta()) host.avisarError('El comentario cambió en el disco mientras lo editabas. Lo que has escrito sigue aquí: Guardar lo sustituye.');
      if (!(await refrescarEdicion(e).catch(() => false))) { cerrarCaja(false); host.avisarError('Ese comentario ya no está en la nota.'); }
      return;
    }
    cerrarCaja(false);
    host.avisar('Comentario guardado');
    await e.alGuardar();
  }
  async function editarHilo(h) {
    if (!h.original) await cargarOriginal(h);
    if (!h.original) return host.avisarError('No se ha podido abrir el comentario para editarlo.');
    const ruta = host.ruta(), volver = h.botones[0], teclado = h.teclado !== false;
    cerrarHilo(false);
    abrirCaja({ cita: h.cita, rect: rectDe(volver), volver, editar: { ruta, linea: h.linea, original: h.original, alGuardar: async () => {
      await host.recargar(); host.contadores();
      const n = hilos.find(x => x.linea === h.linea && x.botones.length); if (n) n.botones[0].focus();
    } } }, { teclado });
  }
  // Desde el panel Comentarios: `x` es un elemento de /api/comentarios y `ancla`, su botón.
  function editarDesdePanel(x, ancla) {
    abrirCaja({ cita: x.cita, rect: ancla.getBoundingClientRect(), volver: ancla, editar: { ruta: x.ruta, linea: x.linea, original: x.original, alGuardar: async () => { await host.refrescarPanel(); host.contadores(); } } });
  }

  // ---------- el hilo (popover junto al subrayado)
  async function abrirHilo(h, { enfocar = true, teclado = true } = {}) {
    cerrarHilo(false); cerrarCaja(false); ocultarBoton();
    h.teclado = teclado;
    const pop = document.createElement('div');
    pop.id = 'comentar-hilo'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Comentario'); pop.tabIndex = -1;
    pop.innerHTML = '<button type="button" class="hilo-x" aria-label="Ocultar el hilo">×</button>'
      + (h.cita ? `<p class="hilo-cita"><i>«${esc(h.cita)}»</i></p>` : '')
      + `<p class="hilo-meta">${esc(h.autor)}${h.fecha ? ` · ${esc(h.fecha)}` : ''}</p><div class="hilo-texto">${h.cuerpo}</div>`
      + '<div class="hilo-pie"><button type="button" class="hilo-editar secundario">Editar</button><button type="button" class="hilo-cerrar secundario">Cerrar comentario</button></div>';
    $('#centro').append(pop);
    hiloAbierto = h;
    colocar(pop, rectDe(h.botones[0]));
    pop.querySelector('.hilo-x').onclick = () => cerrarHilo(true);
    pop.querySelector('.hilo-editar').onclick = () => editarHilo(h);
    pop.querySelector('.hilo-cerrar').onclick = () => cerrarComentario(h);
    if (enfocar) pop.focus();
    await cargarOriginal(h);
  }
  async function cargarOriginal(h) {
    try { const todos = await host.api('/api/comentarios'); const f = todos.find(x => x.ruta === host.ruta() && x.linea === h.linea); if (f) h.original = f.original; } catch { /* sin original, cerrar comprueba solo que ahí hay un comentario */ }
  }
  function cerrarHilo(devolverFoco) {
    const pop = $('#comentar-hilo'); if (pop) pop.remove();
    const h = hiloAbierto; hiloAbierto = null;
    if (devolverFoco && h && h.botones[0] && h.botones[0].isConnected) enfocar(h.botones[0], h.teclado !== false);
  }
  function avisoConAccion(mensaje, etiqueta, accion, ms = 5000) {
    const d = document.createElement('div');
    d.className = 'aviso-flotante'; d.setAttribute('role', 'status');
    const t = document.createElement('span'); t.textContent = mensaje + ' · ';
    const b = document.createElement('button'); b.type = 'button'; b.className = 'aviso-accion'; b.textContent = etiqueta;
    b.onclick = () => { d.remove(); accion(); };
    d.append(t, b); host.zonaAvisos().append(d);
    setTimeout(() => d.remove(), ms);
  }
  // Cierra (borra) un comentario y ofrece Deshacer 5 s. `d`: { ruta, linea, original, cita }; `despues()` repinta lo que se ve (la nota o el panel).
  async function cerrarDatos(d, despues) {
    const texto = d.original ? textoDe(d.original) : '', fecha = (d.original && (d.original.split('\n')[0].match(/\((\d{4}-\d{2}-\d{2})\)/) || [])[1]) || undefined;
    try { await host.api('/api/comentario/cerrar', { ruta: d.ruta, linea: d.linea, original: d.original }); }
    catch (err) { if (err.status !== 409) host.avisarError('No se ha podido cerrar el comentario.', err.message); else if (!host.ruta()) host.avisarError('Ese comentario cambió en el disco. Vuelvo a cargar la lista.'); await despues(); return; }
    await despues(); host.contadores();
    if (d.linea < 2) return host.avisar('Comentario cerrado');
    avisoConAccion('Comentario cerrado', 'Deshacer', async () => {
      try {
        // Vuelve a comentar con la misma cita, texto y fecha, detrás de lo que había encima del callout: su último renglón por original.
        const original = lineasDe(await host.textoFichero(d.ruta))[d.linea - 2];
        await host.api('/api/comentario', { ruta: d.ruta, desde: d.linea - 2, hasta: d.linea - 1, texto, original, cita: d.cita, fecha });
      } catch (err) { if (err.status !== 409) host.avisarError('No se ha podido deshacer.', err.message); return; }
      await despues(); host.contadores();
    });
  }
  async function cerrarComentario(h) {
    if (!h.original) await cargarOriginal(h);
    cerrarHilo(false);
    await cerrarDatos({ ruta: host.ruta(), linea: h.linea, original: h.original, cita: h.cita }, () => host.recargar());
  }
  const cerrarDesdePanel = x => cerrarDatos({ ruta: x.ruta, linea: x.linea, original: x.original, cita: x.cita }, () => host.refrescarPanel());

  // ---------- el teclado y el ratón
  function iniciar(anfitrion) {
    host = anfitrion;
    document.addEventListener('selectionchange', alCambiarSeleccion);
    $('#nota').addEventListener('click', e => {
      const b = e.target.closest('button.comentado'); if (!b) return;
      e.preventDefault(); e.stopPropagation();
      const h = hilos[+b.dataset.hilo];
      if (hiloAbierto === h) cerrarHilo(true); else if (h) abrirHilo(h, { teclado: e.detail === 0 });
    }, true);
    // c: con texto seleccionado comenta ese texto; sin selección, el bloque enfocado.
    document.addEventListener('keydown', e => {
      if (e.key.toLowerCase() !== 'c' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.defaultPrevented || !enLectura()) return;
      if (e.target.closest('input, textarea, select, [contenteditable], #lateral, #cajon, [role="dialog"]')) return;
      const info = analizar(getSelection());
      const foco = document.activeElement;
      if (info) { e.preventDefault(); ocultarBoton(); abrirCaja(info); }
      else if (foco && foco.classList && foco.classList.contains('bloque') && !foco.querySelector(':scope > .callout-comment')) {
        e.preventDefault(); abrirCaja({ bloque: foco, cita: '', desde: +foco.dataset.desde, hasta: +foco.dataset.hasta });
      }
    });
    // Mayús + flechas sobre un bloque enfocado, sin selección: la crea (el navegador solo extiende una que ya existe) y desde ahí se
    // sigue con las flechas: elegir un fragmento para comentar sin ratón (auditoría 2026-10-09, 1). Derecha empieza por el principio del bloque; izquierda, por el final.
    document.addEventListener('keydown', e => {
      if (!e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') || !enLectura()) return;
      const b = e.target;
      if (!b.classList || !b.classList.contains('bloque') || b.querySelector(':scope > .callout-comment')) return;
      const sel = getSelection();
      if (sel.rangeCount && !sel.isCollapsed && b.contains(sel.anchorNode)) return;   // ya hay selección en el bloque: el navegador la amplía
      const { mapa } = textoVisible(b); if (!mapa.length) return;
      e.preventDefault();
      const derecha = e.key === 'ArrowRight';
      if (!(sel.rangeCount && sel.isCollapsed && b.contains(sel.anchorNode))) { const [n, o] = derecha ? mapa[0] : mapa[mapa.length - 1]; const p = derecha ? o : o + 1; sel.setBaseAndExtent(n, p, n, p); }
      sel.modify('extend', derecha ? 'forward' : 'backward', 'character');
    }, true);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && hiloAbierto) { e.preventDefault(); cerrarHilo(true); } });
    // Un clic fuera cierra el hilo, y la caja si está vacía.
    document.addEventListener('mousedown', e => {
      if (hiloAbierto && !e.target.closest('#comentar-hilo, button.comentado')) cerrarHilo(false);
      const ta = $('#comentar-texto');
      if (cajaAbierta && ta && !ta.value.trim() && !e.target.closest('#comentar-caja')) cerrarCaja(false);
    });
    // Un scroll grande suelta el botón flotante.
    $('#centro').addEventListener('scroll', () => { if (botonSel && Math.abs($('#centro').scrollTop - Number(botonSel.dataset.scroll || 0)) > 200) ocultarBoton(); }, { passive: true });
  }
  // La recarga en vivo no repinta con algo a medias: una caja, un hilo o una selección.
  const ocupado = () => cajaAbierta || !!hiloAbierto || (() => { const s = getSelection(); return !!(s && !s.isCollapsed && $('#nota').contains(s.anchorNode)); })();

  window.Comentar = { iniciar, pintar, editarDesdePanel, cerrarDesdePanel, abrirHilo, hiloEnLinea, ocupado, cajaAbierta: () => cajaAbierta, cerrarTodo: () => { cerrarCaja(false); cerrarHilo(false); ocultarBoton(); } };
})();
