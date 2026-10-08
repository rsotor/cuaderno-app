# cuaderno-app · plan vivo

**Nació como punto 0 el 2026-10-07** · **Repo:** `rsotor/cuaderno-app` (privado al nacer, público después) · **Licencia:** MIT

## 0. Estado

**Última actualización:** 2026-10-08, cierre de la segunda sesión del día (plan del chat, fase 9 rehecha, fase 10).

**Ahora**
- **Fase 10 recortada y hecha (2026-10-08, decisión de Roberto):** sin página Inbox ni subir documentos (preparar una clase se hace hablando con el profesor). Lo que entra: el árbol y el buscador (por nombre) listan también PDF, JSON, CSV y TXT; cada tipo se ve bien al pulsarlo (PDF en el visor del navegador, HTML a todo el ancho y alto y titulado con su `<title>`, JSON con sangría, CSV y TXT tal cual); los enlaces relativos y `[[fichero.ext]]` llevan a esa vista; un icono «Mostrar en el Finder» (Explorador en Windows) al pasar el ratón por cada fila del árbol y fijo en la miga. `/fichero` comprueba la ruta real y aísla `.html` y `.svg` por cabecera (§6). Ejemplos de cada tipo en `ejemplos/curso-demo/material/`. 62 tests de Node, 26 recorridos. Diseño en `docs/planes/plan-inbox.md` (dos rondas cortas). Lo que Roberto vio «mal» en un HTML no se ha podido reproducir: no hay ningún `.html` en los ejemplos ni en su vault; si vuelve a pasar, la ruta del fichero.
- **Fase 9 rehecha (2026-10-08, decisión de Roberto: «que sea la terminal que use el sistema, y así quitamos dependencias»).** Hechas y en el historial T1 a T4 del `plan-panel.md` (cajón a la derecha o abajo, asa, varias sesiones con xterm); después se **retiraron** con node-pty, `@xterm/xterm` y `@xterm/addon-fit`. Ahora el botón Terminal (y Ctrl `) abre **la terminal del sistema** en la carpeta del cuaderno y Profesor la abre con el comando del adaptador del kit: en macOS la que arrancó la app (`TERM_PROGRAM`: Ghostty, iTerm, WezTerm) o Terminal.app, con un `.command` temporal; en Windows, Windows Terminal o la consola; en Linux, `xdg-terminal-exec`, `$TERMINAL` o la primera conocida (`terminal.js`, `POST /api/terminal`). Pestañas, tema y letra los pone esa terminal. 57 tests de Node, 21 recorridos. **Sin probar con una ventana de verdad** (los tests no abren nada): primer uso de Roberto pendiente. Para recuperar el cajón cuando llegue el chat: commits `d5eb867`, `c2b11f0`, `f1c6564`.
- **Chat propio: diseñado y aparcado (2026-10-08).** Roberto: «si podemos meter el chat lo tenemos todo»; se retoma tras el primer uso de la terminal y los ficheros. Decisiones de Roberto en esta sesión: el chat es una **sesión propia por cuaderno** (ya no tiene que ser la misma que la terminal); **un proveedor para toda la app**, ajuste global; **Claude Code y Codex desde el día 1**. Señalado una vez: el login lo hace cada CLI, no la app; el kit solo tiene adaptador de Claude (con Codex, AGENTS.md sí, skills del kit por comprobar). Diseño completo en `docs/planes/chat-diseno.md` (panel, puente por CLI directo, ajustes; dos rondas cortas, 10 objeciones aplicadas), con tres investigaciones con fuentes: `chat-puentes.md` (Claude `-p` stream-json y `codex app-server`, política), `chat-interfaces-existentes.md` (apps oficiales: cubren «dos ventanas», no se embeben; Cowork no es el profesor; Remote Control como complemento gratis para Claude). **Decisión final de Roberto:** el chat propio sigue siendo la meta y se hará; **ahora, la fase 9**: panel movible (derecha o abajo), ajustable y con varias sesiones de terminal. Plan por tareas en `docs/planes/plan-panel.md` (superado, ver abajo). Permisos del chat: los del kit (`permisos.js`), nunca una política de la app; proveedor: en un curso con kit lo dice el curso (`llm`).

- **CI en rojo en `main` desde la fase 9 rehecha, arreglado (2026-10-08).** Dos tests de `servidor.test.js` (`/api/terminal` y `/api/mostrar-en-carpeta`) daban por hecho macOS: en Linux no hay terminal instalada en el runner (la app responde 400) y `xdg-open` abre la carpeta sin señalar el fichero. `crearServidor` acepta `plataforma` (como ya aceptaba `lanzar`) y los tests de servidor y de navegador la fijan a `darwin`; cada sistema se sigue probando en `terminal.test.js`. 62 tests de Node y 26 recorridos en verde en Linux. En el PR, Windows destapó dos más, ocultos desde que los tests leen `ejemplos/` (los push solo corren Linux): git en Windows saca los ejemplos con CRLF y `tests/ayuda.js` ya los lee siempre con LF (CRLF solo con la opción `crlf`); y el bit de ejecución del `.command` solo se comprueba donde hay permisos POSIX.

**Después:** primer uso de Roberto del botón Terminal y Profesor (Mac con Ghostty, y el Windows de su padre) y de los ficheros. Luego la fase del chat propio desde `chat-diseno.md` (ronda completa, pruebas previas a–d, plan por tareas; el cajón vuelve del historial); luego la fase 11 (arranque sin terminal).

**Inbox**
- Árbol: la fila al pasar el ratón pesa más que la seleccionada (crítica de la fase 10, objeción 5); revisarlo con la próxima ronda del árbol.
- Buscador / acciones rápidas, revisarlo como un bloque (Roberto, 2026-10-08): en la misma caja conviven buscar, «+» tarea y Escape, al lado el botón Nueva nota, y los accesos de arriba se esconden al buscar. Qué comandos hay, cómo se descubren, qué pasa al terminar cada uno. Encaja con una paleta de comandos (Ctrl K) cuando haya varios: Profesor, Guardar, Traer, cambiar de cuaderno.
- Servidor: Guardar y Traer en asíncrono (hoy `spawnSync` para el servidor mientras git trabaja) y que su resultado no se abra encima del editor; y decidir si un servidor puede tener varios cuadernos a la vez (hoy uno, la pantalla de Cuadernos lo cambia para todas las pestañas). Usar este repo como cuaderno hace que «Guardar» haga commits en el repo de la app: para trastear, copia de `ejemplos/`.
- Barra lateral plegable también en escritorio (hoy solo a 760 px o menos): pendiente de que Roberto diga si le estorba la barra entera.
- Comentarios de la app vs. notas `@@`: misma función, formato distinto (callout `> [!comment] Alumno (fecha)`). Propuesta: un solo formato, el callout, y que el profesor del kit lo recoja; decisión del kit (issue en profesor-kit cuando Roberto confirme). Hoy las líneas `@@` se pintan como texto normal.
- Vault de trabajo (segundo caso): 9 enlaces `[[reserva-anticipada]]` / `[[mapa-estaciones]]` salen rotos porque apuntan a una carpeta, no a una nota (Obsidian tampoco los resuelve): decidir si una carpeta con `brief.md` cuenta como destino. Un cuaderno dentro de un repo mayor toma el repo padre como suyo: decidir si se admite o se avisa. Sin `inicio.md` se ve un aviso, no el árbol; sin kit, el panel Tareas se limita a `tareas.md`.
- Para la fase 11 y el kit: en Windows quedan los ficheros CRLF en un Windows real (fase 11; una web no puede lanzar `npm start`, por eso la app arranca como servicio del sistema); el cuaderno de pruebas con kit se monta en temporal copiando `.kit/`, AGENTS.md, CLAUDE.md, .gitignore y .claude/settings.json más `estudio/` y `config/` del curso de ejemplo, `git init`, `preparar-curso.js --subir no`, `reparar.js` y un commit (`CUADERNO_KIT_PRUEBA=<carpeta>`); para profesor-kit: `pendientes.md` trae textos cortados («solo trae el títu») y `tareas.md` lo crea la app (¿del kit?).

**Contexto:** las decisiones y el orden de fases están abajo; los detalles del kit (formatos, herramientas, reglas) viven en el repo del kit. Para medir diseño otra vez: `pruebas/sonda-navegador.js` lanza las sondas de `ux-ui-audit` y captura con el viewport exacto (solo macOS; los recorridos de navegador de `tests/navegador/` corren en cualquier sistema); el curso de prueba con kit se monta como dice el Inbox. El repo está en GitHub (`rsotor/cuaderno-app`, privado). Arrancar para trastear: `CUADERNO_TOKEN=<fijo> node server.js <cuaderno> [puerto]` sobre una copia de `ejemplos/`.

**Rondas de abogado del diablo:** 2026-10-07, sobre el punto 0 y el prototipo, 7 objeciones → reorden de fases (§7), tabla caso → kit (§4b) y decisiones nuevas (§6) · 2026-10-07, sobre la crítica de diseño, 7 objeciones → todas atendidas (ver el final de `docs/diseno/critica-2026-10-07.md`).

**Rondas de crítica de diseño:** 2026-10-08, tanda del primer uso (árbol, buscador, páginas, vault), 5 objeciones → las 5 aplicadas (`docs/diseno/critica-2026-10-08.md`). · 2026-10-08, fase 10 (ficheros), 5 objeciones → 3 aplicadas (CSV como tabla, miga alineada, tinta normal y título del HTML), 2 razonadas (`docs/diseno/critica-2026-10-08-ficheros.md`).

**Diario del 2026-10-08 (lo que estaba en «Ahora»; detalle de cada cambio y por qué):**
- **Fases 1 a 7 cerradas y validadas en un primer uso real (2026-10-08).** Roberto usó la app sobre este repo y sobre el vault demo; salieron y se arreglaron el mismo día: bucle de recarga por `.git`, scroll, imágenes relativas, árbol sin jerarquía, buscador mezclado, nota nueva, columna estrecha, favicon, cambio de cuaderno entre pestañas, listas ineditables (bug de siempre) y terminal sin pty (permiso del ayudante). Detalle en el diario de abajo. 52 tests de Node, 20 recorridos de navegador, CI en verde.
- **Decisiones de hoy, en §6:** cuadernos de ejemplo en `ejemplos/` como único mock; ronda de crítica de diseño por tanda antes del commit (regla en AGENTS.md; primera ronda hecha, 5 de 5 aplicadas); `CUADERNO_TOKEN` para desarrollar.
- **Notas de Roberto para el chat, guardadas** en `docs/planes/chat-alcances.md` (2 `@@` en §0 y 3 comentarios): cajón dentro de la app, multiproveedor con ajustes de conexión, sesión por cuaderno, formato, imágenes, permisos y página actual. Cambian la recomendación del análisis; no se ha rehecho a propósito: se hace de golpe en la sesión limpia.
- Fase 6 cerrada el 2026-10-07 tras la ronda de abogado del diablo (7 objeciones atendidas): crítica con cifras en `docs/diseno/critica-2026-10-07.md` (18 hallazgos), cambios aplicados y medidos otra vez: 0 fallos de contraste en 15 pantallas y dos temas, foco 9,6:1 / 6,0:1, sin desbordamiento a 390 px. Decisiones de Roberto: fuente del sistema, Destapar discreto, botón «Corregir». Capturas antes y después en `docs/capturas/`. 46 tests.
- Validación de Roberto (2026-10-08) sobre tres cosas: no hay tests de navegador (solo la sonda de macOS); no hay comando rápido para crear tareas (solo Ctrl K para buscar); las tareas no se pueden relacionar con notas ni filtrar. Decisiones en §6 (Tests de navegador, Tareas rápidas) y dos fases nuevas en §7.
- **Fase 7 cerrada el 2026-10-08.** El buscador es el comando: `+` y Enter añaden la tarea a `tareas.md`, con `[[la nota]]` al final si hay una abierta. `tareas()` devuelve `enlaces` y `etiquetas` de cada línea y el panel Tareas filtra por nota, etiqueta y estado con los filtros en el hash (`#/tareas?nota=…&etiqueta=…&estado=…`), sin escribir nada nuevo en el cuaderno. La recarga en vivo ya no se lleva el foco ni el borrador del panel. 47 tests de Node (2 saltados).
- **Primeros tests de navegador:** Playwright 1.56.1 como biblioteca con `node --test`, en `tests/navegador/` (12 recorridos: portada, buscar, editar bloque, tareas y filtros, examen con y sin `examen.js`, tarjetas, 390 px). `npm run test:navegador`, aparte de `npm test`; en un ordenador normal, `npx playwright install chromium` una vez (o `CUADERNO_CHROMIUM` con otro Chromium). Un fallo dice la pantalla y qué faltaba.
- **CI** (2026-10-08): `.github/workflows/tests.yml`, ver §6. Primer run completo a mano en los tres sistemas: Linux y macOS en verde a la primera; en Windows `node-pty` compila con Node 24 y fallaba un solo test, porque la app pasaba a `examen.js` la ruta con barras invertidas. Arreglado en la app (`relKit` en `servidor.js`: a las herramientas del kit siempre con `/`). Segundo run completo: **los tres sistemas en verde** (Linux 51 s, macOS 27 s, Windows 4 min 34 s, de ellos 3 min 40 s descargando Chromium). Decisión de Roberto: una suite completa a mano cuando haga falta; en cada push, solo Linux.
- **Fase 8, análisis hecho; Roberto la ve más tarde:** `docs/planes/chat-alcances.md`. Recomendación: terminal cuidada sí o sí; primer chat en la app con el `fakechat` oficial embebido (lista blanca, sin aviso de desarrollo, una sesión); Telegram, Discord o iMessage opcionales para el móvil; channel propio solo si `fakechat` se queda corto; `claude -p` descartado por la política de Anthropic para terceros.
- **Primer uso de Roberto (2026-10-08), con este mismo repo como cuaderno:** tres fallos de mínimos en los primeros minutos. (1) El scroll volvía arriba solo: el vigilante filtraba solo el nombre base, `.git/index.lock` (lo crea cada `git status` del propio servidor) pasaba como cambio, el cliente recargaba la nota en bucle y la recarga ponía el scroll a 0. Arreglado por los dos lados: nada oculto en ninguna parte de la ruta, y recargar la misma nota conserva el scroll. (2) Los ajustes sí se aplicaban al cambiar el selector (no hay botón, es a propósito); con el bucle no se veía. (3) Las imágenes con ruta relativa daban 404: ahora se resuelven desde la carpeta de la nota y se sirven desde el cuaderno, también `![[foto.png]]`. Lección: los 12 recorridos probaban funciones sueltas sobre un cuaderno sin `.git` y en un segundo; ninguno «usaba» la app. Nuevo `tests/navegador/uso.test.js` (3 recorridos: leer con un repo debajo sin que nada mueva el scroll ni repinte en bucle, ajustes al momento y tras recargar, plegar carpetas y abrir una nota). 48 tests de Node, 15 de navegador. Visto una vez: tarjetas falla por tiempo con cinco Chromes a la vez; no se repitió.
- **Árbol (2026-10-08, decisión de Roberto):** en el árbol no se distinguía carpeta de página ni abierto de cerrado (triángulo de 11 px, carpeta en gris apagado). Opciones vistas: iconos en todo (A), solo chevron (B), chevron + icono de página (C). Roberto eligió C y pidió poco ruido: va la versión silenciosa, chevron de 14 px que gira en las carpetas, nada en las páginas, sangría de 16 px por nivel y el mismo color para las dos. Dos notas de la misma carpeta con el mismo título enseñan el fichero al lado. Capturas `docs/capturas/antes-arbol-2026-10-08.png` y `despues-arbol-2026-10-08.png`; el recorrido del árbol comprueba el chevron y su giro.
- **Buscador (2026-10-08, tres notas de Roberto):** (1) mientras se busca, Inicio/Tareas/Comentarios se esconden para dejar sitio; (2) dos tramos, primero «Notas» (coincidencia por título o nombre de fichero, para abrir sin leer todo el texto; el servidor ahora busca también en los títulos) y después «En el texto», con el plural bien; (3) una paleta modal, todavía no: la limitación era de anchura y hoy solo hay un comando (`+`); se retoma cuando haya varios (Inbox). Teclado: flecha abajo y Enter van al primer resultado, flecha arriba vuelve al buscador, Escape vacía. Captura `docs/capturas/despues-buscador-2026-10-08.png`. 48 tests de Node, 16 de navegador.
- **Segundo caso de uso (2026-10-08): un vault de trabajo, no un curso.** Roberto creó `~/Documents/personal/vault-demo` (Product Owner con iniciativas, personas y tickets; producto inventado, nada real; su README lista lo que ejercita). Se prueba desde una copia con repo propio en `cuadernos-prueba/vault-demo` (`node server.js <copia> 7332`). Primer pase: frontmatter, títulos, callouts, imágenes y backlinks se pintan bien; 15 notas, 0 sin pintar. Visto: (a) 9 enlaces `[[reserva-anticipada]]` / `[[mapa-estaciones]]` salen rotos porque apuntan al nombre de una carpeta, no de una nota (Obsidian también los daría por no resueltos; decidir si una carpeta con `brief.md` cuenta como destino); (b) las líneas `@@` se pintan como texto normal; (c) un cuaderno dentro de un repo mayor toma el repo padre como suyo (la copia sin `git init` decía «guardado hace 2 h» del repo de la app): decidir si se admite o se avisa. A petición de Roberto, el vault lleva un PDF y un JSON de ejemplo enlazados desde la reunión del 2026-10-06, para cuando llegue el visor (Inbox, fase 10).
- **Favicon (2026-10-08, Roberto: «la parte visual debe estar completa para saber a qué pestaña ir»):** `public/icono.svg`, la libreta de la barra lateral rellena en azul; test del servidor. El título de la pestaña ya era «<cuaderno> · Cuaderno».
- **Tres notas más de Roberto (2026-10-08):** (1) **nota nueva**: botón «Nueva nota» bajo Comentarios (título y carpeta, por defecto la de la nota abierta) y, en el buscador, cuando no hay resultados, Enter propone crearla con lo escrito; el fichero es `Título.md` con `# Título` (sin `\ / : * ? " < > |`), `POST /api/nota/nueva`. Sin atajo de teclado: Ctrl N y Cmd N son del navegador y no se pueden capturar. (2) `tareas.md` ya no sale en el árbol: su vista es el panel Tareas, que enlaza el fichero. (3) Columna de lectura de 62 ch a 76 ch: en pantalla grande se quedaba en unos 590 px. 50 tests de Node, 18 de navegador.
- **Un servidor, un cuaderno (2026-10-08):** Roberto no podía comentar en el análisis del chat («la nota cambió» todo el rato). Causa: el servidor del 7331 había pasado a servir el vault demo, abierto desde la pantalla de Cuadernos en otra pestaña (estaba en recientes); la pestaña vieja seguía mirando un cuaderno que ya no estaba. Ahora, al cambiar de cuaderno el servidor avisa por el canal de cambios y cada pestaña lo dice en claro y pasa al cuaderno nuevo. El aviso del 409 dice qué pasó y qué hacer. Recorrido de navegador nuevo (19). Pendiente de diseño: ¿varios cuadernos a la vez en un servidor, uno por pestaña? Hoy no; va al Inbox.
- **Ronda de crítica de diseño de la tanda (2026-10-08):** `docs/diseno/critica-2026-10-08.md`, 5 objeciones, las 5 aplicadas: nombres largos del árbol con puntos suspensivos; rótulos del buscador sin mayúsculas ni 11 px; la miga alineada con la columna; los `h2` más cerca de su texto que del párrafo anterior (resuelve la nota de Roberto del 2026-10-07 sobre el aire entre titulares); el buscador agrupa las líneas por nota, con el título una vez y su ruta. Nota del crítico, sin cambio: la columna de 76 ch da unos 84 caracteres por línea, por encima del «menos de 80» de ayer; decisión de Roberto de hoy, se mantiene. Capturas del después actualizadas.
- **Las listas nunca se pudieron editar ni comentar (2026-10-08, vídeo de Roberto):** markdown-it da a una lista la línea en blanco que la sigue; el cliente mandaba ese original con salto final, el servidor se lo recortaba solo a un lado de la comparación y daba «la nota cambió» siempre. 7 de los 44 bloques del análisis del chat. Ninguna prueba editaba una lista. Arreglo doble: el rango del bloque acaba donde acaba la lista, y la comparación normaliza los dos lados. Tests en el motor, en el render y un recorrido de navegador (editar la lista de casillas de Interés). Visto en el mismo vídeo, al Inbox: el resultado de «Traer» aparece encima del editor si se abre justo después, y Guardar/Traer corren en síncrono y paran el servidor mientras duran. 52 tests de Node, 20 de navegador.
- **Terminal «sesión terminada» (2026-10-08, comentario de Roberto en el análisis del chat):** `posix_spawnp failed` al abrir la pty. Causa: npm instaló `node-pty` sin ejecutar su script (los tiene bloqueados) y su ayudante `spawn-helper` quedó sin permiso de ejecución. `server.js` lo comprueba al arrancar y le pone el permiso. Comprobado en Chrome: la terminal acepta un comando. Es muy probablemente la misma causa del «[terminal cerrada]» en headless anotado para la fase 9; se confirma allí con un recorrido.
- **Buscador, solo busca (2026-10-08, Roberto: «estamos mezclando las cosas»):** el Enter sin resultados ya no crea una nota; con «+» delante es tarea y la nota nueva tiene su botón. El aviso de «nada con…» lo recuerda. Lo que Roberto vio como «todos los espacios» en la carpeta de Nueva nota es que este repo, usado como cuaderno, contiene `ejemplos/` con los dos cuadernos de muestra; con un cuaderno de verdad solo salen sus carpetas.
- **Notas de Roberto para la fase del chat (2026-10-08), guardadas en `docs/planes/chat-alcances.md` (2 `@@` en §0 y 3 comentarios):** el chat va dentro de la app, como cajón a la derecha; con formato sencillo (listas, enlaces), imágenes, permiso para crear carpetas y ficheros, y sabiendo qué página se está viendo; multiproveedor (Claude, Codex, Gemini…) con unos ajustes para iniciar sesión y guardar la conexión; el asistente lee la configuración del proyecto al que está conectado el cuaderno y cada cuaderno puede ser una sesión distinta. Esto cambia la recomendación del análisis (`fakechat` embebido no cubre imágenes, página actual ni otros proveedores): se rehace cuando se abra la fase del chat, todo de golpe, con el skill `plan` (es arquitectura). Decisión de Roberto: se guardan y se lanzan juntas.

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
Dependencias: markdown-it, katex, ws (node-pty y xterm salieron el 2026-10-08: la terminal es la del sistema). Arranque: `npm install` · `node server.js <carpeta-del-cuaderno>`.

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
| Seguridad del servidor local | Escuchar en 127.0.0.1 no basta: token aleatorio por arranque exigido en la API y en la terminal, comprobación de `Origin`, los `.html` del cuaderno en iframe con `sandbox`. Antes de que el repo sea público · 2026-10-08: `/fichero` comprueba la ruta real (un enlace simbólico no saca un fichero de fuera del cuaderno), manda `nosniff` siempre y `Content-Security-Policy: sandbox` a `.html` y `.svg`, para que una página abierta en una pestaña, no en el iframe, tampoco tenga la cookie ni la API |
| Carpetas | Índice en memoria, actualizado por el vigilante. Se respetan `.gitignore` y `.obsidianignore`; `node_modules` nunca se recorre |
| Botón Profesor | Lanza el comando del adaptador del kit en una terminal nueva (`pty.spawn`), no lo teclea; sin kit, el comando sale de la configuración del usuario, nunca del repo. Si el binario no existe, lo dice |
| Varios cuadernos | Pantalla de inicio con recientes. La lista vive en la configuración del usuario, fuera de los repos. Arrancar sin carpeta abre esa pantalla |
| Configuración | **Del usuario, igual para todos sus cuadernos** (2026-10-07): tema, letra, fuente y el comando del profesor para carpetas sin kit, en `~/.config/cuaderno/config.json` (`%APPDATA%\cuaderno` en Windows). `cuaderno.json` en la raíz del cuaderno, opcional y versionado con él, solo con lo del cuaderno en sí: nombre para mostrar y portada |
| Cuadernos de ejemplo | **Una sola referencia, en el repo: `ejemplos/curso-demo` y `ejemplos/vault-demo`** (decisión de Roberto, 2026-10-08: «es nuestro mock»). Inventados, sin nada real. Los tests de Node y los recorridos de navegador los copian a temporal (`tests/ayuda.js`); el andamiaje que git no dejaría entrar (`node_modules`, una nota oculta) lo añade el código. `cuadernos-prueba/` (ignorado) queda para copias de cuadernos reales y para trastear a mano |
| Validación de diseño | **Ronda de crítica por tanda de feedback, antes del commit** (decisión de Roberto, 2026-10-08: «estamos haciendo cambios rápidos y nadie lo valida en diseño»). Un agente con `design-critique` sobre las capturas del después; objeciones atendidas o razonadas aquí. Por retoque sería caro; por tanda, una pasada. Regla en AGENTS.md |
| Token fijo | **`CUADERNO_TOKEN`, solo si lo fija quien arranca** (2026-10-08): el código de la URL deja de cambiar en cada reinicio; para desarrollar. Por defecto, como siempre |
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
10. **Ver cualquier fichero del cuaderno** (recortada el 2026-10-08: el inbox es una carpeta más y preparar se hace con el profesor): PDF, JSON, CSV, TXT y HTML en el árbol y bien pintados; «Mostrar en el Finder». Hecha el 2026-10-08.
11. **Arranque sin terminal:** `npx cuaderno <carpeta>`; la app arranca al iniciar sesión en el ordenador (agente de `launchd` en Mac, tarea programada en Windows) y abre el navegador sola; un icono en el escritorio lee la dirección actual de la configuración del usuario y la abre, arrancando la app si no está. Pensado para quien no debe saber nada de terminales (decisión de Roberto, 2026-10-08). Prueba en Mac y Windows (los ficheros CRLF; la terminal del sistema con una ventana de verdad) y los recorridos de navegador sobre el curso de prueba con kit.
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

Nombre del paquete npm · si los comentarios viven en la nota o en un fichero
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
