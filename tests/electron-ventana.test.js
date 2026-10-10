'use strict';
// Lo del navegador que en la app cambia (electron/ventana.js) con un Electron falso: enlaces fuera (solo http, https y
// mailto van al navegador del sistema; lo propio navega; lo demás se anota y nada), cerrar con cambios (el diálogo y sus
// dos ramas, también con CUADERNO_SIN_DIALOGO), permisos de la sesión (solo el portapapeles) y el tema (themeSource, el
// fondo con `auto`, y que se reaplica cuando cambia config.json).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const ventana = require('../electron/ventana');

const tic = () => new Promise(r => setImmediate(r));
const registroFalso = () => { const lineas = []; return { lineas, anotar: l => lineas.push(l) }; };
// Una ventana de mentira: webContents con setWindowOpenHandler y eventos; setBackgroundColor anota los colores.
function ventanaFalsa() {
  const v = { fondos: [], webContents: Object.assign(new EventEmitter(), { manejador: null, setWindowOpenHandler(f) { this.manejador = f; } }), setBackgroundColor(c) { v.fondos.push(c); } };
  return v;
}
// Un Electron de mentira para ventana.js: shell que anota (o falla), dialog con respuesta fija, nativeTheme, session, app.
function electronFalso({ respuesta = 1, fallaShell = false, sistemaOscuro = false } = {}) {
  const abiertos = [], dialogos = [], sesiones = {}, eventosApp = new EventEmitter();
  return {
    abiertos, dialogos, sesiones, eventosApp,
    electron: {
      shell: { openExternal: async u => { if (fallaShell) throw new Error('sin navegador'); abiertos.push(u); } },
      dialog: { showMessageBoxSync(v, o) { dialogos.push({ ventana: v, ...o }); return respuesta; } },
      nativeTheme: { themeSource: 'system', shouldUseDarkColors: sistemaOscuro },
      session: { fromPartition(p) { sesiones[p] = sesiones[p] || { manejador: null, setPermissionRequestHandler(f) { this.manejador = f; } }; return sesiones[p]; } },
      app: { on: (e, f) => eventosApp.on(e, f) },
    },
  };
}
const navegacion = () => ({ impedida: 0, preventDefault() { this.impedida++; } });
// Monta una ventana preparada; devuelve lo que hace falta para disparar enlaces y cierres.
function montar({ env = {}, puerto = 7331, ...opcionesElectron } = {}) {
  const f = electronFalso(opcionesElectron), r = registroFalso(), v = ventanaFalsa();
  ventana.prepararVentana({ ventana: v, electron: f.electron, env, puerto: () => puerto, anotar: r.anotar });
  const wc = v.webContents;
  return { ...f, ...r, v, wc, abrirVentana: url => wc.manejador({ url }).action, navegar: url => { const e = navegacion(); wc.emit('will-navigate', e, url); return e.impedida ? 'impedida' : 'navega'; }, cerrar: () => { const e = navegacion(); wc.emit('will-prevent-unload', e); return e.impedida ? 'descarta' : 'sigue editando'; } };
}

test('esPropia y tratarEnlace: solo http en localhost con el puerto de ahora es propio (el origen de remitenteValido); localhost o 127.0.0.1 con otro puerto se ignora (no va al navegador); lo permitido va fuera; lo demás se ignora; todo anotado', () => {
  assert.equal(ventana.esPropia('http://localhost:7331/', 7331), true);
  assert.equal(ventana.esPropia('http://127.0.0.1:7331/api/info', 7331), false, 'la ventana entra por localhost: 127.0.0.1 no es propio (como en remitenteValido)');
  assert.equal(ventana.esPropia('http://localhost:7332/', 7331), false, 'otro puerto no es nuestro');
  assert.equal(ventana.esPropia('https://localhost:7331/', 7331), false);
  assert.equal(ventana.esPropia('http://localhost.example:7331/', 7331), false);
  assert.equal(ventana.esPropia('no es url', 7331), false);
  assert.equal(ventana.esLocalAjena('http://localhost:7332/'), true); assert.equal(ventana.esLocalAjena('http://127.0.0.1:7331/'), true);
  assert.equal(ventana.esLocalAjena('https://example.com'), false); assert.equal(ventana.esLocalAjena('no es url'), false);
  const r = registroFalso(), fuera = [];
  const tratar = u => ventana.tratarEnlace(u, { puerto: () => 7331, abrirFuera: x => fuera.push(x), anotar: r.anotar });
  assert.equal(tratar('http://localhost:7331/#/n/inicio.md'), 'propia');
  assert.equal(tratar('https://example.com'), 'fuera');
  assert.equal(tratar('mailto:alguien@example.com'), 'fuera');
  assert.equal(tratar('file:///etc/passwd'), 'ignorado');
  assert.equal(tratar('http://localhost:7332/'), 'ignorado', 'otro puerto local: ni propio ni al navegador');
  assert.equal(tratar('http://127.0.0.1:7331/api/info'), 'ignorado');
  assert.deepEqual(fuera, ['https://example.com', 'mailto:alguien@example.com']);
  assert.deepEqual(r.lineas, ['enlace al navegador del sistema: https://example.com', 'enlace al navegador del sistema: mailto:alguien@example.com', 'enlace ignorado (esquema no permitido): file:///etc/passwd', 'enlace ignorado (local pero no es nuestro servidor): http://localhost:7332/', 'enlace ignorado (local pero no es nuestro servidor): http://127.0.0.1:7331/api/info']);
});

test('un enlace https (target _blank o navegación) abre el navegador del sistema y la ventana no navega ni abre otra ventana', async () => {
  const m = montar();
  assert.equal(m.abrirVentana('https://example.com/curso'), 'deny');
  assert.equal(m.navegar('https://example.com/otra'), 'impedida');
  assert.equal(m.navegar('mailto:alguien@example.com'), 'impedida');
  await tic();
  assert.deepEqual(m.abiertos, ['https://example.com/curso', 'https://example.com/otra', 'mailto:alguien@example.com']);
  assert.deepEqual(m.lineas, m.abiertos.map(u => `enlace al navegador del sistema: ${u}`));
});

test('file:, javascript: y smb: ni abren nada ni navegan, y quedan en el registro', async () => {
  const m = montar();
  for (const u of ['file:///etc/passwd', 'javascript:alert(1)', 'smb://servidor/recurso']) {
    assert.equal(m.abrirVentana(u), 'deny', u);
    assert.equal(m.navegar(u), 'impedida', u);
  }
  await tic();
  assert.deepEqual(m.abiertos, []);
  assert.equal(m.lineas.length, 6);
  assert.ok(m.lineas.every(l => l.startsWith('enlace ignorado (esquema no permitido): ')), m.lineas.join('\n'));
  assert.ok(m.lineas.includes('enlace ignorado (esquema no permitido): javascript:alert(1)'));
});

test('lo propio (http://localhost:<puerto de ahora>/…) navega y abre ventana normal; el puerto es el de ahora (cambia tras un relanzado); una ventana hija recibe los mismos tratos', async () => {
  let puerto = 7331;
  const f = electronFalso(), r = registroFalso(), v = ventanaFalsa();
  ventana.prepararVentana({ ventana: v, electron: f.electron, env: {}, puerto: () => puerto, anotar: r.anotar });
  const navegar = u => { const e = navegacion(); v.webContents.emit('will-navigate', e, u); return e.impedida ? 'impedida' : 'navega'; };
  assert.equal(v.webContents.manejador({ url: 'http://localhost:7331/fichero/material/largo.txt' }).action, 'allow');
  assert.equal(navegar('http://localhost:7331/?t=abc'), 'navega');
  assert.equal(navegar('http://127.0.0.1:7331/'), 'impedida', '127.0.0.1 no es el origen de la ventana');
  puerto = 45000;   // el servidor se relanzó en otro puerto
  assert.equal(navegar('http://localhost:7331/'), 'impedida', 'el puerto viejo ya no es nuestro');
  assert.equal(navegar('http://localhost:45000/'), 'navega');
  await tic();
  assert.deepEqual(f.abiertos, [], 'ni el puerto viejo ni 127.0.0.1 van al navegador del sistema: se ignoran');
  assert.ok(r.lineas.includes('enlace ignorado (local pero no es nuestro servidor): http://localhost:7331/'), r.lineas.join('\n'));
  // La ventana hija (window.open de un fichero del cuaderno) se trata igual: sus enlaces fuera salen al navegador.
  const hija = ventanaFalsa();
  v.webContents.emit('did-create-window', hija, { url: 'http://localhost:45000/fichero/x.html' });
  assert.equal(typeof hija.webContents.manejador, 'function');
  assert.equal(hija.webContents.manejador({ url: 'https://example.com' }).action, 'deny');
  const e = navegacion(); hija.webContents.emit('will-navigate', e, 'file:///x'); assert.equal(e.impedida, 1);
  assert.equal(hija.webContents.listenerCount('will-prevent-unload'), 1);
});

test('si openExternal falla se anota y la ventana sigue sin navegar; con CUADERNO_SIN_NAVEGADOR (pruebas) no se abre nada: se anota', async () => {
  const roto = montar({ fallaShell: true });
  assert.equal(roto.navegar('https://example.com'), 'impedida');
  await tic();
  assert.ok(roto.lineas.includes('no se ha podido abrir fuera https://example.com: sin navegador'), roto.lineas.join('\n'));
  const sin = montar({ env: { CUADERNO_SIN_NAVEGADOR: '1' } });
  assert.equal(sin.navegar('https://example.com'), 'impedida');
  await tic();
  assert.deepEqual(sin.abiertos, []);
  assert.ok(sin.lineas.includes('navegador no abierto (CUADERNO_SIN_NAVEGADOR): https://example.com'));
});

test('cerrar (o recargar) con el editor sucio pregunta «¿Descartar lo escrito?» con Descartar / Seguir editando; Descartar deja ir la página, Seguir editando la retiene', () => {
  const descarta = montar({ respuesta: 0 });
  assert.equal(descarta.cerrar(), 'descarta');
  assert.equal(descarta.dialogos.length, 1);
  const d = descarta.dialogos[0];
  assert.equal(d.ventana, descarta.v, 'el diálogo es de la ventana (modal)');
  assert.equal(d.message, '¿Descartar lo escrito?');
  assert.deepEqual(d.buttons, ['Descartar', 'Seguir editando']);
  assert.equal(d.defaultId, 1); assert.equal(d.cancelId, 1); assert.equal(d.type, 'question');
  const sigue = montar({ respuesta: 1 });
  assert.equal(sigue.cerrar(), 'sigue editando');
  assert.equal(sigue.dialogos.length, 1);
  // Si el diálogo no se puede enseñar, lo seguro: seguir editando, y se anota.
  const roto = montar();
  roto.electron.dialog.showMessageBoxSync = () => { throw new Error('sin pantalla'); };
  assert.equal(roto.cerrar(), 'sigue editando');
  assert.ok(roto.lineas.includes('no se ha podido enseñar el diálogo de cerrar: se sigue editando (sin pantalla)'));
});

test('CUADERNO_SIN_DIALOGO fija la respuesta sin diálogo: «descartar» descarta; «seguir» (o cualquier otro valor, como el 1 del recorrido) sigue editando; y queda anotado', () => {
  const descartar = montar({ env: { CUADERNO_SIN_DIALOGO: 'descartar' }, respuesta: 1 });
  assert.equal(descartar.cerrar(), 'descarta');
  assert.equal(descartar.dialogos.length, 0);
  assert.ok(descartar.lineas.includes('diálogo saltado (CUADERNO_SIN_DIALOGO=descartar): ¿Descartar lo escrito? → descartar'));
  for (const valor of ['seguir', '1']) {
    const seguir = montar({ env: { CUADERNO_SIN_DIALOGO: valor }, respuesta: 0 });
    assert.equal(seguir.cerrar(), 'sigue editando', valor);
    assert.equal(seguir.dialogos.length, 0);
    assert.ok(seguir.lineas.includes(`diálogo saltado (CUADERNO_SIN_DIALOGO=${valor}): ¿Descartar lo escrito? → seguir editando`));
  }
});

test('permisos: la sesión concede solo clipboard-sanitized-write y deniega lo demás (anotado); permisoConcedido es la lista pura que un futuro check handler debe compartir', () => {
  assert.deepEqual(ventana.PERMISOS, ['clipboard-sanitized-write']);
  assert.equal(ventana.permisoConcedido('clipboard-sanitized-write'), true);
  for (const p of ['clipboard-read', 'media', 'geolocation', 'notifications', 'fullscreen', 'openExternal', 'pointerLock', '', undefined]) assert.equal(ventana.permisoConcedido(p), false, String(p));
  const f = electronFalso(), r = registroFalso();
  const sesion = f.electron.session.fromPartition('cuaderno');
  ventana.permisos({ session: sesion, anotar: r.anotar });
  const respuestas = [];
  sesion.manejador({}, 'clipboard-sanitized-write', ok => respuestas.push(ok));
  sesion.manejador({}, 'media', ok => respuestas.push(ok));
  sesion.manejador({}, 'geolocation', ok => respuestas.push(ok));
  assert.deepEqual(respuestas, [true, false, false]);
  assert.deepEqual(r.lineas, ['permiso denegado a la pantalla: media', 'permiso denegado a la pantalla: geolocation']);
});

const configFalsa = tema => ({ leer: () => ({ tema: tema.valor }), carpeta: () => tema.carpeta });

test('tema: oscuro → themeSource dark y fondo oscuro; claro → light y blanco; auto → system y el fondo del sistema (oscuro si shouldUseDarkColors)', () => {
  const { FONDO } = ventana;
  assert.equal(ventana.colorDeFondo('oscuro', { shouldUseDarkColors: false }), FONDO.oscuro);
  assert.equal(ventana.colorDeFondo('claro', { shouldUseDarkColors: true }), FONDO.claro, 'claro fijo es claro aunque el sistema sea oscuro');
  assert.equal(ventana.colorDeFondo('auto', { shouldUseDarkColors: true }), FONDO.oscuro, 'nunca blanco sobre un sistema oscuro');
  assert.equal(ventana.colorDeFondo('auto', { shouldUseDarkColors: false }), FONDO.claro);
  assert.equal(ventana.colorDeFondo('lo que sea', undefined), FONDO.claro);
  const tema = { valor: 'oscuro' }, f = electronFalso(), v = ventanaFalsa();
  assert.deepEqual(ventana.aplicarTema({ nativeTheme: f.electron.nativeTheme, config: configFalsa(tema), ventana: v }), { tema: 'oscuro', fuente: 'dark', color: FONDO.oscuro });
  assert.equal(f.electron.nativeTheme.themeSource, 'dark');
  assert.deepEqual(v.fondos, [FONDO.oscuro]);
  tema.valor = 'auto';
  const oscuro = electronFalso({ sistemaOscuro: true });
  assert.deepEqual(ventana.aplicarTema({ nativeTheme: oscuro.electron.nativeTheme, config: configFalsa(tema) }), { tema: 'auto', fuente: 'system', color: FONDO.oscuro });
  assert.equal(oscuro.electron.nativeTheme.themeSource, 'system');
});

test('vigilarTema: vigila la carpeta de configuración (la crea si no está) y, cuando cambia config.json, reaplica themeSource y el fondo y lo anota; otro fichero de la carpeta no cuenta; cerrar deja de vigilar', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cuaderno-ventana-')), carpeta = path.join(base, 'config');
  const tema = { valor: 'claro', carpeta }, f = electronFalso(), r = registroFalso(), v = ventanaFalsa();
  const vigilados = [], cierres = [];
  let avisar = null;
  const vigilar = (dir, fn) => { vigilados.push(dir); avisar = fn; return { on() {}, close: () => cierres.push(dir) }; };
  const vig = ventana.vigilarTema({ nativeTheme: f.electron.nativeTheme, config: configFalsa(tema), ventana: v, anotar: r.anotar, vigilar });
  assert.deepEqual(vigilados, [carpeta]);
  assert.ok(fs.statSync(carpeta).isDirectory(), 'la carpeta se crea para poder vigilarla');
  assert.equal(f.electron.nativeTheme.themeSource, 'system', 'vigilar no aplica nada por su cuenta: eso lo hace aplicarTema al arrancar');
  tema.valor = 'oscuro';
  avisar('change', 'token');   // otro fichero de la carpeta: nada
  assert.equal(f.electron.nativeTheme.themeSource, 'system');
  avisar('change', 'config.json');
  assert.equal(f.electron.nativeTheme.themeSource, 'dark');
  assert.deepEqual(v.fondos, [ventana.FONDO.oscuro]);
  assert.deepEqual(r.lineas, ['tema cambiado en config.json: oscuro → themeSource dark']);
  avisar('change', 'config.json');   // el mismo tema otra vez (fs.watch avisa dos veces por escritura): sin anotar de nuevo
  assert.equal(r.lineas.length, 1);
  avisar('rename', null);   // sin nombre (hay sistemas que no lo dan): se relee igual
  tema.valor = 'auto';
  avisar('change', null);
  assert.equal(f.electron.nativeTheme.themeSource, 'system');
  assert.equal(r.lineas.length, 2);
  vig.cerrar(); vig.cerrar();
  assert.deepEqual(cierres, [carpeta], 'cerrar dos veces cierra una');
  fs.rmSync(base, { recursive: true, force: true });
});

test('vigilarTema: si no se puede vigilar, se anota y el tema queda el del arranque (cerrar no falla)', () => {
  const f = electronFalso(), r = registroFalso();
  const vig = ventana.vigilarTema({ nativeTheme: f.electron.nativeTheme, config: configFalsa({ valor: 'claro', carpeta: null }), anotar: r.anotar, carpeta: () => { throw new Error('sin carpeta'); } });
  assert.equal(r.lineas.length, 1);
  assert.match(r.lineas[0], /^no se puede vigilar config\.json \(el tema solo se lee al arrancar\): sin carpeta/);
  vig.cerrar();
});

test('vigilarTema con el fs.watch de verdad: escribir config.json con otro tema lo reaplica', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cuaderno-ventana-real-'));
  const f = electronFalso(), r = registroFalso();
  const config = { leer: () => { try { return JSON.parse(fs.readFileSync(path.join(base, 'config.json'), 'utf8')); } catch { return { tema: 'auto' }; } }, carpeta: () => base };
  const vig = ventana.vigilarTema({ nativeTheme: f.electron.nativeTheme, config, anotar: r.anotar });
  try {
    await new Promise(r => setTimeout(r, 100));   // que el vigilante esté puesto antes de escribir
    fs.writeFileSync(path.join(base, 'config.json'), JSON.stringify({ tema: 'oscuro' }));
    const fin = Date.now() + 5000;
    while (Date.now() < fin && f.electron.nativeTheme.themeSource !== 'dark') await new Promise(r => setTimeout(r, 25));
    assert.equal(f.electron.nativeTheme.themeSource, 'dark');
    assert.deepEqual(r.lineas, ['tema cambiado en config.json: oscuro → themeSource dark']);
  } finally { vig.cerrar(); fs.rmSync(base, { recursive: true, force: true }); }
});

test('preparar: de una vez, los tratos de la ventana, los permisos de la partición y el vigilante del tema, que se cierra en will-quit (no en before-quit: un quit cancelado lo dejaría sin vigilante)', () => {
  const f = electronFalso(), r = registroFalso(), v = ventanaFalsa();
  let cerrado = 0;
  const vigilar = () => ({ on() {}, close() { cerrado++; } });
  const vig = ventana.preparar({ ventana: v, electron: f.electron, config: configFalsa({ valor: 'claro', carpeta: os.tmpdir() }), env: {}, particion: 'cuaderno', puerto: () => 7331, anotar: r.anotar, vigilar });
  assert.equal(typeof v.webContents.manejador, 'function');
  assert.equal(v.webContents.listenerCount('will-prevent-unload'), 1);
  assert.equal(typeof f.sesiones.cuaderno.manejador, 'function');
  assert.equal(typeof vig.cerrar, 'function');
  f.eventosApp.emit('before-quit');
  assert.equal(cerrado, 0, 'before-quit aún se puede cancelar');
  f.eventosApp.emit('will-quit');
  assert.equal(cerrado, 1);
});

test('vigilarTema con alCambiar (el menú rehace sus recientes): se llama en cada cambio de config.json, también sin cambio de tema, no por otro fichero; si falla, se anota y el tema se sigue aplicando', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'cuaderno-ventana-')), carpeta = path.join(base, 'config');
  const tema = { valor: 'claro', carpeta }, f = electronFalso(), r = registroFalso();
  let avisar = null, llamadas = 0;
  const vigilar = (dir, fn) => { avisar = fn; return { on() {}, close() {} }; };
  const vig = ventana.vigilarTema({ nativeTheme: f.electron.nativeTheme, config: configFalsa(tema), anotar: r.anotar, vigilar, alCambiar: () => { llamadas++; if (llamadas === 3) throw new Error('menú roto'); } });
  avisar('change', 'token'); assert.equal(llamadas, 0, 'otro fichero: nada');
  avisar('change', 'config.json'); assert.equal(llamadas, 1);
  avisar('change', 'config.json'); assert.equal(llamadas, 2, 'sin cambio de tema también: los recientes pueden haber cambiado');
  assert.deepEqual(r.lineas, []);
  tema.valor = 'oscuro';
  avisar('change', 'config.json');
  assert.equal(llamadas, 3);
  assert.equal(f.electron.nativeTheme.themeSource, 'dark', 'el tema se aplicó antes del fallo');
  assert.deepEqual(r.lineas, ['tema cambiado en config.json: oscuro → themeSource dark', 'al cambiar config.json: menú roto']);
  vig.cerrar();
  fs.rmSync(base, { recursive: true, force: true });
});

test('preparar pasa alCambiar al vigilante', () => {
  const f = electronFalso(), r = registroFalso(), v = ventanaFalsa();
  let avisar = null, llamadas = 0;
  const vigilar = (dir, fn) => { avisar = fn; return { on() {}, close() {} }; };
  ventana.preparar({ ventana: v, electron: f.electron, config: configFalsa({ valor: 'claro', carpeta: os.tmpdir() }), env: {}, particion: 'cuaderno', puerto: () => 7331, anotar: r.anotar, vigilar, alCambiar: () => llamadas++ });
  avisar('change', 'config.json');
  assert.equal(llamadas, 1);
  f.eventosApp.emit('will-quit');
});

test('«Arrancando…» (electron/arrancando.html): el fondo de la mesa del tema (FONDO = --mesa de la pantalla), texto en tinta suave a 16 px, la «c» del logo con currentColor, «Abriendo el cuaderno…» y los dos avisos a los 4 y 12 s', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'electron', 'arrancando.html'), 'utf8');
  const estilo = fs.readFileSync(path.join(__dirname, '..', 'public', 'estilo.css'), 'utf8');
  const mesa = tema => estilo.match(new RegExp(`${tema}[\\s\\S]*?--mesa: (#[0-9a-f]{6})`))[1];
  assert.deepEqual(ventana.FONDO, { claro: '#e6e8ec', oscuro: '#0e0f12' });
  assert.equal(mesa(':root \\{'), ventana.FONDO.claro, 'la mesa en claro de estilo.css'); assert.equal(mesa('prefers-color-scheme: dark'), ventana.FONDO.oscuro, 'la mesa en oscuro de estilo.css');
  assert.match(html, /--mesa: #e6e8ec; --tinta: #1b1b1f; --tinta-suave: #5a5e66/); assert.match(html, /prefers-color-scheme: dark\) \{ :root \{ --mesa: #0e0f12; --tinta: #e6e6e6; --tinta-suave: #a0a4ab/);
  assert.match(html, /font: 16px\/1\.5 system-ui/); assert.match(html, /color: var\(--tinta-suave\); background: var\(--mesa\)/);
  assert.match(html, /\.arranque svg \{ width: 56px; height: 56px; color: var\(--tinta\)/);
  assert.match(html, /<svg viewBox="0 0 64 64" fill="none" stroke="currentColor"[^>]*aria-hidden="true"><path d="M12 53l40-2\.5" stroke="#ffe45c" stroke-width="8"\/><path d="M46 14A17 17 0 1 0 46 40"\/><\/svg>/, 'la «c» de la propuesta 3, en línea');
  assert.match(html, /<p id="estado" role="status">Abriendo el cuaderno…<\/p>/);
  assert.match(html, /setTimeout\(\(\) => \{ estado\.textContent = 'Leyendo el entorno de tu shell…'; \}, 4000\)/);
  assert.match(html, /setTimeout\(\(\) => \{ estado\.textContent = 'Está tardando más de lo normal\. Si no abre, mira Ayuda → Mostrar registro\.'; \}, 12000\)/);
  assert.doesNotMatch(html, /Arrancando…/);
});
