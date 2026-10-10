# La app de escritorio con Electron: plan de trabajo

**2026-10-10 · estado: plan redactado; la ronda del abogado del diablo (§9) está en marcha; después, que Roberto lo
apruebe y decida las preguntas abiertas de §8.** Es el «siguiente bloque» del plan vivo (§0, decisión de Roberto del
2026-10-09): una ventana propia para él y su pareja, sin firma ni tienda, «como mucho hacer público el repo».
Sus palabras: «tenerlo en navegador me mata» y hay «un par de cosas que podríamos hacer mejor con atajos de app».

Este documento está escrito para **delegar cada tarea a otro modelo** sin que tenga que leer la conversación:
§1 dice qué hay hoy y qué no se puede romper, §2 las decisiones tomadas y por qué, §3 la arquitectura, §4 los
riesgos con su medida, §5 el spike con su criterio de seguir o parar, §6 las tareas una a una con sus criterios
de aceptación, §7 qué pasa con la versión web, §8 lo que decide Roberto y §9 la ronda del abogado del diablo.

## 1. De dónde se parte (hechos del repo, 2026-10-10)

- **La app es un servidor Node sin build más una pantalla en `public/`.** `server.js` (47 líneas) lee los
  argumentos y la configuración, hace `crearServidor({ pty, token })` de `servidor.js` (288 líneas), escucha en
  `127.0.0.1:7331` y abre el navegador con `sistema.abrirUrl` en la URL de entrada (`/?t=<token>`), que fija una
  cookie y vuelve a `http://localhost:7331/`. **Todo lo de verdad está en `servidor.js`, `cuaderno.js`, `kit.js`,
  `guardar.js`, `config.js`, `sistema.js`**: el servidor ya es una función que se puede llamar desde cualquier
  proceso Node, y sus tests (`tests/rutas.test.js`) lo arrancan así.
- **Seguridad hoy:** cookie con un código por usuario (`config.token()`, fijo entre arranques, en la carpeta de
  configuración), comprobación de `Host` y `Origin` (solo `localhost` y `127.0.0.1` con el puerto), `sandbox`
  en la pantalla. Documentado en la cabecera de `servidor.js`.
- **Configuración:** `~/.config/cuaderno/` (Linux y Mac) o `%APPDATA%\cuaderno\` (Windows): `config.json`
  (tema, letra, recientes, tamaños del panel, `comando_agente`) y `token`. `CUADERNO_CONFIG_DIR` la cambia (los
  tests la usan).
- **Dependencias nativas: solo `node-pty` 1.1.0** (la terminal). Trae prebuilds para `darwin-arm64`,
  `darwin-x64`, `win32-x64`, `win32-arm64` y Linux, compilados con **node-addon-api (N-API)**, así que el mismo
  `pty.node` sirve para Node y para Electron sin recompilar. Trae además ejecutables sueltos que tienen que estar
  en disco, no dentro de un `asar`: `spawn-helper` (Mac), `conpty.dll`, `OpenConsole.exe`, `winpty-agent.exe`
  (Windows). `server.js` ya repara el permiso de ejecución de `spawn-helper` al arrancar.
- **Las herramientas del kit se lanzan con `process.execPath`** (`guardar.js`, línea 18:
  `spawnSync(process.execPath, ['.kit/herramientas/<nombre>', …])`). En Node, `execPath` es `node`. **En Electron
  es el binario de Electron**: lanzaría una ventana, no un script. Es el fallo más seguro de todo el bloque y está
  en §4 y en la tarea 3.
- **La terminal lanza `$SHELL` (o `powershell.exe`) sin `-l`**, heredando el entorno del proceso. En una app de
  escritorio en Mac, ese entorno es el de la sesión gráfica: el `PATH` no lleva Homebrew ni nvm, así que `git`,
  `node`, `claude` o `codex` no se encuentran. También `execFileSync('git')` en `servidor.js` y `guardar.js`.
- **Versiones hoy (npm, 2026-10-10):** Electron **44.7.0** (lleva **Node 24.x** y Chromium 152: cumple
  `engines.node >= 24` del `package.json`, y la pantalla ve el mismo Chromium que los recorridos de Playwright),
  electron-builder **26.15.3**, Playwright 1.56.1 (ya en `devDependencies`; trae `_electron` para lanzar y
  manejar una app Electron desde un test).
- **CI:** `.github/workflows/tests.yml`: `npm test` (con suelo de cobertura 85 %) y `npm run test:navegador` con
  Node 24; `push` solo en `main` y solo Linux; en PR y a mano, Linux, Mac y Windows. Solo salta si cambian
  `*.js`, `public/`, `tests/`, `pruebas/`, dependencias o el propio workflow. Repo **privado**: macOS cuenta ×10 y
  Windows ×2 contra la cuota.
- **Lo que el navegador no deja hacer y en la app sí** (lo que motiva el bloque): elegir una carpeta con el
  diálogo del sistema (hoy se escribe la ruta a mano en la pantalla de Cuadernos), **⌘S / Ctrl S** sin que el
  navegador abra «Guardar como» (hallazgo 5 de la revisión de diseño), atajos sin reservar (⌘K, ⌘E…),
  arrancar sin terminal ni Node instalado, una ventana con nombre e icono propios, y que nadie tenga que saber
  qué es `localhost:7331`.

## 2. Decisiones (tomadas en este plan; las que son de Roberto, en §8)

| Qué | Decisión | Por qué |
|---|---|---|
| Dónde corre el servidor | **Dentro del proceso principal de Electron**, con `crearServidor` tal cual, escuchando en `127.0.0.1` | Electron 44 lleva Node 24: el mismo código, sin segundo runtime, sin exigir Node instalado. Un `utilityProcess` aparte se descarta de salida: añade IPC sin ganar nada hoy |
| Puerto | **7331 si está libre; si no, uno libre (`listen(0)`)** | Mantiene la decisión «una sola dirección» para quien abra además un navegador; con el puerto ocupado (una `npm start` abierta) la ventana funciona igual, porque en Electron la dirección no se ve |
| Cómo entra la ventana | **`loadURL` de `urlEntrada()`** (la de `/?t=<token>`): la misma cookie, los mismos `Host`/`Origin` | Un solo modelo de seguridad para web y app; cero caminos nuevos en el servidor |
| Pantalla | **La misma `public/`**, sin `nodeIntegration`, con `contextIsolation` y `sandbox`; un `preload` mínimo que expone `window.cuadernoApp` (elegir carpeta, recibir atajos del menú) | Principio 3 aplicado a la plataforma: la pantalla funciona sola en el navegador; con Electron añade lo de Electron. Sin `window.cuadernoApp`, la pantalla se comporta como hoy |
| Configuración | **La misma carpeta de `config.js`** (`~/.config/cuaderno`), no `app.getPath('userData')` | Web y app comparten recientes, tema y código; ir y volver no pierde nada |
| Empaquetado | **electron-builder 26**, `.dmg` (arm64 y x64 por separado, sin universal) y `.exe` NSIS (x64), **sin firma ni notarización**, **sin asar en la primera versión** (`asar: false`) | Sin firma por decisión de Roberto (uso propio). Sin asar porque el servidor lee `public/` y `node_modules/` con `fs` y `node-pty` necesita ejecutables sueltos en disco: una clase entera de problemas menos. El universal duplica el tamaño sin ganar nada con dos máquinas conocidas. Se revisa en §5 si el arranque sin asar tarda |
| Node para el kit | **`process.execPath` con `ELECTRON_RUN_AS_NODE=1`** cuando se corre en Electron | El binario de Electron se comporta como `node` con esa variable: las herramientas del kit corren sin exigir Node instalado |
| `PATH` en Mac y Linux | **Al arrancar, leer el `PATH` de la shell de login una vez** (`$SHELL -ilc 'echo $PATH'`, con tiempo máximo) y ponerlo en `process.env` antes de crear el servidor | Resuelve `git`, `claude`, `codex`, `node` para `execFileSync`, `spawnSync` y el pty. Es lo que hacen VS Code y los demás; sin dependencia (son 15 líneas probadas) |
| Terminal | `pty.spawn` de la shell **como login shell (`-l`)** solo en Electron | Que la terminal de la app sea la misma que la del Terminal del sistema |
| Enlaces fuera | `setWindowOpenHandler` y `will-navigate`: lo que no sea nuestro `localhost` va a `shell.openExternal` | La ventana no navega a Internet; los `target="_blank"` de hoy abren el navegador del sistema |
| Menú y atajos | Menú propio en castellano (Cuaderno, Edición, Ver, Ventana, Ayuda). Los atajos del menú **mandan un mensaje a la pantalla** (`webContents.send('accion', 'guardar')`) y la pantalla hace lo que ya sabe hacer | La lógica sigue en la pantalla; el menú solo la nombra. **Los atajos concretos los decide Roberto (§8)**: el plan los deja preparados con ⌘S / Ctrl S → Guardar y ⌘, → Ajustes |
| Una instancia | `app.requestSingleInstanceLock()`; la segunda apertura trae la ventana al frente | Dos servidores sobre el mismo cuaderno pisarían el vigilante y la cookie |
| Icono | Se elige al crear la app entre las tres propuestas de `docs/diseno/logo/` (decisión de Roberto del 2026-10-09: «con ojos frescos»); se generan `.icns`, `.ico` y `.png` desde el SVG elegido con un script en `pruebas/` | Lo decidido ya; la app sin icono propio parece rota |
| Nombre del producto | `Cuaderno` (`productName`), `appId` `es.cuaderno.app` (sin dominio real detrás: es un identificador) | Sin rutas ni nombres de nadie (principio 5) |
| Actualizaciones automáticas | **Fuera** | Sin firma no hay `autoUpdater` en Mac; con dos usuarios no compensa. Se avisa de versión nueva como mucho (fuera también por ahora) |
| Tests | El pegamento de Electron (`electron/`) **fino y en módulos puros probados con `node --test`** (menú, elección de puerto, `PATH`, Node del kit); **un recorrido Playwright con `_electron.launch`** que abre la ventana sobre el cuaderno de ejemplo y lo recorre | Lo que no se puede probar en Node (crear la ventana) se prueba de verdad; lo demás, como el resto del repo. `electron/main.js` queda fuera del suelo de cobertura del servidor (no es código del servidor) |

## 3. Arquitectura

```
electron/
  main.js        app.whenReady → entorno (PATH) → crearServidor({pty, token, nodeDelKit}) → listen → BrowserWindow(urlEntrada)
                 menú, una instancia, cerrar = cerrar servidor; nada de lógica del cuaderno aquí
  preload.js     contextBridge.exposeInMainWorld('cuadernoApp', { elegirCarpeta(), alAccion(cb), version })
  menu.js        construye el menú desde una tabla (puro: se prueba sin Electron)
  entorno.js     pathDeLaShell(), puertoLibre(), nodeDelKit() (puros, probados)
  icono/         icono.icns, icono.ico, icono.png generados desde el SVG elegido (script en pruebas/icono.js)
server.js        sigue igual: el modo web (npm start)
servidor.js      un parámetro nuevo opcional: `ejecutarNode` (cómo lanzar un script Node) que guardar.js usa en vez de process.execPath
public/app.js    si window.cuadernoApp existe: botón «Elegir carpeta…» en Cuadernos y oyente de acciones del menú
```

Arranque en la app: `electron .` → `main.js` lee la configuración con `config.js` (misma carpeta que la web),
decide el cuaderno con `config.cuadernoAlArrancar` (sin argumentos: el último), arranca el servidor en 7331 o en
un puerto libre y abre la ventana en `urlEntrada()`. Cerrar la última ventana cierra el servidor (`server.close()`
ya cierra el vigilante; hay que matar también los pty abiertos, que hoy se cierran con su WebSocket).

Lo que **no** cambia: `servidor.js`, `cuaderno.js`, el render, los formatos, el kit. La web (`npm start`) sigue
funcionando con el mismo código y la cubren los mismos tests (§7).

## 4. Riesgos y su medida

| # | Riesgo | Probabilidad | Medida | Dónde se comprueba |
|---|---|---|---|---|
| R1 | **`process.execPath` en `guardar.js` lanza Electron en vez de Node**: Guardar con kit abre ventanas o se cuelga | Segura si no se toca | `ejecutarNode` inyectable en `crearServidor` → `guardar.js`; en Electron, `execPath` + `ELECTRON_RUN_AS_NODE=1` | Spike (§5) con el cuaderno de ejemplo con kit; test de Node de `nodeDelKit()` |
| R2 | **`PATH` de la sesión gráfica en Mac**: `git` no está, Guardar falla, la terminal no encuentra `claude` | Alta en Mac con Homebrew o nvm | `pathDeLaShell()` al arrancar, con 3 s de tope y el `PATH` de siempre si falla; shell de login en el pty | Spike en el Mac de Roberto; test de Node de `pathDeLaShell` con una shell falsa |
| R3 | **`node-pty` no carga dentro de Electron** (ABI, `spawn-helper` sin permiso o dentro de un asar) | Media | Prebuilds N-API; `asar: false`; `npmRebuild: false` en electron-builder para que no recompile lo que ya sirve; el chmod de `server.js` pasa a una función compartida | Spike: abrir la terminal en la app empaquetada, en Mac y Windows |
| R4 | **Gatekeeper (Mac) y SmartScreen (Windows) frenan la app sin firma**: en macOS 15 ya no vale Control+clic; hay que ir a Privacidad y seguridad → «Abrir de todos modos»; en arm64 un binario sin firma ninguna no arranca (hace falta al menos firma ad hoc) | Segura en descargas | electron-builder firma ad hoc en Mac cuando no hay identidad (comprobar en el spike: `codesign -dv`); un `INSTALAR.md` de cinco líneas con los pasos exactos para Mac y Windows; **alternativa para el Mac de Roberto: construir en su propio ordenador (`npm run empaquetar`), que no lleva la marca de cuarentena** | Spike, con una descarga real desde GitHub |
| R5 | **Coste de CI**: un build de Mac son 6-10 min ×10 contra la cuota del repo privado | Segura | El empaquetado solo en `workflow_dispatch` y en etiquetas `v*`, nunca en PR; el recorrido Electron en PR solo en Linux (con `xvfb-run`) y en Mac y Windows a mano | Workflow `empaquetar.yml` |
| R6 | **Tamaño**: ~200 MB instalados, `.dmg` de ~110 MB | Segura | Es Electron; asumido por Roberto el 2026-10-09. `files` del builder excluye `tests/`, `docs/`, `ejemplos/`, `pruebas/`, `cuadernos-prueba/`, `playwright` | Medir en el spike |
| R7 | **La pantalla asume navegador**: `beforeunload` (cerrar con cambios sin aplicar), `navigator.clipboard`, `target="_blank"`, el visor de PDF | Media | `close` de la ventana pregunta si el editor tiene cambios (misma lógica que `beforeunload`, por IPC); `clipboard` funciona en Electron sobre `http://localhost` (contexto seguro); PDF lo pinta Chromium; `_blank` → `openExternal` | Recorrido Electron |
| R8 | **Dos servidores a la vez** (web y app, o dos ventanas) | Media | Una instancia; puerto libre si 7331 está ocupado; el vigilante es por proceso, cada uno ve sus cambios | Test de Node de `puertoLibre()` |
| R9 | **El recorrido Electron en CI es frágil** (sin pantalla en Linux, lento en Windows) | Media | `xvfb-run` en Linux; tiempo máximo propio; si en dos semanas falla por su cuenta, pasa a manual (`workflow_dispatch`) y se anota | Primeras semanas de CI |
| R10 | **Electron y Chromium se actualizan cada 8 semanas** y Dependabot propondrá saltos de mayor | Segura | Grupo `electron` en `dependabot.yml`, mensual; se sube cuando la CI del recorrido Electron está en verde | `dependabot.yml` |

## 5. El spike (día 1): seguir o parar

Una rama `electron-spike`, sin tests ni diseño, que responde a cinco preguntas con el cuaderno de ejemplo con
kit en una copia temporal. **Se sigue con las tareas de §6 solo si las cinco salen bien**; si alguna falla, se
anota en §9 lo que se ha visto y se decide con Roberto.

1. ¿Arranca `crearServidor` dentro de `main.js` y la ventana carga `urlEntrada()` con la cookie puesta
   (navega a `/` y se ve la portada)? **Sí/no, y el tiempo de arranque hasta la portada** (objetivo: < 2 s).
2. ¿Carga `node-pty` y la terminal abre una shell con el `PATH` de login en el Mac (`which git`, `which claude`)?
3. ¿Guardar con kit funciona con `ELECTRON_RUN_AS_NODE=1` (la herramienta `guardar.js` del kit corre y hace su
   commit en la copia)?
4. ¿La app empaquetada con electron-builder sin asar abre en el Mac de Roberto desde una descarga de GitHub
   (qué pasos pide Gatekeeper, `codesign -dv` dice ad hoc o nada) y en Windows (SmartScreen)? Tamaño del `.dmg`
   y del `.exe`.
5. ¿`_electron.launch` de Playwright abre la app y lee el título de la portada en Linux con `xvfb-run`?

Entregable del spike: una tabla de cinco filas en este documento (§5 bis) con sí/no, cifras y lo que haya que
cambiar del plan. El código del spike no se mergea: las tareas lo reescriben con sus tests.

## 6. Tareas (cada una, un PR pequeño en castellano, CI en verde, su fila en el plan vivo)

Formato: **qué** · ficheros · criterios de aceptación · tests · estimación · depende de. Las estimaciones son
de trabajo de un agente con revisión de Roberto; el total son **2-3 días** más el spike, como se dijo el
2026-10-09.

### T1 · El servidor arranca dentro de Electron y abre su ventana
- **Qué:** `electron/main.js`, `electron/entorno.js` (`puertoLibre`, `pathDeLaShell`), `npm run app`
  (`electron .`), campo `main` en `package.json`, `electron` como `devDependency` con versión exacta.
- **Criterios:** `npm run app` abre una ventana con el último cuaderno (o la pantalla de Cuadernos); la
  dirección no se ve; cerrar la ventana cierra el servidor y los pty (sin procesos huérfanos: `ps` limpio);
  una segunda instancia trae la ventana al frente; con 7331 ocupado arranca en otro puerto y funciona.
- **Tests:** `tests/electron-entorno.test.js` (puros: `puertoLibre` con un puerto ocupado a propósito;
  `pathDeLaShell` con un `SHELL` falso que imprime un `PATH` conocido, y con uno que no responde → el `PATH` de
  siempre). Recorrido `tests/electron/ventana.test.js` con `_electron.launch`: abre, lee «Cuaderno de ejemplo» en
  el título, cierra y comprueba que el puerto queda libre.
- **Estimación:** medio día. **Depende de:** spike.

### T2 · Lo del navegador que en la app cambia: enlaces, cierre con cambios, PATH de login en la terminal
- **Qué:** `setWindowOpenHandler` y `will-navigate` → `shell.openExternal`; `close` de la ventana con cambios sin
  aplicar en el editor pregunta (por IPC, la misma condición que hoy usa `beforeunload`); pty con shell de login en
  Electron (`servidor.js` recibe `shellLogin: true`); `sistema.abrirUrl` no se llama en la app.
- **Criterios:** un enlace externo de una nota abre el navegador del sistema y la ventana no cambia; con el editor
  sucio, cerrar pregunta «¿Descartar lo escrito?» y cancelar deja la ventana; en el Mac, `echo $PATH` en la terminal
  de la app es el mismo que en Terminal.
- **Tests:** rutas (`tests/rutas.test.js`) para `shellLogin`; recorrido Electron: enlace externo interceptado (se
  comprueba el `openExternal` con un stub por IPC de pruebas, nunca abriendo un navegador en CI).
- **Estimación:** medio día. **Depende de:** T1.

### T3 · Guardar con kit desde la app: el Node del kit
- **Qué:** `crearServidor({ ejecutarNode })`; `guardar.js` deja de leer `process.execPath` directamente y usa lo
  inyectado (por defecto, el `execPath` de siempre: la web no cambia); `electron/entorno.js` → `nodeDelKit()`
  devuelve `{ cmd: process.execPath, env: { ELECTRON_RUN_AS_NODE: '1' } }`.
- **Criterios:** en la app, Guardar y Deshacer sobre la copia del ejemplo con kit hacen lo mismo que en la web
  (commit, salida del kit en pantalla); sin Node instalado en el sistema, también.
- **Tests:** `tests/guardar.test.js` (ya existe el fichero o se crea) con un `ejecutarNode` falso que registra
  cmd, args y env; test de `nodeDelKit()`.
- **Estimación:** medio día. **Depende de:** T1.

### T4 · Elegir carpeta con el diálogo del sistema
- **Qué:** `electron/preload.js` expone `cuadernoApp.elegirCarpeta()` → `ipcMain.handle('elegir-carpeta')` →
  `dialog.showOpenDialog({ properties: ['openDirectory'] })`; en `public/app.js`, si existe `window.cuadernoApp`,
  la pantalla de Cuadernos enseña un botón «Elegir carpeta…» junto a la casilla de la ruta (que se queda, por si
  alguien prefiere escribirla), y el resultado va a `POST /api/abrir` como hoy.
- **Criterios:** elegir una carpeta la abre y la añade a recientes; cancelar no hace nada; en la web no aparece el
  botón ni cambia nada (los recorridos de navegador actuales siguen en verde sin tocar).
- **Tests:** recorrido Electron que fuerza el diálogo con una ruta fija (en pruebas, `main.js` acepta
  `CUADERNO_DIALOGO_PRUEBA=<ruta>` y no abre diálogo); test de `ejemplo.test.js` sin cambios.
- **Estimación:** medio día. **Depende de:** T1.

### T5 · Menú en castellano y atajos de app
- **Qué:** `electron/menu.js` (tabla → `Menu.buildFromTemplate`), con roles estándar en Edición (sin ellos, en Mac
  no hay copiar y pegar), Ver (recargar, zoom, pantalla completa), Ventana y Ayuda (plan vivo, versión). Los
  elementos propios mandan `webContents.send('accion', nombre)` y la pantalla los atiende con
  `cuadernoApp.alAccion(cb)`. De salida: **Guardar (⌘S / Ctrl S)**, **Ajustes (⌘,)**, **Abrir carpeta… (⌘O)**,
  **Cuadernos recientes** (submenú desde `config.leer().recientes`). Los demás atajos, cuando Roberto dé su lista
  (§8).
- **Criterios:** ⌘S guarda (y no abre «Guardar como»); el menú se ve en castellano en Mac y Windows; los recientes
  se actualizan al abrir otro cuaderno.
- **Tests:** `tests/electron-menu.test.js` (puro: la tabla produce las etiquetas, aceleradores y acciones
  esperadas por plataforma); recorrido Electron: `accion: guardar` por IPC de pruebas llega a la pantalla.
- **Estimación:** medio día. **Depende de:** T1, T4.

### T6 · Icono y empaquetado sin firma
- **Qué:** elegir el logo (Roberto, §8), `pruebas/icono.js` genera `electron/icono/icono.{icns,ico,png}` desde el
  SVG (con `sharp` **no**: sin dependencia nueva; se usa Chromium de Playwright para rasterizar a PNG y los
  empaquetadores de electron-builder para `.icns` e `.ico`), `electron-builder.yml` (`asar: false`,
  `npmRebuild: false`, `files` acotado, `mac.identity: null`, `dmg` arm64 y x64, `nsis` x64 con instalación por
  usuario sin preguntar), `npm run empaquetar`, `INSTALAR.md` con los pasos de Gatekeeper y SmartScreen.
- **Criterios:** el `.dmg` abre en el Mac de Roberto y el `.exe` en el Windows de su padre siguiendo
  `INSTALAR.md`; la terminal funciona en los dos (prebuilds en disco); tamaño anotado en el plan vivo.
- **Tests:** ninguno automático del binario; la CI de T7 comprueba que el empaquetado termina.
- **Estimación:** medio día. **Depende de:** T1-T5.

### T7 · CI: recorrido Electron en los tests y empaquetado a mano o por etiqueta
- **Qué:** `tests.yml` añade el recorrido Electron en Linux con `xvfb-run` (y en Mac y Windows cuando se lanza a
  mano); `empaquetar.yml` nuevo, `workflow_dispatch` y `push` de etiquetas `v*`, construye en `macos-latest` y
  `windows-latest` y sube los instaladores como artefactos del run (y como Release si es etiqueta). Dependabot:
  grupo `electron` mensual. El suelo de cobertura excluye `electron/main.js` y `preload.js` (todo lo probable está
  en los módulos puros).
- **Criterios:** PR en verde con el recorrido Electron; un `workflow_dispatch` deja `.dmg` y `.exe` descargables.
- **Estimación:** medio día. **Depende de:** T6.

### T8 · Cierre: plan vivo, README y la versión web guardada
- **Qué:** §0, §6 (fila Plataforma, Arranque, CI, Teclado) y §8 del plan vivo; README con «Arrancar» para la app y
  para la web; lo de §7 (etiqueta y Release de la web). Ronda de crítica de diseño sobre capturas de la ventana
  (menú, Cuadernos con el botón, icono en el dock) como manda AGENTS.md para cambios visuales.
- **Estimación:** medio día. **Depende de:** todo.

## 7. La versión web: guardada, descargable y viva

Dos cosas distintas, y las dos se hacen:

1. **La web sigue viva en el mismo código.** La app Electron es una ventana alrededor del mismo servidor;
   `npm start` sigue abriendo el navegador y **todos los recorridos de navegador siguen corriendo contra la web**
   (Playwright con Chromium contra `localhost`). No hay dos ramas de código ni dos versiones que mantener: si la
   web se rompe, lo dice la CI de cada PR. Es el mejor «por si acaso» posible porque no envejece.
2. **Una copia congelada, descargable.** Antes del primer PR de Electron se pone una **etiqueta `web-0.1.0`**
   sobre `main` y se publica una **Release en GitHub con `cuaderno-web-0.1.0.zip`** (el repo sin `node_modules`,
   `docs/capturas*` ni `cuadernos-prueba`; `npm install` y `node server.js` lo arrancan) y un `LEEME.txt` con esas
   dos líneas. La Release es la «carpeta» de la que descargar: tiene fecha, no cambia, y no mete binarios ni zips
   en el historial de git. **Lo que no se recomienda:** una carpeta `web/` o `legado/` dentro del repo con una copia
   del código, porque son dos códigos que divergen, el doble de tests o ninguno, y un zip en git que pesa en cada
   clon. Si Roberto prefiere la carpeta de todas formas, es una decisión de §8 y se hace: `legado/web-0.1.0/` con
   el zip y el `LEEME.txt`, excluida del suelo de cobertura y de la CI.

## 8. Lo que decide Roberto antes de empezar

1. **La lista de atajos de app** («el par de cosas»): el plan arranca con ⌘S Guardar, ⌘, Ajustes, ⌘O Abrir
   carpeta y los recientes. ¿Qué más? (candidatos: ⌘E editar, ⌘K acciones rápidas cuando llegue ese bloque, ⌘P
   Profesor, ⌘1/⌘2 paneles).
2. **El logo**: 1, 2 o 3 de `docs/diseno/logo/` (recomendación de Claude del 2026-10-09: la 1).
3. **La copia web**: Release con etiqueta (recomendado) o carpeta `legado/` en el repo (§7).
4. **Dónde se construye el `.dmg` de su Mac**: en CI (descarga con cuarentena: pasos de Gatekeeper) o en su
   ordenador con `npm run empaquetar` (sin cuarentena). Para el Windows de su padre, CI.
5. **¿Hacer público el repo antes del empaquetado en CI?** Con el repo público la CI de Mac y Windows no gasta
   cuota; en privado, cada build completo son unos 100 min de cuota.

## 9. Abogado del diablo

(Se rellena con la ronda del agente independiente: cada objeción, si se aplica al plan o se razona.)
