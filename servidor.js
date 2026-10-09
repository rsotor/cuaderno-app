'use strict';
// El servidor local: la API que usa el navegador, los ficheros estáticos, la terminal por WebSocket y la recarga en
// vivo. Escuchar en 127.0.0.1 no basta para estar a salvo (cualquier web abierta en el navegador puede llamar a
// localhost): un código por usuario viaja en la URL una vez (la pestaña que abre server.js), se queda en una cookie y
// se exige en todo. La dirección que ve el usuario es siempre http://localhost:<puerto>, sin código (Roberto, 2026-10-09).
// Un servidor tiene como mucho un cuaderno abierto; la pantalla de cuadernos lo cambia.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { WebSocketServer } = require('ws');
const { Cuaderno, ErrorPeticion } = require('./cuaderno');
const { detectar } = require('./kit');
const sistema = require('./sistema');
const config = require('./config');
const acciones = require('./guardar');
const formulario = require('./formulario');
const { leerTarjetas } = require('./tarjetas');
const { leerFrontmatter } = require('./markdown');

const COOKIE = 'cuaderno';
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.md': 'text/plain; charset=utf-8', '.pdf': 'application/pdf' , '.txt': 'text/plain; charset=utf-8', '.csv': 'text/plain; charset=utf-8', '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.ogv': 'video/ogg', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.flac': 'audio/flac'};
const PUBLICO = path.join(__dirname, 'public');
const NODE_MODULES = path.join(__dirname, 'node_modules');
// Ruta relativa a la raíz del cuaderno tal como se le pasa a una herramienta del kit: siempre con «/», también en
// Windows (es lo que el kit escribe en sus ficheros y Node la entiende en cualquier sistema).
const relKit = (raiz, abs) => path.relative(raiz, abs).split(path.sep).join('/');

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

// Lo que git sabe de un cuaderno, solo lectura: cuándo se guardó por última vez y si hay cambios sin guardar.
function estadoGit(raiz) {
  const git = args => execFileSync('git', args, { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 4000 }).trim();
  try {
    if (git(['rev-parse', '--is-inside-work-tree']) !== 'true') return null;
    const ultimo = git(['log', '-1', '--format=%cI']) || null;
    const cambios = git(['status', '--porcelain']).split('\n').filter(Boolean).length;
    let sinSubir = null;
    try { sinSubir = Number(git(['rev-list', '--count', '@{upstream}..HEAD'])); } catch { /* sin remoto */ }
    return { ultimo, cambios, sinSubir };
  } catch { return null; }
}

function crearServidor({ cuaderno = null, kit = null, token = crypto.randomBytes(16).toString('hex'), pty = null, lanzar = null, ejecutar = null, plataforma = process.platform, fuentes = [__dirname, PUBLICO] }) {
  const estado = { cuaderno, kit };
  const oyentes = new Set(), terminales = new Set();   // pestañas que escuchan cambios; conexiones de terminal abiertas
  const avisarCambio = f => { for (const ws of oyentes) ws.send(JSON.stringify({ fichero: f })); };
  if (cuaderno) cuaderno.vigilar(avisarCambio);

  const abrir = ruta => {
    if (typeof ruta !== 'string' || !ruta.trim()) throw new ErrorPeticion('falta la carpeta');
    const raiz = path.resolve(ruta.trim().replace(/^~(?=$|[\\/])/, require('node:os').homedir()));
    if (!fs.existsSync(raiz) || !fs.statSync(raiz).isDirectory()) throw new ErrorPeticion('esa carpeta no existe');
    const k = detectar(raiz);
    if (!fs.existsSync(k.base)) throw new ErrorPeticion('esa carpeta no tiene notas');
    if (estado.cuaderno) estado.cuaderno.cerrar();
    for (const ws of terminales) ws.close();   // las terminales eran del cuaderno anterior: al cerrar el ws muere su pty
    estado.kit = k; estado.cuaderno = new Cuaderno(raiz, k.base);
    estado.cuaderno.vigilar(avisarCambio);
    avisarCambio('');   // las demás pestañas abiertas se enteran de que el cuaderno es otro
    config.registrarReciente(raiz, estado.cuaderno.nombre());
    return info();
  };
  // ¿Ha cambiado el código de la app en el disco desde que arrancó? (una actualización con git pull y la app sin
  // reiniciar: el navegador carga la página nueva y el servidor viejo no conoce sus rutas; Roberto, 2026-10-09).
  // La firma es la fecha más reciente de los .js y la página de la app; el navegador lo dice con un aviso fijo.
  const firma = () => Math.max(0, ...fuentes.flatMap(d => { try { return fs.readdirSync(d).filter(n => /\.(js|html|css)$/.test(n)).map(n => fs.statSync(path.join(d, n)).mtimeMs); } catch { return []; } }));
  const firmaAlArrancar = firma();
  const info = () => {
    const c = config.leer();
    const base = { configuracion: config.apariencia(c), cuaderno: null, desactualizada: firma() > firmaAlArrancar };
    if (!estado.cuaderno) return base;
    const { cuaderno: cu, kit: k } = estado;
    const comando = k.tipo === 'kit' ? k.comando : (k.tipo === 'carpeta' ? c.comando_agente : null);
    return { ...base, cuaderno: { nombre: cu.nombre(), ruta: cu.raiz, base: cu.base, sep: path.sep, kit: k.tipo, profesor: !!comando, portada: cu.portada(), git: estadoGit(cu.raiz) } };
  };
  // Una ruta del índice está oculta si lo está ella o una carpeta que la contiene (solo en la app; ver config.ocultar).
  const oculta = r => { if (!estado.cuaderno) return false; const l = config.ocultas(estado.cuaderno.raiz); return l.some(o => r === o || r.startsWith(o + '/')); };
  const comandoProfesor = () => { const k = estado.kit; if (!k) return null; return k.tipo === 'kit' ? k.comando : (k.tipo === 'carpeta' ? config.leer().comando_agente || null : null); };
  const cuadernos = () => config.leer().recientes.map(r => ({ ...r, existe: fs.existsSync(r.ruta), abiertoAhora: !!estado.cuaderno && estado.cuaderno.raiz === r.ruta, git: fs.existsSync(r.ruta) ? estadoGit(r.ruta) : null }));
  const conCuaderno = () => { if (!estado.cuaderno) throw new ErrorPeticion('no hay ningún cuaderno abierto'); return estado.cuaderno; };
  // Guardar, traer y deshacer de uno en uno: dos a la vez sobre el mismo repo se pisarían.
  let ocupado = false;
  const accion = fn => { if (ocupado) throw Object.assign(new Error('hay otra operación en marcha; espera a que termine'), { status: 409 }); ocupado = true; try { return fn(conCuaderno().raiz, estado.kit); } finally { ocupado = false; } };

  const servir = (res, abs, cabeceras = {}, req = null) => {
    if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) { res.writeHead(404); return res.end('no existe'); }
    const tam = fs.statSync(abs).size, comunes = { 'content-type': TIPOS[path.extname(abs).toLowerCase()] || 'application/octet-stream', 'x-content-type-options': 'nosniff', 'accept-ranges': 'bytes', ...cabeceras };
    // Un vídeo o un audio se piden por trozos (Range): Safari no los reproduce sin ellos, y así se puede saltar adelante.
    const r = /^bytes=(\d*)-(\d*)$/.exec((req && req.headers.range) || '');
    if (r && (r[1] || r[2])) {
      const ini = r[1] ? Number(r[1]) : Math.max(0, tam - Number(r[2])), fin = r[1] && r[2] ? Math.min(Number(r[2]), tam - 1) : tam - 1;
      if (ini > fin || ini >= tam) { res.writeHead(416, { 'content-range': `bytes */${tam}` }); return res.end(); }
      res.writeHead(206, { ...comunes, 'content-range': `bytes ${ini}-${fin}/${tam}`, 'content-length': fin - ini + 1 });
      return fs.createReadStream(abs, { start: ini, end: fin }).pipe(res);
    }
    res.writeHead(200, { ...comunes, 'content-length': tam });
    fs.createReadStream(abs).pipe(res);
  };
  // Un fichero del cuaderno: dentro de la carpeta también por su ruta real (un enlace simbólico no saca nada de ella).
  // Una página .html o un .svg corre aislada (origen opaco: sin la cookie ni la API de la app), también si alguien la
  // abre en una pestaña y no en el iframe de la app.
  const servirDelCuaderno = (res, rel, req) => {
    const cu = conCuaderno(), abs = cu.dentro(rel);
    let real, base;
    try { real = fs.realpathSync(abs); base = fs.realpathSync(cu.base); } catch { res.writeHead(404); return res.end('no existe'); }
    if (real !== base && !real.startsWith(base + path.sep)) throw new ErrorPeticion('ruta fuera del cuaderno');
    const activo = /\.(html?|svg)$/i.test(abs);
    return servir(res, real, activo ? { 'content-security-policy': 'sandbox allow-scripts allow-forms allow-modals' } : {}, req);
  };
  const json = (res, obj, code = 200) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
  const leerCuerpo = req => new Promise((ok, mal) => {
    if (!/^application\/json/.test(req.headers['content-type'] || '')) return mal(Object.assign(new Error('el cuerpo tiene que ser JSON'), { status: 415 }));
    let d = ''; req.on('data', c => { d += c; if (d.length > 2e6) req.destroy(); }); req.on('end', () => { try { ok(d ? JSON.parse(d) : {}); } catch { mal(new ErrorPeticion('JSON inválido')); } });
  });

  const server = http.createServer(async (req, res) => {
    const puerto = server.address().port;
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    try {
      if (!hostPropio(req, puerto)) { res.writeHead(403); return res.end('host no permitido'); }
      // Una sola dirección: la página entra siempre por localhost (la cookie es de un nombre; con dos, habría que entrar dos veces).
      if (p === '/' && req.headers.host === `127.0.0.1:${puerto}`) { res.writeHead(302, { location: `http://localhost:${puerto}${req.url}` }); return res.end(); }
      // Entrada con el código de la URL: se guarda en la cookie y se vuelve a / sin él.
      if (p === '/' && url.searchParams.has('t')) {
        if (!iguales(url.searchParams.get('t'), token)) { res.writeHead(403); return res.end('código incorrecto'); }
        // Un año: el código no cambia entre arranques, así que la cookie vale también tras reiniciar el navegador.
        res.writeHead(302, { 'set-cookie': `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000`, location: '/' });
        return res.end();
      }
      if (!autorizado(req, token)) {
        res.writeHead(403, { 'content-type': 'text/html; charset=utf-8' });
        return res.end('<!doctype html><meta charset="utf-8"><title>Cuaderno</title><p style="font:16px system-ui;margin:40px;max-width:36em">Este navegador aún no ha entrado en la app. Arráncala desde la terminal (<code>node server.js</code>): abre esta pestaña ya dentro, y desde entonces basta con esta dirección.</p>');
      }
      if (!origenPropio(req, puerto)) { res.writeHead(403); return res.end('origen no permitido'); }

      if (p === '/') return servir(res, path.join(PUBLICO, 'index.html'));
      if (p.startsWith('/public/')) return servir(res, path.join(PUBLICO, path.normalize(p.slice(8))));
      if (p.startsWith('/assets/')) return servir(res, path.join(NODE_MODULES, path.normalize(p.slice(8))));
      if (p === '/api/info') return json(res, info());
      if (p === '/api/cuadernos') return json(res, cuadernos());
      if (p === '/api/arbol') return json(res, conCuaderno().arbol().filter(r => !oculta(r)));
      if (p === '/api/ocultas') return json(res, config.ocultas(conCuaderno().raiz));
      if (p === '/api/titulos') return json(res, conCuaderno().titulos());
      if (p === '/api/buscar') { const r = conCuaderno().buscar(url.searchParams.get('q') || ''); return json(res, { ficheros: r.ficheros.filter(f => !oculta(f)), lineas: r.lineas.filter(l => !oculta(l.ruta)) }); }
      if (p === '/api/nota') return json(res, conCuaderno().nota(url.searchParams.get('p')));
      if (p === '/api/tareas') return json(res, conCuaderno().tareas({ soloPropias: estado.kit.tipo === 'carpeta' }));   // una salida del kit sin motor sigue teniendo sus formatos
      if (p === '/api/tareas-de') return json(res, conCuaderno().tareasDe(url.searchParams.get('p'), { soloPropias: estado.kit.tipo === 'carpeta' }));   // «Tareas que la mencionan» al final de una nota
      if (p === '/api/comentarios') return json(res, conCuaderno().comentarios());
      if (p === '/api/recorrido') return json(res, conCuaderno().recorrido());
      if (p === '/api/examen') {
        const cu = conCuaderno(), rel = url.searchParams.get('p'), texto = cu.leer(rel);
        const { datos } = leerFrontmatter(texto);
        const ex = formulario.leerExamen(texto.split(/\r?\n/).slice(leerFrontmatter(texto).lineas).join('\n'));
        const desplaza = leerFrontmatter(texto).lineas;
        const v = formulario.validable(cu.raiz, estado.kit, relKit(cu.raiz, cu.dentro(rel)), datos);
        return json(res, { ruta: rel, frontmatter: datos, validable: v.ok, motivo: v.motivo, cabecera: cu.md.render(ex.cabecera, {}),
          preguntas: ex.preguntas.map(q => ({ numero: q.numero, unica: q.unica, enunciado: cu.md.render(q.enunciado.replace(/^(\d+\.\s|\*\*\d+\.\*\*)\s*/, ''), {}), opciones: q.opciones.map(o => ({ letra: o.letra, marcada: o.marcada, linea: o.linea + desplaza, texto: cu.md.renderInline(o.texto, {}) })) })),
          resto: ex.resto ? cu.md.render(ex.resto, {}) : '' });
      }
      if (p === '/api/flashcards') {
        const cu = conCuaderno(), rel = url.searchParams.get('p'), texto = cu.leer(rel);
        const t = leerTarjetas(texto);
        const titulo = (texto.match(/^#\s+(.+)$/m) || [])[1] || rel;
        return json(res, { ruta: rel, titulo, tarjetas: t.map(x => ({ ...x, pregunta: cu.md.renderInline(x.pregunta, {}), respuesta: cu.md.render(x.respuesta, {}) })) });
      }
      if (p === '/api/guardar/propuesta') { const raiz = conCuaderno().raiz; return json(res, { mensaje: acciones.proponerMensaje(raiz), cambios: acciones.cambios(raiz), repo: acciones.esRepo(raiz), kit: estado.kit.tipo }); }
      if (p.startsWith('/fichero/')) return servirDelCuaderno(res, decodeURIComponent(p.slice(9)), req);
      if (req.method === 'POST') {
        const b = await leerCuerpo(req);
        if (p === '/api/abrir') return json(res, abrir(b.ruta));
        if (p === '/api/olvidar') { config.olvidarReciente(String(b.ruta || '')); return json(res, { ok: true }); }
        if (p === '/api/configuracion') return json(res, config.apariencia(config.ajustar(b)));
        // Ocultar del árbol y del buscador una carpeta o un fichero, solo en la app (o volver a mostrarlo).
        if (p === '/api/ocultar') {
          const cu = conCuaderno(), ruta = String(b.ruta || '').replace(/\/+$/, '');
          cu.dentro(ruta);
          return json(res, config.ocultar(cu.raiz, ruta, b.ocultar !== false));
        }
        // Mostrar una carpeta o un fichero del cuaderno en el gestor de archivos del sistema (Finder, Explorador…).
        if (p === '/api/mostrar-en-carpeta') {
          const cu = conCuaderno(), abs = b.ruta ? cu.dentro(String(b.ruta)) : cu.base;
          if (!fs.existsSync(abs)) throw new ErrorPeticion('ese fichero ya no está');
          sistema.mostrar({ abs, carpeta: fs.statSync(abs).isDirectory(), plataforma, ...(lanzar ? { lanzar } : {}) });
          return json(res, { ok: true });
        }
        // Borrar un fichero del cuaderno es mandarlo a la papelera del sistema; una carpeta, no.
        if (p === '/api/papelera') {
          const cu = conCuaderno(), abs = cu.dentro(String(b.ruta || ''));
          if (!fs.existsSync(abs)) throw new ErrorPeticion('ese fichero ya no está');
          if (fs.lstatSync(abs).isDirectory()) throw new ErrorPeticion('solo se mandan ficheros a la papelera, no carpetas');
          try { sistema.aPapelera({ abs, plataforma, ...(ejecutar ? { ejecutar } : {}) }); } catch (e) { throw new ErrorPeticion(e.message); }
          cu.invalidar();
          return json(res, { ok: true });
        }
        if (p === '/api/guardar') return json(res, accion((raiz, k) => acciones.guardar(raiz, k, b.mensaje)));
        if (p === '/api/traer') return json(res, accion((raiz, k) => acciones.traer(raiz, k)));
        if (p === '/api/deshacer') return json(res, accion((raiz, k) => acciones.deshacer(raiz, k, { ver: b.ver !== false })));
        const cu = conCuaderno();
        if (p === '/api/examen/validar') {
          const abs = cu.dentro(b.ruta), texto = fs.readFileSync(abs, 'utf8');
          const { lineas } = leerFrontmatter(texto);
          // marcar() trabaja sobre el cuerpo (sin frontmatter) para que las líneas coincidan con las del formulario
          const partes = texto.split(/(\r?\n)/);   // conserva los finales de línea
          const cabeza = partes.slice(0, lineas * 2).join(''), cuerpo = partes.slice(lineas * 2).join('');
          fs.writeFileSync(abs, cabeza + formulario.marcar(cuerpo, b.respuestas || {})); cu.invalidar();
          const v = formulario.validable(cu.raiz, estado.kit, relKit(cu.raiz, abs), leerFrontmatter(texto).datos);
          if (!v.ok) return json(res, { codigo: 0, corregido: false, salida: `Respuestas guardadas en la nota. ${v.motivo}` });
          const r = accion(raiz => formulario.corregir(raiz, relKit(raiz, abs)));
          cu.invalidar();
          return json(res, { ...r, corregido: r.codigo === 0 });
        }
        if (p === '/api/bloque') { cu.escribirBloque(b.ruta, b.desde, b.hasta, b.texto, b.original); return json(res, { ok: true }); }
        if (p === '/api/nota/escribir') { cu.escribirNota(b.ruta, b.texto, b.original); return json(res, { ok: true }); }
        if (p === '/api/render') return json(res, { html: cu.renderizar(b.texto, b.ruta) });
        if (p === '/api/casilla') { cu.marcarCasilla(b.ruta, b.linea, !!b.marcada, b.original); return json(res, { ok: true }); }
        if (p === '/api/comentario') { cu.comentar(b.ruta, b.desde, b.hasta, b.texto, b.original); return json(res, { ok: true }); }
        if (p === '/api/tarea') { cu.nuevaTarea(b.texto); return json(res, { ok: true }); }
        if (p === '/api/nota/nueva') return json(res, { ruta: cu.nuevaNota(b.titulo, b.carpeta) });
      }
      res.writeHead(404); res.end('no existe');
    } catch (e) {
      if (e.code === 'ENOENT') return json(res, { error: 'no existe' }, 404);
      json(res, { error: e.message }, e.status || 500);
    }
  });

  // ---------- terminal (pty) por WebSocket, abierta en la raíz del cuaderno. ?profesor=1 lanza el comando del
  // profesor directamente (el del adaptador del kit, o el configurado por el usuario sin kit): nunca se teclea a ciegas.
  const wssPty = new WebSocketServer({ noServer: true });
  wssPty.on('connection', (ws, req) => {
    if (!pty) { ws.send('\r\n[la terminal no está disponible en este arranque]\r\n'); return ws.close(); }
    if (!estado.cuaderno) { ws.send('\r\n[no hay ningún cuaderno abierto]\r\n'); return ws.close(); }
    const url = new URL(req.url, 'http://x');
    const profesor = url.searchParams.get('profesor') === '1';
    const shell = process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || 'bash');
    const comando = comandoProfesor();
    const opciones = { name: 'xterm-256color', cols: 100, rows: 28, cwd: estado.cuaderno.raiz, env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' } };
    let term;
    try {
      if (profesor) {
        if (!comando) { ws.send('\r\n[este cuaderno no tiene profesor configurado]\r\n'); return ws.close(); }
        const [cmd, ...args] = comando.split(/\s+/);
        term = pty.spawn(cmd, args, opciones);
      } else term = pty.spawn(shell, [], opciones);
    } catch (e) {
      ws.send(`\r\n[no se ha podido abrir ${profesor ? comando : shell}: ${e.message}]\r\n`); return ws.close();
    }
    terminales.add(ws);
    term.onData(d => ws.readyState === 1 && ws.send(d));
    term.onExit(() => ws.close());
    ws.on('message', m => { const s = m.toString(); if (s.startsWith('\u0001')) { try { const { cols, rows } = JSON.parse(s.slice(1)); term.resize(cols, rows); } catch { /* ignorado */ } } else term.write(s); });
    ws.on('close', () => { terminales.delete(ws); term.kill(); });
  });

  // ---------- recarga en vivo
  const wssCambios = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, sock, head) => {
    const puerto = server.address().port;
    const url = new URL(req.url, 'http://x');
    if (!hostPropio(req, puerto) || !autorizado(req, token) || req.headers.origin == null || !origenPropio(req, puerto)) { sock.write('HTTP/1.1 403 Forbidden\r\n\r\n'); return sock.destroy(); }
    if (url.pathname === '/pty') wssPty.handleUpgrade(req, sock, head, ws => wssPty.emit('connection', ws, req));
    else if (url.pathname === '/cambios') wssCambios.handleUpgrade(req, sock, head, ws => { oyentes.add(ws); ws.on('close', () => oyentes.delete(ws)); });
    else sock.destroy();
  });
  server.on('close', () => estado.cuaderno && estado.cuaderno.cerrar());

  server.token = token;
  server.estado = estado;
  server.abrir = abrir;
  server.url = () => `http://localhost:${server.address().port}/`;   // la que se enseña y se guarda en marcadores
  server.urlEntrada = () => `${server.url()}?t=${token}`;   // la que abre server.js: fija la cookie y vuelve a la de arriba
  return server;
}

module.exports = { crearServidor, estadoGit, COOKIE };
