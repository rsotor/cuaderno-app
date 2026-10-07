'use strict';
// El servidor local: la API que usa el navegador, los ficheros estáticos, la terminal por WebSocket y la recarga en
// vivo. Escuchar en 127.0.0.1 no basta para estar a salvo (cualquier web abierta en el navegador puede llamar a
// localhost): cada arranque genera un token que viaja en la URL una vez, se queda en una cookie y se exige en todo.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { WebSocketServer } = require('ws');
const { ErrorPeticion } = require('./cuaderno');

const COOKIE = 'cuaderno';
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.md': 'text/plain; charset=utf-8', '.pdf': 'application/pdf' };
const PUBLICO = path.join(__dirname, 'public');
const NODE_MODULES = path.join(__dirname, 'node_modules');

const iguales = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
function cookieDe(req) { const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]+)`)); return m ? m[1] : null; }
function autorizado(req, token) { const c = cookieDe(req); return !!c && iguales(c, token); }
// Host y Origin tienen que ser los nuestros: así una web ajena (o un nombre DNS que apunte a 127.0.0.1) no entra.
function hostPropio(req, puerto) { return ['127.0.0.1', 'localhost'].some(h => req.headers.host === `${h}:${puerto}`); }
function origenPropio(req, puerto) {
  const o = req.headers.origin;
  if (o == null) return true;   // navegación normal, sin Origin
  return ['127.0.0.1', 'localhost'].some(h => o === `http://${h}:${puerto}`);
}

function crearServidor({ cuaderno, kit, token = crypto.randomBytes(16).toString('hex'), pty = null }) {
  const servir = (res, abs) => {
    if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) { res.writeHead(404); return res.end('no existe'); }
    res.writeHead(200, { 'content-type': TIPOS[path.extname(abs).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(abs).pipe(res);
  };
  const json = (res, obj, code = 200) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
  const leerCuerpo = req => new Promise((ok, mal) => {
    if (!/^application\/json/.test(req.headers['content-type'] || '')) return mal(Object.assign(new Error('el cuerpo tiene que ser JSON'), { status: 415 }));
    let d = ''; req.on('data', c => { d += c; if (d.length > 2e6) req.destroy(); }); req.on('end', () => { try { ok(d ? JSON.parse(d) : {}); } catch { mal(new ErrorPeticion('JSON inválido')); } });
  });
  const conKit = kit.tipo === 'kit';

  const server = http.createServer(async (req, res) => {
    const puerto = server.address().port;
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    try {
      if (!hostPropio(req, puerto)) { res.writeHead(403); return res.end('host no permitido'); }
      // Entrada con el token de la URL: se guarda en la cookie y se vuelve a / sin él.
      if (p === '/' && url.searchParams.has('t')) {
        if (!iguales(url.searchParams.get('t'), token)) { res.writeHead(403); return res.end('token incorrecto'); }
        res.writeHead(302, { 'set-cookie': `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/`, location: '/' });
        return res.end();
      }
      if (!autorizado(req, token)) {
        res.writeHead(403, { 'content-type': 'text/html; charset=utf-8' });
        return res.end('<!doctype html><meta charset="utf-8"><title>Cuaderno</title><p style="font:16px system-ui;margin:40px">Abre la app desde la dirección que ha impreso la terminal (lleva un código que cambia en cada arranque).</p>');
      }
      if (!origenPropio(req, puerto)) { res.writeHead(403); return res.end('origen no permitido'); }

      if (p === '/') return servir(res, path.join(PUBLICO, 'index.html'));
      if (p.startsWith('/public/')) return servir(res, path.join(PUBLICO, path.normalize(p.slice(8))));
      if (p.startsWith('/assets/')) return servir(res, path.join(NODE_MODULES, path.normalize(p.slice(8))));
      if (p === '/api/info') return json(res, { nombre: path.basename(cuaderno.raiz), kit: kit.tipo, profesor: !!(conKit && kit.comando), portada: cuaderno.portada() });
      if (p === '/api/arbol') return json(res, cuaderno.listar());
      if (p === '/api/buscar') return json(res, cuaderno.buscar(url.searchParams.get('q') || ''));
      if (p === '/api/nota') return json(res, cuaderno.nota(url.searchParams.get('p')));
      if (p === '/api/tareas') return json(res, cuaderno.tareas({ soloPropias: kit.tipo === 'carpeta' }));   // una salida del kit sin motor sigue teniendo sus formatos
      if (p === '/api/comentarios') return json(res, cuaderno.comentarios());
      if (p === '/api/recorrido') return json(res, cuaderno.recorrido());
      if (p.startsWith('/fichero/')) return servir(res, cuaderno.dentro(decodeURIComponent(p.slice(9))));
      if (req.method === 'POST') {
        const b = await leerCuerpo(req);
        if (p === '/api/bloque') { cuaderno.escribirBloque(b.ruta, b.desde, b.hasta, b.texto, b.original); return json(res, { ok: true }); }
        if (p === '/api/casilla') { cuaderno.marcarCasilla(b.ruta, b.linea, !!b.marcada, b.original); return json(res, { ok: true }); }
        if (p === '/api/comentario') { cuaderno.comentar(b.ruta, b.desde, b.hasta, b.texto, b.original); return json(res, { ok: true }); }
        if (p === '/api/tarea') { cuaderno.nuevaTarea(b.texto); return json(res, { ok: true }); }
      }
      res.writeHead(404); res.end('no existe');
    } catch (e) {
      if (e.code === 'ENOENT') return json(res, { error: 'no existe' }, 404);
      json(res, { error: e.message }, e.status || 500);
    }
  });

  // ---------- terminal (pty) por WebSocket, abierta en la raíz del cuaderno. ?profesor=1 lanza el comando del
  // adaptador del kit directamente (nunca se teclea a ciegas en una shell).
  const wssPty = new WebSocketServer({ noServer: true });
  wssPty.on('connection', (ws, req) => {
    if (!pty) { ws.send('\r\n[la terminal no está disponible en este arranque]\r\n'); return ws.close(); }
    const url = new URL(req.url, 'http://x');
    const profesor = url.searchParams.get('profesor') === '1';
    const shell = process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || 'bash');
    let term;
    try {
      if (profesor) {
        if (!conKit || !kit.comando) { ws.send('\r\n[este cuaderno no tiene profesor configurado]\r\n'); return ws.close(); }
        const [cmd, ...args] = kit.comando.split(/\s+/);
        term = pty.spawn(cmd, args, { name: 'xterm-256color', cols: 100, rows: 28, cwd: cuaderno.raiz, env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' } });
      } else {
        term = pty.spawn(shell, [], { name: 'xterm-256color', cols: 100, rows: 28, cwd: cuaderno.raiz, env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' } });
      }
    } catch (e) {
      ws.send(`\r\n[no se ha podido abrir ${profesor ? kit.comando : shell}: ${e.message}]\r\n`); return ws.close();
    }
    term.onData(d => ws.readyState === 1 && ws.send(d));
    term.onExit(() => ws.close());
    ws.on('message', m => { const s = m.toString(); if (s.startsWith('\u0001')) { try { const { cols, rows } = JSON.parse(s.slice(1)); term.resize(cols, rows); } catch { /* ignorado */ } } else term.write(s); });
    ws.on('close', () => term.kill());
  });

  // ---------- recarga en vivo
  const oyentes = new Set();
  const wssCambios = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, sock, head) => {
    const puerto = server.address().port;
    const url = new URL(req.url, 'http://x');
    if (!hostPropio(req, puerto) || !autorizado(req, token) || req.headers.origin == null || !origenPropio(req, puerto)) { sock.write('HTTP/1.1 403 Forbidden\r\n\r\n'); return sock.destroy(); }
    if (url.pathname === '/pty') wssPty.handleUpgrade(req, sock, head, ws => wssPty.emit('connection', ws, req));
    else if (url.pathname === '/cambios') wssCambios.handleUpgrade(req, sock, head, ws => { oyentes.add(ws); ws.on('close', () => oyentes.delete(ws)); });
    else sock.destroy();
  });
  cuaderno.vigilar(f => { for (const ws of oyentes) ws.send(JSON.stringify({ fichero: f })); });
  server.on('close', () => cuaderno.cerrar());

  server.token = token;
  server.url = () => `http://127.0.0.1:${server.address().port}/?t=${token}`;
  return server;
}

module.exports = { crearServidor, COOKIE };
