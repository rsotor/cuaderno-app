# cuaderno-app · plan vivo

**Nació como punto 0 el 2026-10-07** · **Repo:** `rsotor/cuaderno-app` (privado al nacer, público después) · **Licencia:** MIT

## 0. Estado

**Última actualización:** 2026-10-08.

**Ahora**
- Fase 6 cerrada el 2026-10-07 tras la ronda de abogado del diablo (7 objeciones atendidas): crítica con cifras en `docs/diseno/critica-2026-10-07.md` (18 hallazgos), cambios aplicados y medidos otra vez: 0 fallos de contraste en 15 pantallas y dos temas, foco 9,6:1 / 6,0:1, sin desbordamiento a 390 px. Decisiones de Roberto: fuente del sistema, Destapar discreto, botón «Corregir». Capturas antes y después en `docs/capturas/`. 46 tests.
- Validación de Roberto (2026-10-08) sobre tres cosas: no hay tests de navegador (solo la sonda de macOS); no hay comando rápido para crear tareas (solo Ctrl K para buscar); las tareas no se pueden relacionar con notas ni filtrar. Decisiones en §6 (Tests de navegador, Tareas rápidas) y dos fases nuevas en §7.
- **Fase 7 cerrada el 2026-10-08.** El buscador es el comando: `+` y Enter añaden la tarea a `tareas.md`, con `[[la nota]]` al final si hay una abierta. `tareas()` devuelve `enlaces` y `etiquetas` de cada línea y el panel Tareas filtra por nota, etiqueta y estado con los filtros en el hash (`#/tareas?nota=…&etiqueta=…&estado=…`), sin escribir nada nuevo en el cuaderno. La recarga en vivo ya no se lleva el foco ni el borrador del panel. 47 tests de Node (2 saltados).
- **Primeros tests de navegador:** Playwright 1.56.1 como biblioteca con `node --test`, en `tests/navegador/` (12 recorridos: portada, buscar, editar bloque, tareas y filtros, examen con y sin `examen.js`, tarjetas, 390 px). `npm run test:navegador`, aparte de `npm test`; en un ordenador normal, `npx playwright install chromium` una vez (o `CUADERNO_CHROMIUM` con otro Chromium). Un fallo dice la pantalla y qué faltaba.
- **CI** (2026-10-08): `.github/workflows/tests.yml`, ver §6. Primer run completo a mano en los tres sistemas: Linux y macOS en verde a la primera; en Windows `node-pty` compila con Node 24 y fallaba un solo test, porque la app pasaba a `examen.js` la ruta con barras invertidas. Arreglado en la app (`relKit` en `servidor.js`: a las herramientas del kit siempre con `/`). Segundo run completo: **los tres sistemas en verde** (Linux 51 s, macOS 27 s, Windows 4 min 34 s, de ellos 3 min 40 s descargando Chromium). Decisión de Roberto: una suite completa a mano cuando haga falta; en cada push, solo Linux.
- **Fase 8, análisis hecho; Roberto la ve más tarde:** `docs/planes/chat-alcances.md`. Recomendación: terminal cuidada sí o sí; primer chat en la app con el `fakechat` oficial embebido (lista blanca, sin aviso de desarrollo, una sesión); Telegram, Discord o iMessage opcionales para el móvil; channel propio solo si `fakechat` se queda corto; `claude -p` descartado por la política de Anthropic para terceros.
- **Primer uso de Roberto (2026-10-08), con este mismo repo como cuaderno:** tres fallos de mínimos en los primeros minutos. (1) El scroll volvía arriba solo: el vigilante filtraba solo el nombre base, `.git/index.lock` (lo crea cada `git status` del propio servidor) pasaba como cambio, el cliente recargaba la nota en bucle y la recarga ponía el scroll a 0. Arreglado por los dos lados: nada oculto en ninguna parte de la ruta, y recargar la misma nota conserva el scroll. (2) Los ajustes sí se aplicaban al cambiar el selector (no hay botón, es a propósito); con el bucle no se veía. (3) Las imágenes con ruta relativa daban 404: ahora se resuelven desde la carpeta de la nota y se sirven desde el cuaderno, también `![[foto.png]]`. Lección: los 12 recorridos probaban funciones sueltas sobre un cuaderno sin `.git` y en un segundo; ninguno «usaba» la app. Nuevo `tests/navegador/uso.test.js` (3 recorridos: leer con un repo debajo sin que nada mueva el scroll ni repinte en bucle, ajustes al momento y tras recargar, plegar carpetas y abrir una nota). 48 tests de Node, 15 de navegador. Visto una vez: tarjetas falla por tiempo con cinco Chromes a la vez; no se repitió.
- **Árbol (2026-10-08, decisión de Roberto):** en el árbol no se distinguía carpeta de página ni abierto de cerrado (triángulo de 11 px, carpeta en gris apagado). Opciones vistas: iconos en todo (A), solo chevron (B), chevron + icono de página (C). Roberto eligió C y pidió poco ruido: va la versión silenciosa, chevron de 14 px que gira en las carpetas, nada en las páginas, sangría de 16 px por nivel y el mismo color para las dos. Dos notas de la misma carpeta con el mismo título enseñan el fichero al lado. Capturas `docs/capturas/antes-arbol-2026-10-08.png` y `despues-arbol-2026-10-08.png`; el recorrido del árbol comprueba el chevron y su giro.

**Después:** fase 9 (terminal cuidada, con la vía del chat ya decidida), fase 10 (inbox).

**Inbox**
- Primer uso (Roberto, 2026-10-08): la barra lateral entera, ¿plegable también en escritorio? Hoy solo a 760 px o menos. Pendiente de que diga si le estorba la barra o solo era el árbol (ya arreglado, ver Ahora).
- Primer uso: cada reinicio del servidor cambia el código de la URL y la pestaña abierta se queda fuera. Para desarrollar, un token fijo por variable de entorno (solo si la fija el usuario; por defecto, como ahora).
- Comentarios de la app vs. notas `@@` de Roberto: misma función, formato distinto (callout `> [!comment] Alumno (fecha)`). Propuesta: un solo formato, el callout, y que el profesor del kit lo recoja; la decisión es del kit (issue en profesor-kit cuando Roberto confirme).
- Diseño (nota de Roberto, 2026-10-07): revisar los espacios entre titulares en la vista de concepto (captura `despues/02-concepto.png`): hay demasiado aire entre un `h2` y el siguiente bloque.
- Visor de PDF y de ficheros de texto (JSON, txt): hoy el índice solo lista `.md` y `.html`. El navegador pinta PDF en un iframe sin librería; JSON y txt, como texto preformateado. Solo lectura. Decidir en qué fase entra (encaja en la 10, inbox, donde llegan los PDF de clase).
- Fase 9: la terminal en Chrome headless se cierra nada más abrirse («[terminal cerrada]»); reproducirlo con un recorrido en `tests/navegador/` (hoy arrancan sin `node-pty`) y, si pasa en un navegador normal, por qué.
- Pendiente de que Roberto confirme la vía del chat: si acepta la recomendación de `chat-alcances.md`, la fase 12 pasa a ser «chat por channel oficial (`fakechat` embebido, con Telegram, Discord o iMessage opcionales)» y el channel propio queda como fase posterior condicionada.
- Para el kit: `pendientes.md` trae textos cortados («solo trae el títu»); avisar en profesor-kit.
- Fase 8: analizar a fondo el chat como *channel* de Claude Code (el oficial `fakechat`: chat web en localhost conectado a la sesión local), frente a las otras vías, con alcance y tiempo de cada una. Si es viable, la fase 12 se adelanta a la 9.
- Fase 11: el CI ya compila `node-pty` y pasa los recorridos en Windows con Node 24; quedan los ficheros CRLF en un Windows de verdad. El arranque sin terminal ya está en la fase (§7). Lo que no se puede hacer, y por qué: una página web no puede lanzar `npm start` en el ordenador; el navegador lo impide por diseño, y es la misma barrera que protege el cuaderno de otras webs. Por eso la app se arranca como servicio del sistema y el icono solo abre el navegador.
- Visto con la bóveda sin kit (2026-10-07): sin `inicio.md` la app enseña un error en vez del árbol; el panel Tareas toma como tarea cualquier casilla de cualquier nota (miles en una bóveda grande): sin kit, Tareas debe limitarse a lo que configure el usuario o no mostrarse. Con `node_modules` fuera, las respuestas tardan menos de 0,2 s.
- Cuaderno de pruebas con kit: se monta en una carpeta temporal copiando el motor del kit (`.kit/`, AGENTS.md, CLAUDE.md, .gitignore, .claude/settings.json) más `estudio/` y `config/` del curso de ejemplo, `git init`, `preparar-curso.js --subir no`, `reparar.js` y un commit base. El test `guardar y deshacer con el kit de verdad` corre con `CUADERNO_KIT_PRUEBA=<esa carpeta>`.

**Contexto:** las decisiones y el orden de fases están abajo; los detalles del kit (formatos, herramientas, reglas) viven en el repo del kit. Para medir diseño otra vez: `pruebas/sonda-navegador.js` lanza las sondas de `ux-ui-audit` y captura con el viewport exacto (solo macOS; los recorridos de navegador de `tests/navegador/` corren en cualquier sistema); el curso de prueba con kit se monta como dice el Inbox. El repo está en GitHub (`rsotor/cuaderno-app`, privado).

**Rondas de abogado del diablo:** 2026-10-07, sobre el punto 0 y el prototipo, 7 objeciones → reorden de fases (§7), tabla caso → kit (§4b) y decisiones nuevas (§6) · 2026-10-07, sobre la crítica de diseño, 7 objeciones → todas atendidas (ver el final de `docs/diseno/critica-2026-10-07.md`).

## 1. Qué es

Una app local, en el navegador, para trabajar con un **cuaderno**: una carpeta de notas Markdown que genera y
mantiene un profesor-agente (Claude Code, Codex…) a partir de un curso. Hoy esa carpeta se abre con Obsidian.
La app lo sustituye con algo nuestro al 100 %: leer y editar las notas, contestar exámenes, apuntar tareas y
comentarios, hablar con el profesor y guardar al repo, todo en una ventana.

Puede haber tantos cuadernos como se quiera, cada uno en su carpeta y con su repo.

## 2. Para quién y por qué

Para el alumno de un curso montado con uno de nuestros kits. Obsidian nos daba un lector de Markdown ágil y
nada más: no sabe qué es un examen, qué es una tarea ni quién es el profesor, y hay cosas que el alumno hace
en el chat (marcar opciones) que no llegan a ningún sitio. Una app propia conoce la estructura del cuaderno y la
pinta como lo que es.

## 3. Principios

1. **La app es la ventana; el cuaderno es la verdad.** Todo lo que la app escribe es Markdown en los ficheros
   del cuaderno, en el formato que ya tienen. Sin base de datos, sin formatos propios.
2. **La lógica del curso no es de la app.** Corregir, calcular progreso, decidir si se puede guardar: lo hacen
   las herramientas del kit. La app las lanza y enseña su salida.
3. **Un kit funciona sin la app.** La app depende del kit; nunca al revés.
4. **Control total de la experiencia.** Render, tema, atajos, paneles: nuestros y configurables.
5. **Nada que esconder.** Repo público desde el diseño: sin secretos, sin tokens, sin rutas de nadie.

## 4. Casos de uso

| # | El alumno… | La app… |
|---|---|---|
| 1 | Abre el cuaderno | Enseña la **portada** (`inicio`): por dónde sigue, qué repasar, qué examen toca. Si hay cambios sin guardar o sin subir, se ve en la barra |
| 2 | Busca algo | **Buscador** por nombre de nota y por texto, sin acentos, con la línea donde aparece |
| 3 | Lee una nota | **Lector**: propiedades arriba, enlaces entre notas que funcionan (también en tablas), avisos y bloques plegables, tablas, fórmulas, "quién enlaza aquí" |
| 4 | Quiere cambiar algo pequeño | **Editar por bloques**: pasa el ratón por un párrafo, lista o tabla, lo edita en su Markdown, guarda ese tramo |
| 5 | No entiende algo, o en clase dijeron otra cosa | **Comentar un bloque**: queda anotado en la nota; el profesor lo recoge en la siguiente sesión. Un panel reúne todos los comentarios |
| 6 | Estudia una sesión | Lee, salta a sus conceptos, abre el **ejercicio interactivo** dentro de la app, marca la sesión como **estudiada** |
| 7 | Repasa flashcards | **Modo tarjeta**: pregunta, destapar, "la sabía / no la sabía" |
| 8 | Hace un examen | **Formulario completo** con botón **Corregir**: la app escribe las respuestas y corrige con la herramienta del kit, sin pasar por el chat. Los de respuesta libre se **entregan** y los corrige el profesor |
| 9 | Se organiza | **Tareas**: todas las casillas del curso agrupadas por nota, más su lista propia. Marcar aquí escribe en la nota |
| 10 | Habla con el profesor | **Terminal integrada**, bonita, abierta en el cuaderno, con botón "Profesor". Más adelante, **chat** |
| 11 | Deja una clase nueva | Ve el **inbox** y lo que aún no está preparado; "Preparar con el profesor" |
| 12 | Termina | Botón **Guardar**: commit y push al repo del cuaderno con un mensaje propuesto. **Traer** si cambió en otro sitio. **Deshacer** lo último |
| 13 | Tiene varios cursos | **Pantalla de cuadernos**: recientes, abrir carpeta, cada uno con su nombre y su último guardado |

### 4b. Qué pieza del kit usa cada caso

La app no se inventa nada del curso: cada caso consume un formato o una herramienta del kit. Donde no exista,
primero se añade al kit (y funciona sin la app) o el caso espera.

| Caso | Formato o herramienta del kit | Estado |
|---|---|---|
| 1 Portada | `estudio/inicio.md` tal como lo regenera `guardar.js`; la app no calcula "qué toca" | listo |
| 2 Buscador | los `.md` de `estudio/` | de la app |
| 3 Lector | formato Obsidian del kit: wikilinks, `[[nota\|alias]]` en tablas, callouts `> [!tipo]`, `$…$` | listo |
| 4 Editar bloque | escritura directa en la nota, comprobando que el texto original sigue ahí | de la app |
| 5 Comentar | callout `> [!comment]` en la nota | **TBD:** confirmar con el kit que el profesor lo recoge (hoy ninguna herramienta lo lee) |
| 6 Sesión estudiada | casilla `estudiada` del frontmatter de la sesión (la marca el alumno o `examen.js` al aprobar) | listo; exige escribir YAML sin romperlo |
| 7 Flashcards | casillas `✅ la sabía / ❌ no la sabía` del fichero (la app marca una y desmarca la otra); `guardar.js` las lee para el repaso | hecho (fase 5) |
| 8 Examen tipo test | casillas del examen + `examen.js --corregir <examen.md>` (clave en `config/claves/`); solo si `examen.js --revision` dice resuelta. La app lee las preguntas con las mismas reglas que `examen.js` (número `**1.**`, opción `- [ ] a)`), "(elige una)" → una sola respuesta | hecho (fase 5) |
| 8 Examen de respuesta libre | Fuera de v1 hasta que el kit lo resuelva: [profesor-kit#46](https://github.com/rsotor/profesor-kit/issues/46) ("/examen: desarrollo, problemas y supuestos prácticos"). Hoy lo corrige el profesor en el chat y lo registra con `--registrar` | espera al kit |
| 9 Tareas | casillas `- [ ]` de cualquier nota + `tareas.md`. Una tarea se relaciona con una nota con un `[[wikilink]]` en su línea y se etiqueta con `#etiqueta` en línea (formato Obsidian, nada nuevo); la app solo los lee para filtrar | **TBD:** `tareas.md` hoy lo crea la app; decidir si es del kit y avisar allí de que las líneas pueden llevar enlaces y etiquetas |
| 10 Terminal / Profesor | comando del adaptador del kit (`.kit/adaptadores/<id>.json` → `comando`) | listo |
| 11 Inbox | `estudio/inbox/`, `estudio/pendientes.md`; preparar → `preparar.js` | **TBD:** cómo se lanza desde la app |
| 12 Guardar / Traer / Deshacer | `guardar.js "<mensaje>"`, `guardar.js --traer`, `deshacer.js --ver` y `deshacer.js` | listo; errores y conflictos se pasan al profesor por la terminal, la app no los resuelve |
| 13 Cuadernos | configuración del usuario fuera del repo | de la app |

## 5. Lo que ya está hecho

Prototipo validado el 2026-10-07 sobre un curso real (52 ficheros), probado con Chromium: casos 1, 2, 3, 4, 5,
9 y 10 (terminal), más recarga en vivo y modo oscuro. Seis ficheros en Node sin build, en la raíz del repo:
`server.js`, `markdown.js`, `public/{index.html, estilo.css, app.js}`, `package.json`.
Dependencias: markdown-it, katex, xterm, node-pty, ws. Arranque: `npm install` · `node server.js <carpeta-del-cuaderno>`.

Capturas del prototipo (en `docs/capturas-prototipo/`), tal como salió, antes del repaso de diseño:

| Caso | Captura |
|---|---|
| 1 · Portada | ![Portada](../capturas-prototipo/01-inicio.png) |
| 2 · Buscador | ![Buscador](../capturas-prototipo/03-buscador.png) |
| 3 · Lector: concepto con propiedades y tabla | ![Concepto](../capturas-prototipo/02-concepto.png) |
| 3 · Lector: fórmula y aviso plegable | ![Fórmula](../capturas-prototipo/12-formula-y-callout.png) |
| 4 · Editar un bloque | ![Editar bloque](../capturas-prototipo/07-editar-bloque.png) |
| 5 · Comentario en la nota | ![Comentario](../capturas-prototipo/06-comentario-en-nota.png) |
| 5 · Panel de comentarios | ![Comentarios](../capturas-prototipo/09-comentarios.png) |
| 7 · Flashcards (aún sin modo tarjeta) | ![Flashcards](../capturas-prototipo/13-flashcards.png) |
| 8 · Examen con casilla marcada (aún sin formulario) | ![Examen](../capturas-prototipo/04-examen.png) |
| 9 · Tareas | ![Tareas](../capturas-prototipo/08-tareas.png) |
| 10 · Terminal | ![Terminal](../capturas-prototipo/10-terminal.png) |
| Modo oscuro | ![Oscuro](../capturas-prototipo/11-oscuro.png) |

## 6. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Plataforma | Navegador + proceso local en Node. Sin app de escritorio empaquetada |
| Editor | Por bloques, en Markdown. Sin WYSIWYG ni vista previa partida |
| Anotar | Comentarios anclados a un bloque, dentro de la nota |
| Exámenes | Formulario HTML completo con un botón **Corregir** (2026-10-07: antes «Validar»; el verbo es el del kit y el del resultado). El chat no genera nada |
| Agente | **Terminal en v1.** El chat con el profesor después, como modo opcional. El Agent SDK queda descartado (exige API key de pago, no admite la suscripción). Vía elegida (2026-10-07): la app como *channel* de Claude Code, igual que el channel oficial `fakechat` (chat web en localhost conectado a la sesión local): el chat de la app envía a la sesión que la propia app arranca en su terminal y pinta las respuestas; misma sesión, mismo contexto (AGENTS.md, skills, herramientas), suscripción sin API key. Codex, por comprobar |
| Cuaderno con kit | Lo es si tiene `.kit/motor.json`. Con kit, todo pasa por sus herramientas. Si tiene `estudio/` y `config/` pero no `.kit/` (una salida del kit sin motor), la app lee sus formatos (tareas, exámenes…) pero no hay Profesor ni Guardar. Sin nada de eso, es una carpeta de notas: solo lectura y edición, Tareas se limita a `tareas.md`, y Guardar hace commit; el push se confirma |
| Guardar | Un botón. En un cuaderno con kit, llama a `guardar.js "<mensaje>"` (comprueba, apunta en el diario, sube); nunca git a mano. El mensaje lo propone la app a partir de los ficheros cambiados y se puede editar. Un error o un conflicto de `--traer` no lo resuelve la app: enseña la salida y ofrece abrir la terminal con el profesor. En una carpeta sin kit que sea un repo: `git add -A`, commit y push si hay remoto, sin preguntar (como un autosave); traer es `pull --ff-only`; deshacer es `revert` del último commit, siempre enseñando antes qué volvería. Credenciales: las de git de la máquina |
| Escrituras | Toda escritura en una nota lleva el texto original del tramo; si el fichero cambió debajo, el servidor rechaza y la app avisa. Se conserva el final de línea del fichero (LF o CRLF) |
| Seguridad del servidor local | Escuchar en 127.0.0.1 no basta: token aleatorio por arranque exigido en la API y en la terminal, comprobación de `Origin`, los `.html` del cuaderno en iframe con `sandbox`. Antes de que el repo sea público |
| Carpetas | Índice en memoria, actualizado por el vigilante. Se respetan `.gitignore` y `.obsidianignore`; `node_modules` nunca se recorre |
| Botón Profesor | Lanza el comando del adaptador del kit en una terminal nueva (`pty.spawn`), no lo teclea; sin kit, el comando sale de la configuración del usuario, nunca del repo. Si el binario no existe, lo dice |
| Varios cuadernos | Pantalla de inicio con recientes. La lista vive en la configuración del usuario, fuera de los repos. Arrancar sin carpeta abre esa pantalla |
| Configuración | **Del usuario, igual para todos sus cuadernos** (2026-10-07): tema, letra, fuente y el comando del profesor para carpetas sin kit, en `~/.config/cuaderno/config.json` (`%APPDATA%\cuaderno` en Windows). `cuaderno.json` en la raíz del cuaderno, opcional y versionado con él, solo con lo del cuaderno en sí: nombre para mostrar y portada |
| Tests de navegador | **Playwright como biblioteca, con `node --test`** (2026-10-08). Hasta hoy nada probaba la pantalla: 46 tests de Node y HTTP, y una sonda de diseño que solo corre en macOS. Los recorridos viven en `tests/navegador/*.test.js`, arrancan `crearServidor` en el puerto 0 con el cuaderno de `tests/ayuda.js` y conducen Chromium. Se lanzan con `npm run test:navegador`, aparte de `npm test`, que sigue sin exigir un navegador. No se usa `@playwright/test`: un solo runner, el de siempre. Dependencia de desarrollo nueva, `playwright`, justificada así: es la única forma seria de probar lo que ve el alumno en Mac, Windows y Linux, y a medio plazo sustituye a la sonda de macOS |
| CI | **GitHub Actions con los mismos dos comandos que en local** (2026-10-08, confirmado por Roberto): `.github/workflows/tests.yml` corre `npm test` y `npm run test:navegador` con Node 24. En cada push, solo Linux (barato); en los pull requests y a mano (`workflow_dispatch`), Linux, macOS y Windows. Solo se lanza si el commit toca algo que afecta a los tests (código `*.js`, `public/`, `tests/`, `pruebas/`, dependencias o el propio workflow): un commit de solo documentación no gasta nada (decisión de Roberto, 2026-10-08). El run de Windows compila `node-pty` con Node 24: la comprobación que la fase 11 esperaba a tener una máquina Windows. Coste: cero cuando el repo sea público; en privado, unos 50 minutos de cuota por run completo (macOS cuenta ×10, Windows ×2), por eso Mac y Windows no van en cada push |
| Tareas rápidas | **El buscador es el comando** (2026-10-08): si lo que se escribe en Ctrl K empieza por `+`, Enter añade esa tarea a `tareas.md`. Ni atajo nuevo ni panel: Ctrl T y Ctrl Shift T los retiene el navegador. Si se está leyendo una nota, la tarea lleva `[[esa nota]]` al final. Relación con notas y etiquetas: wikilinks y `#etiqueta` en la propia línea (§4b, caso 9); el panel Tareas filtra por nota enlazada, por etiqueta y por pendientes o hechas, sin escribir nada nuevo en el cuaderno |
| Arranque | **Servicio del sistema más icono, nunca una web que lance procesos** (2026-10-08): para un alumno que no debe saber nada de terminales, la app se instala como servicio al iniciar sesión y un icono abre el navegador en la dirección actual (que lleva el token del arranque). Electron y Tauri siguen fuera (§8); hace falta Node instalado y una instalación inicial hecha por alguien que sepa |
| Diseño | **Repaso de UX/UI con plugins cuando existan las pantallas que más lo piden** (examen, tarjetas, cuadernos): fase 6. Plugins del catálogo de Anthropic a activar en la sesión: **Design** (Anthropic; skills `design-critique`, `accessibility-review`, `ux-copy`) para la crítica pantalla a pantalla y los textos; **ux-ui-audit** (comunidad) para medir en el navegador contraste WCAG, tamaño de objetivos y foco; **frontend-design** (Anthropic) para aplicar los cambios con criterio. Entrada: las capturas de §5 y la app arrancada. Salida: lista priorizada, cambios aplicados, capturas de antes y después. Lo que ya se ve en las capturas se arregla antes, en la fase 2 |

## 7. Fases

1. **Sembrar el repo:** prototipo, licencia, README, este documento como plan vivo, reglas del repo. ✅ 2026-10-07
2. ✅ 2026-10-07 **Base segura, escrituras robustas y tests:** token + `Origin` + `sandbox`; escrituras con comprobación del texto original, línea en blanco tras cada comentario, CRLF; índice en memoria y respeto a `.gitignore` / `.obsidianignore`; detección del kit; botón Profesor con el comando del adaptador; tests `node --test` del render y de las escrituras sobre los dos cuadernos (§9: "el mismo fichero que a mano", con LF y CRLF). De diseño, solo lo que ya se ve en las capturas: foco de teclado visible, "editar / comentar" accesibles sin ratón, el panel Tareas menos denso, la cabecera de propiedades por debajo del título.
3. ✅ 2026-10-07 **Pantalla de cuadernos** y configuración del usuario.
4. ✅ 2026-10-07 **Guardar / Traer / Deshacer.**
5. ✅ 2026-10-07 **Formulario de examen** (tipo test) y **modo tarjeta** de flashcards. La respuesta libre espera a profesor-kit#46.
6. ✅ 2026-10-07 **Repaso de diseño** con los plugins de §6 (Design, ux-ui-audit, frontend-design), cambios aplicados, capturas antes y después: `docs/diseno/critica-2026-10-07.md`.
7. ✅ 2026-10-08 **Tareas rápidas y primeros tests de navegador:** `+` en el buscador, enlaces y etiquetas en las tareas, filtros en el panel; Playwright con `node --test` en `tests/navegador/` con 12 recorridos (portada, buscar, editar, tareas, examen, tarjetas, 390 px) (§6).
8. **Análisis del chat con el profesor:** las vías posibles (channel de Claude Code, terminal sola, otras), con alcance, riesgos y tiempo de cada una, en `docs/planes/chat-alcances.md`. Termina con una decisión de Roberto sobre la vía; hasta entonces no se toca la terminal.
9. **Terminal cuidada** (pestañas, fuente, tema) y botón Profesor, con la vía del chat ya decidida. Si el channel es viable, la fase 12 se adelanta a esta.
10. **Inbox** y preparación de clases nuevas.
11. **Arranque sin terminal:** `npx cuaderno <carpeta>`; la app arranca al iniciar sesión en el ordenador (agente de `launchd` en Mac, tarea programada en Windows) y abre el navegador sola; un icono en el escritorio lee la dirección actual de la configuración del usuario y la abre, arrancando la app si no está. Pensado para quien no debe saber nada de terminales (decisión de Roberto, 2026-10-08). Prueba en Mac y Windows (los ficheros CRLF; `node-pty` ya compila en el CI) y los recorridos de navegador sobre el curso de prueba con kit.
12. **Chat con el profesor** como *channel* de Claude Code (§6, Agente).

Cada fase termina usable y guardada.

## 8. Fuera

Electron o Tauri · editor WYSIWYG · sincronización, cuentas o nube (el repo ya es la sync) · grafo de notas ·
móvil como objetivo · instalar o pagar el agente · cualquier lógica del curso dentro de la app.

## 9. Cómo sabremos

- Un recorrido por todas las notas de un curso real no encuentra enlaces rotos ni bloques sin pintar.
- Marcar, editar, comentar y añadir tarea desde la app dan el mismo fichero que hacerlo a mano.
- Un examen contestado en el formulario da la misma nota que marcado a mano y corregido con el kit.
- Guardar desde la app deja el repo igual que guardar desde la terminal.
- Una sesión entera con el profesor sin salir de la app.
- Crítica de diseño cerrada con cambios aplicados. Tests y prueba real en verde. Arranca en Mac y Windows.

## 10. Pendiente de decidir

Nombre del paquete npm · `node-pty` en Mac y Windows · si los comentarios viven en la nota o en un fichero
aparte (hoy, en la nota) · cómo adaptan los kits sus reglas de escritura "para Obsidian" cuando usen la app ·
los **TBD** de §4b.

## 11. Cuadernos de prueba

Dos cuadernos en el ordenador de Roberto, **nunca se escribe en ellos**: se copian a una carpeta temporal antes de
arrancar la app o los tests. Sus rutas no van en el repo (principio 5). Uno es la salida del curso de ejemplo del
kit (con `estudio/` y `config/`, sin `.kit/`); el otro es una bóveda de Obsidian de otro proyecto, sin kit, con
otra estructura, `.obsidianignore` en lista blanca y `node_modules` en la raíz: sirve para comprobar que la app
no da nada por supuesto del curso de ejemplo. Si algo del formato no cuadra, la referencia es el AGENTS.md y las
herramientas de `.kit/` del kit, no la memoria.

---
*Los detalles del kit (formatos, herramientas, reglas) viven en el repo del kit. Este documento es solo la app.*
