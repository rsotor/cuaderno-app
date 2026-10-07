'use strict';
// Cuaderno: servidor local que abre la carpeta estudio/ de un kit en el navegador.
//   node server.js <ruta-del-kit> [puerto]
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const { WebSocketServer } = require('ws');
const pty = require('node-pty');
const { crearRender, leerFrontmatter } = require('./markdown');

const raizKit = path.resolve(process.argv[2] || '.');
const estudio = fs.existsSync(path.join(raizKit, 'estudio')) ? path.join(raizKit, 'estudio') : raizKit;
const puerto = Number(process.argv[3] || 7331);
const publico = path.join(__dirname, 'public');
const nm = path.join(__dirname, 'node_modules');

// ---------- índice de ficheros
function listar(dir = estudio, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'es'))) {
    if (e.name.startsWith('.')) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) listar(abs, acc);
    else if (/\.(md|html)$/.test(e.name)) acc.push(path.relative(estudio, abs).split(path.sep).join('/'));
  }
  return acc;
}
function resolverWiki(destino) {
  const limpio = destino.replace(/\.md$/, '').replace(/#.*$/, '');
  const todos = listar();
  const exacto = todos.find(p => p.replace(/\.md$/, '') === limpio);
  if (exacto) return exacto;
  const base = limpio.split('/').pop();
  return todos.find(p => p.replace(/\.md$/, '').split('/').pop() === base) || null;
}
const md = crearRender(resolverWiki);

function dentro(rel) {
  const abs = path.resolve(estudio, rel);
  if (!abs.startsWith(estudio + path.sep) && abs !== estudio) throw new Error('fuera de estudio/');
  return abs;
}
const quitarAcentos = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ---------- API
function nota(rel) {
  const abs = dentro(rel);
  const src = fs.readFileSync(abs, 'utf8');
  if (rel.endsWith('.html')) return { ruta: rel, html: null, esHtml: true, raw: src };
  const { datos, lineas } = leerFrontmatter(src);
  const cuerpo = src.split('\n').slice(lineas).join('\n');
  const env = {};
  let html = md.render(cuerpo, env);
  if (lineas) html = html.replace(/data-(desde|hasta)="(\d+)"/g, (_, k, n) => `data-${k}="${Number(n) + lineas}"`).replace(/data-linea="(\d+)"/g, (_, n) => `data-linea="${Number(n) + lineas}"`);
  const base = rel.replace(/\.md$/, '').split('/').pop();
  const backlinks = listar().filter(p => p !== rel && p.endsWith('.md') && new RegExp(`\\[\\[(?:[^\\]|]*/)?${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[|\\]#\\\\])`).test(fs.readFileSync(dentro(p), 'utf8')));
  return { ruta: rel, frontmatter: datos, html, backlinks, lineas: src.split('\n').length };
}
function buscar(q) {
  const nq = quitarAcentos(q.trim());
  if (!nq) return { ficheros: [], lineas: [] };
  const ficheros = listar().filter(p => quitarAcentos(p).includes(nq));
  const lineas = [];
  for (const p of listar()) {
    if (!p.endsWith('.md')) continue;
    const ls = fs.readFileSync(dentro(p), 'utf8').split('\n');
    ls.forEach((l, i) => { if (lineas.length < 60 && quitarAcentos(l).includes(nq)) lineas.push({ ruta: p, linea: i, texto: l.trim().slice(0, 160) }); });
  }
  return { ficheros, lineas };
}
function tareas() {
  const grupos = [];
  for (const p of listar()) {
    if (!p.endsWith('.md')) continue;
    const src = fs.readFileSync(dentro(p), 'utf8');
    const tipo = (leerFrontmatter(src).datos || {}).tipo;
    if (tipo === 'examen' || tipo === 'flashcards') continue;   // se contestan en su nota, no son tareas
    const ls = src.split('\n');
    const items = [];
    ls.forEach((l, i) => { const m = l.match(/^\s*- \[([ xX])\] (.*)$/); if (m) items.push({ linea: i, hecha: m[1] !== ' ', texto: m[2].replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2').slice(0, 200) }); });
    if (items.length) grupos.push({ ruta: p, generado: /^> Lo genera tu profesor/m.test(ls.slice(0, 6).join('\n')), items });
  }
  grupos.sort((a, b) => (a.ruta === 'tareas.md' ? -1 : b.ruta === 'tareas.md' ? 1 : a.generado - b.generado));
  return grupos;
}
function nuevaTarea(texto) {
  const abs = path.join(estudio, 'tareas.md');
  if (!fs.existsSync(abs)) fs.writeFileSync(abs, '# Mis tareas\n\nLo que te apuntas tú. Tu profesor lo lee, pero no lo reescribe.\n\n');
  fs.appendFileSync(abs, `- [ ] ${texto.trim()}\n`);
}
function comentarios() {
  const lista = [];
  for (const p of listar()) {
    if (!p.endsWith('.md')) continue;
    const ls = fs.readFileSync(dentro(p), 'utf8').split('\n');
    ls.forEach((l, i) => {
      const m = l.match(/^> \[!comment\][-+]?\s*(.*)$/);
      if (m) { let j = i + 1, cuerpo = []; while (j < ls.length && ls[j].startsWith('>')) cuerpo.push(ls[j++].replace(/^>\s?/, '')); lista.push({ ruta: p, linea: i, titulo: m[1], texto: cuerpo.join(' ') }); }
    });
  }
  return lista;
}
function escribirLineas(rel, desde, hasta, nuevas) {
  const abs = dentro(rel);
  const ls = fs.readFileSync(abs, 'utf8').split('\n');
  ls.splice(desde, hasta - desde, ...nuevas);
  fs.writeFileSync(abs, ls.join('\n'));
}
function marcarCasilla(rel, linea, marcada) {
  const abs = dentro(rel);
  const ls = fs.readFileSync(abs, 'utf8').split('\n');
  if (!/^\s*- \[[ xX]\] /.test(ls[linea])) throw new Error('esa línea no es una casilla');
  ls[linea] = ls[linea].replace(/\[[ xX]\]/, marcada ? '[x]' : '[ ]');
  fs.writeFileSync(abs, ls.join('\n'));
}
function comentar(rel, trasLinea, texto) {
  const fecha = new Date().toISOString().slice(0, 10);
  const cuerpo = texto.trim().split('\n').map(l => `> ${l}`);
  escribirLineas(rel, trasLinea, trasLinea, ['', `> [!comment] Alumno (${fecha})`, ...cuerpo]);
}

// ---------- HTTP
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.png': 'image/png' };
const servir = (res, abs) => { if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) { res.writeHead(404); return res.end('no'); } res.writeHead(200, { 'content-type': tipos[path.extname(abs)] || 'application/octet-stream' }); fs.createReadStream(abs).pipe(res); };
const json = (res, obj, code = 200) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
const leerCuerpo = req => new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => r(d ? JSON.parse(d) : {})); });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  try {
    if (p === '/' ) return servir(res, path.join(publico, 'index.html'));
    if (p.startsWith('/assets/')) return servir(res, path.join(nm, p.slice(8)));
    if (p.startsWith('/public/')) return servir(res, path.join(publico, p.slice(8)));
    if (p === '/api/info') return json(res, { kit: raizKit, estudio, nombre: path.basename(raizKit) });
    if (p === '/api/arbol') return json(res, listar());
    if (p === '/api/buscar') return json(res, buscar(url.searchParams.get('q') || ''));
    if (p === '/api/nota') return json(res, nota(url.searchParams.get('p')));
    if (p === '/api/tareas') return json(res, tareas());
    if (p === '/api/comentarios') return json(res, comentarios());
    if (p.startsWith('/fichero/')) return servir(res, dentro(decodeURIComponent(p.slice(9))));
    if (req.method === 'POST') {
      const b = await leerCuerpo(req);
      if (p === '/api/bloque') { escribirLineas(b.ruta, b.desde, b.hasta, b.texto.replace(/\n$/, '').split('\n')); return json(res, { ok: true }); }
      if (p === '/api/casilla') { marcarCasilla(b.ruta, b.linea, b.marcada); return json(res, { ok: true }); }
      if (p === '/api/comentario') { comentar(b.ruta, b.tras, b.texto); return json(res, { ok: true }); }
      if (p === '/api/tarea') { nuevaTarea(b.texto); return json(res, { ok: true }); }
    }
    res.writeHead(404); res.end('no');
  } catch (e) { json(res, { error: e.message }, 400); }
});

// ---------- terminal (pty) por WebSocket, abierta en la raíz del kit
const wss = new WebSocketServer({ noServer: true });
wss.on('connection', ws => {
  const shell = process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || 'bash');
  const term = pty.spawn(shell, [], { name: 'xterm-256color', cols: 100, rows: 28, cwd: raizKit, env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' } });
  term.onData(d => ws.readyState === 1 && ws.send(d));
  term.onExit(() => ws.close());
  ws.on('message', m => { const s = m.toString(); if (s.startsWith('\u0001')) { const { cols, rows } = JSON.parse(s.slice(1)); term.resize(cols, rows); } else term.write(s); });
  ws.on('close', () => term.kill());
});

// ---------- recarga en vivo cuando cambia algo en estudio/
const oyentes = new Set();
const wssCambios = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, sock, head) => {
  if (req.url === '/pty') wss.handleUpgrade(req, sock, head, ws => wss.emit('connection', ws, req));
  else if (req.url === '/cambios') wssCambios.handleUpgrade(req, sock, head, ws => { oyentes.add(ws); ws.on('close', () => oyentes.delete(ws)); });
  else sock.destroy();
});
let timer = null;
try { fs.watch(estudio, { recursive: true }, (_, f) => { clearTimeout(timer); timer = setTimeout(() => { for (const ws of oyentes) ws.send(JSON.stringify({ fichero: f })); }, 150); }); } catch { /* recursive no disponible: sin recarga en vivo */ }

server.listen(puerto, '127.0.0.1', () => console.log(`Cuaderno · ${estudio}\nhttp://127.0.0.1:${puerto}  (${os.hostname()})`));
