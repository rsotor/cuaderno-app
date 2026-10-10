# Texto del PR del bloque «app de escritorio con Electron»

Rama `electron` → `main`. Squash con el título del PR, CI en verde en los tres sistemas antes de mergear (plan vivo, §6
«Repo en GitHub»). Antes de abrirlo: la etiqueta `web-0.1.0` sobre `main` (`docs/planes/electron.md`, §7). Al abrirlo se añade
el pie de atribución; aquí no va.

## Título

```
feat: app de escritorio con Electron: ventana propia, servidor en un utilityProcess, menú con atajos, icono y empaquetado sin firma
```

## Cuerpo

La app de escritorio del plan `docs/planes/electron.md` (decisión de Roberto del 2026-10-09: «tenerlo en navegador me mata»; una
app para uso propio, sin firma ni tienda). Una ventana propia alrededor del mismo servidor y de la misma pantalla; **la web sigue
con el mismo código** (`npm start`) y todos los recorridos de navegador corren contra ella.

### Qué entra (T1 a T7, un día, 64 commits)

- **T1 · El servidor en un `utilityProcess`.** `electron/main.js` (diez líneas) → `electron/app.js` (`arrancar` con Electron
  inyectado, probado en Node con un Electron falso); el servidor (`crearServidor` tal cual, con el Node 24 de Electron) corre en
  `electron/servidor-hijo.js` y manda `{ puerto, token, pty }` al escuchar; la ventana aparece antes que nada
  («Arrancando…», fondo del tema); puerto 7331 o uno libre; si el hijo no arranca (tope 15 s), diálogo y salir; si muere después,
  se relanza una vez y la ventana vuelve; a la segunda en un minuto, diálogo y salir; registro a fichero (`registro.log`, rotado);
  entorno de la **shell de login** leído con marcadores y `env -0` (asíncrono, 10 s, respaldo con Homebrew, nvm y `~/.local/bin`)
  y pasado al hijo antes de que cargue nada; instancia única. `npm run app`.
- **T2 · Lo del navegador que en la app cambia** (`electron/ventana.js`): enlaces fuera solo `http:`, `https:` y `mailto:`
  (`shell.openExternal`), el resto anotado y sin efecto; «¿Descartar lo escrito?» al cerrar o recargar con el editor sucio
  (`will-prevent-unload`); permisos solo `clipboard-sanitized-write`; sesión en memoria; `nativeTheme` y fondo según el tema
  (sin flash blanco en oscuro), reaplicado al cambiar `config.json`; la terminal como shell de login; textos sin «desde la terminal».
- **T3 · El Node del kit.** Las herramientas del kit y el corrector se lanzan con el binario de Electron como Node
  (`ELECTRON_RUN_AS_NODE=1`, `crearServidor({ ejecutarNode })`); `guardar.js` ya no congela su entorno al cargar. Sin Node
  instalado, Guardar, Deshacer y corregir funcionan igual.
- **T4 · Abrir una carpeta** (`electron/carpeta.js`): «Elegir carpeta…» en Cuadernos con el diálogo del sistema (preload
  `window.cuadernoApp.elegirCarpeta()`, IPC validado por el origen del frame), carpeta en `argv`, arrastrada al icono
  (`open-file`) o en una segunda instancia; en la web, nada cambia.
- **T5 · Menú en castellano y atajos** (`electron/menu.js`), los que decidió Roberto: ⌘O Abrir nota…, ⌘F Buscar…, ⌘T Nueva
  tarea, ⌘S Guardar, ⇧⌘O Abrir carpeta…, ⌘, Ajustes…, Cuadernos recientes (se reconstruye al cambiar); ⌘K reservada; Edición, Ver y
  Ventana con roles estándar; Ayuda con Plan vivo, Mostrar registro, Diagnóstico (sin token) y Acerca de. El menú manda un
  nombre a la pantalla y ella hace lo que ya hace su botón. Con el foco en la terminal, Ctrl/⌘ S, O, F, T y coma van al menú.
- **T6 · Icono y empaquetado sin firma.** Icono de la propuesta 3 sobre placa redondeada (`pruebas/icono.js` con el Chromium
  de Playwright, reproducible byte a byte); `electron-builder.js` (`asar: false`, `npmRebuild: false`, `files` acotado, firma ad
  hoc en Mac con `identity: "-"`, `.dmg` arm64 y x64, NSIS por usuario; fuses sin tocar); `npm run empaquetar`,
  `npm run empaquetar:instaladores`; `INSTALAR.md` (Gatekeeper, SmartScreen, Windows 10 1809, dónde está el registro).
- **T7 · CI.** `tests.yml` con el paso «Recorridos de Electron» (Linux siempre con `xvfb-run`; Mac y Windows a mano) y el binario
  de Electron descargado aparte y cacheado; `empaquetar.yml` a mano o por etiqueta `v*` (instaladores como artefactos del run y
  Release si es etiqueta); Dependabot con el grupo `electron` y 30 días de reposo.
- **Revisión de código** sobre T2 y T4 con T5 y T6 encima (§11 del plan): 10 hallazgos, 9 aplicados (el quit cancelado que
  dejaba la app sin servidor, el arranque retenido por un nieto de la shell, las variables de prueba vivas en la app empaquetada,
  el origen del IPC, la carpeta que llegaba durante un relanzado, un solo oyente de `second-instance`…).
- **T8 · Cierre.** Plan vivo (§0, §6, §7, §8, Inbox), README («Arrancar» para la app y la web, la etiqueta `web-0.1.0`),
  capturas de la ventana en claro y oscuro para la crítica de diseño (`docs/capturas/electron/`, con el menú volcado a `menu.md`).

### Qué no entra

- **§5 bis, la prueba de instalación en las máquinas reales:** en el Mac de Roberto (Gatekeeper con la firma ad hoc,
  `codesign -dv --verbose=2` → `Signature=adhoc`, terminal y Guardar con kit, el entorno de la shell con Homebrew, nvm y zsh, qué
  binario es `process.execPath` dentro del hijo) y en el Windows de su padre (SmartScreen, conpty, CRLF); tamaños del `.dmg` y del
  `.exe`. Todo lo de aquí se ha probado en Linux (contenedor, `xvfb-run`), incluido el paquete construido (`--dir --linux`).
- **El primer run real de CI** en Mac y Windows (`workflow_dispatch`) y una etiqueta `v*` de prueba (T7, «queda para el primer run real»).
- **El `grep`** de `spawn|exec|npx|execPath` en las herramientas de profesor-kit (el repo no estaba en la sesión).
- **Decisiones abiertas de §8 del plan:** la marca de la web (etiqueta sola, recomendado; Release; carpeta `legado/`), hacer
  público el repo antes del empaquetado en CI, dónde se construye el `.dmg` del Mac (CI o `npm run empaquetar` en su ordenador),
  arranque al iniciar sesión (fuera, recomendado), qué Windows tiene su padre.
- **La ronda de crítica de diseño** sobre las capturas de T8: se hace aparte; lo que salga, en una tarea nueva.
- Fuera del bloque, al Inbox: Guardar y Traer en asíncrono (hoy `spawnSync` en el hijo, como en la web); `formulario.js` sin
  `GIT_TERMINAL_PROMPT=0`; el intermitente de `lateral.test.js`/`comentar.test.js` al correr a la vez que los recorridos de Electron.

### Cómo probar

```
npm ci
node node_modules/electron/install.js        # una vez: el binario de Electron (~100 MB)
npm run app                                  # o npm run app -- <carpeta>; copia antes ejemplos/cuaderno-ejemplo a cuadernos-prueba/
```

Ver: la ventana abre el último cuaderno (o Cuadernos con «Elegir carpeta…»); ⌘S guarda; un enlace `https:` de una nota abre el
navegador del sistema; Ayuda → Diagnóstico y Mostrar registro; cerrar la ventana deja el puerto libre y ningún proceso.
Instaladores: `npm run empaquetar:instaladores` en un Mac o un Windows, y `INSTALAR.md`. La web: `npm start`, como siempre.

Tests: `npm run test:cobertura` · `xvfb-run -a npm run test:electron` (o sin `xvfb-run` con pantalla) · `npm run test:navegador`.

### Cifras

- 234 tests de Node (232 pass, 2 skipped) con cobertura **99,3 % líneas / 91,0 % ramas / 97,5 % funciones** (suelo 85; `electron/`
  al 100 % de líneas: todo el pegamento es inyectable); 13 recorridos Electron (~13 s); 120 recorridos de navegador.
- Arranque hasta la portada ~800 ms (paquete: ~1 s); relanzado del hijo tras una muerte, 377 ms; entorno de la shell, 18-26 ms en Linux.
- Paquete Linux sin asar: 295 MB y 472 ficheros (`resources/`, 12 MB y 402 ficheros); con asar, 294 MB y 108: se queda sin asar.
- Dependencias nuevas, solo de desarrollo: `electron` 44.7.0 y `electron-builder` 26.15.3 (exactas; unos 270 paquetes más en el
  lock, nada en la app ni en la web). Sin dependencias nuevas de ejecución.

### Documentos

- `docs/planes/electron.md`: §1 de dónde se parte, §2 decisiones, §3 arquitectura, §4 riesgos, §5 spike y §5 bis, §6 tareas con su
  párrafo «Hecha» (lo que difiere y por qué), §7 la web, §8 lo que decide Roberto, §9 abogado del diablo, §10 revisión de
  confirmación, §11 revisión de código.
- `docs/planes/plan-vivo.md`: §0 estado, §6 Plataforma, Arranque, CI, Teclado, Seguridad y Dependencias de escritorio, §7 fase 11, §8.
- `README.md`, `INSTALAR.md`, `docs/capturas/electron/` (capturas y `menu.md`), `ejemplos/cuaderno-ejemplo.md` filas 25 a 28.
