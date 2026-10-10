'use strict';
// Abrir una carpeta en la app de escritorio (electron/carpeta.js) con un Electron falso: la carpeta de argv (saltando la
// app y los flags; sin carpeta, nada), el remitente del canal IPC (solo nuestra pantalla), CUADERNO_DIALOGO_PRUEBA con
// ruta y vacía (cancelar), el diálogo de verdad, open-file antes y después de arrancar, la segunda instancia con y sin
// carpeta, y la petición POST /api/abrir al hijo con la cookie del código. Y que el preload solo haga require('electron').
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { crearAbridor, carpetaDeArgv, remitenteValido, abrirEnServidor, pedir, CANAL, DIALOGO } = require('../electron/carpeta');

const tic = () => new Promise(r => setImmediate(r));
const CARPETAS = ['/cuadernos/a', '/cuadernos/b', '/cuadernos/c'];
const existe = r => CARPETAS.includes(r);

// Un Electron de mentira con lo que carpeta.js usa: app (on, isPackaged), ipcMain.handle y dialog.showOpenDialog.
function montar({ argv = ['/apps/electron', '.'], env = {}, puerto = null, token = 't0k', dialogo = { canceled: true, filePaths: [] }, respuesta = { status: 200, cuerpo: '{"cuaderno":{}}' }, empaquetada } = {}) {
  const eventos = new EventEmitter(), canales = {}, lineas = [], peticiones = [], dialogos = [], pasos = [];
  const ventana = { minimizada: false, isMinimized() { return this.minimizada; }, restore() { this.minimizada = false; pasos.push('restore'); }, focus() { pasos.push('focus'); } };
  const electron = {
    app: { on: (e, f) => eventos.on(e, f), isPackaged: !!empaquetada },
    ipcMain: { handle: (c, f) => { canales[c] = f; } },
    dialog: { async showOpenDialog(v, o) { dialogos.push({ ventana: v, opciones: o }); return dialogo; } },
  };
  const estado = { ventana, puerto, token };
  const peticion = async (o, cuerpo) => { peticiones.push({ ...o, cuerpo }); if (respuesta instanceof Error) throw respuesta; return respuesta; };
  const abridor = crearAbridor({ electron, estado, anotar: l => lineas.push(l), existe, env, argv, cwd: '/trabajo', empaquetada, peticion, recargar: () => { pasos.push('recargar'); return true; } });
  return { abridor, estado, eventos, canales, lineas, peticiones, dialogos, pasos, ventana };
}
const invocar = (m, origen) => m.canales[CANAL]({ senderFrame: origen == null ? null : { origin: origen, url: `${origen}/` } });

test('carpetaDeArgv: el primer argumento que es una carpeta, saltando el ejecutable, la ruta de la app sin empaquetar (y «.») y los flags; relativas contra cwd; sin carpeta, null', () => {
  const o = { existe, cwd: '/cuadernos' };
  assert.equal(carpetaDeArgv(['/apps/electron', '.', '/cuadernos/a'], o), '/cuadernos/a');
  assert.equal(carpetaDeArgv(['/apps/electron', '--inspect=0', '.', '--no-sandbox', '/cuadernos/b', '/cuadernos/a'], o), '/cuadernos/b', 'los flags no cuentan y la primera gana');
  assert.equal(carpetaDeArgv(['/apps/electron', '.', 'a'], o), '/cuadernos/a', 'relativa al cwd');
  assert.equal(carpetaDeArgv(['/apps/electron', '.'], o), null, 'solo la app: nada');
  assert.equal(carpetaDeArgv(['/apps/electron', '.', '/no/existe', '--x'], o), null);
  assert.equal(carpetaDeArgv(['/apps/electron', '.', '/cuadernos/a/nota.md'], o), null, 'un fichero no es una carpeta');
  assert.equal(carpetaDeArgv(['/apps/Cuaderno', '/cuadernos/c'], { ...o, empaquetada: true }), '/cuadernos/c', 'empaquetada: sin ruta de la app que saltar');
  assert.equal(carpetaDeArgv(['/apps/Cuaderno', '-psn_0_123', 'c'], { ...o, empaquetada: true }), '/cuadernos/c');
  assert.equal(carpetaDeArgv(['/apps/Cuaderno'], { ...o, empaquetada: true }), null);
  assert.equal(carpetaDeArgv(undefined, o), null);
  assert.equal(carpetaDeArgv(['/apps/electron', '.', '/cuadernos/a'], { cwd: '/', existe: () => { throw new Error('EACCES'); } }), null, 'si no se puede mirar, no se abre');
});

test('remitenteValido: el origen del frame tiene que ser exactamente http://localhost:<puerto>; «null» (un .html del cuaderno con CSP sandbox, origen opaco) se rechaza aunque su URL sea nuestra; sin puerto aún, nada vale', () => {
  assert.equal(remitenteValido('http://localhost:7331', 7331), true);
  assert.equal(remitenteValido('null', 7331), false, 'el origen opaco del iframe con sandbox');
  assert.equal(remitenteValido('http://localhost:7331/', 7331), false, 'es un origen, no una URL');
  assert.equal(remitenteValido('http://localhost:7331/fichero/x.html', 7331), false);
  assert.equal(remitenteValido('http://localhost:7332', 7331), false);
  assert.equal(remitenteValido('http://localhost:73310', 7331), false, 'el puerto es entero, no un prefijo');
  assert.equal(remitenteValido('http://127.0.0.1:7331', 7331), false, 'la ventana entra por localhost');
  assert.equal(remitenteValido('https://localhost:7331', 7331), false);
  assert.equal(remitenteValido('http://localhost:7331', null), false);
  assert.equal(remitenteValido(null, 7331), false); assert.equal(remitenteValido(undefined, 7331), false);
  assert.equal(remitenteValido('about:blank', 7331), false);
});

test('el canal elegir-carpeta: con un remitente que no es la pantalla (otro puerto, el origen opaco «null» de un .html del cuaderno, sin frame) rechaza y lo anota; nada se abre', async () => {
  const m = montar({ puerto: 7331 });
  await assert.rejects(invocar(m, 'http://localhost:9999'), /remitente no permitido/);
  await assert.rejects(m.canales[CANAL]({ senderFrame: { origin: 'null', url: 'http://localhost:7331/fichero/material/pagina.html' } }), /remitente no permitido/);
  await assert.rejects(invocar(m, null), /remitente no permitido/);
  await assert.rejects(m.canales[CANAL]({}), /remitente no permitido/);
  assert.equal(m.dialogos.length, 0);
  assert.ok(m.lineas.includes(`petición de ${CANAL} de un remitente que no es la pantalla, rechazada: http://localhost:9999`));
  assert.ok(m.lineas.includes(`petición de ${CANAL} de un remitente que no es la pantalla, rechazada: null`));
  assert.ok(m.lineas.includes(`petición de ${CANAL} de un remitente que no es la pantalla, rechazada: (sin frame)`));
});

test('el canal elegir-carpeta: CUADERNO_DIALOGO_PRUEBA con ruta devuelve la ruta sin diálogo; vacía es cancelar (null); y queda anotado', async () => {
  const con = montar({ puerto: 7331, env: { CUADERNO_DIALOGO_PRUEBA: '/cuadernos/b' } });
  assert.equal(await invocar(con, 'http://localhost:7331'), '/cuadernos/b');
  assert.equal(con.dialogos.length, 0, 'sin diálogo');
  assert.ok(con.lineas.includes('diálogo de carpeta sustituido (CUADERNO_DIALOGO_PRUEBA): /cuadernos/b'));
  const vacia = montar({ puerto: 7331, env: { CUADERNO_DIALOGO_PRUEBA: '' } });
  assert.equal(await invocar(vacia, 'http://localhost:7331'), null);
  assert.equal(vacia.dialogos.length, 0);
  assert.ok(vacia.lineas.includes('diálogo de carpeta sustituido (CUADERNO_DIALOGO_PRUEBA): cancelado'));
});

test('el canal elegir-carpeta sin la variable: abre el diálogo del sistema sobre la ventana, solo carpetas; devuelve la elegida, o null si se cancela', async () => {
  const elegida = montar({ puerto: 7331, dialogo: { canceled: false, filePaths: ['/cuadernos/c'] } });
  assert.equal(await invocar(elegida, 'http://localhost:7331'), '/cuadernos/c');
  assert.equal(elegida.dialogos.length, 1);
  assert.equal(elegida.dialogos[0].ventana, elegida.ventana);
  assert.deepEqual(elegida.dialogos[0].opciones, DIALOGO);
  assert.ok(DIALOGO.properties.includes('openDirectory') && !DIALOGO.properties.includes('openFile'));
  const cancelada = montar({ puerto: 7331 });
  assert.equal(await invocar(cancelada, 'http://localhost:7331'), null);
  const rara = montar({ puerto: 7331, dialogo: { canceled: false, filePaths: [] } });
  assert.equal(await invocar(rara, 'http://localhost:7331'), null);
});

test('la carpeta de argv queda pendiente y tomar() la da una vez (va al hijo en CUADERNO_CARPETA); sin carpeta, pendiente es null', () => {
  const m = montar({ argv: ['/apps/electron', '.', '--flag', '/cuadernos/a'] });
  assert.equal(m.abridor.pendiente, '/cuadernos/a');
  assert.ok(m.lineas.includes('carpeta en los argumentos: /cuadernos/a'));
  assert.equal(m.abridor.tomar(), '/cuadernos/a');
  assert.equal(m.abridor.tomar(), null, 'solo una vez');
  const sin = montar({ argv: ['/apps/electron', '.', '--flag'] });
  assert.equal(sin.abridor.pendiente, null);
  assert.equal(sin.lineas.length, 0);
});

test('open-file antes de arrancar (sin puerto): la carpeta queda pendiente, con preventDefault, y despachar() la abre cuando hay puerto', async () => {
  const m = montar();
  let prevenido = false;
  m.eventos.emit('open-file', { preventDefault() { prevenido = true; } }, '/cuadernos/b');
  await tic();
  assert.equal(prevenido, true);
  assert.equal(m.abridor.pendiente, '/cuadernos/b');
  assert.deepEqual(m.peticiones, [], 'sin servidor no hay a quién pedir');
  assert.ok(m.lineas.includes('carpeta por open-file antes de que arranque el servidor: /cuadernos/b (se abrirá al arrancar)'));
  assert.deepEqual(m.pasos, ['focus'], 'la ventana (ya existe en el falso) pasa al frente');
  // Si app.js se la lleva al hijo con tomar(), despachar() no hace nada; si no, al llegar el puerto la abre.
  m.estado.puerto = 7331;
  assert.equal(await m.abridor.despachar(), true);
  assert.equal(m.peticiones.length, 1);
  assert.deepEqual(JSON.parse(m.peticiones[0].cuerpo), { ruta: '/cuadernos/b' });
  assert.equal(m.abridor.pendiente, null);
  assert.equal(await m.abridor.despachar(), false, 'ya no hay nada pendiente');
  assert.equal(m.peticiones.length, 1);
});

test('open-file con la app arrancada: POST /api/abrir al hijo (localhost:<puerto>, cookie del código, JSON) y recarga la ventana; si el servidor dice que no, se anota y no se recarga; si no contesta, igual', async () => {
  const m = montar({ puerto: 7331, token: 'c0ffee' });
  m.ventana.minimizada = true;
  m.eventos.emit('open-file', { preventDefault() {} }, '/cuadernos/a');
  await tic(); await tic();
  assert.equal(m.peticiones.length, 1);
  const p = m.peticiones[0];
  assert.equal(p.host, 'localhost'); assert.equal(p.port, 7331); assert.equal(p.method, 'POST'); assert.equal(p.path, '/api/abrir');
  assert.equal(p.headers.cookie, 'cuaderno=c0ffee');
  assert.equal(p.headers['content-type'], 'application/json');
  assert.equal(p.headers['content-length'], Buffer.byteLength(p.cuerpo));
  assert.equal('origin' in p.headers, false, 'sin Origin: navegación propia para el servidor');
  assert.deepEqual(JSON.parse(p.cuerpo), { ruta: '/cuadernos/a' });
  assert.deepEqual(m.pasos, ['restore', 'focus', 'recargar']);
  assert.ok(m.lineas.includes('carpeta por open-file: /cuadernos/a'));
  assert.ok(m.lineas.includes('cuaderno abierto en el servidor: /cuadernos/a; se recarga la ventana'));
  const no = montar({ puerto: 7331, respuesta: { status: 400, cuerpo: '{"error":"esa carpeta no tiene notas"}' } });
  assert.equal(await no.abridor.llegada('/cuadernos/b', 'open-file'), false);
  assert.ok(no.lineas.includes('no se ha podido abrir /cuadernos/b: esa carpeta no tiene notas'));
  assert.deepEqual(no.pasos, []);
  const roto = montar({ puerto: 7331, respuesta: { status: 500, cuerpo: 'no es json' } });
  assert.equal(await roto.abridor.llegada('/cuadernos/b', 'open-file'), false);
  assert.ok(roto.lineas.includes('no se ha podido abrir /cuadernos/b: respuesta 500'));
  const caido = montar({ puerto: 7331, respuesta: Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }) });
  assert.equal(await caido.abridor.llegada('/cuadernos/b', 'open-file'), false);
  assert.ok(caido.lineas.includes('no se ha podido abrir /cuadernos/b: connect ECONNREFUSED'));
});

test('open-file con algo que no es una carpeta (un fichero, una ruta que no existe) se ignora y se anota', async () => {
  const m = montar({ puerto: 7331 });
  m.eventos.emit('open-file', { preventDefault() {} }, '/cuadernos/a/nota.md');
  m.eventos.emit('open-file', { preventDefault() {} }, '/no/existe');
  await tic();
  assert.deepEqual(m.peticiones, []);
  assert.equal(m.abridor.pendiente, null);
  assert.ok(m.lineas.includes('open-file con algo que no es una carpeta, se ignora: /cuadernos/a/nota.md'));
  assert.deepEqual(m.pasos, []);
});

test('second-instance: con carpeta en los argumentos de la segunda (relativa a su directorio) la abre en el servidor; sin carpeta, no hace nada', async () => {
  const m = montar({ puerto: 7331 });
  m.eventos.emit('second-instance', {}, ['/apps/electron', '.', 'c'], '/cuadernos');
  await tic(); await tic();
  assert.equal(m.peticiones.length, 1);
  assert.deepEqual(JSON.parse(m.peticiones[0].cuerpo), { ruta: '/cuadernos/c' });
  assert.ok(m.lineas.includes('carpeta por segunda instancia: /cuadernos/c'));
  m.eventos.emit('second-instance', {}, ['/apps/electron', '.'], '/cuadernos');
  m.eventos.emit('second-instance', {}, ['/apps/electron', '.', '--allow-file-access-from-files'], undefined);   // sin directorio: el nuestro
  await tic(); await tic();
  assert.equal(m.peticiones.length, 1);
  // Empaquetada, la segunda no lleva «.»: su primer argumento ya es la carpeta.
  const emp = montar({ puerto: 7331, empaquetada: true });
  m.eventos.removeAllListeners();
  emp.eventos.emit('second-instance', {}, ['/apps/Cuaderno', '/cuadernos/a'], '/');
  await tic(); await tic();
  assert.deepEqual(JSON.parse(emp.peticiones[0].cuerpo), { ruta: '/cuadernos/a' });
  // Antes de arrancar, queda pendiente como open-file.
  const antes = montar();
  antes.eventos.emit('second-instance', {}, ['/apps/electron', '.', '/cuadernos/b'], '/');
  await tic();
  assert.equal(antes.abridor.pendiente, '/cuadernos/b');
});

test('abrirEnServidor con un servidor de verdad: la petición llega con la cookie, el servidor contesta y una respuesta de error se vuelve excepción', async () => {
  const recibidas = [];
  const servidor = http.createServer((req, res) => {
    let cuerpo = ''; req.on('data', c => { cuerpo += c; }); req.on('end', () => {
      recibidas.push({ metodo: req.method, url: req.url, host: req.headers.host, cookie: req.headers.cookie, cuerpo });
      const ruta = JSON.parse(cuerpo).ruta;
      res.setHeader('content-type', 'application/json');
      if (ruta === '/mala') { res.writeHead(400); return res.end(JSON.stringify({ error: 'esa carpeta no existe' })); }
      res.end(JSON.stringify({ cuaderno: { ruta } }));
    });
  });
  await new Promise(r => servidor.listen(0, '127.0.0.1', r));
  const puerto = servidor.address().port;
  try {
    const r = await abrirEnServidor({ puerto, token: 'abc', carpeta: '/cuadernos/a' });
    assert.deepEqual(r, { cuaderno: { ruta: '/cuadernos/a' } });
    assert.deepEqual(recibidas[0], { metodo: 'POST', url: '/api/abrir', host: `localhost:${puerto}`, cookie: 'cuaderno=abc', cuerpo: '{"ruta":"/cuadernos/a"}' });
    await assert.rejects(abrirEnServidor({ puerto, token: 'abc', carpeta: '/mala' }), /esa carpeta no existe/);
  } finally { servidor.close(); }
  // Sin nadie escuchando, `pedir` rechaza con el error de conexión.
  await assert.rejects(pedir({ host: '127.0.0.1', port: puerto, method: 'POST', path: '/api/abrir' }, '{}'), /ECONNREFUSED/);
});

test('el preload corre en el sandbox: solo require de electron, expone cuadernoApp con elegirCarpeta, alAccion y version por contextBridge, y lee la versión de --cuaderno-version', () => {
  const fuente = fs.readFileSync(path.join(__dirname, '..', 'electron', 'preload.js'), 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');   // el código, sin los comentarios
  const requires = [...fuente.matchAll(/require\(([^)]*)\)/g)].map(m => m[1]);
  assert.deepEqual(requires, ["'electron'"], 'en el sandbox no hay más módulos que electron');
  assert.match(fuente, /contextBridge\.exposeInMainWorld\('cuadernoApp'/);
  for (const clave of ['elegirCarpeta', 'alAccion', 'version']) assert.match(fuente, new RegExp(`^\\s*${clave}[,:]`, 'm'), `expone ${clave}`);
  assert.match(fuente, /ipcRenderer\.invoke\('elegir-carpeta'\)/);
  assert.match(fuente, /ipcRenderer\.on\('accion'/);
  assert.match(fuente, /--cuaderno-version=/);
  assert.doesNotMatch(fuente, /\bprocess\.env\b|\bfs\b|child_process/, 'nada del sistema');
});
