# Plan · fase 9: el panel (terminal movible, ajustable y con varias sesiones)

**2026-10-08 · estado: para aprobar.** Sale del §2 de `chat-diseno.md` (diseño del panel, ronda corta aplicada) y de la
decisión de Roberto de hoy: el chat propio dentro de la app sigue siendo la meta, pero ahora toca el panel de la terminal.

## Objetivo

Un panel con pestañas, a la derecha o abajo a elección del alumno, de tamaño ajustable, donde conviven varias sesiones de
terminal (shell y Profesor) sin pisarse, y en el que el chat tendrá su pestaña cuando llegue.

## Enfoque

El panel sustituye a la franja fija de hoy (`#terminal-panel`, 320 px bajo la nota). La posición y el tamaño viven en
la configuración del usuario, como el tema. Cada sesión de terminal es su propio xterm y su propio WebSocket `/pty`
(el servidor ya abre una pty por conexión); el cliente solo deja de matar una sesión para abrir otra. Sin dependencias
nuevas.

## Restricciones (de Roberto y del repo)

- «Lo que sí necesitamos es revisar terminal para poder moverlo y crear varias pestañas» (2026-10-08).
- La nota manda: el panel nunca la deja por debajo de 480 px de ancho ni de 240 px de alto; si no cabe, capa completa.
- Español en todo; Node sin build; tests con `node --test`; un test que falla no se arregla tocando el valor esperado.
- Cambios visuales: ronda de crítica de diseño sobre las capturas del después antes del commit de cierre.
- Los cuadernos de prueba se copian a temporal; nunca se escribe en `ejemplos/`.

## Ficheros

| Fichero | Responsabilidad en esta fase |
|---|---|
| `config.js` | Campos nuevos `panel` (`derecha` \| `abajo`), `panel_ancho`, `panel_alto`, con validación y tope; `apariencia()` los expone |
| `public/index.html` | El panel pasa a `#panel`, con barra de pestañas (`.panel-pestanas`), sub-barra de sesiones de terminal, asa (`.panel-asa`) y el selector «Panel» en Ajustes |
| `public/estilo.css` | Rejilla por `data-panel` y `.panel-abierto`; asa; capa completa; paleta clara de la terminal |
| `public/app.js` | Estado del panel (posición, tamaño, abierto), arrastre con límites, lista de sesiones de terminal, `fit` al activar, atajos |
| `tests/config.test.js` | Validación de los campos nuevos |
| `tests/servidor.test.js` | `/api/configuracion` acepta y acota los campos; `apariencia` los devuelve |
| `tests/navegador/ayuda.js` | `ptyFalso()`: una pty de mentira que hace eco, registra `resize` y se puede «salir», para probar sesiones sin `node-pty` |
| `tests/navegador/panel.test.js` | Recorridos del panel (nuevo) |
| `docs/planes/plan-vivo.md` | §0, §6 (fila nueva «Panel») y §7 (fase 9 cerrada) |
| `docs/capturas/` | Antes y después del panel (derecha y abajo) |

## Tareas

### T1 · Configuración del panel

- `config.js`: `POR_DEFECTO` suma `panel: 'derecha'`, `panel_ancho: 420`, `panel_alto: 320`. `leer()` descarta lo que no
  vale (posición fuera de `['derecha', 'abajo']`, tamaños que no sean enteros entre 320 y 3000 / 180 y 3000) y pone el
  valor por defecto. `ajustar()` acepta los tres con la misma regla. `apariencia()` los devuelve.
- Test primero, `tests/config.test.js`: un fichero con `panel: 'izquierda'`, `panel_ancho: 50`, `panel_alto: 'x'` lee
  los tres por defecto; `ajustar({ panel: 'abajo', panel_ancho: 500 })` guarda los dos y deja `panel_alto`.
- `tests/servidor.test.js`: `POST /api/configuracion` con `panel_ancho: 99999` devuelve `apariencia` con el valor por
  defecto (no un 500 ni el valor fuera de rango).
- Comando: `npm test`. Commit: `Configuración: posición y tamaño del panel`.

### T2 · El panel, con posición a elegir

- `public/index.html`: `#terminal-panel` pasa a `#panel` (`grep -rn terminal-panel public tests pruebas` y actualizar
  todas las referencias). Dentro: `.panel-barra` con las pestañas (hoy una, «Terminal»; el botón de cerrar a la
  derecha), `.panel-asa` y `.panel-cuerpo`. Ajustes: `<select id="ajustes-panel">` con «A la derecha» y «Abajo», junto a
  Fuente de lectura, guardado por el mismo `change` del formulario que el resto.
- `public/estilo.css`, con `data-panel` en `#app` y la clase `panel-abierto`:
  - cerrado: la rejilla de hoy, `280px minmax(0, 1fr)` y filas `1fr auto`, el panel `hidden`;
  - `derecha` abierto: `grid-template-columns: 280px minmax(0, 1fr) var(--panel-ancho)`, `#panel` en columna 3, filas 1 a 3;
  - `abajo` abierto: columnas de hoy, `grid-template-rows: 1fr var(--panel-alto)`, `#panel` en columna 2, fila 2;
  - capa completa (`.panel-capa`): `position: fixed; inset: 0; z-index: 10`, sin asa; se aplica a 760 px o menos y
    cuando `innerWidth < 280 + 320 + 480` con el panel a la derecha, o `innerHeight < 180 + 240` abajo.
- `public/app.js`: `info.configuracion.panel` pone `data-panel` al cargar y al cambiar Ajustes; `abrirTerminal` y
  `alternarTerminal` ponen y quitan `panel-abierto`; `--panel-ancho` / `--panel-alto` salen de la configuración acotada
  (función `acotarPanel(valor, posicion)` que aplica los mínimos de la nota con el tamaño actual de la ventana) y se
  recalculan en `resize` de la ventana. Cerrar el panel no cierra sesiones (como hoy).
- Test primero, `tests/navegador/panel.test.js` (arranca con `ptyFalso`, ver T4, para que la pestaña abra):
  1. con el panel cerrado, `#nota` mide lo mismo que antes de abrirlo (sin columna fantasma); abierto a la derecha, el
     panel mide 420 px y la nota se estrecha en esa cantidad;
  2. en Ajustes, «Abajo»: el panel pasa a estar debajo de la nota (su `boundingBox().y` mayor que el de `#nota`),
     con 320 px de alto, y sigue abajo tras recargar;
  3. a 390 × 800 y a 900 × 800 con el panel a la derecha, el panel ocupa toda la ventana (`.panel-capa`).
- Comando: `npm run test:navegador`. Commit: `Panel: a la derecha o abajo, a elegir en Ajustes`.

### T3 · Tamaño ajustable con asa

- `public/app.js`: `.panel-asa` con eventos `pointerdown` / `pointermove` / `pointerup` (`setPointerCapture`), que
  cambian `--panel-ancho` o `--panel-alto` en vivo dentro de los límites de `acotarPanel`; al soltar, `POST
  /api/configuracion` con el valor; doble clic devuelve 420 / 320 y lo guarda. Durante el arrastre, `user-select: none`
  en `body`. `fit` de todas las sesiones de terminal visibles al soltar (el `ResizeObserver` ya existe).
- `public/estilo.css`: asa de 6 px visibles y 12 px de zona activa (`::before` ampliado), `cursor: col-resize` a la
  derecha y `row-resize` abajo, color `var(--linea)` y `var(--acento)` al pasar o arrastrar; foco visible.
- Test primero, en `panel.test.js`:
  4. arrastrar el asa 100 px hacia la izquierda deja el panel en 520 px y, tras recargar, sigue en 520 px (la
     configuración lo guardó);
  5. arrastrar hasta dejar la nota por debajo de 480 px no pasa de ahí (el panel se queda en `innerWidth - 280 - 480`);
  6. con `panel_ancho: 3000` guardado por la API, al abrir el panel mide el máximo permitido, no 3000;
  7. doble clic en el asa vuelve a 420 px.
- Comando: `npm run test:navegador`. Commit: `Panel: tamaño ajustable con asa, acotado a favor de la nota`.

### T4 · Varias sesiones de terminal que conviven

- `tests/navegador/ayuda.js`: `ptyFalso()` devuelve `{ spawn(cmd, args, opciones) }` cuyo proceso de mentira guarda
  `cmd`, hace eco de lo que recibe por `write`, anota cada `resize` en una lista accesible desde el test, y tiene
  `salir()` para disparar `onExit`. `arrancar({ kit, pty })` lo pasa a `crearServidor`.
- `public/app.js`: la terminal deja de ser `term / fit / ws / modoTerminal` globales y pasa a `sesiones` (lista de
  `{ id, modo, titulo, term, fit, ws, elemento, cerrada }`) con `sesionActiva`. `abrirTerminal(modo)`: si `modo ===
  'profesor'` y ya hay una sesión Profesor viva, la activa; si no, crea una nueva (no mata nada). «+» crea un shell;
  «×» en una pestaña cierra su `ws` (el servidor mata la pty) y la quita; la última que se cierra deja el panel
  abierto con el mensaje «Sin sesiones: + abre una». Activar una sesión muestra su `elemento`, oculta los demás y hace
  `fit` en el siguiente frame; el `ResizeObserver` ignora medidas de 0 (no manda `resize` de 0 columnas por el `ws`).
  `onclose` del `ws` pinta «[terminal cerrada]» y marca la pestaña (`cerrada`): Enter en ella la vuelve a abrir con el
  mismo modo. Cambiar de cuaderno (el aviso del canal de cambios que ya existe) cierra todas las sesiones.
  Ctrl ` sigue alternando el panel; con el panel abierto y el foco en él, Ctrl ` lo cierra y devuelve el foco al botón.
- `public/index.html` / `estilo.css`: sub-barra de sesiones dentro de la pestaña Terminal (`.sesiones`, botones con
  el título y «×», más «+»), en el mismo estilo que `.terminal-barra` de hoy.
- Test primero, en `panel.test.js`:
  8. Terminal, escribir `hola` → el eco aparece; pulsar Profesor → segunda pestaña activa con `cmd` del adaptador del
     kit; volver a la primera: `hola` sigue ahí (el shell no murió);
  9. tras volver de una pestaña a otra, el último `resize` registrado por la pty falsa tiene `cols > 0` y `rows > 0`;
  10. `salir()` de la pty falsa: la pestaña dice «[terminal cerrada]» y Enter en ella abre una sesión nueva;
  11. «×» en la única sesión deja el panel abierto con el mensaje y «+» abre otra;
  12. Ctrl ` con el foco dentro del panel lo cierra y el foco vuelve a `#btn-terminal`.
- Comando: `npm run test:navegador`. Commit: `Terminal: varias sesiones a la vez; Profesor ya no mata el shell`.

### T5 · Terminal cuidada: letra y tema

- `public/app.js`: el `fontSize` del xterm sigue el ajuste «Letra» (pequeña 12.5, media 13.5, grande 15) y cambia en
  vivo en todas las sesiones (`term.options.fontSize` y `fit`). La paleta: la oscura de hoy cuando el tema efectivo es
  oscuro y una clara (fondo `var(--fondo)`, tinta `var(--tinta)`, los 16 colores con contraste 4,5:1 sobre claro)
  cuando es claro; se aplica al crear la sesión y al cambiar el tema (`term.options.theme`).
- `public/estilo.css`: `--terminal-fondo` ya existe por tema; se añaden las variables de la paleta clara.
- Test primero, en `panel.test.js`:
  13. con «Letra: grande», el `font-size` de `.xterm-rows` de la sesión abierta es 15 px; con «Tema: claro», el fondo
      del contenedor de la terminal es el claro.
- Comando: `npm run test:navegador`. Commit: `Terminal: letra y tema siguen los Ajustes`.

### T6 · Crítica de diseño, capturas y cierre

- Capturas del después con `pruebas/sonda-navegador.js` (panel a la derecha y abajo, 1440 y 1280 px, claro y oscuro)
  en `docs/capturas/despues-panel-2026-10-08.png` (y `-abajo`). Ronda de crítica (agente con `design-critique` sobre
  las capturas); objeciones aplicadas o razonadas en `docs/diseno/critica-<fecha>.md` y en el plan vivo.
- `docs/planes/plan-vivo.md`: §0 (Ahora/Después), §6 fila «Panel» (posición, tamaño, sesiones; qué se decidió y por
  qué), §7 fase 9 cerrada; Inbox: «barra lateral plegable en escritorio» se revisa con el panel a la derecha abierto.
- Comandos: `npm test && npm run test:navegador`. Commit: `Fase 9 cerrada: panel con terminal movible, ajustable y
  con sesiones; crítica de diseño aplicada`.

## Qué revisar (fallos que el encargo implica y su test)

1. **Pestaña oculta mide 0 y manda `resize` a 0 a la pty** → T4, test 9.
2. **Columna fantasma con el panel cerrado** (la rejilla reserva la columna 3) → T2, test 1.
3. **Valor guardado que no cabe en otra ventana** → T3, test 6; y el `resize` de ventana reacota (T2) con el test 3.
4. **La pty muere (el shell sale, el comando del profesor falla) y la pestaña se queda muda** → T4, test 10.
5. **Dos pestañas del navegador guardan tamaños distintos:** gana la última; la otra lo ve al recargar. Sin test:
   no rompe nada y es el mismo comportamiento del tema.

## Rondas de abogado del diablo

(pendiente la ronda completa antes de la entrega)
