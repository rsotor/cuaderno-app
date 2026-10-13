'use strict';
// El proceso principal de la app de escritorio, con Electron inyectado para probarlo en Node con uno falso
// (tests/electron-app.test.js). La secuencia (plan §3): userData → instancia única → la ventana ANTES que nada, con
// «Arrancando…» y el fondo del tema (la shell puede tardar hasta 10 s) → el entorno de la shell de login → el servidor
// en un utilityProcess con ese entorno, CUADERNO_NODE (el Node del kit) y el cuaderno que toca → esperar
// { puerto, token } compitiendo con exit/error y un tope de 15 s → la ventana entra por la URL de entrada (la cookie
// se fija igual que en la web). Si el hijo muere después, se relanza una vez y se recarga; si vuelve a morir en menos
// de un minuto, diálogo y salir. Cerrar la ventana mata al hijo (que cierra vigilante y pty) y sale; `will-quit`
// marca `cerrando` para que esa salida del hijo no cuente como caída (lo vio el spike). Es `will-quit` y no
// `before-quit` porque un quit se puede cancelar después de `before-quit` (el editor sucio y «Seguir editando» en
// will-prevent-unload): si se matara al hijo ahí, la app seguiría viva con el servidor muerto y nadie lo relanzaría.
const fs = require('node:fs');
const path = require('node:path');
const { entornoDeLaShell, sinVariablesDePrueba, VARIABLES_DE_PRUEBA } = require('./entorno');
const { crearAbridor } = require('./carpeta');
const registroPorDefecto = require('./registro');
const ventanaApp = require('./ventana');   // lo del navegador que en la app cambia: enlaces fuera, cerrar con cambios, permisos, tema
const { instalarMenu } = require('./menu');   // el menú en castellano: sus atajos mandan acciones a la pantalla; Ayuda es del principal
const { version: VERSION } = require('../package.json');

const { FONDO } = ventanaApp;   // el fondo hasta que carga la pantalla, según el tema (con auto, el del sistema)
const TOPE_PUERTO = 15_000;   // ms que se espera el puerto del hijo
const TREGUA = 60_000;        // ms: dos muertes del hijo en menos de esto y la app se rinde
// El preload corre en el sandbox y solo expone window.cuadernoApp (electron/preload.js); la versión le llega como argumento.
// Tamaño y posición: los guardados en config.json si caen en una pantalla, o 1456 × 900 (ventana.limitesDeVentana); nunca menos de 760 × 480.
const PANTALLA = { ...ventanaApp.VENTANA, title: 'Cuaderno', webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, partition: 'cuaderno', preload: path.join(__dirname, 'preload.js'), additionalArguments: [`--cuaderno-version=${VERSION}`] } };
// El token nunca va al registro ni a un diálogo: los mensajes de Electron de un loadURL fallido traen la URL entera.
const sinToken = texto => String(texto).replace(/\?t=[0-9a-f]+/g, '?t=…');

// Devuelve el estado (ventana, hijo, puerto, entorno, muertes, cerrando) y `listo`, la promesa del arranque (true si
// la ventana cargó la app). Variables de prueba: CUADERNO_USERDATA (dónde va el lock de instancia única) y
// CUADERNO_SIN_DIALOGO (el diálogo de error se anota y se da por cerrado; en ventana.js, además, su valor fija la respuesta
// a «¿Descartar lo escrito?») y CUADERNO_DIALOGO_PRUEBA (electron/carpeta.js); en la app empaquetada (app.isPackaged) las
// cuatro se ignoran (entorno.sinVariablesDePrueba) y queda anotado. `vigilar`: el fs.watch de config.json;
// `argv`, `cwd`, `peticion` y `resolver` (path.resolve) son del abridor de carpetas (carpeta.js); `plataforma`, del menú; todos
// inyectables para que los tests no dependan del sistema en que corren.
function arrancar({ electron, config, env = process.env, entorno = entornoDeLaShell, registro = registroPorDefecto, topePuerto = TOPE_PUERTO, tregua = TREGUA, ahora = Date.now, execPath = process.execPath, existe = r => fs.statSync(r).isDirectory(), vigilar = undefined, argv = process.argv, cwd = process.cwd(), peticion, plataforma = process.platform, resolver = path.resolve }) {
  const { app, BrowserWindow, utilityProcess, dialog } = electron;
  const anotar = linea => registro.escribir(`[app] ${sinToken(linea)}`);
  // Empaquetada, las variables de prueba no valen: el `env` que ven carpeta.js, ventana.js, menu.js y el hijo es el limpio.
  if (app.isPackaged) {
    const puestas = VARIABLES_DE_PRUEBA.filter(v => v in env);
    env = sinVariablesDePrueba(env);
    if (puestas.length) anotar(`variables de prueba ignoradas (app empaquetada): ${puestas.join(', ')}`);
  }
  const estado = { ventana: null, hijo: null, puerto: null, token: null, pty: null, entorno: null, muertes: [], cerrando: false, listo: null, menu: null };

  // userData solo para lo de Electron (el lock de instancia única va ahí); tiene que fijarse antes de `ready`.
  if (env.CUADERNO_USERDATA) app.setPath('userData', env.CUADERNO_USERDATA);
  if (!app.requestSingleInstanceLock()) { anotar('ya hay otra instancia abierta: esta sale y aquella pasa al frente'); app.quit(); estado.listo = Promise.resolve(false); return estado; }
  // Abrir carpeta por diálogo, argumentos, open-file y segunda instancia (carpeta.js, único dueño de `second-instance`: trae la
  // ventana al frente y abre la carpeta que traiga); open-file se registra aquí, antes de ready.
  const carpetas = crearAbridor({ electron, estado, anotar, existe, env, argv, cwd, peticion, resolver, recargar: () => (estado.ventana ? cargarVentana(estado.ventana) : false) });

  const urlEntrada = () => `http://localhost:${estado.puerto}/?t=${estado.token}`;
  const matarHijo = () => { if (estado.hijo) { try { estado.hijo.kill(); } catch { /* ya muerto */ } } };
  const avisar = (mensaje, detalle) => {
    if (env.CUADERNO_SIN_DIALOGO) return anotar(`diálogo saltado (CUADERNO_SIN_DIALOGO): ${mensaje}`);
    try { dialog.showMessageBoxSync({ type: 'error', title: 'Cuaderno', message: mensaje, detail: sinToken(detalle) }); } catch (e) { anotar(`no se ha podido enseñar el diálogo: ${e.message}`); }
  };
  // Sin servidor no hay app: se anota, se avisa y se sale con 1. Si ya se está cerrando (la persona cerró la ventana
  // durante «Arrancando…» o con un relanzado en vuelo), la salida del hijo no es un fallo: solo se anota.
  const fallo = motivo => {
    if (estado.cerrando) return anotar(`durante el cierre: ${motivo}`);
    anotar(`FALLO: ${motivo}`);
    estado.cerrando = true;
    matarHijo();
    avisar('El servidor del cuaderno ha fallado', `${motivo}\n\nEl registro está en ${registro.ruta()}.`);
    app.exit(1);
  };

  // El entorno del hijo: el de la shell con CUADERNO_NODE y el cuaderno que toca ahora (la carpeta de argv u open-file
  // si hay una esperando; si no, el último reciente; abrir uno lo registra, así que tras una caída se vuelve al que
  // estaba abierto, no al del arranque). El kit hereda este entorno entero, con CUADERNO_* y ELECTRON_RUN_AS_NODE: no
  // se filtra a propósito, y CUADERNO_CONFIG_DIR TIENE que viajar (el hijo lee el token y los recientes de esa carpeta).
  const entornoDelHijo = () => {
    const { carpeta, origen } = config.cuadernoAlArrancar(carpetas.tomar(), config.leer().recientes, existe);
    const e = { ...estado.entorno.env, CUADERNO_NODE: execPath };
    if (carpeta) e.CUADERNO_CARPETA = carpeta;
    return { env: e, carpeta, origen };
  };
  // La ventana entra por la URL de entrada. Un ERR_ABORTED (otra carga la ha pisado: una recarga, un enlace) no es
  // fallo; otro error se reintenta una vez y, si no, fallo. Los mensajes llevan la URL con el token: se limpia.
  const cargarVentana = async (ventana, reintento = false) => {
    try { await ventana.loadURL(urlEntrada()); return true; } catch (e) {
      const motivo = sinToken(e.message);
      if (e.code === 'ERR_ABORTED' || /ERR_ABORTED/.test(motivo)) { anotar(`carga de la ventana interrumpida por otra (no es fallo): ${motivo}`); return true; }
      if (!reintento) { anotar(`la ventana no ha cargado (${motivo}): se reintenta`); return cargarVentana(ventana, true); }
      fallo(`La ventana no ha podido cargar la app: ${motivo}`);
      return false;
    }
  };

  // Lanza servidor-hijo.js y resuelve con { puerto, token } cuando el hijo ya escucha; rechaza si antes sale, da
  // error o pasa el tope. Una salida posterior es una caída (salvo que se esté cerrando o el hijo ya sea otro).
  const lanzarHijo = entornoHijo => new Promise((resolver, rechazar) => {
    const hijo = utilityProcess.fork(path.join(__dirname, 'servidor-hijo.js'), [], { env: entornoHijo, stdio: 'inherit', serviceName: 'servidor del cuaderno' });
    estado.hijo = hijo;
    let listo = false;
    const acabar = (fn, valor) => { if (listo) return; listo = true; clearTimeout(temporizador); fn(valor); };
    const temporizador = setTimeout(() => acabar(rechazar, new Error(`el servidor no ha dicho su puerto en ${topePuerto / 1000} s`)), topePuerto);
    hijo.once('spawn', () => anotar(`servidor lanzado (pid ${hijo.pid})`));
    hijo.on('message', m => { if (m && m.puerto) { estado.pty = typeof m.pty === 'boolean' ? m.pty : null; acabar(resolver, { puerto: m.puerto, token: m.token }); } });
    hijo.on('error', e => { anotar(`error del servidor: ${e.message}`); acabar(rechazar, e); });
    hijo.on('exit', codigo => {
      anotar(`el servidor ha salido con código ${codigo}`);
      if (!listo) return acabar(rechazar, new Error(`el servidor ha salido con código ${codigo} antes de escuchar`));
      if (estado.cerrando || hijo !== estado.hijo) return;   // cierre, o la salida tardía de un hijo ya sustituido
      caida(codigo);
    });
  });
  const caida = codigo => {
    const t = ahora();
    const reciente = estado.muertes.some(m => t - m < tregua);
    estado.muertes.push(t);
    if (reciente) return fallo(`El servidor se ha caído dos veces en menos de un minuto (código ${codigo}).`);
    estado.puerto = null;   // sin servidor: una carpeta que llegue ahora (open-file, segunda instancia) se encola en vez de pedirse a un puerto muerto
    const { env: entornoHijo, carpeta } = entornoDelHijo();
    anotar(`se relanza el servidor con el mismo entorno${carpeta ? ` y el cuaderno ${carpeta}` : ''}`);
    lanzarHijo(entornoHijo)
      .then(async ({ puerto, token }) => {
        estado.puerto = puerto; estado.token = token;
        anotar(`servidor relanzado en el puerto ${puerto}: se recarga la ventana`);
        if (!estado.ventana) return false;
        return (await carpetas.despachar()) || cargarVentana(estado.ventana);   // como en el arranque: lo encolado se abre en el servidor nuevo, y eso ya recarga
      })
      .catch(e => fallo(`El servidor no ha vuelto a arrancar: ${e.message}`));
  };

  estado.listo = app.whenReady().then(async () => {
    const { color } = ventanaApp.aplicarTema({ nativeTheme: electron.nativeTheme, config });   // themeSource según config.tema antes del primer píxel: sin flash blanco en oscuro
    const { origen: origenLimites, ...limites } = ventanaApp.limitesDeVentana({ screen: electron.screen, guardado: config.leer().ventana });
    const oculta = !!env.CUADERNO_OCULTA;   // solo los tests: la ventana existe pero no se ve ni toma el foco (no se llama nunca a show/focus), y en Mac sin icono en el Dock; sin ahogar los temporizadores de una ventana oculta (la CI de Linux los vio a 1 s)
    if (oculta && app.dock) app.dock.hide();
    const ventana = new BrowserWindow({ ...PANTALLA, ...limites, backgroundColor: color, ...(oculta ? { show: false, webPreferences: { ...PANTALLA.webPreferences, backgroundThrottling: false } } : {}) });
    estado.ventana = ventana;
    anotar(`ventana ${limites.width} × ${limites.height}${'x' in limites ? ` en (${limites.x}, ${limites.y})` : ''}: ${origenLimites === 'guardado' ? 'la última posición' : origenLimites === 'area' ? 'el 90 % del área de trabajo' : 'el tamaño por defecto'}`);
    // Al cerrar, dónde y cuánto medía, para abrir igual la próxima vez (minimizada no: sus límites no son de verdad).
    ventana.on('close', () => { try { if (!ventana.isMinimized()) config.guardarVentana(ventana.getBounds()); } catch (e) { anotar(`no se ha podido guardar la ventana: ${e.message}`); } });
    // El menú, antes del primer píxel; sus recientes se reconstruyen cuando cambia config.json (el mismo vigilante que el tema).
    estado.menu = instalarMenu({ electron, estado, config, registro, env, anotar, version: VERSION, execPath, plataforma, abrirCarpeta: ruta => carpetas.llegada(ruta, 'menú') });
    ventanaApp.preparar({ ventana, electron, config, env, particion: PANTALLA.webPreferences.partition, puerto: () => estado.puerto, anotar, vigilar, alCambiar: () => estado.menu.reconstruir() });
    await ventana.loadFile(path.join(__dirname, 'arrancando.html'));
    const r = await entorno({ env });   // asíncrono: el proceso principal sigue atendiendo eventos mientras la shell contesta (hasta 10 s)
    estado.entorno = { origen: r.origen, ms: r.ms, shell: r.shell, error: r.error, PATH: r.env.PATH, env: r.env };
    anotar(`entorno de la shell: ${r.origen}, ${r.ms} ms${r.error ? ` (${r.error})` : ''}`);
    const { env: entornoHijo, carpeta, origen } = entornoDelHijo();
    try {
      const { puerto, token } = await lanzarHijo(entornoHijo);
      estado.puerto = puerto; estado.token = token;
      anotar(`servidor en el puerto ${puerto}; ${carpeta ? `${origen === 'reciente' ? 'el último cuaderno' : 'la carpeta'}: ${carpeta}` : 'sin cuaderno: pantalla de cuadernos'}`);
      // Una carpeta llegada entre el fork y el puerto (open-file) se abre ahora en el servidor, y eso ya recarga la ventana.
      return (await carpetas.despachar()) || cargarVentana(ventana);
    } catch (e) { fallo(e.message); return false; }
  });

  // Salir (Archivo → Salir, ⌘Q, app.quit() desde Playwright) o cerrar la ventana: el hijo se mata y su salida no es caída.
  // En `will-quit`, no en `before-quit`: ahí ya no hay vuelta atrás (un «Seguir editando» cancela el quit entre los dos).
  app.on('will-quit', () => { estado.cerrando = true; matarHijo(); });
  app.on('window-all-closed', () => { estado.cerrando = true; matarHijo(); app.quit(); });
  return estado;
}

module.exports = { arrancar, sinToken, FONDO, TOPE_PUERTO, TREGUA };
