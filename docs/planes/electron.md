# La app de escritorio con Electron: plan de trabajo

**2026-10-10 · estado: plan redactado, pasado por abogado del diablo (§9: 15 objeciones, 14 aplicadas y 1
aplicada en parte) y por una revisión de confirmación independiente (§10: «viable con cambios», 8 puntos, todos
aplicados). **Spike técnico hecho el 2026-10-10 (§5, «Resultado»): las cuatro preguntas salen SÍ en Linux; se sigue
con las tareas de §6.** Pendientes de Roberto: las decisiones de §8 y lo que solo se puede probar en su Mac.** Es el «siguiente bloque»
del plan vivo (§0, decisión de Roberto del 2026-10-09): una ventana propia para él y su pareja, sin firma ni
tienda, «como mucho hacer público el repo». Sus palabras: «tenerlo en navegador me mata» y hay «un par de cosas
que podríamos hacer mejor con atajos de app».

Este documento está escrito para **delegar cada tarea a otro modelo** sin que tenga que leer la conversación:
§1 dice qué hay hoy y qué no se puede romper, §2 las decisiones tomadas y por qué, §3 la arquitectura, §4 los
riesgos con su medida, §5 el spike con su criterio de seguir o parar, §6 las tareas una a una con sus criterios
de aceptación, §7 qué pasa con la versión web, §8 lo que decide Roberto, §9 la ronda del abogado del diablo y §10 la
revisión de confirmación. Quien tome una tarea lee §1-§4 enteros y su tarea; el resto, cuando lo necesite.

## 1. De dónde se parte (hechos del repo, 2026-10-10, contrastados en §9)

- **La app es un servidor Node sin build más una pantalla en `public/`.** `server.js` (47 líneas) lee los
  argumentos y la configuración, hace `crearServidor({ pty, token })` de `servidor.js` (288 líneas), escucha en
  `127.0.0.1:7331` y abre el navegador con `sistema.abrirUrl` en la URL de entrada (`/?t=<token>`), que fija una
  cookie y vuelve a `http://localhost:7331/`. **Todo lo de verdad está en `servidor.js`, `cuaderno.js`, `kit.js`,
  `guardar.js`, `formulario.js`, `config.js`, `sistema.js`**: el servidor ya es una función que se puede llamar
  desde cualquier proceso Node, y sus tests (`tests/rutas.test.js`) lo arrancan así.
- **El servidor se para mientras trabaja git o el kit.** `guardar.js` (`ejecutar`: `spawnSync`, 120 s para las
  herramientas del kit y 60 s para git, incluido el `push`), `formulario.js` l.49 (`spawnSync` para corregir un
  examen, 120 s), `servidor.js` `estadoGit` (`execFileSync`, 4 s, **por cada reciente** en `/api/cuadernos` y en
  cada `/api/info`) y `sistema.aPapelera` (`execFileSync`, 15 s). Hoy eso congela el servidor y el navegador sigue
  vivo; ya está anotado en el Inbox del plan vivo («Guardar y Traer en asíncrono»). En Electron decide la
  arquitectura (§2, primera fila).
- **Seguridad hoy:** cookie con un código por usuario (`config.token()`, fijo entre arranques, en la carpeta de
  configuración), comprobación de `Host` y `Origin` (solo `localhost` y `127.0.0.1` con el puerto); el `sandbox`
  de `servidor.js` l.119 es un CSP para los `.html` y `.svg` **del cuaderno** en su iframe, no para la app.
  Documentado en la cabecera de `servidor.js`.
- **Configuración:** `~/.config/cuaderno/` (Linux y Mac) o `%APPDATA%\cuaderno\` (Windows): `config.json`
  (tema, letra, recientes, tamaños del panel, `comando_agente`) y `token`. `CUADERNO_CONFIG_DIR` la cambia (los
  tests la usan). Dos procesos a la vez (dos `npm start`) escriben `recientes` y el último gana: ya pasa hoy.
- **Dependencias nativas: solo `node-pty` 1.1.0** (la terminal). El paquete trae prebuilds para `darwin-arm64`,
  `darwin-x64`, `win32-x64` y `win32-arm64`, compilados con **node-addon-api (N-API)**: el mismo `pty.node` sirve
  para Node 24 y para Electron 44 sin recompilar. **En Linux no hay prebuild**: `npm ci` compila con `node-gyp` (por
  eso el runner necesita toolchain). Trae además ejecutables sueltos que tienen que estar en disco:
  `spawn-helper` (Mac; `unixTerminal.js` ya sabe buscarlo en `app.asar.unpacked`), `conpty.dll`, `OpenConsole.exe`,
  `winpty-agent.exe` (Windows; conpty exige Windows 10 1809 o más). `server.js` repara el permiso de ejecución de
  `spawn-helper` al arrancar.
- **Las herramientas del kit y el corrector se lanzan con `process.execPath`** (`guardar.js` l.18 y
  `formulario.js` l.49). En Node, `execPath` es `node`. **En Electron es el binario de Electron**: lanzaría una
  ventana, no un script (R1). Y `guardar.js` l.9 construye su entorno `ENV` **al cargar el módulo**: lo que haya
  en `process.env` en ese instante es lo que verán git y el kit para siempre (R2).
- **La terminal lanza `$SHELL` (o `powershell.exe`) sin `-l`**, heredando el entorno del proceso. En una app de
  escritorio en Mac y Linux, ese entorno es el de la sesión gráfica: el `PATH` no lleva Homebrew, nvm ni
  `~/.local/bin`, así que `git`, `node`, `claude` o `codex` no se encuentran; tampoco para `execFileSync('git')`.
  El comando del profesor (`kit.js`, `comando_agente`) se divide por espacios y se lanza **por nombre**: un alias
  o una función de la shell no vale, tiene que ser un ejecutable.
- **Versiones hoy (npm, 2026-10-10):** Electron **44.7.0**, la que se fija (lleva **Node 24.21.0** y Chromium 152.0.7977.130, según su `DEPS`;
  cumple `engines.node >= 24`), electron-builder **26.15.3**, Playwright 1.56.1 (ya en `devDependencies`; trae
  `_electron` para lanzar una app Electron desde un test, **marcado como experimental**, y su Chromium es el
  **141**: los recorridos de la web no ven el mismo motor que la app).
- **CI:** `.github/workflows/tests.yml`: `npm test` (suelo de cobertura 85 %) y `npm run test:navegador` con
  Node 24; `push` solo en `main` y solo Linux; en PR y a mano, Linux, Mac y Windows. Solo salta si cambian
  `*.js`, `public/`, `tests/`, `pruebas/`, dependencias o el propio workflow. Repo **privado**: macOS cuenta ×10 y
  Windows ×2 contra la cuota. `npm test` es `tests/*.test.js`: un test en una subcarpeta no corre si no tiene
  su script. El filtro `*.js` del workflow **no cruza directorios**: un cambio solo en `electron/` no dispararía la CI.
- **La pantalla supone navegador y terminal:** `beforeunload` (`app.js` l.579) para no cerrar con el editor sucio;
  `target="_blank"` (l.248); `navigator.clipboard.writeText` (l.201 y 596); el 403 del servidor y `app.js` l.18
  dicen «arranca la app desde la terminal»; `console.error('node-pty no está disponible…')` solo se ve en una
  terminal. El WebSocket de recarga en vivo (`app.js` l.1018) **no tiene reconexión**: si el servidor cae, la
  pantalla se queda muda sin avisar.
- **Lo que el navegador no deja hacer y en la app sí** (lo que motiva el bloque): elegir una carpeta con el
  diálogo del sistema (hoy se escribe la ruta a mano en Cuadernos), **⌘S / Ctrl S** sin que el navegador abra
  «Guardar como» (hallazgo 5 de la revisión de diseño), atajos sin reservar (⌘K, ⌘E…), arrancar sin terminal ni
  Node instalado, ventana con nombre e icono propios, abrir una carpeta arrastrándola al icono, y que nadie tenga
  que saber qué es `localhost:7331`.

## 2. Decisiones (tomadas en este plan; las que son de Roberto, en §8)

| Qué | Decisión | Por qué |
|---|---|---|
| Dónde corre el servidor | **En un `utilityProcess` de Electron** (`electron/servidor-hijo.js`: `crearServidor` tal cual, escucha y manda el puerto al padre por `process.parentPort`). El proceso principal solo tiene ventana, menú, IPC y diálogos | Es Node 24 igual, sin exigir Node instalado. Y el servidor **bloquea** con `spawnSync` en Guardar, Traer, corregir y `estadoGit` (§1): en el proceso principal eso congelaría la ventana entera (bola de macOS, «no responde» en Windows); en el hijo pasa lo mismo que hoy en la web. Además un fallo nativo de `node-pty` no tumba la ventana. Son unas 20 líneas; pasar el servidor a asíncrono sigue en el Inbox, como deuda aparte, no de este bloque. **Camino de fallo:** el hijo manda el puerto solo en `listening` y hace `listen(0)` si recibe `EADDRINUSE` (comprobar el puerto antes tiene carrera); el padre compite `message` contra `exit`/`error` con un **tope de 15 s** y, si no llega el puerto, escribe en el registro, enseña un diálogo («El servidor no ha arrancado; mira Ayuda → Mostrar registro») y sale. Si el hijo **muere después** (fallo nativo de `node-pty`, excepción) y no se está cerrando, el padre lo anota, lo **relanza una vez** con el mismo entorno y recarga la ventana en la nueva `urlEntrada()` (mismo token, el puerto puede cambiar); si vuelve a morir en menos de un minuto, diálogo y salir. La ventana se crea **antes** de resolver el entorno (con `backgroundColor` del tema y una página local «Arrancando…»), para que el primer píxel no espere los hasta 10 s de la shell |
| Puerto | **7331 si está libre; si no, uno libre (`listen(0)`)** | Mantiene «una sola dirección» para quien abra además un navegador; con el puerto ocupado (una `npm start` abierta) la ventana funciona igual, porque en Electron la dirección no se ve. La cookie es por host, no por puerto |
| Cómo entra la ventana | **`loadURL` de `urlEntrada()`** (la de `/?t=<token>`): la misma cookie, los mismos `Host`/`Origin`; **sesión en memoria** (`webPreferences.partition: 'cuaderno'`, sin `persist:`) | Un solo modelo de seguridad para web y app; cero caminos nuevos en el servidor. `SameSite=Strict` y `Origin` funcionan igual en una `BrowserWindow`. El token se reinyecta por la URL en cada arranque, así que no hace falta que la cookie quede en disco en `userData` (sería un segundo almacén de estado que nadie cuenta) |
| Pantalla | **La misma `public/`**, sin `nodeIntegration`, con `contextIsolation` y `sandbox`; un `preload` mínimo que expone `window.cuadernoApp` (`elegirCarpeta()`, `alAccion(cb)`, `version`; el registro y el diagnóstico se abren desde el menú, no desde la pantalla); todo `ipcMain.handle` valida `event.senderFrame` (solo nuestro `localhost`); `setPermissionRequestHandler` concede solo `clipboard-sanitized-write` y deniega lo demás (si algún día se añade `setPermissionCheckHandler`, tiene que conceder el mismo: el check por defecto concede, uno «deniega todo» rompería copiar ruta) | Principio 3 aplicado a la plataforma: la pantalla funciona sola en el navegador; con Electron añade lo de Electron. Sin `window.cuadernoApp`, la pantalla es la de hoy. La superficie nueva son dos canales IPC y queda acotada |
| Enlaces fuera | `setWindowOpenHandler` y `will-navigate`: lo que no sea nuestro `localhost` se intercepta; **solo `http:`, `https:` y `mailto:` van a `shell.openExternal`**, el resto se ignora con aviso | Una nota o un `.html` del cuaderno pueden llevar `file:`, `smb:`, `vnc:`, `javascript:`: la lista de seguridad de Electron dice no pasarlos a `openExternal`. Lista pura, con test |
| Cerrar con cambios | **`webContents.on('will-prevent-unload')`** con un `dialog.showMessageBoxSync` «¿Descartar lo escrito?» | En Electron un `beforeunload` que cancela **no pregunta: bloquea el cierre en silencio** (doc de `BrowserWindow`, evento `close`). Con `will-prevent-unload` la pantalla no cambia, no hay IPC nuevo y cubre también Ver → Recargar |
| Configuración | **La misma carpeta de `config.js`** (`~/.config/cuaderno`), no `app.getPath('userData')`; `userData` solo para lo que Electron necesite por su cuenta (el lock de instancia única) | Web y app comparten recientes, tema y código; ir y volver no pierde nada. Dos procesos escribiendo `recientes` es lo mismo que hoy con dos `npm start`: asumido (R8) |
| Entorno de la shell | **Al arrancar, en Mac y Linux (no en Windows), leer el entorno de la shell de login** y pasárselo al hijo en `utilityProcess.fork(…, { env })`: `$SHELL -lc` (y `-ilc` solo si falta algo) ejecutando `env -0` entre **marcadores** (`__CUADERNO__`), tope de **10 s**, y de respaldo añadir siempre `/opt/homebrew/bin`, `/usr/local/bin`, `~/.local/bin` y `~/.nvm/versions/node/*/bin`. Se importan `PATH`, `LANG`, `LC_*`, `SSH_AUTH_SOCK` y `GIT_*` (con `env -0` fish también exporta `PATH` con `:`). El resultado se ve en Ayuda → Diagnóstico | `echo $PATH` a secas se mezcla con el MOTD, el prompt de p10k o los avisos de nvm, y fish separa por espacios: es lo que hacen VS Code y los demás con marcadores y `env`. Pasarlo en el `fork` **antes de que el hijo cargue nada** resuelve que `guardar.js` congele su `ENV` al cargar (R2). `SSH_AUTH_SOCK` lo necesita el `push` por ssh en Linux. Un fallo aquí tiene que ser visible, no un «git: not found» misterioso |
| Terminal | `pty.spawn` de la shell **como login shell (`-l`)** solo en Electron | Que la terminal de la app sea la misma que la del Terminal del sistema |
| Node para el kit y el corrector | **`process.execPath` con `ELECTRON_RUN_AS_NODE=1`** solo en el entorno del hijo que se lanza, inyectado como `ejecutarNode` en `crearServidor` (`guardar.js` y `formulario.js` dejan de leer `execPath` directamente; por defecto, el de siempre) | El binario de Electron se comporta como `node` con esa variable: las herramientas del kit corren sin exigir Node instalado. En macOS, `process.execPath` dentro del `utilityProcess` es probablemente el **helper** (`Cuaderno Helper.app/…`), que también honra la variable; aun así el padre pasa su propio `execPath` en el entorno del hijo (`CUADERNO_NODE`) y `nodeDelKit()` lo prefiere, y el spike anota qué binario se usó. **Depende del fuse `runAsNode`, habilitado por defecto; los fuses no se tocan** (`runAsNode` y `nodeCliInspect`: Playwright `_electron.launch` necesita el segundo). El kit ve el Node de Electron (24.18), no el del sistema; si una herramienta del kit lanza `node`, `npm` o `npx` **por nombre**, no los habrá: se comprueba en el spike (pregunta 3) |
| Tema | `nativeTheme.themeSource = temaNativo(config.tema)` al arrancar y al cambiar Ajustes (`auto`/`claro`/`oscuro` → `system`/`light`/`dark`, función pura con test); `backgroundColor` de la ventana según el tema | Con `auto`, `prefers-color-scheme` ya sigue al sistema; con `claro`/`oscuro` fijos, la barra de título, el menú y el fondo antes de cargar no seguirían el ajuste (flash blanco en oscuro) |
| Empaquetado | **electron-builder 26**, `.dmg` (arm64 y x64 por separado, sin universal) y `.exe` NSIS (x64, instalación por usuario), **sin notarización**, **firma ad hoc en Mac** (`mac.identity: "-"` y `hardenedRuntime: false`), `npmRebuild: false`, **sin asar en la primera versión** (`asar: false`) | Sin identidad, electron-builder **no firma nada** (no hay caída automática a ad hoc) y con `identity: null` tampoco: un `.dmg` descargado en un Mac arm64 sale «dañado», sin botón «Abrir de todos modos». Con `"-"` queda firmado ad hoc, que es lo que Gatekeeper admite tras «Abrir de todos modos». Sin asar no por el `fs` (Electron lo parchea y servir estáticos desde asar funciona) sino porque **para dos usuarios compensa poder abrir y parchear `public/app.js` dentro del bundle** y que la señal «desactualizada» por mtime siga teniendo sentido; coste: miles de ficheros, primera apertura y la instalación NSIS más lentas (se mide en el spike; ruta de vuelta: `asar: true` con `asarUnpack: node_modules/node-pty/**`). El universal duplica el tamaño sin ganar nada con dos máquinas conocidas |
| Una instancia | `app.requestSingleInstanceLock()`; la segunda apertura trae la ventana al frente y, si trae una carpeta en `argv`, la abre | Dos servidores sobre el mismo cuaderno pisarían el vigilante y la cookie |
| Abrir carpeta | Diálogo del sistema (`dialog.showOpenDialog`), **más** `app.on('open-file')` (Mac: arrastrar al icono) y la carpeta en `argv` (Windows y Linux, y `second-instance`) | Es lo que un usuario del Finder o del Explorador espera; cuesta lo mismo que el diálogo |
| Registro | **Registro a fichero** en la carpeta de configuración (`registro.log`, rotado a 1 MB) con lo que hoy va a `console.error`, más Ayuda → «Mostrar registro» y «Diagnóstico» (versiones, puerto, `PATH` resuelto, `node-pty` cargado o no) | Sin terminal, los errores desaparecen; es la única manera de depurar el Windows del padre a distancia |
| Menú y atajos | Menú propio en castellano (Cuaderno, Edición, Ver, Ventana, Ayuda). Los atajos del menú **mandan un mensaje a la pantalla** (`webContents.send('accion', 'guardar')`) y la pantalla hace lo que ya sabe hacer | La lógica sigue en la pantalla; el menú solo la nombra. **Los atajos concretos los decide Roberto (§8)**: el plan arranca con ⌘S / Ctrl S → Guardar, ⌘, → Ajustes y ⌘O → Abrir carpeta |
| Icono | Se elige al crear la app entre las tres propuestas de `docs/diseno/logo/` (decisión de Roberto del 2026-10-09); electron-builder genera `.icns` e `.ico` desde un PNG de 1024 px rasterizado con el Chromium de Playwright (sin `sharp`) | Lo decidido ya; la app sin icono propio parece rota; sin dependencia nueva |
| Nombre del producto | `Cuaderno` (`productName`), `appId` `es.cuaderno.app` (sin dominio real detrás: es un identificador) | Sin rutas ni nombres de nadie (principio 5) |
| Actualizaciones | **Sin `autoUpdater`** (sin firma no funciona en Mac). «Buscar versión nueva» en Ayuda solo tiene sentido con el repo público (API de Releases sin token): decisión de Roberto en §8 | Con dos usuarios no compensa más |
| Arranque al iniciar sesión | **Fuera de este bloque**; `setLoginItemSettings` sin firma falla en silencio en Mac (doc de firma de Electron). Si hace falta para el padre, a mano (carpeta Inicio de Windows). Decisión en §8 | La fase 11 del plan vivo (servicio del sistema) deja de hacer falta para arrancar sin terminal, pero no para arrancar solo |
| Tests | **`electron/main.js` de diez líneas** que llama a `electron/app.js` → `arrancar({ electron, crearServidor, config, env })`, probado con `node --test` y un **Electron falso** (el patrón de `lanzar`/`ejecutar` de `sistema.js`): entra en el suelo del 85 % de verdad. Un **recorrido Playwright `_electron.launch`** (`tests/electron/*.test.js`, script `test:electron`, paso propio en CI) sobre el cuaderno de ejemplo, con `userData` temporal y `CUADERNO_CONFIG_DIR`; cada caso con su fila en `ejemplos/cuaderno-ejemplo.md` | «Toda la funcionalidad, probada» (AGENTS.md) no se cumple excluyendo ficheros de la cobertura: se cumple haciendo el pegamento inyectable. Lo que solo existe con una ventana real (diálogo, menú, cierre) lo cubre el recorrido, que es experimental en Playwright y por eso va en un paso aparte que se puede pasar a manual si falla por su cuenta (R9) |

## 3. Arquitectura

```
electron/
  main.js            diez líneas: require('./app').arrancar({ electron: require('electron'), crearServidor, config, env: process.env })
  app.js             lo que se prueba: whenReady → entorno → fork del servidor-hijo → ventana(urlEntrada) → menú → instancia única → cierre
  servidor-hijo.js   utilityProcess: chmod de spawn-helper → crearServidor({ pty, token, ejecutarNode, shellLogin: true }) → listen(7331; EADDRINUSE → 0) → en 'listening', parentPort.postMessage({ puerto })
  arrancando.html    página local mínima («Arrancando…», fondo del tema) que la ventana enseña hasta que llega el puerto
  preload.js         contextBridge.exposeInMainWorld('cuadernoApp', { elegirCarpeta(), alAccion(cb), version })
  menu.js            tabla → plantilla de Menu (puro: etiquetas, aceleradores y acciones por plataforma)
  entorno.js         entornoDeLaShell(), nodeDelKit(), esquemaPermitido(url), temaNativo(tema) (puros, probados)
  registro.js        escribir(linea) a registro.log con rotación; leer() para Ayuda
  icono/             icono.png (1024) generado desde el SVG elegido por pruebas/icono.js; electron-builder hace .icns e .ico
server.js            sigue igual: el modo web (npm start)
servidor.js          parámetros nuevos opcionales: ejecutarNode ({cmd, env}) y shellLogin; guardar.js y formulario.js los usan
public/app.js        si window.cuadernoApp existe: botón «Elegir carpeta…» en Cuadernos, oyente de acciones del menú, textos sin «terminal»
```

Arranque en la app: `electron .` → `main.js` → `app.js` lee la configuración con `config.js` (misma carpeta que la
web), **crea la ventana** con `arrancando.html` y el fondo del tema, resuelve el entorno de la shell (Mac y Linux,
hasta 10 s), lanza `servidor-hijo.js` con ese entorno y el cuaderno decidido por `config.cuadernoAlArrancar` (sin
argumentos: el último; con carpeta en `argv` u `open-file`, esa), **espera el puerto con tope de 15 s** (si antes
llega `exit` o `error`, o vence el tope: registro, diálogo y salir) y carga `urlEntrada()`. Si el hijo muere
después, lo relanza una vez y recarga; a la segunda, diálogo y salir (§2). Cerrar la última ventana mata el hijo
(que cierra el vigilante y los pty) y sale.

Lo que **no** cambia: `cuaderno.js`, el render, los formatos, el kit. La web (`npm start`) sigue funcionando con
el mismo código y la cubren los mismos tests (§7).

## 4. Riesgos y su medida

| # | Riesgo | Probabilidad | Medida | Dónde se comprueba |
|---|---|---|---|---|
| R1 | **`process.execPath` en `guardar.js` y `formulario.js` lanza Electron en vez de Node**: Guardar o corregir abren ventanas o se cuelgan | Segura si no se toca | `ejecutarNode` inyectable; en Electron, `execPath` + `ELECTRON_RUN_AS_NODE=1` solo en el entorno del hijo; fuses sin tocar | Spike (pregunta 3) con el ejemplo con kit; test de `nodeDelKit()`; `grep` de `spawn|exec|npx|execPath` en las herramientas del kit |
| R2 | **El entorno de la sesión gráfica en Mac y Linux**: `git`, `claude`, `node` no están; y `guardar.js` congela su `ENV` al cargar | Alta con Homebrew o nvm | `entornoDeLaShell()` con marcadores y `env -0`, 10 s, respaldo de rutas conocidas; se pasa en el `fork` antes de que el hijo cargue nada; Diagnóstico lo enseña | Spike (pregunta 2) en el Mac de Roberto; tests de Node con una shell falsa (que imprime ruido, que tarda, fish) y uno que carga `guardar` con un entorno y comprueba lo que recibe la herramienta falsa |
| R3 | **`node-pty` no carga en Electron** (ABI, `spawn-helper` sin permiso) | Baja | Prebuilds N-API (Mac y Windows); `npmRebuild: false`; sin asar; el chmod de `server.js` pasa a una función compartida que `servidor-hijo.js` llama (T1); si el hijo muere, el padre lo relanza una vez y lo anota (§2) | Spike: terminal en la app empaquetada, Mac y Windows |
| R4 | **Gatekeeper y SmartScreen**: en macOS 15 ya no vale Control+clic, hay que ir a Privacidad y seguridad → «Abrir de todos modos»; y ese botón solo aparece si el bundle está firmado (ad hoc vale); sin firma ninguna sale «dañado». SmartScreen pide «Más información → Ejecutar de todas formas» en cada versión | Segura en descargas | `mac.identity: "-"`, `hardenedRuntime: false`; criterio: `codesign -dv --verbose=2` dice `Signature=adhoc` e `Identifier=es.cuaderno.app`; `INSTALAR.md` con los pasos; **alternativa para el Mac de Roberto: construir en su ordenador (`npm run empaquetar`), sin marca de cuarentena** | Prueba de instalación (§5 bis) con una descarga real |
| R5 | **Coste de CI**: un build de Mac son 6-10 min ×10 contra la cuota del repo privado; el binario de Electron (~100 MB) hay que descargarlo en el job que lo use | Segura | Empaquetado solo en `workflow_dispatch` y etiquetas `v*`; recorrido Electron en PR solo en Linux (`xvfb-run`), Mac y Windows a mano; Electron ≥ 44 no descarga el binario en `npm ci` (sin `postinstall`): solo el job de `test:electron` lo baja, en un paso explícito y cacheado | `tests.yml`, `empaquetar.yml` |
| R6 | **Tamaño**: ~200 MB instalados, `.dmg` de ~110 MB; sin asar, miles de ficheros | Segura | Asumido por Roberto el 2026-10-09; `files` del builder excluye `tests/`, `docs/`, `ejemplos/`, `pruebas/`, `cuadernos-prueba/`, `playwright`; medir arranque y primera apertura, con la ruta de vuelta al asar anotada | Spike (pregunta 1 y 4) |
| R7 | **La pantalla supone navegador**: `beforeunload` bloquea el cierre en silencio; `target="_blank"`; textos «desde la terminal»; el visor de PDF | Segura | `will-prevent-unload` con diálogo; `_blank` → `openExternal` solo `http/https/mailto`; textos variados con `cuadernoApp`; PDF lo pinta Chromium (comprobar) | Recorrido Electron; `rutas.test.js` para los textos del 403 |
| R8 | **Dos servidores a la vez** (web y app) escriben `recientes` | Media | **Asumido**: ya pasa hoy con dos `npm start`; instancia única evita dos apps; `listen(0)` tras `EADDRINUSE` si 7331 está ocupado | `rutas.test.js`: arrancar con el puerto ocupado |
| R9 | **El recorrido Electron es frágil** (`_electron` experimental, sin pantalla en Linux, lento en Windows, lock de instancia única si Roberto tiene la app abierta) | Media | `xvfb-run`; `userData` temporal y variable para saltar el lock; tiempo máximo propio; si en dos semanas falla por su cuenta, pasa a manual y se anota | Primeras semanas de CI |
| R10 | **Electron cada 8 semanas**; Dependabot propondrá saltos de mayor | Segura | Grupo `electron` mensual en `dependabot.yml`; se sube con el recorrido Electron en verde | `dependabot.yml` |
| R11 | **Fuses**: si alguien «endurece» `runAsNode` o `nodeCliInspect`, se rompen el kit (R1) y el recorrido Electron | Baja | Anotado en §2; comentario en `electron-builder.yml` | Revisión del PR de T6 |
| R13 | **El hijo muere o no arranca** (fallo nativo, `EADDRINUSE`, excepción al cargar): sin camino de fallo, la ventana se queda muda (el WS de recarga no reconecta) o nunca aparece | Media | Puerto solo en `listening`, tope de 15 s, relanzar una vez, diálogo y salir; todo en el registro | Test de `arrancar` con un hijo falso que muere antes y después del puerto |
| R12 | **Windows del padre**: conpty exige Windows 10 1809 o más; rutas y CRLF ya probados en la CI de Windows | Baja | Preguntar la versión (§8); `INSTALAR.md` lo dice | Prueba de instalación |

## 5. El spike técnico (día 1): seguir o parar

Una rama `electron-spike`, sin tests ni diseño, que responde a **cuatro preguntas técnicas** con el cuaderno de
ejemplo con kit en una copia temporal. **Se sigue con las tareas de §6 solo si las cuatro salen bien**; si alguna
falla, se anota aquí lo que se ha visto y se decide con Roberto. La prueba de instalación en máquinas reales
(§5 bis) **no es del spike**: es prueba de usuario y va después de T6.

1. ¿Arranca `crearServidor` en un `utilityProcess`, el padre recibe el puerto, y la ventana carga `urlEntrada()`
   con la cookie puesta (navega a `/` y se ve la portada)? ¿Y si se mata el hijo con la ventana abierta, el padre lo
   relanza y la ventana vuelve? **Sí/no, y el tiempo de arranque hasta la portada** (objetivo: < 2 s; medir con y
   sin asar).
2. ¿Carga `node-pty` en el hijo y la terminal abre una shell con el entorno de login en el Mac (`which git`,
   `which claude`)? ¿Y Guardar encuentra `git` (el entorno llegó al hijo antes de cargar `guardar.js`)?
3. ¿Guardar con kit funciona con `ELECTRON_RUN_AS_NODE=1` (la herramienta `guardar.js` del kit corre y hace su
   commit en la copia)? ¿Qué binario es `process.execPath` dentro del hijo en macOS (el principal o el helper)?
   Antes, `grep -rn "spawn\|exec\|npx\|process.execPath" .kit/herramientas/ lib/` en profesor-kit: ¿alguna
   herramienta lanza `node`, `npm` o `npx` por nombre?
4. ¿`_electron.launch` de Playwright abre la app y lee el título de la portada en Linux con `xvfb-run`, con
   `userData` temporal?

Entregable: una tabla de cuatro filas aquí (§5, «Resultado») con sí/no, cifras y lo que haya que cambiar del
plan. El código del spike no se mergea: las tareas lo reescriben con sus tests.

### Resultado (2026-10-10, en el contenedor Linux de la sesión, rama `electron`, commits `8999bd0`…`b02c287`)

Medido con `xvfb-run -a node electron/spike-medir.js` (Playwright `_electron`) sobre una copia temporal del cuaderno de
ejemplo con kit, `git init` y una herramienta `guardar.js` del kit falsa pero realista (hace el commit con git y dice
con qué Node corre). Electron 44.7.0 (Node 24.21.0 dentro), `node-pty` compilado por `npm ci` con el Node 22 del
sistema y cargado dentro del Node 24 de Electron (N-API, también en Linux).

| Pregunta | Resultado | Cifras y evidencia |
|---|---|---|
| P1 servidor en `utilityProcess`, puerto al padre, ventana con cookie, portada; muerte del hijo | **SÍ** a todo | Arranque hasta la portada: **835, 813 y 782 ms** (binario frío, primera tanda: 1714, 1421, 1482). Ventana «Arrancando…» a los ~200 ms, entorno de la shell +25 ms, puerto a los ~400 ms, portada a los ~550 ms. Cookie: `/api/info` 200, ninguna respuesta ≥ 400 en 17; `document.cookie` vacío (HttpOnly). WebSocket `/cambios` abierto (Chromium pone el `Origin`). Con 7331 ocupado: «se escucha en uno libre», puerto 44407, portada igual. Hijo matado con `SIGKILL`: relanzado en **377 ms**, portada de vuelta; segunda muerte: «se ha caído dos veces» y la app sale |
| P2 entorno de la shell de login (Linux) | **SÍ** en Linux; **Mac sin responder** | `bash -lc` con marcadores y `env -0`: **18-26 ms**, sin necesitar `-ilc`. El PATH resuelto es el de `bash -lc 'echo $PATH'` (con rutas que el proceso lanzador no tenía) más el respaldo; el hijo lo recibe y la herramienta del kit lanzada por `guardar.js` lo ve (`which git` → `/usr/bin/git`). Homebrew, nvm, zsh y fish: no hay en el contenedor |
| P3 Guardar con kit con `ELECTRON_RUN_AS_NODE=1` | **SÍ**; **el grep del kit real, pendiente** | `/api/guardar` desde la ventana → código 0, commit «Guardado desde Electron kit», árbol limpio. La herramienta ve `execPath` = binario de Electron, `node 24.21.0`, `runAsNode=1`, `require('electron')` falla (bien) pero **`process.versions.electron` está definido** (una herramienta que detecte Electron por esa clave se confundiría). En Linux el `execPath` del hijo es el binario principal, no un helper; macOS sigue abierto. El `grep` de `spawn|exec|npx|execPath` en profesor-kit no se pudo hacer: el repo no está en esta sesión (acceso denegado) |
| P4 `_electron.launch` con `xvfb-run`, `userData` temporal, título | **SÍ** | Tres arranques limpios. El lock de instancia única **sí es por `userData`** (`SingletonLock/Cookie/Socket`). Primer fallo: `Socket path too long` porque Chromium crea el socket del singleton bajo **`TMPDIR`** (límite ~108 caracteres), no en `userData`; con `TMPDIR` corto, resuelto (en CI `/tmp` y en macOS `/var/folders/…` no pasa). `--no-sandbox` lo añade Playwright solo cuando se es root; en CI no hace falta. Sin librerías que instalar. Ruido inofensivo: `Failed to connect to the bus` (sin dbus) y `Address family not supported (97)` (sin IPv6) |
| Extra portapapeles | **SÍ, sin pedir permiso** | `writeText` y `readText` funcionan sin handler: el handler por defecto concede todo. T2 lo restringe |
| Extra `node-pty` en el `utilityProcess` | **SÍ** | `/pty` por WebSocket desde la página: prompt en < 1 s, `echo $((40+2))` → 42 |
| Extra tests de Node | **114 tests, 112 pass, 0 fail, 2 skipped** | `npm test` entero tras tocar `guardar.js`, `formulario.js` y `servidor.js` (con Node 22; no se quejó) |

**Veredicto: se sigue con §6.** Lo que el spike ha demostrado falso o nuevo, y cómo cambia el plan:

- **Electron 44 ya no tiene `postinstall`**: `npm install` no descarga el binario; lo baja el primer `require('electron')`
  (lo hizo Playwright: 7,9 s y ~100 MB) o `node node_modules/electron/install.js`. Así que `ELECTRON_SKIP_BINARY_DOWNLOAD`
  sobra, y el job de `test:electron` **descarga el binario en un paso explícito y lo cachea** (`actions/cache` sobre
  `~/.cache/electron`) antes del test. R5, T1 y T7 corregidos.
- **`app.quit()` mata al hijo con código 0 y el relanzado se disparaba**: `before-quit` marca `cerrando` antes. T1 lo
  recoge con test (hijo falso que sale durante el cierre).
- **Diálogo bloqueante en pruebas**: variable para sustituirlo por respuesta fija (ya previsto en T2; también en T1).
- **Zombis `<defunct>`** unos segundos tras salir, cosa del contenedor sin init: el criterio «`ps` limpio» de T1 espera
  hasta 2 s.
- **El token lo leen padre e hijo** del mismo fichero: en T1 el hijo manda `{ puerto, token }` y el padre no lo lee.
- **fish**: con `env -0` no hace falta `string join` (exporta `PATH` con `:`). §2 corregido.
- **No medido**: con y sin asar (el spike no empaqueta; se mide en T6).

**Pendiente que solo se puede hacer fuera de este contenedor:** (1) en el Mac de Roberto, P2 con Homebrew, nvm y zsh, y
qué binario es `process.execPath` dentro del hijo (helper o principal); (2) el `grep` en profesor-kit (o darle acceso al
repo a la sesión); (3) la prueba de instalación de §5 bis, después de T6.

### 5 bis. La prueba de instalación (después de T6, con Roberto)

En el Mac de Roberto, desde una descarga real del artefacto de CI: ¿qué pide Gatekeeper, `codesign -dv
--verbose=2` dice `Signature=adhoc`, la terminal funciona, Guardar con kit funciona? Lo mismo con `npm run
empaquetar` en su ordenador (sin cuarentena). En el Windows del padre: SmartScreen, terminal (conpty), un
cuaderno con CRLF. Tamaños del `.dmg` y del `.exe`. Resultado en este documento y en el plan vivo.

## 6. Tareas (cada una, un PR pequeño en castellano, CI en verde, su fila en el plan vivo)

Formato: **qué** · criterios de aceptación · tests · estimación · depende de. Las estimaciones son de trabajo de
un agente con revisión de Roberto; el total son **5-6 días más el spike** (el 2026-10-09 se dijo 2-3: el abogado
del diablo lo dobló con razones, §9 objeción 10). Cada tarea con pantalla trae su fila en la tabla de casos de
`ejemplos/cuaderno-ejemplo.md` y su recorrido empieza por el texto del caso (`tests/ejemplo.test.js` lo exige).

### T1 · El servidor arranca en un `utilityProcess` y Electron abre su ventana
- **Qué:** `electron/main.js`, `electron/app.js` (`arrancar` con Electron inyectado), `electron/servidor-hijo.js`,
  `electron/entorno.js` (`entornoDeLaShell`), `electron/registro.js`, `electron/arrancando.html`; el chmod de
  `spawn-helper` de `server.js` pasa a una función compartida que llama `servidor-hijo.js`; `npm run app`
  (`electron .`), campo `main` en `package.json`, `electron` como `devDependency` con versión exacta; **camino de
  fallo del hijo** (puerto en `listening`, `EADDRINUSE` → `listen(0)`, tope de 15 s, relanzar una vez, diálogo y
  salir); cierre limpio (matar el hijo, que cierra vigilante y pty; `before-quit` marca `cerrando` para que la salida del hijo
  al cerrar no dispare el relanzado); el hijo manda `{ puerto, token }`; instancia única con `userData`; variable de
  pruebas que sustituye el diálogo por una respuesta fija; `node node_modules/electron/install.js` documentado como el
  paso que baja el binario; **`tests.yml` añade `electron/**`, `electron-builder.yml` y
  `.github/workflows/empaquetar.yml` a los dos filtros `paths`** (sin eso un PR que solo toque `electron/` no
  corre la CI).
- **Criterios:** `npm run app` abre una ventana con el último cuaderno (o Cuadernos); la dirección no se ve; cerrar
  la ventana cierra el servidor y los pty (sin huérfanos: `ps` limpio en Mac y Linux pasados 2 s, Administrador de tareas en
  Windows); una segunda instancia trae la ventana al frente; con 7331 ocupado arranca en otro puerto; la ventana aparece
  antes de resolver el entorno; si se mata el hijo, el padre lo relanza y la pantalla vuelve; si el hijo no arranca,
  hay diálogo y la app sale con el motivo en el registro; en el Mac,
  `echo $PATH` en la terminal de la app es el de Terminal y Guardar encuentra `git`; `registro.log` recoge lo que
  hoy va a `console.error`.
- **Tests:** `tests/electron-app.test.js` (`arrancar` con un Electron falso y un hijo falso: crea la ventana antes
  del entorno, lanza el hijo con el entorno resuelto, carga la URL de entrada al llegar el puerto, relanza si el hijo
  muere después, no relanza si el hijo sale durante el cierre, sale con diálogo si muere antes o vence el tope, cierra en orden); `rutas.test.js`: `listen` con
  7331 ocupado acaba en otro puerto; `tests/electron-entorno.test.js` (`entornoDeLaShell` con una shell falsa que imprime ruido antes y después de los marcadores, otra
  que tarda más del tope → respaldo, otra fish; un test que carga `guardar` con un entorno dado y comprueba el que
  recibe la herramienta falsa); `tests/electron/ventana.test.js` con `_electron.launch`: abre, lee «Cuaderno de
  ejemplo», cierra, el puerto queda libre. Script `test:electron`.
- **Estimación:** un día. **Depende de:** spike.
- **Hecha (2026-10-10, rama `electron`, pendiente de PR).** Lo que difiere de lo escrito arriba, y por qué: (1) la lógica del
  hijo va en `electron/hijo.js` (`arrancarHijo`, probada en Node con un `parentPort` falso: `tests/electron-hijo.test.js`,
  que es donde se prueba `EADDRINUSE` → `listen(0)`, no en `rutas.test.js`), y `servidor-hijo.js` queda como punto de
  entrada de seis líneas; así el camino del puerto entra en el suelo de cobertura. (2) El chmod compartido es
  `sistema.repararAyudantePty()` (test en `sistema.test.js`). (3) El cuaderno lo decide el padre con
  `config.cuadernoAlArrancar` y viaja al hijo en `CUADERNO_CARPETA`. (4) Variables de prueba: `CUADERNO_USERDATA`
  (lock) y `CUADERNO_SIN_DIALOGO` (el diálogo se anota y se da por cerrado). (5) La segunda muerte solo cuenta si pasa
  en menos de un minuto de la anterior (tregua inyectable); pasado el minuto se vuelve a relanzar. (6) `shellLogin` es
  de T2 y no se pasa aún; el test «carga `guardar` con un entorno dado» es de T3 (`guardar.test.js`), no de aquí.
  (7) Sin test con fish real (no hay en el contenedor): la shell falsa cubre ruido, `-ilc`, tope y fallo. (8) El tiempo
  de arranque no es criterio de test: lo mide `pruebas/arranque-electron.js` (833, 828 y 782 ms el 2026-10-10, como el
  spike). (9) `entornoDeLaShell` es sincrónica (`spawnSync`, hasta 10 s): la ventana ya está pintada, pero el proceso
  principal no atiende eventos mientras espera; si en el Mac se nota, pasarla a `spawn` asíncrono es un cambio local.
  El recorrido `tests/electron/ventana.test.js` (fila 25 del ejemplo) abre, mata al hijo y comprueba el relanzado, y
  cierra comprobando puerto libre y `ps` limpio.

### T2 · Lo del navegador que en la app cambia
- **Añadido tras T1 (2026-10-10):** `entornoDeLaShell` pasa a asíncrona (`spawn` con promesa en vez de `spawnSync`): hoy
  el proceso principal no atiende eventos mientras espera a la shell (hasta 10 s; en Linux son 25 ms, el Mac sin medir) y
  en Mac eso es el menú sin responder. Y el `backgroundColor` con tema `auto` deja de ser blanco: sigue a `nativeTheme`.
- **Qué:** `setWindowOpenHandler` y `will-navigate` con `esquemaPermitido`; `will-prevent-unload` con el diálogo
  «¿Descartar lo escrito?»; `setPermissionRequestHandler`; `partition` en memoria; `nativeTheme.themeSource = temaNativo(config.tema)` (`auto`/`claro`/`oscuro` → `system`/`light`/`dark`) y
  `backgroundColor` desde `config.tema` (también al cambiar Ajustes: la pantalla avisa por IPC o el padre relee la
  configuración al cambiar el fichero); pty con shell de login (`servidor.js` recibe `shellLogin: true`);
  `sistema.abrirUrl` no se llama en la app; textos «desde la terminal» (403 del servidor, `app.js` l.18,
  `#aviso-reinicio`) variados con `cuadernoApp`; nota en Ajustes de que `comando_agente` tiene que ser un
  ejecutable, no un alias.
- **Criterios:** un enlace `https:` de una nota abre el navegador del sistema y la ventana no cambia; un enlace
  `file:` o `javascript:` no hace nada y queda en el registro; con el editor sucio, cerrar o recargar pregunta y
  cancelar deja la ventana; con tema oscuro fijo no hay flash blanco al arrancar; `navigator.clipboard.writeText`
  funciona sin pedir permiso.
- **Tests:** `esquemaPermitido` y `temaNativo` puros; `rutas.test.js` para `shellLogin` y los textos del 403; recorrido Electron:
  enlace externo interceptado (con `openExternal` sustituido por IPC de pruebas, nunca abriendo un navegador en
  CI) y cierre con cambios (diálogo sustituido por respuesta fija en pruebas).
- **Estimación:** un día. **Depende de:** T1.

### T3 · Guardar y corregir con kit desde la app: el Node del kit
- **Hecha (2026-10-10, en un árbol aparte, integrada en `7532d26`):** el código lo dejó el spike (`5b613eb`) y T3 lo limpió
  (`341caf2`) y lo fijó con tests (`f073545`, `cff9a1b`): herramientas del kit y corrector lanzados con el Node inyectado y el
  entorno fusionado, el entorno de `guardar.js` ya no se congela al cargar (los tests fallan contra el código anterior),
  `crearServidor({ ejecutarNode })` llega a las rutas de guardar, traer, deshacer, revisión y corrección. Ayudantes en
  `tests/ayuda.js` (`otroNode()`, copia portable del binario; `herramientasChivatas()`). 117 → tests en verde; ramas de
  `guardar.js` 82 → 85 %. Visto de paso y fuera de T3, al Inbox del plan vivo: `formulario.js` no pone
  `GIT_TERMINAL_PROMPT=0` ni trata el tiempo agotado al corregir (debería reutilizar el `ejecutar` de `guardar.js`).
- **Qué:** `crearServidor({ ejecutarNode })`; `guardar.js` y `formulario.js` dejan de leer `process.execPath` y de
  congelar `ENV` al cargar (función perezosa) y usan lo inyectado (por defecto, lo de siempre: la web no cambia);
  `entorno.js` → `nodeDelKit(env)` devuelve `{ cmd: env.CUADERNO_NODE || process.execPath, env: { ELECTRON_RUN_AS_NODE: '1' } }`
  (el padre pone `CUADERNO_NODE` con su `execPath` en el entorno del hijo: en macOS el `execPath` del hijo es el helper).
- **Criterios:** en la app, Guardar, Deshacer y corregir un examen sobre la copia del ejemplo con kit hacen lo
  mismo que en la web (commit, salida del kit en pantalla); sin Node instalado en el sistema, también.
- **Tests:** tests de Node de `guardar` y `formulario` con un `ejecutarNode` falso que registra cmd, args y env;
  test de `nodeDelKit()`; los recorridos de la web con kit, sin cambios.
- **Estimación:** medio día. **Depende de:** T1.

### T4 · Abrir una carpeta: diálogo del sistema, arrastrar al icono, argumento
- **Qué:** `preload.js` expone `cuadernoApp.elegirCarpeta()` → `ipcMain.handle('elegir-carpeta')` (valida
  `senderFrame`) → `dialog.showOpenDialog({ properties: ['openDirectory'] })`; en `public/app.js`, si existe
  `window.cuadernoApp`, Cuadernos enseña un botón «Elegir carpeta…» junto a la casilla de la ruta (que se queda),
  y el resultado va a `POST /api/abrir` como hoy; `app.on('open-file')` y carpeta en `argv` / `second-instance`
  abren esa carpeta.
- **Criterios:** elegir una carpeta la abre y la añade a recientes; cancelar no hace nada; arrastrar una carpeta
  al icono del Dock la abre; en la web no aparece el botón ni cambia nada (los recorridos actuales siguen en verde
  sin tocar).
- **Tests:** recorrido Electron que fuerza el diálogo con una ruta fija (en pruebas, `CUADERNO_DIALOGO_PRUEBA=<ruta>`
  y no abre diálogo); test de `arrancar` con `argv` que lleva carpeta; fila nueva en la tabla de casos.
- **Estimación:** medio día. **Depende de:** T1.
- **Hecha (2026-10-10, en un árbol aparte sobre `c22e0d4`, pendiente de integrar con T2).** Lo que difiere de lo escrito arriba,
  y por qué: (1) todo lo de T4 va en un módulo nuevo, `electron/carpeta.js` (`crearAbridor`: el canal IPC, `open-file`, la
  carpeta de `argv` y `second-instance`; `carpetaDeArgv`, `remitenteValido` y `abrirEnServidor` puros), y `app.js` solo lo
  engancha en cuatro líneas (el preload en `webPreferences`, `tomar()` en el entorno del hijo y `despachar()` al llegar el
  puerto), para no chocar con T2. (2) La carpeta que llega **con el servidor ya en marcha** (open-file o segunda instancia
  con la app abierta) la abre **el padre** con `POST /api/abrir` al hijo, con la cookie del código (conoce puerto y token) y
  sin `Origin` (navegación propia para el servidor), y después vuelve a cargar la URL de entrada: así no hace falta un canal
  IPC más en el preload ni que la ventana esté cargada, y el servidor no cambia; el WebSocket de cambios no valía solo,
  porque la pantalla lo ignora cuando no hay cuaderno abierto (Cuadernos). Si llega **antes** del puerto (argv, u open-file
  durante «Arrancando…»), va al hijo en `CUADERNO_CARPETA` en lugar del último reciente; la que llega entre el fork y el
  puerto se despacha al escuchar. Un relanzado tras una caída ya no lleva la carpeta de argv: vuelve al último reciente,
  que es el que estaba abierto. (3) `carpetaDeArgv` salta el ejecutable, la ruta de la propia app cuando no está
  empaquetada (`electron .`: el primer argumento que no es un flag; Playwright quita sus `--inspect=0` antes de que lleguen
  a `process.argv`, comprobado) y los flags; las relativas se resuelven contra el directorio de trabajo (la segunda
  instancia trae el suyo). (4) `open-file` con algo que no es una carpeta (un fichero) se ignora y se anota. (5) El preload
  pasa `version` desde `additionalArguments` (`--cuaderno-version=<package.json>`): en el sandbox no se puede leer el
  `package.json`; `tests/electron-carpeta.test.js` vigila que el único `require` sea `electron`. (6) El remitente del IPC se
  valida con `event.senderFrame.url` que empiece por `http://localhost:<puerto>/`; lo demás se rechaza y queda en el registro.
  (7) En `public/app.js`, con `window.cuadernoApp`: botón «Elegir carpeta…» junto a la casilla (que se queda), resumen de
  Cuadernos, el 403 («cierra y vuelve a abrir la app») y el `#aviso-reinicio` (se reescribe el texto al cargar, sin tocar
  `index.html`); sin él, nada cambia. (8) El recorrido `tests/electron/carpeta.test.js` (fila 26 del ejemplo) cubre además
  la **segunda instancia real** (lanza el binario de Electron con otra carpeta y la primera la abre), que arriba no estaba
  como test. Textos del 403 del servidor y `will-prevent-unload`: siguen en T2.

### T5 · Menú en castellano y atajos de app
- **Qué:** `electron/menu.js` (tabla → plantilla), con roles estándar en Edición (sin ellos, en Mac no hay copiar y
  pegar), Ver (recargar, zoom, pantalla completa), Ventana y Ayuda (plan vivo, versión, «Mostrar registro»,
  «Diagnóstico»). Los elementos propios mandan `webContents.send('accion', nombre)` y la pantalla los atiende con
  `cuadernoApp.alAccion(cb)`. De salida: **Guardar (⌘S / Ctrl S)**, **Ajustes (⌘,)**, **Abrir carpeta… (⌘O)**,
  **Cuadernos recientes** (submenú desde `config.leer().recientes`). Los demás, cuando Roberto dé su lista (§8).
- **Criterios:** ⌘S guarda (y no abre «Guardar como»); el menú se ve en castellano en Mac y Windows; los recientes
  se actualizan al abrir otro cuaderno; Diagnóstico enseña versión, puerto, `PATH` resuelto y si `node-pty` cargó.
- **Tests:** `tests/electron-menu.test.js` (puro: etiquetas, aceleradores y acciones por plataforma); recorrido
  Electron: `accion: guardar` por IPC de pruebas llega a la pantalla; fila en la tabla de casos (⌘S).
- **Estimación:** medio día. **Depende de:** T1, T4.

### T6 · Icono y empaquetado sin firma
- **Qué:** elegir el logo (Roberto, §8); `pruebas/icono.js` rasteriza el SVG a `electron/icono/icono.png` (1024)
  con el Chromium de Playwright; `electron-builder.yml` (`asar: false`, `npmRebuild: false`, `files` acotado,
  `mac.identity: "-"`, `hardenedRuntime: false`, sin notarización, `dmg` arm64 y x64, `nsis` x64 por usuario sin
  preguntar, comentario «fuses sin tocar: runAsNode y nodeCliInspect»); `npm run empaquetar`; `INSTALAR.md` con
  los pasos de Gatekeeper (Privacidad y seguridad → «Abrir de todos modos») y SmartScreen.
- **Criterios:** `codesign -dv --verbose=2` del `.app` dice `Signature=adhoc` e `Identifier=es.cuaderno.app`; el
  `.dmg` y el `.exe` se construyen en local; la terminal funciona en el paquete (prebuilds en disco); tamaños y
  tiempo de arranque anotados. La prueba en las dos máquinas reales es §5 bis, con Roberto.
- **Tests:** ninguno automático del binario; la CI de T7 comprueba que el empaquetado termina.
- **Estimación:** un día (la primera vez con electron-builder siempre cuesta). **Depende de:** T1-T5.

### T7 · CI: recorrido Electron en los tests y empaquetado a mano o por etiqueta
- **Qué:** `tests.yml` añade el paso `npm run test:electron` en Linux con `xvfb-run` (y en Mac y Windows cuando
  se lanza a mano), con un paso previo que baja el binario de Electron y lo cachea (`actions/cache` sobre `~/.cache/electron`); `empaquetar.yml` nuevo,
  `workflow_dispatch` y `push` de etiquetas `v*`, construye en `macos-latest` y `windows-latest` y sube los
  instaladores como artefactos del run (y como Release si es etiqueta). Dependabot: grupo `electron` mensual.
- **Criterios:** PR en verde con el recorrido Electron; un `workflow_dispatch` deja `.dmg` y `.exe` descargables.
- **Estimación:** un día. **Depende de:** T6.

### T8 · Cierre: plan vivo, README, la etiqueta de la web y la crítica de diseño
- **Qué:** §0, §6 (filas Plataforma, Arranque, CI, Teclado, Seguridad) y §8 del plan vivo; README con «Arrancar»
  para la app y para la web; lo de §7 (etiqueta `web-0.1.0`); ronda de crítica de diseño sobre capturas de la
  ventana (menú, Cuadernos con el botón, icono en el Dock, Diagnóstico) como manda AGENTS.md.
- **Estimación:** medio día. **Depende de:** todo.

## 7. La versión web: viva, y marcada

1. **La web sigue viva en el mismo código.** La app Electron es una ventana alrededor del mismo servidor;
   `npm start` sigue abriendo el navegador y **todos los recorridos de navegador siguen corriendo contra la web**.
   No hay dos ramas de código ni dos versiones que mantener: si la web se rompe, lo dice la CI de cada PR. Es el
   mejor «por si acaso» posible porque no envejece.
2. **Una marca descargable.** Antes del primer PR de Electron se pone la **etiqueta `web-0.1.0`** sobre `main`.
   GitHub da el zip de cualquier etiqueta (Code → Tags → Download ZIP) y `git clone --branch web-0.1.0` la trae; el
   README lo dice en una línea («la última versión solo web: etiqueta `web-0.1.0`; `npm install` y
   `node server.js`»). Una Release con zip propio no añade nada (el zip exige `npm install` igual) y se hace solo
   si el repo pasa a público y apetece tener la página.
3. **Lo que no se recomienda:** una carpeta `web/` o `legado/` dentro del repo con una copia del código: dos
   códigos que divergen, el doble de tests o ninguno, y `.gitignore` ya excluye `*.zip`. Si Roberto quiere de
   todas formas «una carpeta» en el repo, es su decisión (§8) y se hace: `legado/web-0.1.0/LEEME.md` con el
   enlace a la etiqueta, nunca una copia del código.

## 8. Lo que decide Roberto antes de empezar

1. **La lista de atajos de app** («el par de cosas»): el plan arranca con ⌘S Guardar, ⌘, Ajustes, ⌘O Abrir
   carpeta y los recientes. ¿Qué más? (candidatos: ⌘E editar, ⌘K acciones rápidas cuando llegue ese bloque, ⌘P
   Profesor, ⌘1/⌘2 paneles).
2. **El logo**: 1, 2 o 3 de `docs/diseno/logo/` (recomendación de Claude del 2026-10-09: la 1).
3. **La marca de la web**: etiqueta sola con línea en el README (recomendado), Release con zip, o carpeta
   `legado/` con un LEEME (§7).
4. **Dónde se construye el `.dmg` de su Mac**: en CI (descarga con cuarentena: «Abrir de todos modos») o en su
   ordenador con `npm run empaquetar` (sin cuarentena). Para el Windows de su padre, CI.
5. **¿Hacer público el repo antes del empaquetado en CI?** Público: la CI de Mac y Windows no gasta cuota y
   «Buscar versión nueva» es posible sin token. Privado: unos 100 min de cuota por build completo y sin aviso de
   versión nueva.
6. **Arranque al iniciar sesión**: fuera (recomendado: sin firma falla en silencio en Mac) o a mano para el
   padre (carpeta Inicio de Windows).
7. **Qué Windows tiene su padre** (conpty necesita Windows 10 1809 o más).

## 9. Abogado del diablo (2026-10-10)

Ronda de un agente independiente sobre el borrador, con el repo, los tarballs de `node-pty@1.1.0` y
`app-builder-lib@26.15.3`, la documentación de Electron y `playwright-core@1.56.1` a mano. **15 objeciones: 14
aplicadas, 1 aplicada en parte.** Lo que no tocaría, según él (y queda): el mismo `crearServidor` y la misma
`public/` con preload opcional; entrar por `urlEntrada()`; la misma carpeta de configuración; sin firma, sin
notarización, sin `autoUpdater`, sin universal; `npmRebuild: false`; empaquetar solo a mano o por etiqueta; la web
viva en el mismo código; icono sin `sharp`.

| # | Objeción | Gravedad | Qué se hizo |
|---|---|---|---|
| 1 | «electron-builder firma ad hoc sin identidad» es falso: sin identidad no firma, con `identity: null` tampoco, y en arm64 un `.dmg` sin firma sale «dañado» sin «Abrir de todos modos» (fuente: `macOptions.d.ts` de app-builder-lib 26.15.3) | Bloqueante | **Aplicada**: `mac.identity: "-"` y `hardenedRuntime: false`; criterio `Signature=adhoc` en T6 y §5 bis. Lo de Control+clic en macOS 15 era cierto y se mantiene |
| 2 | Servidor en el proceso principal: cada `spawnSync` (Guardar, Traer, corregir, `estadoGit` por reciente, papelera) congela la ventana entera; el plan lo descartaba «sin ganar nada» | Bloqueante | **Aplicada**: el servidor va en un `utilityProcess` (`servidor-hijo.js`); pasar el servidor a asíncrono sigue en el Inbox como deuda aparte |
| 3 | `guardar.js` congela `ENV` al cargar: el `PATH` de login llegaría tarde y la terminal encontraría `git` pero Guardar no | Importante | **Aplicada**: el entorno se pasa en el `fork` antes de que el hijo cargue nada, y `ENV` pasa a perezoso en T3, con test |
| 4 | `$SHELL -ilc 'echo $PATH'` con 3 s falla en silencio: ruido de MOTD, p10k y nvm; fish separa por espacios; nvm tarda 1-3 s | Importante | **Aplicada**: marcadores y `env -0`, `-l` primero, 10 s, respaldo de rutas conocidas, fish, `SSH_AUTH_SOCK`/`LANG`/`GIT_*`, Linux también, Diagnóstico visible |
| 5 | `ELECTRON_RUN_AS_NODE` depende del fuse `runAsNode` (por defecto habilitado) y Playwright del `nodeCliInspect`; nadie ha mirado si el kit lanza `node`/`npm` por nombre; el kit ve el Node de Electron | Importante | **Aplicada**: «fuses sin tocar» en §2, R11, comentario en el builder; `grep` en el kit como parte de la pregunta 3 del spike |
| 6 | Tres hechos falsos en §1: `node-pty` no trae prebuild de Linux; el Chromium de Playwright es el 141, no el 152; el `sandbox` es un CSP del cuaderno, no de la app | Importante | **Aplicada**: §1 corregido |
| 7 | En Electron, `beforeunload` no pregunta: bloquea el cierre en silencio (y afectaría a Recargar) | Importante | **Aplicada**: `will-prevent-unload` con diálogo, sin IPC ni cambios en la pantalla |
| 8 | `openExternal` demasiado ancho (`file:`, `smb:`, `javascript:`), IPC sin validar remitente, cookie persistida en `userData` sin necesidad, permisos sin handler | Importante | **Aplicada**: lista de esquemas con test, `senderFrame`, `partition` en memoria, `setPermissionRequestHandler` solo portapapeles |
| 9 | El recorrido Electron no entra en `npm test`; excluir `main.js` de la cobertura no mide nada; faltan las filas de casos; el lock de instancia única rompe el test si la app está abierta; `npm ci` descarga Electron en todos los jobs | Importante | **Aplicada**: `app.js` con Electron inyectado dentro del suelo; `test:electron` con paso propio; filas en la tabla; `userData` temporal; `ELECTRON_SKIP_BINARY_DOWNLOAD` |
| 10 | 2-3 días es la mitad: T1, T3, T6 y T7 doblan; la prueba en máquinas reales no es de un agente | Importante | **Aplicada**: 5-6 días más el spike; estimaciones por tarea revisadas; la instalación pasa a §5 bis |
| 11 | `asar: false` es defendible, pero las razones (el `fs`, los ejecutables de `node-pty`) no lo son: Electron parchea `fs` y `node-pty` ya busca en `app.asar.unpacked` | Menor | **Aplicada**: la decisión se mantiene con la razón correcta (depurable y parcheable para dos usuarios), coste real anotado y ruta de vuelta |
| 12 | La Release con zip no aporta nada sobre la etiqueta; GitHub ya da el zip de cualquier etiqueta; `.gitignore` excluye `*.zip` | Menor | **Aplicada en parte**: la recomendación pasa a «etiqueta sola con línea en el README». La Release y la carpeta siguen como opciones en §8 porque Roberto pidió expresamente «descargar de una carpeta»: lo decide él |
| 13 | Faltan tareas: registro a fichero y Diagnóstico; textos «desde la terminal»; `open-file` y `argv`; arranque al iniciar sesión (falla en silencio sin firma); tema fijo y `nativeTheme`; aviso de versión nueva; versión de Windows; `comando_agente` por nombre | Menor | **Aplicada**: registro y Diagnóstico en T1 y T5; textos y tema en T2; `open-file`/`argv` en T4; arranque, versión nueva y Windows a §8; nota de `comando_agente` en T2 |
| 14 | El criterio del spike mezclaba lo técnico con la prueba de usuario | Menor | **Aplicada**: spike de cuatro preguntas técnicas; §5 bis para la instalación |
| 15 | Instancia única no protege de web + app escribiendo `recientes` a la vez | Menor | **Aplicada**: R8 pasa a «asumido, ya pasa hoy» |

## 10. Revisión de confirmación (2026-10-10)

Segundo agente independiente, con alcance cerrado: comprobar que los 15 arreglos de §9 están aplicados sin
contradicciones, verificar contra documentación de primera mano los hechos técnicos que la revisión introdujo, y
examinar el camino de fallo del `utilityProcess`. **Veredicto: «viable con cambios».** La arquitectura se sostiene
con la documentación y el código; faltaban el camino de fallo del hijo y un hueco de la CI. **8 puntos, todos
aplicados.**

Hechos confirmados con fuente (documentación de Electron 44, tarballs de `app-builder-lib@26.15.3`,
`playwright-core@1.56.1` y `node-pty@1.1.0`): `utilityProcess.fork` con `env` y `process.parentPort`;
`ELECTRON_RUN_AS_NODE` también desde el helper de macOS; `will-prevent-unload` con `preventDefault` descarga la
página y `close` con `beforeunload` cancela en silencio; `partition` sin `persist:` es sesión en memoria;
`clipboard-sanitized-write` es el nombre del permiso; `identity: "-"` es ad hoc y necesita `hardenedRuntime: false`;
`electronFuses` sin fijar no toca nada y `runAsNode` y `nodeCliInspect` van habilitados; `_electron.launch` acepta
`args` y `env` y arranca con `--inspect=0`; `open-file` solo en macOS; `nativeTheme.themeSource` es
`system | light | dark`; `setLoginItemSettings` falla en silencio sin firma; Electron 44.7.0 lleva Node 24.21.0.
**No pudo comprobar en documentación** (lo responde el spike): que `node-pty` cargue dentro de un `utilityProcess`
(pregunta 2), que la cookie del 302 viaje en fetch y WebSocket de la ventana (pregunta 1), si `writeText` pide
permiso sobre `http://localhost`, y que el lock de instancia única sea por `userData`.

| # | Problema | Gravedad | Qué se hizo |
|---|---|---|---|
| 1 | La muerte del hijo no estaba en el plan: la ventana se queda muda (el WS de recarga no reconecta) | Importante | **Aplicado**: relanzar una vez y recargar; a la segunda, diálogo y salir; R13; criterio y test en T1; pregunta 1 del spike |
| 2 | Esperar el puerto sin tope ni ruta de fallo; el entorno (10 s) antes del primer píxel | Importante | **Aplicado**: ventana antes del entorno con `arrancando.html`; puerto solo en `listening`; `EADDRINUSE` → `listen(0)` (en vez de `puertoLibre()`, que tenía carrera); tope de 15 s con diálogo y salir |
| 3 | `tests.yml` filtra por `*.js` de la raíz: un PR solo de `electron/` no correría la CI | Importante | **Aplicado**: T1 añade `electron/**`, `electron-builder.yml` y `empaquetar.yml` a los `paths` |
| 4 | `themeSource` no acepta `auto`/`claro`/`oscuro` | Menor | **Aplicado**: `temaNativo()` pura con test (T2) |
| 5 | En macOS el `execPath` del hijo es probablemente el helper | Menor | **Aplicado**: el padre pasa `CUADERNO_NODE`; `nodeDelKit(env)` lo prefiere; el spike anota el binario |
| 6 | `setPermissionRequestHandler` solo: un futuro check handler «deniega todo» rompería copiar ruta | Menor | **Aplicado**: nota en §2 |
| 7 | Dos cabos sin tarea: el chmod compartido de `spawn-helper` y un `registro()` del preload sin uso | Menor | **Aplicado**: el chmod va en T1 (`servidor-hijo.js`); `registro()` fuera del preload, el menú abre el registro |
| 8 | §1 fijaba 44.7.0 pero citaba el Node de 44.0 | Menor | **Aplicado**: Node 24.21.0 |
