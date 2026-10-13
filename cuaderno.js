'use strict';
// El cuaderno en disco: índice en memoria, lectura y render de notas, y escrituras que comprueban antes de tocar.
// Todo lo que escribe es Markdown en los ficheros del cuaderno, con el final de línea que ya tengan.
const fs = require('node:fs');
const path = require('node:path');
const { crearRender, leerFrontmatter } = require('./markdown');
const { crearFiltro } = require('./ignorar');

class ErrorConflicto extends Error { constructor(msg) { super(msg); this.status = 409; } }
class ErrorPeticion extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }

const quitarAcentos = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const escaparRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RE_TITULO_COMENTARIO = /^(.*?) \((\d{4}-\d{2}-\d{2})\)(?: · «(.*)»)?\s*$/;
const RE_CASILLA = /^(\s*- \[)([ xX])(\] .*)$/;
// Una etiqueta en línea, como en Obsidian: «#» tras un espacio (o al principio), una letra y luego letras, dígitos,
// guiones, guiones bajos o barras; acentos admitidos. «#1» y «# título» no lo son. Se busca fuera del código `…`.
const RE_ETIQUETA = /(^|[\s(])#(\p{L}[\p{L}\p{N}_\-/]*)/gu;
const RE_WIKI = /\[\[([^\]|]*?)(?:\\?\|[^\]]*)?\]\]/g;
// Una etiqueta y el nombre de una nota o carpeta se comparan sin mayúsculas y con espacios, guiones y guiones bajos por igual.
const normalizarNombre = s => s.toLowerCase().replace(/[\s_-]+/g, ' ').trim();
// La nota principal de una carpeta, por orden: brief.md, README.md, index.md (sin distinguir mayúsculas).
const PRINCIPALES = ['brief.md', 'readme.md', 'index.md'];
const sinCodigo = texto => texto.replace(/`[^`]*`/g, m => ' '.repeat(m.length));
// Lo que lista el índice: todos los ficheros del cuaderno menos los ocultos (punto delante, node_modules, ignorados),
// como el Finder (Roberto, 2026-10-09). Los que no son notas salen en el árbol y en el buscador por su nombre; la
// app enseña los que sabe y del resto lleva a su carpeta. La búsqueda en el texto, los backlinks y las tareas siguen
// siendo solo de notas. Un fichero solo se enlaza con su extensión: [[datos.json]].
// Una carpeta que empieza por «_» (_meta, _archive, _plantillas) es de trastienda: no sale en el árbol ni en el
// buscador, pero sigue en el índice, así que sus notas se pueden enlazar y abrir (Roberto, 2026-10-08).
const enCarpetaOculta = p => p.split('/').slice(0, -1).some(s => s.startsWith('_'));
const esNota = p => /\.(md|html)$/i.test(p);
const tipoDe = p => (p.match(/\.([a-z0-9]+)$/i) || [, ''])[1].toLowerCase();
function etiquetasDe(texto) { const e = []; for (const m of sinCodigo(texto).matchAll(RE_ETIQUETA)) if (!e.includes(m[2])) e.push(m[2]); return e; }

class Cuaderno {
  // raiz: la carpeta abierta (donde vive .gitignore). base: la carpeta de las notas (estudio/ con kit).
  constructor(raiz, base = raiz) {
    this.raiz = path.resolve(raiz);
    this.base = path.resolve(base);
    this.ignorado = crearFiltro([path.join(this.raiz, '.gitignore'), path.join(this.base, '.obsidianignore')]);
    this.md = crearRender(d => this.resolverWiki(d));
    this.indice = null;
    this.vigilante = null;
    this.ajustes = this.leerAjustes();
  }
  // cuaderno.json en la raíz del cuaderno: solo lo que es del cuaderno en sí (nombre para mostrar, portada).
  // La apariencia (tema, letra, fuente) es del usuario, no del cuaderno.
  leerAjustes() {
    try {
      const a = JSON.parse(fs.readFileSync(path.join(this.raiz, 'cuaderno.json'), 'utf8'));
      return { nombre: typeof a.nombre === 'string' && a.nombre.trim() ? a.nombre.trim() : null, portada: typeof a.portada === 'string' ? a.portada.replace(/^\//, '') : null };
    } catch { return { nombre: null, portada: null }; }
  }
  // El nombre: el de cuaderno.json; si no, el nombre_curso de los ajustes del kit; si no, la carpeta.
  nombre() {
    if (this.ajustes.nombre) return this.ajustes.nombre;
    try { const a = JSON.parse(fs.readFileSync(path.join(this.raiz, 'config', 'ajustes.json'), 'utf8')); if (typeof a.nombre_curso === 'string' && a.nombre_curso.trim()) return a.nombre_curso.trim(); } catch { /* sin ajustes del kit */ }
    return path.basename(this.raiz);
  }

  // ---------- índice
  listar() {
    if (!this.indice) { this.vacias = []; this.indice = this.recorrer(this.base, []); }
    return this.indice;
  }
  invalidar() { this.indice = null; this.cacheTitulos = null; }
  // Lo que enseña el árbol: el índice sin las carpetas de trastienda, más las carpetas sin nada que enseñar (una recién
  // creada, con solo un .gitkeep), que salen como «carpeta/»: en el Finder se ven, así que aquí también.
  arbol() { const todos = this.listar(); return [...todos, ...this.vacias.map(c => c + '/')].filter(p => !enCarpetaOculta(p)); }
  // El título (# …) de cada nota, para que la app enseñe títulos y no nombres de fichero.
  titulos() {
    if (this.cacheTitulos) return this.cacheTitulos;
    const t = {};
    for (const p of this.listar()) {
      if (p.endsWith('.html')) {   // una página HTML: su <title>, leído del principio del fichero
        const m = this.principio(p, 8192).match(/<title[^>]*>([^<]*)<\/title>/i);
        if (m && m[1].trim()) t[p] = m[1].replace(/\s+/g, ' ').trim();
        continue;
      }
      if (!p.endsWith('.md')) continue;
      const m = this.leer(p).replace(/\r\n/g, '\n').match(/^#\s+(.+?)\s*#*\s*$/m);
      if (m) t[p] = m[1].replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2').trim();
    }
    return (this.cacheTitulos = t);
  }
  recorrer(dir, acc) {
    let entradas;
    try { entradas = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
    for (const e of entradas.sort((a, b) => a.name.localeCompare(b.name, 'es'))) {
      const abs = path.join(dir, e.name);
      if (this.ignorado(abs, e.isDirectory())) continue;
      if (e.isDirectory()) { const antes = acc.length, vacias = this.vacias.length; this.recorrer(abs, acc); if (acc.length === antes && this.vacias.length === vacias) this.vacias.push(this.relativa(abs)); }
      else if (e.isFile()) acc.push(this.relativa(abs));
    }
    return acc;
  }
  relativa(abs) { return path.relative(this.base, abs).split(path.sep).join('/'); }
  dentro(rel) {
    if (typeof rel !== 'string' || !rel) throw new ErrorPeticion('falta la ruta');
    const abs = path.resolve(this.base, rel);
    if (abs !== this.base && !abs.startsWith(this.base + path.sep)) throw new ErrorPeticion('ruta fuera del cuaderno');
    return abs;
  }
  resolverWiki(destino) {
    const limpio = destino.replace(/\.md$/, '').replace(/#.*$/, '').replace(/^\//, '');
    // Una nota se enlaza con o sin .md; cualquier otro fichero, con su extensión ([[datos.json]], [[pagina.html]]).
    const todos = this.listar(), clave = p => p.replace(/\.md$/, '');
    const exacto = todos.find(p => clave(p) === limpio);
    if (exacto) return exacto;
    const nombre = limpio.split('/').pop();
    return todos.find(p => clave(p).split('/').pop() === nombre) || null;
  }
  // La portada: la de cuaderno.json si existe; si no, inicio.md; si no, la primera nota de la raíz; si no hay, null (la app enseña el árbol).
  portada() {
    const todos = this.listar();
    if (this.ajustes.portada && todos.includes(this.ajustes.portada)) return this.ajustes.portada;
    if (todos.includes('inicio.md')) return 'inicio.md';
    return todos.find(p => !p.includes('/') && p.endsWith('.md')) || null;
  }

  // ---------- lectura
  leer(rel) { return fs.readFileSync(this.dentro(rel), 'utf8'); }
  // Los primeros bytes de un fichero, como texto (para el <title> de una página sin leerla entera).
  principio(rel, bytes) {
    const fd = fs.openSync(this.dentro(rel), 'r');
    try { const b = Buffer.alloc(bytes); return b.toString('utf8', 0, fs.readSync(fd, b, 0, bytes, 0)); } finally { fs.closeSync(fd); }
  }
  lineas(src) { return src.split(/\r?\n/); }
  finDeLinea(src) { return src.includes('\r\n') ? '\r\n' : '\n'; }

  nota(rel) {
    // Un fichero que no es nota (PDF, datos, texto) no se lee aquí: el navegador lo pide a /fichero según su tipo.
    if (!esNota(rel)) { this.dentro(rel); return { ruta: rel, tipo: tipoDe(rel), esFichero: true }; }
    const src = this.leer(rel);
    if (rel.endsWith('.html')) return { ruta: rel, html: null, esHtml: true };
    const texto = src.replace(/\r\n/g, '\n');
    const { datos, lineas } = leerFrontmatter(texto);
    const cuerpo = texto.split('\n').slice(lineas).join('\n');
    let html = this.md.render(cuerpo, { ruta: rel });
    if (lineas) html = html.replace(/data-(desde|hasta|linea)="(\d+)"/g, (_, k, n) => `data-${k}="${Number(n) + lineas}"`);
    // generado: la nota la regenera el profesor del kit cada vez que guarda (inicio.md, progreso): no se borra a mano.
    return { ruta: rel, frontmatter: datos, html, backlinks: this.backlinks(rel), lineas: texto.split('\n').length, generado: /^> Lo genera tu profesor/m.test(texto.split('\n').slice(0, 6).join('\n')) };
  }
  backlinks(rel) {
    const nombre = escaparRegex(rel.replace(/\.md$/, '').split('/').pop());
    const re = new RegExp(`\\[\\[(?:[^\\]|]*/)?${nombre}(?:[|\\]#\\\\])`);
    return this.listar().filter(p => p !== rel && p.endsWith('.md') && re.test(this.leer(p)));
  }
  // buscar(q, tope) (firma de siempre) o buscar(q, { tope, porNota, excluir }). Con porNota: la primera línea que coincide
  // de cada nota, hasta 50 notas, saltando las excluidas antes de contar; `cortado` dice si quedaron notas fuera.
  buscar(q, opciones = 60) {
    const { tope = 60, porNota = false, excluir = () => false } = typeof opciones === 'number' ? { tope: opciones } : opciones;
    const nq = quitarAcentos(String(q || '').trim());
    if (!nq) return porNota ? { ficheros: [], lineas: [], cortado: false } : { ficheros: [], lineas: [] };
    const todos = this.arbol();
    const titulos = this.titulos();
    const ficheros = todos.filter(p => quitarAcentos(p).includes(nq) || (titulos[p] && quitarAcentos(titulos[p]).includes(nq)));
    const lineas = [];
    if (porNota) {
      const MAX_NOTAS = 50;
      let cortado = false;
      for (const p of todos) {
        if (!p.endsWith('.md') || excluir(p)) continue;
        const i = this.lineas(this.leer(p)).findIndex(l => quitarAcentos(l).includes(nq));
        if (i < 0) continue;
        if (lineas.length >= MAX_NOTAS) { cortado = true; break; }
        lineas.push({ ruta: p, linea: i, texto: this.lineas(this.leer(p))[i].trim().slice(0, 160) });
      }
      return { ficheros, lineas, cortado };
    }
    for (const p of todos) {
      if (!p.endsWith('.md') || lineas.length >= tope) continue;
      this.lineas(this.leer(p)).forEach((l, i) => { if (lineas.length < tope && quitarAcentos(l).includes(nq)) lineas.push({ ruta: p, linea: i, texto: l.trim().slice(0, 160) }); });
    }
    return { ficheros, lineas };
  }
  // Las casillas del cuaderno agrupadas por nota. soloPropias: solo tareas.md (sin kit, cualquier casilla no es una tarea).
  tareas({ soloPropias = false } = {}) {
    const grupos = [], menciones = this.indiceMenciones();
    for (const p of this.listar()) {
      if (!p.endsWith('.md')) continue;
      if (soloPropias && p !== 'tareas.md') continue;
      const src = this.leer(p);
      const tipo = (leerFrontmatter(src.replace(/\r\n/g, '\n')).datos || {}).tipo;
      if (tipo === 'examen' || tipo === 'flashcards') continue;   // se contestan en su nota, no son tareas
      const ls = this.lineas(src);
      const items = [];
      ls.forEach((l, i) => {
        const m = l.match(RE_CASILLA); if (!m) return;
        const crudo = m[3].slice(2);
        const texto = this.acortarRutas(crudo.replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2'));
        items.push({ linea: i, hecha: m[2] !== ' ', texto, html: this.marcarEtiquetas(this.md.renderInline(texto, {})), enlaces: this.enlacesDe(crudo), etiquetas: etiquetasDe(crudo.replace(RE_WIKI, ' ')), notas: this.notasDeTarea(crudo, menciones) });
      });
      if (items.length) grupos.push({ ruta: p, generado: /^> Lo genera tu profesor/m.test(ls.slice(0, 6).join('\n')), items });
    }
    grupos.sort((a, b) => (a.ruta === 'tareas.md' ? -1 : b.ruta === 'tareas.md' ? 1 : a.generado - b.generado));
    return grupos;
  }
  // A qué notas pertenece una tarea (la «pertenencia», en un solo sitio; Roberto, 2026-10-09): las que enlaza con
  // [[nombre]], las que se llaman como una de sus #etiquetas (sin mayúsculas; espacio, guion y guion bajo valen igual:
  // #cms-update ≙ «cms update.md») y, si la etiqueta es el nombre de una carpeta, la nota principal de esa carpeta.
  // Devuelve rutas; incluye la propia nota donde vive la tarea si se menciona a sí misma (tareasDe la quita).
  notasDeTarea(crudo, menciones = this.indiceMenciones()) {
    const rutas = [];
    const poner = r => { if (r && !rutas.includes(r)) rutas.push(r); };
    for (const m of sinCodigo(crudo).matchAll(RE_WIKI)) { const d = m[1].trim(); if (d) { const r = this.resolverWiki(d); if (r && r.endsWith('.md')) poner(r); } }
    for (const e of etiquetasDe(crudo.replace(RE_WIKI, ' '))) {
      const k = normalizarNombre(e);
      (menciones.notas.get(k) || []).forEach(poner);
      (menciones.carpetas.get(k) || []).forEach(poner);
    }
    return rutas;
  }
  // nombre normalizado → rutas: de las notas por su fichero, y de las carpetas por su nota principal.
  indiceMenciones() {
    const notas = new Map(), carpetas = new Map(), todos = this.listar(), rutas = new Set(todos.map(p => p.toLowerCase())), dirs = new Set();
    const poner = (mapa, k, v) => { if (!mapa.has(k)) mapa.set(k, []); if (!mapa.get(k).includes(v)) mapa.get(k).push(v); };
    for (const p of todos) {
      const partes = p.split('/');
      if (p.endsWith('.md')) poner(notas, normalizarNombre(partes.at(-1).replace(/\.md$/, '')), p);
      for (let i = 1; i < partes.length; i++) dirs.add(partes.slice(0, i).join('/'));
    }
    for (const d of dirs) {
      const nombre = PRINCIPALES.find(n => rutas.has(`${d}/${n}`.toLowerCase())); if (!nombre) continue;
      poner(carpetas, normalizarNombre(d.split('/').at(-1)), todos.find(p => p.toLowerCase() === `${d}/${nombre}`.toLowerCase()));
    }
    return { notas, carpetas };
  }
  // Las tareas que mencionan una nota y viven en otra (las de la propia nota ya se ven en ella), pendientes primero.
  tareasDe(rel, opciones = {}) {
    if (!String(rel || '').endsWith('.md')) return [];
    const lista = [];
    for (const g of this.tareas(opciones)) if (g.ruta !== rel) for (const i of g.items) if (i.notas.includes(rel)) lista.push({ ...i, ruta: g.ruta, generado: g.generado });
    return [...lista.filter(i => !i.hecha), ...lista.filter(i => i.hecha)];
  }
  // Una ruta de nota del cuaderno dentro de un texto se deja en su nombre; cualquier otra cosa con barras
  // («regla 50/30/20», «04/10/2026», una URL) se queda como está.
  acortarRutas(texto) {
    const notas = new Set(this.listar().map(p => p.replace(/\.md$/, '')));
    return texto.replace(/[\w.-]+(?:\/[\w.-]+)+/g, t => notas.has(t.replace(/\.md$/, '')) ? t.replace(/\.md$/, '').split('/').pop() : t);
  }
  // Los destinos de los [[wikilinks]] de una línea, sin alias ni #sección, como nombre de nota (el fichero sin ruta
  // ni .md). Si el enlace no resuelve a ninguna nota, se deja el nombre tal como está escrito.
  enlacesDe(texto) {
    const nombres = [];
    for (const m of sinCodigo(texto).matchAll(RE_WIKI)) {
      const destino = m[1].trim(); if (!destino) continue;
      const ruta = this.resolverWiki(destino);
      const nombre = (ruta || destino.replace(/#.*$/, '')).replace(/\.md$/, '').split('/').pop();
      if (nombre && !nombres.includes(nombre)) nombres.push(nombre);
    }
    return nombres;
  }
  // Las #etiquetas del HTML en línea de una tarea, envueltas para pintarlas; solo en el texto, nunca dentro de <code>.
  marcarEtiquetas(html) {
    let enCodigo = 0;
    return html.split(/(<[^>]*>)/).map(t => {
      if (t.startsWith('<')) { if (/^<code[\s>]/.test(t)) enCodigo++; else if (/^<\/code>/.test(t)) enCodigo = Math.max(0, enCodigo - 1); return t; }
      return enCodigo ? t : t.replace(RE_ETIQUETA, (_, antes, e) => `${antes}<span class="etiqueta">#${e}</span>`);
    }).join('');
  }
  comentarios() {
    const lista = [];
    for (const p of this.listar()) {
      if (!p.endsWith('.md')) continue;
      const ls = this.lineas(this.leer(p));
      ls.forEach((l, i) => {
        const m = l.match(/^> \[!comment\][-+]?\s*(.*)$/);
        if (!m) return;
        let j = i + 1; const cuerpo = [];
        while (j < ls.length && ls[j].startsWith('>')) cuerpo.push(ls[j++].replace(/^>\s?/, ''));
        const t = m[1].match(RE_TITULO_COMENTARIO);   // 'Alumno (2026-10-09)' o 'Alumno (2026-10-09) · «cita»'; si no cuadra (lo escribió otro), solo `titulo`
        lista.push({ ruta: p, linea: i, titulo: m[1], autor: t ? t[1] : null, fecha: t ? t[2] : null, cita: t && t[3] ? t[3] : null, texto: cuerpo.join(' '), original: ls.slice(i, j).join('\n') });
      });
    }
    return lista;
  }
  // Recorre todas las notas: enlaces rotos y notas que no se pueden pintar. Para la prueba sobre un cuaderno real.
  recorrido() {
    const rotos = [], fallos = [];
    let notas = 0;
    for (const p of this.listar()) {
      if (!p.endsWith('.md')) continue;
      notas++;
      try {
        const html = this.nota(p).html;
        for (const m of html.matchAll(/class="wiki roto" href="#" title="([^"]*)"/g)) rotos.push({ ruta: p, destino: m[1] });
      } catch (e) { fallos.push({ ruta: p, error: e.message }); }
    }
    return { notas, rotos, fallos };
  }

  // ---------- escrituras (comprueban que el tramo sigue siendo el que el usuario vio)
  escribir(abs, lineas, eol) { fs.writeFileSync(abs, lineas.join(eol)); this.invalidar(); }
  tramo(ls, desde, hasta) {
    if (!Number.isInteger(desde) || !Number.isInteger(hasta) || desde < 0 || hasta < desde || hasta > ls.length) throw new ErrorPeticion('tramo inválido');
    return ls.slice(desde, hasta).join('\n');
  }
  comprobarOriginal(ls, desde, hasta, original) {
    const actual = this.tramo(ls, desde, hasta);   // valida el rango aunque no venga el original
    if (original == null) return;
    const norm = s => String(s).replace(/\r\n/g, '\n').replace(/\n+$/, '');   // los dos lados igual: un bloque que acababa en línea en blanco daba conflicto siempre (2026-10-08)
    if (norm(actual) !== norm(original)) throw new ErrorConflicto('la nota cambió desde que la abriste; vuelve a cargarla');
  }
  escribirBloque(rel, desde, hasta, texto, original) {
    const abs = this.dentro(rel), src = fs.readFileSync(abs, 'utf8');
    const ls = this.lineas(src);
    this.comprobarOriginal(ls, desde, hasta, original);
    ls.splice(desde, hasta - desde, ...String(texto).replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n'));
    this.escribir(abs, ls, this.finDeLinea(src));
  }
  // La nota entera (editor del navegador). Comparación estricta con `original` (sin BOM, CRLF→LF, nada más); el texto
  // manda: no se añade ni se quita el salto final. Conserva el EOL y el BOM del fichero; con finales mezclados, 422.
  escribirNota(rel, texto, original) {
    const abs = this.dentro(rel);
    if (typeof texto !== 'string') throw new ErrorPeticion('falta el texto de la nota');
    const src = fs.readFileSync(abs, 'utf8');
    const bom = src.startsWith('\uFEFF');
    const sinBom = bom ? src.slice(1) : src;
    if (sinBom.includes('\r\n') && /(^|[^\r])\n/.test(sinBom)) throw new ErrorPeticion('la nota tiene saltos de línea mezclados', 422);
    const norm = s => String(s).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
    if (original != null && norm(original) !== norm(sinBom)) throw new ErrorConflicto('la nota cambió desde que la abriste; vuelve a cargarla');
    const eol = this.finDeLinea(sinBom);
    fs.writeFileSync(abs, (bom ? '\uFEFF' : '') + norm(texto).replace(/\n/g, eol));
    this.invalidar();
  }
  // Pinta un fragmento de Markdown como la lectura (mismo render que `nota`), para el editor.
  renderizar(texto, rel = '') {
    return this.md.render(String(texto == null ? '' : texto).replace(/\r\n/g, '\n'), { ruta: String(rel || '') });
  }
  marcarCasilla(rel, linea, marcada, textoOriginal) {
    const abs = this.dentro(rel), src = fs.readFileSync(abs, 'utf8');
    const ls = this.lineas(src);
    const m = (ls[linea] || '').match(RE_CASILLA);
    if (!m) throw new ErrorConflicto('esa línea ya no es una casilla; vuelve a cargar la nota');
    if (textoOriginal != null && ls[linea] !== textoOriginal) throw new ErrorConflicto('la casilla cambió desde que la viste; vuelve a cargar la nota');
    ls[linea] = `${m[1]}${marcada ? 'x' : ' '}${m[3]}`;
    this.escribir(abs, ls, this.finDeLinea(src));
  }
  // Cita de un comentario: una sola línea, espacios colapsados, sin «» dentro, de 120 caracteres como mucho (se corta
  // en el último espacio y se añade …). Vacía tras normalizar = comentario sin cita. La unicidad no es de aquí: la
  // decide la pantalla sobre el texto que se ve.
  normalizarCita(cita) {
    let c = String(cita || '').replace(/[«»]/g, ' ').replace(/\s+/g, ' ').trim();
    if (c.length > 120) {
      c = c.slice(0, 120);
      const sp = c.lastIndexOf(' ');
      c = (sp > 0 ? c.slice(0, sp) : c).trimEnd() + '…';
    }
    return c;
  }
  // Comentario del alumno debajo de un bloque (desde..hasta), separado por líneas en blanco para que Markdown no
  // lo pegue al párrafo siguiente. `opciones.cita`: el texto seleccionado, que va en el título tras « · ».
  //
  // Regla que comparte con cerrarComentario(): comentar() añade SIEMPRE una línea en blanco antes del callout, y otra
  // después solo si la línea siguiente no estaba en blanco.
  comentar(rel, desde, hasta, texto, original, fecha = new Date().toISOString().slice(0, 10), opciones = {}) {
    const abs = this.dentro(rel), src = fs.readFileSync(abs, 'utf8');
    const ls = this.lineas(src);
    if (!String(texto || '').trim()) throw new ErrorPeticion('comentario vacío');
    this.comprobarOriginal(ls, desde, hasta, original);
    const cuerpo = String(texto).trim().replace(/\r\n/g, '\n').split('\n').map(l => `> ${l}`);
    const cita = this.normalizarCita(opciones && opciones.cita);
    const nuevas = ['', `> [!comment] Alumno (${fecha})${cita ? ` · «${cita}»` : ''}`, ...cuerpo];
    if (hasta < ls.length && ls[hasta].trim() !== '') nuevas.push('');
    ls.splice(hasta, 0, ...nuevas);
    this.escribir(abs, ls, this.finDeLinea(src));
  }
  // Cierra (borra) el comentario cuyo título está en la línea `linea`. `original` es el callout tal como lo da
  // comentarios() (campo `original`: título y cuerpo, con `> ` y unidos por \n); sin él solo se comprueba que ahí hay un
  // comentario. 409 si en esa línea ya no está.
  //
  // Quita el callout y la línea en blanco anterior (la que comentar() añade siempre). La posterior se deja: comentar()
  // solo la añade si la siguiente no estaba en blanco, y con una línea en blanco delante de otra cosa el fichero queda
  // igual en los dos casos; quitarla podría pegar dos bloques que estaban separados. Así el fichero queda byte a byte
  // como antes de comentar salvo si el bloque seguía pegado al siguiente sin línea en blanco: ahí queda una de más.
  cerrarComentario(rel, linea, original) {
    const abs = this.dentro(rel), src = fs.readFileSync(abs, 'utf8');
    const ls = this.lineas(src);
    if (!Number.isInteger(linea) || linea < 0 || linea >= ls.length || !/^> \[!comment\]/.test(ls[linea])) throw new ErrorConflicto('ese comentario ya no está; vuelve a cargar la nota');
    let fin = linea + 1;
    while (fin < ls.length && ls[fin].startsWith('>')) fin++;
    const norm = t => String(t).replace(/\r\n/g, '\n').replace(/\n+$/, '');
    if (original != null && norm(ls.slice(linea, fin).join('\n')) !== norm(original)) throw new ErrorConflicto('el comentario cambió desde que lo abriste; vuelve a cargar la nota');
    const ini = linea > 0 && ls[linea - 1].trim() === '' ? linea - 1 : linea;
    ls.splice(ini, fin - ini);
    this.escribir(abs, ls, this.finDeLinea(src));
  }
  // Nota nueva: el título es el nombre del fichero (sin los caracteres que un sistema de ficheros no admite), en la
  // carpeta que se diga (tiene que existir). Solo `# Título` y una línea en blanco: el resto se escribe por bloques.
  nuevaNota(titulo, carpeta = '') {
    const t = String(titulo || '').trim();
    if (!t) throw new ErrorPeticion('la nota necesita un título');
    const nombre = t.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
    if (!nombre || nombre.startsWith('.')) throw new ErrorPeticion('ese título no vale como nombre de fichero');
    const dir = String(carpeta || '').replace(/^\/+|\/+$/g, '');
    const rel = (dir ? dir + '/' : '') + nombre + '.md';
    const abs = this.dentro(rel);
    if (dir && !fs.existsSync(path.dirname(abs))) throw new ErrorPeticion(`no existe la carpeta ${dir}`);
    if (fs.existsSync(abs)) throw new ErrorPeticion(`ya hay una nota llamada ${rel}`);
    fs.writeFileSync(abs, `# ${t}\n\n`);
    this.invalidar();
    return rel;
  }
  nuevaTarea(texto) {
    if (!String(texto || '').trim()) throw new ErrorPeticion('tarea vacía');
    const abs = path.join(this.base, 'tareas.md');
    const linea = `- [ ] ${String(texto).trim()}`;
    if (!fs.existsSync(abs)) { fs.writeFileSync(abs, `# Mis tareas\n\nLo que te apuntas tú. Tu profesor lo lee, pero no lo reescribe.\n\n${linea}\n`); this.invalidar(); return; }
    const previo = fs.readFileSync(abs, 'utf8');
    const eol = this.finDeLinea(previo);
    fs.writeFileSync(abs, previo.replace(/(\r?\n)*$/, eol) + linea + eol);
    this.invalidar();
  }

  // ---------- cambios en disco: el índice se invalida y quien escuche se entera (recarga en vivo)
  vigilar(alCambiar) {
    let timer = null;
    try {
      this.vigilante = fs.watch(this.base, { recursive: true }, (_, f) => {
        // Nada oculto, en ninguna parte de la ruta: .git/index.lock (cada `git status` lo crea) o .obsidian/ no son cambios del cuaderno.
        if (f && (f.includes('node_modules') || f.split(/[\\/]/).some(s => s.startsWith('.')))) return;
        this.invalidar();
        clearTimeout(timer); timer = setTimeout(() => alCambiar(f), 150);
      });
    } catch { /* sin recursivo: sin recarga en vivo */ }
  }
  cerrar() { if (this.vigilante) this.vigilante.close(); }
}

module.exports = { Cuaderno, ErrorConflicto, ErrorPeticion };
