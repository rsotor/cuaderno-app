'use strict';
// El cuaderno en disco: índice en memoria, lectura y render de notas, y escrituras que comprueban antes de tocar.
// Todo lo que escribe es Markdown en los ficheros del cuaderno, con el final de línea que ya tengan.
const fs = require('node:fs');
const path = require('node:path');
const { crearRender, leerFrontmatter } = require('./markdown');
const { crearFiltro } = require('./ignorar');

class ErrorConflicto extends Error { constructor(msg) { super(msg); this.status = 409; } }
class ErrorPeticion extends Error { constructor(msg) { super(msg); this.status = 400; } }

const quitarAcentos = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const escaparRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RE_CASILLA = /^(\s*- \[)([ xX])(\] .*)$/;
// Una etiqueta en línea, como en Obsidian: «#» tras un espacio (o al principio), una letra y luego letras, dígitos,
// guiones, guiones bajos o barras; acentos admitidos. «#1» y «# título» no lo son. Se busca fuera del código `…`.
const RE_ETIQUETA = /(^|[\s(])#(\p{L}[\p{L}\p{N}_\-/]*)/gu;
const RE_WIKI = /\[\[([^\]|]*?)(?:\\?\|[^\]]*)?\]\]/g;
const sinCodigo = texto => texto.replace(/`[^`]*`/g, m => ' '.repeat(m.length));
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
    if (!this.indice) this.indice = this.recorrer(this.base, []);
    return this.indice;
  }
  invalidar() { this.indice = null; this.cacheTitulos = null; }
  // El título (# …) de cada nota, para que la app enseñe títulos y no nombres de fichero.
  titulos() {
    if (this.cacheTitulos) return this.cacheTitulos;
    const t = {};
    for (const p of this.listar()) {
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
      if (e.isDirectory()) this.recorrer(abs, acc);
      else if (/\.(md|html)$/.test(e.name)) acc.push(this.relativa(abs));
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
    const todos = this.listar();
    const exacto = todos.find(p => p.replace(/\.md$/, '') === limpio);
    if (exacto) return exacto;
    const nombre = limpio.split('/').pop();
    return todos.find(p => p.replace(/\.md$/, '').split('/').pop() === nombre) || null;
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
  lineas(src) { return src.split(/\r?\n/); }
  finDeLinea(src) { return src.includes('\r\n') ? '\r\n' : '\n'; }

  nota(rel) {
    const src = this.leer(rel);
    if (rel.endsWith('.html')) return { ruta: rel, html: null, esHtml: true };
    const texto = src.replace(/\r\n/g, '\n');
    const { datos, lineas } = leerFrontmatter(texto);
    const cuerpo = texto.split('\n').slice(lineas).join('\n');
    let html = this.md.render(cuerpo, { ruta: rel });
    if (lineas) html = html.replace(/data-(desde|hasta|linea)="(\d+)"/g, (_, k, n) => `data-${k}="${Number(n) + lineas}"`);
    return { ruta: rel, frontmatter: datos, html, backlinks: this.backlinks(rel), lineas: texto.split('\n').length };
  }
  backlinks(rel) {
    const nombre = escaparRegex(rel.replace(/\.md$/, '').split('/').pop());
    const re = new RegExp(`\\[\\[(?:[^\\]|]*/)?${nombre}(?:[|\\]#\\\\])`);
    return this.listar().filter(p => p !== rel && p.endsWith('.md') && re.test(this.leer(p)));
  }
  buscar(q, tope = 60) {
    const nq = quitarAcentos(String(q || '').trim());
    if (!nq) return { ficheros: [], lineas: [] };
    const todos = this.listar();
    const titulos = this.titulos();
    const ficheros = todos.filter(p => quitarAcentos(p).includes(nq) || (titulos[p] && quitarAcentos(titulos[p]).includes(nq)));
    const lineas = [];
    for (const p of todos) {
      if (!p.endsWith('.md') || lineas.length >= tope) continue;
      this.lineas(this.leer(p)).forEach((l, i) => { if (lineas.length < tope && quitarAcentos(l).includes(nq)) lineas.push({ ruta: p, linea: i, texto: l.trim().slice(0, 160) }); });
    }
    return { ficheros, lineas };
  }
  // Las casillas del cuaderno agrupadas por nota. soloPropias: solo tareas.md (sin kit, cualquier casilla no es una tarea).
  tareas({ soloPropias = false } = {}) {
    const grupos = [];
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
        items.push({ linea: i, hecha: m[2] !== ' ', texto, html: this.marcarEtiquetas(this.md.renderInline(texto, {})), enlaces: this.enlacesDe(crudo), etiquetas: etiquetasDe(crudo.replace(RE_WIKI, ' ')) });
      });
      if (items.length) grupos.push({ ruta: p, generado: /^> Lo genera tu profesor/m.test(ls.slice(0, 6).join('\n')), items });
    }
    grupos.sort((a, b) => (a.ruta === 'tareas.md' ? -1 : b.ruta === 'tareas.md' ? 1 : a.generado - b.generado));
    return grupos;
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
        lista.push({ ruta: p, linea: i, titulo: m[1], texto: cuerpo.join(' ') });
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
    if (actual !== String(original).replace(/\r\n/g, '\n').replace(/\n$/, '')) throw new ErrorConflicto('la nota cambió desde que la abriste; vuelve a cargarla');
  }
  escribirBloque(rel, desde, hasta, texto, original) {
    const abs = this.dentro(rel), src = fs.readFileSync(abs, 'utf8');
    const ls = this.lineas(src);
    this.comprobarOriginal(ls, desde, hasta, original);
    ls.splice(desde, hasta - desde, ...String(texto).replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n'));
    this.escribir(abs, ls, this.finDeLinea(src));
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
  // Comentario del alumno debajo de un bloque (desde..hasta), separado por líneas en blanco para que Markdown no
  // lo pegue al párrafo siguiente.
  comentar(rel, desde, hasta, texto, original, fecha = new Date().toISOString().slice(0, 10)) {
    const abs = this.dentro(rel), src = fs.readFileSync(abs, 'utf8');
    const ls = this.lineas(src);
    if (!String(texto || '').trim()) throw new ErrorPeticion('comentario vacío');
    this.comprobarOriginal(ls, desde, hasta, original);
    const cuerpo = String(texto).trim().replace(/\r\n/g, '\n').split('\n').map(l => `> ${l}`);
    const nuevas = ['', `> [!comment] Alumno (${fecha})`, ...cuerpo];
    if (hasta < ls.length && ls[hasta].trim() !== '') nuevas.push('');
    ls.splice(hasta, 0, ...nuevas);
    this.escribir(abs, ls, this.finDeLinea(src));
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
