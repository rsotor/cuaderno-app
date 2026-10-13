# Navegación: búsqueda en modal y reorganización A2 — plan de trabajo

**2026-10-13 · estado: plan escrito (fase 4 de la skill `plan`, camino arquitectónico), pendiente de la revisión de
Roberto. Ronda completa de abogado del diablo hecha (§11: 10 objeciones, 9 aplicadas y 1 en parte).** Nada de código todavía. Dos PR, en este orden: **PR 1, la
modal de búsqueda; PR 2, la reorganización A2.** Quien tome una tarea lee §1-§4 enteros, su tarea y §8; el resto, cuando
lo necesite.

## 1. Objetivo, enfoque y restricciones

**Objetivo.** Que buscar, abrir una nota y apuntar una tarea se hagan desde una modal (⌘K, ⌘F, ⌘O) y que la barra lateral
y la barra superior queden como la maqueta A2: lo del cuaderno arriba a la izquierda, lo de la nota arriba a la derecha.

**Enfoque.** PR 1 saca la búsqueda del lateral a una modal que reutiliza `/api/buscar` (con un parámetro opcional,
`por-nota=1`, P1) y `/api/tarea` tal cual, con el campo del lateral convertido en un simple disparador. PR 2 rehace la cabecera del lateral (nombre con
selector, línea de estado con Guardar/Traer/Deshacer), la fila de accesos (con la lupa en lugar del campo), el pie y la
barra superior (‹ ›, Editar sin recuadro y el menú «…» de la nota), cada pieza en su tarea con su recorrido de navegador.

### 1.1 Restricciones (copiadas literales de `docs/diseno/navegacion-2026-10-13-roberto.md`)

> ## Decidido (Roberto, 2026-10-13)
>
> - **Guardar, Descargar y Deshacer van a la línea del estado**, bajo el nombre del cuaderno: `1 cambio por guardar
>   [Guardar] ⤓ ↶`. Con 0 cambios, «guardado hace 3 h» y Guardar sin destacar. Descartado: en la línea del nombre (no
>   cabe en ~280 px, lo vio Roberto) y abajo, en el hueco de Terminal/Ajustes (lejos de la vista; con kit es la acción
>   principal).
> - **Cuidado (Roberto): el texto no puede romper la línea.** El texto encoge y se corta con «…» (texto completo en el
>   tooltip); los botones no encogen nunca. Texto corto («1 cambio», «guardado · 3 h»). Test de navegador con los casos
>   largos: «128 cambios por guardar», «guardado hace 3 semanas», barra lateral al mínimo y letra al 200 %.
> - **Atrás / Adelante visibles (propuesta de Roberto, 2026-10-13; pendiente de su sí a la ubicación).** Hoy existen
>   solo en el menú de la app con ⌘[ / ⌘] (`electron/menu.js:45-48`); la web los tiene en el navegador. Propuesta:
>   flechas ‹ › al principio de la barra superior, antes de la ruta (sitio de Obsidian, Notion, VS Code), apagadas sin
>   historial y solo con `window.cuadernoApp` (principio 3). TODO: comprobar si funcionan los botones laterales del
>   ratón y el gesto de dos dedos del trackpad.
>
> ## Tras ver las maquetas (Roberto, 2026-10-13)
>
> - **A, no B** (B mezcla lo del cuaderno con lo de la nota en la barra superior).
> - **Fuera el rótulo «NOTAS»**: en su lugar, un borde superior algo más grueso entre los accesos y el árbol.
> - **Inicio con icono de casa** en la fila de accesos (el nombre del cuaderno abre el selector, como en Notion/Linear).
> - **«…» de la nota = lo que ya hay**: Mostrar en el Finder, Copiar la ruta, Ocultar (sí, Roberto), Mover a la papelera (al final, en rojo).
>   La maqueta añadió «Mover», que no existe: fuera.
> - **Buscar: icono que abre una modal tipo Obsidian** (Roberto: la búsqueda en modal es más funcional, así que en la
>   barra pierde peso). Objeción de Claude retirada: el campo pasa a ser solo un disparador. Para que se descubra:
>   tooltip con el atajo y una pista en la portada. La modal (buscar notas + «+ tarea») se diseña en el análisis de
>   Buscar y Abrir.
> - **Inbox:** favoritos u ordenar carpetas (función nueva; dónde se guarda, sin romper el principio 1).

De la tabla de zonas del mismo fichero (postura de Claude aceptada por Roberto), literal: «nombre → inicio, selector de
cuaderno al lado (recientes + «Abrir carpeta…»)» (sustituido después por «el nombre del cuaderno abre el selector»);
«quitar el recuadro a Editar (resuelve rev-13 #3)»; «Papelera a un menú «…»»; «fila de iconos con contador y tooltip para
Tareas, Comentarios y «+»»; «Ajustes fuera solo con `window.cuadernoApp` (la web no tiene menú: principio 3). Terminal a
icono».

### 1.2 Restricciones del encargo (2026-10-13)

- PR 1: ⌘F, ⌘O y ⌘K (Ctrl en Windows y en la web) abren la modal; el campo del lateral se queda, pero solo la abre; dentro,
  notas por título y contenido con carpeta y fragmento, «Apuntar tarea» (lo que hoy hace «+ texto» y Enter, **sin cambiar
  dónde ni cómo se escribe en `tareas.md`**), flechas/Enter/Esc, foco atrapado y devuelto, `role="dialog"` y ARIA.
  Reutiliza la búsqueda del servidor; nada nuevo en la API salvo que sea imprescindible. Las acciones `buscar` y
  `abrir-nota` del menú de Electron abren la modal.
- PR 2, **después de que se mergee el PR #27 (`arreglo/recarga-en-vivo-reconecta`)**: lateral de 260 px como mínimo,
  textos con «…» y botones que no encogen, test de casos largos, Guardar con borde a 0 cambios y relleno con cambios, ‹ ›
  y quitar Ajustes del lateral solo con `window.cuadernoApp`, menú «…» de la nota y la lupa en lugar del campo. Comprobar
  botones laterales del ratón y gesto del trackpad en Electron.
- Fuera: favoritos y ordenar carpetas (Inbox del fichero de Roberto).
- Principios de AGENTS.md: la app no escribe nada nuevo en el cuaderno (principio 1: solo la línea de `tareas.md` que ya
  escribía); la web conserva lo suyo (principio 3); toda función con su recorrido y su fila en el cuaderno de ejemplo;
  cobertura del servidor ≥ 85 %; crítica de diseño sobre capturas reales por tanda; un test que falla no se arregla
  tocando el valor esperado.

### 1.3 Contradicciones con decisiones previas (señaladas una vez; el plan sigue el encargo)

1. **Orden de los PR.** El fichero de Roberto («Orden», 2026-10-13) dice PR 1 = reorganización A2 con el buscador aún como
   campo y PR 2 = la modal. El encargo de hoy los invierte (modal primero). El plan sigue el encargo: la modal primero
   evita rehacer dos veces el campo del lateral (en A2 desaparece) y PR 2 ya no tiene que convivir con resultados en el
   lateral. Si Roberto quiere el orden de su fichero, cambian solo el orden de §5 y las dependencias de T2.3.
2. **Ctrl F y Ctrl O en la web.** El plan de Electron (T5, §6 del plan vivo, «Teclado») decidió que «en la web nada cambia
   y no gana ningún atajo», y en el navegador Ctrl F es «Buscar en la página». El encargo pide Ctrl en la web también. El
   plan lo implementa (T1.2) y deja la decisión a Roberto en §9, D1, con recomendación.
3. **PR 1 también depende del PR #27.** `alCambiarDisco` (la recarga en vivo que reescribe #27, `public/app.js`, rama
   `origin/arreglo/recarga-en-vivo-reconecta`) mira `$('#buscador').value` para decidir si repinta el árbol; PR 1 cambia
   esa línea. Empezar PR 1 desde `main` antes del merge de #27 garantiza un conflicto. **Los dos PR salen de `main` con
   #27 dentro.**
4. **Guardar en la maqueta.** `maqueta-a2.js:46, 146` pinta Guardar con borde de acento *con* cambios y `secundario` a 0.
   Roberto dice «Guardar sin destacar» a 0 y «destaca solo con cambios»; el encargo, «borde a 0 cambios y relleno con
   cambios». Se leen juntos así (ronda del abogado, objeción 4): **a 0, `secundario` neutro (el borde de la línea, tinta
   suave, sin acento); con cambios, `primario` (relleno)**. Un borde de acento a 0 seguiría destacando.
5. **La API.** El encargo pide no tocarla salvo que sea imprescindible. Lo es en dos sitios, justificados en P1 y P2.

## 2. De dónde se parte (hechos del repo, 2026-10-13)

- **Buscador en el lateral.** `public/index.html:65-66` (`#buscador`, `type="search"`, marcador «Buscar… o + tarea  (Ctrl
  K)» con color por defecto: 4,46:1 / 3,62:1, rev-13 #2). `public/app.js:108-176`: `buscar(q)` pinta en `#arbol` dos tramos
  («N notas» y «En el texto», con las líneas en crudo), `#lateral.buscando` esconde `.paginas` (`estilo.css:140`), flechas
  entre `#arbol a.resultado`, Escape vacía; `comandoTarea`/`anadirTareaDesdeBuscador` (`app.js:113-129`) mandan
  `POST /api/tarea { texto }` con ` [[ruta-sin-.md]]` si hay una nota `.md` abierta; `enfocarBuscador()` (`app.js:172`)
  despliega el lateral y selecciona el texto; Ctrl/⌘ K (`app.js:173-176`) lo llama.
- **Servidor.** `cuaderno.js:150-162` `buscar(q, tope = 60)`: `ficheros` (todas las rutas cuyo nombre o título contiene la
  consulta, sin acentos, sin tope) y `lineas` (`{ ruta, linea, texto ≤ 160 }`, **60 como mucho en total**). `servidor.js:163`
  quita las ocultas. `servidor.js:237` `/api/tarea` → `cu.nuevaTarea(texto)`. `servidor.js:96` `/api/cuadernos`: los
  recientes con `estadoGit` **síncrono por cada uno** (4 s de techo cada uno).
- **Menú de Electron.** `electron/menu.js:33-48`: `abrir-nota` (⌘O), `buscar` (⌘F), `nueva-tarea` (⌘T) mandan su nombre a
  la pantalla; ⌘K **reservada sin acción** (`RESERVADOS`, vigilado por `tests/electron-menu.test.js`): la página la atiende
  sola. `ACCIONES_APP` (`app.js:1033-1056`) hace `enfocarBuscador()` para las dos y ignora la acción con un diálogo abierto.
  Atrás/Adelante: `menu.js:178-188`, `webContents.navigationHistory` con `canGoBack`. La ventana carga primero
  `arrancando.html` (`electron/app.js:141`) y después la URL de entrada (`app.js:85`): **el historial empieza en
  `arrancando.html`**, así que ⌘[ en la primera nota puede volver a esa pantalla (no comprobado; §8, foco 3).
- **Terminal.** En la app, xterm deja pasar Ctrl/⌘ S, O, F, T y coma al menú (plan de Electron §11, hallazgo 9); Ctrl K no
  (en un shell es «borrar hasta el final»).
- **Diálogos.** `app.js:644-656`: `DIALOGOS` (lista de ids), `dialogoAbierto()`, `sincronizarInerte()` (`#app` inerte) y el
  Tab que da la vuelta dentro; `abrirModal`/`cerrarModal` (`app.js:938-939`) guardan y devuelven el foco.
- **Cabecera del lateral.** `index.html:63-64`: `.marca` con el nombre como enlace a `#/cuadernos` (rev-13 #7),
  `#btn-plegar`, `#estado-git` (`<small>`) con `textoGit` (`app.js:897`: «guardado hace 3 h, 1 cambio por guardar, 2 sin
  subir», se parte en dos líneas: recorrido #10) y `.guardar-barra` (Guardar relleno siempre, rev-13 #8). Lateral de 280 px
  fijos (`estilo.css:77`, `:294`); a ≤ 760 px es un cajón (`estilo.css:360-363`).
- **Accesos y pie.** `index.html:67-72` `.paginas` (Inicio, Tareas `(n)`, Comentarios `(n)`, Nueva nota con el mismo lápiz
  que Editar, rev-13 #5); `index.html:74-77` `.pie-lateral` (Terminal y Ajustes con texto).
- **Barra superior.** `index.html:80` `.miga-barra`: `#btn-desplegar`, `#btn-menu`, `#miga` (un `div`, rev-13 #4), «Editar»
  con recuadro; `app.js:307` mete en la miga Mostrar en el Finder, Copiar la ruta y Papelera (sin Papelera si la nota es
  `generado`); Ocultar solo existe en las filas del árbol (`app.js:182-185`).
- **PR #27** (abierto): reescribe la recarga en vivo (`alCambiarDisco`, `conectarCambios`) y ocupa la **fila 29** del
  índice del cuaderno de ejemplo. Este plan usa la 30 y siguientes.
- **Tab hasta la nota:** techo de 34 en `tests/navegador/diseno.test.js:67-81` (hoy 33).

- **Historial (visto en la ronda del abogado).** Las redirecciones a la portada empujan una entrada nueva:
  `enrutar` (`app.js:1083`, `location.hash = …`), `abrirCarpeta` (`app.js:918`) y la recarga en vivo al cambiar de
  cuaderno (`app.js:1100`; en #27, `alCambiarDisco`). Así, en la portada recién abierta ya «hay atrás» (a `/`), y volver
  a `/` re-empuja la portada y borra lo de delante. Tras cambiar de cuaderno sin recargar, las entradas anteriores
  apuntan a notas del cuaderno viejo.
- **Otros sitios que dependen del buscador o del lateral:** `crearNota` llama a `buscar('')` (`app.js:99`); en la app la
  pista del campo es la del menú, ⌘F (`app.js:26`, crítica 2026-10-10 (10), comprobada en `tests/electron/menu.test.js:71`);
  sin cuaderno, `estilo.css:85` esconde el buscador, pero Ctrl K (`app.js:174`) no mira `cuaderno()`; Escape a ≤ 760 px
  cierra el cajón del menú y enfoca `#btn-menu` sin mirar si hay un diálogo (`app.js:1017`); `LATERAL = 280` en JS
  (`app.js:756`) para el cajón y el índice; a ≤ 760 px el lateral es un cajón del 80 % del ancho (`estilo.css:361`), que
  a 320 px de pantalla mide 256 px; `#miga strong` es la señal de espera de los recorridos (`tests/navegador/ayuda.js:67`).

## 3. Decisiones de este plan

| # | Decisión | Por qué |
|---|---|---|
| P1 | **`/api/buscar?por-nota=1`** (opcional; sin él, la respuesta de siempre): `ficheros` como hoy y `lineas` con **la primera línea que coincide de cada nota**, hasta 50 notas, con las ocultas filtradas **antes** del tope (`buscar(q, { porNota, excluir })` en `cuaderno.js`), más `cortado: true` si quedaron notas fuera | Imprescindible: con el tope de hoy (60 líneas en total, `cuaderno.js:158-159`) una sola nota larga gasta el tope y la modal «una fila por nota» enseñaría una o dos notas por contenido; y como el servidor filtra las ocultas después del tope (`servidor.js:163`), el cliente no puede saber si se cortó. Ronda del abogado, objeción 6 |
| P2 | **`GET /api/cuadernos?sin-git=1`**: la misma lista sin `git` | El selector se abre a menudo y hoy cada apertura haría `estadoGit` síncrono por reciente (servidor parado hasta 4 s × N) |
| P3 | Las piezas puras de la búsqueda (convertir la respuesta en filas, limpiar el fragmento, resaltar) van en `public/busqueda.js`, script clásico que deja `window.Busqueda` y, si existe `module`, `module.exports` | Se prueban en Node (`tests/busqueda.test.js`); el DOM sigue en `app.js`. Patrón de script clásico: `public/comentar.js` |
| P4 | El campo de la modal conserva el id **`#buscador`**; el disparador del lateral pasa a `<button id="btn-buscar">` con aspecto de campo (PR 1) y lupa (PR 2) | El nombre «el buscador» sigue valiendo en código y tests; el disparador es botón porque no se escribe en él |
| P5 | Combobox WAI-ARIA 1.2: foco siempre en `#buscador` (`role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`), lista `role="listbox"`, filas `role="option"`, `role="status"` con el recuento. **La primera *nota* queda elegida; la fila de tarea nunca se elige sola** (solo con flechas) | Flechas sin sacar el foco del campo. Lo segundo, para que Enter sin resultados no apunte nada (objeción 2a) |
| P6 | `abrirBusqueda(texto)` es idempotente: con la modal abierta, **no** vuelve a llamar a `abrirModal` (no pisa el foco guardado); solo enfoca el campo y selecciona su texto | El atajo puede llegar por la página y por el acelerador; abrir dos veces no apila nada ni pierde a dónde volver (objeción 10) |
| P7 | La modal recuerda la última consulta **de búsqueda** de la sesión y la abre seleccionada; **tras apuntar una tarea, la consulta se olvida** | Lo que hacía el campo con ⌘O (plan de Electron T5) sin que un Enter repita la tarea (objeción 2c) |
| P8 | Una fila por nota: el nombre como en el árbol (`nombreNota`, sin `.md`), la carpeta a la derecha y debajo el fragmento de su línea, sin sintaxis (`[[a|b]]` → b, `> [!tipo] ` fuera, `- [ ] ` fuera, `**`/`_`/`` ` `` fuera). Si coincide por título y no por nombre, el título hace de fragmento; si solo por la carpeta, «en la carpeta …». Orden: las que coinciden por nombre, título o carpeta y después las de solo contenido. Con `cortado`, al final «Hay más: afina la búsqueda» | Es la maqueta y resuelve recorrido #11 y revisión-09 #11 |
| P9 | «Apuntar tarea»: fila al pie con el texto («Apuntar tarea: «…»», pista «escribe + delante»). Se activa con Enter sobre ella (llegando con flechas), con ⌘/Ctrl Enter desde cualquier fila, o con Enter si el texto empieza por «+». La función pasa a recibir el texto (`apuntarTarea(texto)`, sin «+»): hoy `anadirTareaDesdeBuscador` sale si no hay «+» (`app.js:113, 120-121`). **Escribe lo mismo que hoy**: `POST /api/tarea` con el texto y ` [[nota]]` si hay una nota `.md` abierta | Encargo: «sin cambiar dónde ni cómo se escribe en `tareas.md`». Enter sin «+» y sin elegir la fila no apunta nada («el buscador solo busca», plan vivo 2026-10-08). Objeción 2b |
| P10 | Ctrl/⌘ K con el foco en la terminal **no** abre la modal (llega al shell); ⌘F/⌘O sí, por el menú. Sin cuaderno abierto (pantalla de Cuadernos), ningún atajo la abre | Ctrl K es del shell en Windows y Linux; sin cuaderno `/api/buscar` falla |
| P11 | La pista del disparador y de la lupa: **en la app, la del menú (⌘F / Ctrl F)**, como hoy (convención de la crítica 2026-10-10 (10)); en la web, «⌘K» en Mac y «Ctrl K» en el resto (hoy dice «Ctrl K» también en Mac: rev-13, Menores) | No se cambia un valor que un test comprueba sin decisión (objeción 5); la maqueta pone «⌘K» en la app: si Roberto lo prefiere, es una línea (§9, D6) |
| P12 | **«Lateral al mínimo» = 260 px de verdad:** el lateral de escritorio sigue en 280 fijos (`estilo.css:77`, `LATERAL` en `app.js:756`); el cajón de ≤ 760 px pasa de `inset: 0 20% 0 0` a `width: max(80vw, 260px)` (a 320 px de pantalla hoy mediría 256). 260 es el ancho más estrecho que el lateral puede tener, y el test lo alcanza sin forzar CSS | El encargo pide «ancho mínimo 260»; el lateral no tiene asa y forzar 260 solo en el test probaría un estado que no existe (objeción 3). Un asa, al Inbox (§9, D4) |
| P13 | **«Letra al 200 %»:** el texto de la cabecera (nombre, estado, Guardar) pasa a `em` sobre la letra del cuerpo, que ya sigue al ajuste «Letra» (`estilo.css:35-36`); los iconos y su caja siguen en px. El test pone el cuerpo al 200 % (`body { font-size: 200% }` sobre la página real) y mira que la línea aguanta | El zoom de página da los mismos px de CSS y no prueba nada (objeción 3); lo que rompe una línea es el texto que crece y los botones que no |
| P14 | Texto de estado corto, una línea: con cambios «N cambio(s)»; sin cambios y con commits sin subir «N sin subir»; sin nada pendiente «guardado · 3 h» / «guardado · 2 días» / «guardado · 12 sep»; sin repo, nada. `textoGit` entero (el de hoy) al `title` y al `aria-label` | Decisión de Roberto; resuelve recorrido #10 |
| P15 | Guardar: con 0 cambios, `secundario` (borde neutro de la línea, tinta suave); con cambios ≥ 1, `primario`. Traer y Deshacer, iconos de 28 px con `aria-label` y `title` | §1.3, 4; resuelve rev-13 #8 |
| P16 | «Abrir carpeta…» del selector: en la app, el diálogo del sistema (`elegirCarpeta`); en la web, la pantalla de Cuadernos (`#/cuadernos`) | Principio 3 |
| P17 | **Historial de la app con reglas propias** (objeción 1): (a) toda redirección a la portada o a la ruta del cuaderno usa `location.replace` (sin entrada nueva): `enrutar`, `abrirCarpeta`, `alCambiarDisco`, `mandarAPapelera`; (b) cada entrada guarda su cuaderno (`navigation.updateCurrentEntry({ state: { cuaderno } })`); (c) `puedeIr(dir)` = la entrada vecina existe, es del mismo origen y del mismo cuaderno (`navigation.entries()`, Navigation API, Chromium ≥ 102; Electron 44 la trae); (d) ‹ ›, ⌘[ / ⌘], botones del ratón y gesto usan **una sola** función `irHistorial(dir)` de la pantalla. Por eso los elementos Atrás/Adelante del menú pasan a mandar la acción `atras`/`adelante` a la pantalla (como los demás), en vez de usar `navigationHistory` desde el principal | Así ‹ no vuelve a `arrancando.html` (otro origen) ni a una nota del cuaderno anterior, y el menú y los botones dicen lo mismo. Sin IPC nuevo. Sustituye a la idea de `navigationHistory.clear()`, que corría antes de la redirección (objeción 1, escenario 4) |
| P18 | Botones laterales del ratón: `mouseup` con `button` 3/4 → `irHistorial`, solo con `window.cuadernoApp`. Gesto: el evento `deslizar` de `BrowserWindow` (macOS) manda `atras`/`adelante` a la pantalla. Dos dedos con la preferencia por defecto: no (T2.7) | — |

## 4. Ficheros

| Fichero | PR | Qué cambia y de qué es responsable |
|---|---|---|
| `cuaderno.js`, `servidor.js` | 1, 2 | PR 1: `buscar(q, { porNota, excluir })` y `?por-nota=1` (P1). PR 2: `?sin-git=1` en `/api/cuadernos` (P2) |
| `tests/cuaderno.test.js`, `tests/rutas.test.js` | 1, 2 | P1 y P2 |
| `public/busqueda.js` (nuevo) | 1 | `filas(respuesta, q, titulos)` → `{ ruta, nombre, carpeta, fragmento, linea, porNombre }`; `limpiarFragmento(texto)`; `resaltar(texto, q)`. Sin DOM |
| `tests/busqueda.test.js` (nuevo) | 1 | Node: filas, orden, limpieza, resaltado, escape |
| `public/index.html` | 1, 2 | PR 1: `#busqueda` y `#btn-buscar`; `<script src="/public/busqueda.js">`. PR 2: cabecera, accesos, pie, barra superior, `#menu-cuaderno`, `#menu-nota`, iconos (`i-lupa`, `i-mas`, `i-izq`, `i-der`, `i-puntos`, `i-abajo`, `i-nota`) |
| `public/app.js` | 1, 2 | PR 1: la sección «buscador» (modal, filas, teclado, tarea), `DIALOGOS`, `ACCIONES_APP`, `crearNota`, `ocultar`, `mandarAPapelera`, `alCambiarDisco`, Escape del cajón. PR 2: `pintarEstado`, selector, menú «…», historial (P17), ratón |
| `public/estilo.css` | 1, 2 | PR 1: la modal (`maqueta-a2.js`: 620 px, 11vh, radio 12, filas 8×10, `--acento-suave`), el disparador. PR 2: cabecera en `em`, accesos, borde de 2 px sobre el árbol, pie, barra superior, menús, cajón `max(80vw, 260px)` |
| `electron/menu.js` | 1, 2 | PR 1: comentarios. PR 2: Atrás/Adelante mandan `atras`/`adelante` (P17) |
| `electron/ventana.js` | 2 | `deslizar` (P18) |
| `tests/navegador/busqueda.test.js`, `tests/navegador/navegacion.test.js` (nuevos) | 1, 2 | Los recorridos |
| `tests/electron-menu.test.js`, `tests/electron-app.test.js`, `tests/electron-ventana.test.js`, `tests/electron/menu.test.js` | 1, 2 | Ver cada tarea |
| `ejemplos/cuaderno-ejemplo/busqueda/fragmentos.md` (nuevo) | 1 | Líneas con «zanahoria» con wikilink con alias, callout y casilla |
| `ejemplos/cuaderno-ejemplo/navegacion/una-nota-con-un-nombre-muy-largo-para-la-barra-superior.md` (nuevo) | 2 | La miga larga |
| `ejemplos/cuaderno-ejemplo.md` | 1, 2 | Filas de característica; casos 30 (PR 1) y 31-34 (PR 2) |
| `pruebas/capturas-navegacion.js` (nuevo) | 1, 2 | Capturas reales para la crítica (copia del ejemplo en `cuadernos-prueba/`); fuera de la cobertura |
| `docs/diseno/critica-2026-10-xx-busqueda.md`, `…-navegacion.md`; `README.md`; `docs/planes/plan-vivo.md` | 1, 2 | En la tarea de cierre |

## 5. Tareas

Para todas: rama nueva desde `main`; commit en castellano por tarea, **cada commit con los tres juegos en verde** (squash al
mergear); `npm test` siempre; `npm run test:navegador` si toca `public/`; `npm run test:electron` (en Linux `xvfb-run
-a`) si toca `electron/` o lo que la pantalla hace con `window.cuadernoApp`; **nunca `test:navegador` y `test:electron`
a la vez**; `npm run test:cobertura` si toca `cuaderno.js`, `servidor.js` o `electron/`. Cada test nuevo se escribe
primero y se ve fallar. **Crítica de diseño:** la tanda es el PR; la ronda corre sobre capturas reales de la rama al final
de la última tarea visual de cada PR, **antes de su commit y antes de abrir el PR**, y lo que cambie entra en ese commit
(precedente: T8 del plan de Electron).

### PR 1 · La búsqueda en una modal (7 tareas)

#### T1.0 · Punto de partida
- **Qué:** el PR #27 mergeado en `main`. Releer en `main` `alCambiarDisco` y la fila 29 del índice del ejemplo y ajustar
  T1.4 si algo no cuadra con lo que dice este plan (que leyó #27 en `origin/arreglo/recarga-en-vivo-reconecta`). Este plan
  y los documentos de diseño del 2026-10-13 sin seguimiento (`referentes`, las `a2-*.png`, `maqueta-a2.js`) entran por su
  propio PR de documentación, no por #27 (§9, D7).
- **Test / comando:** `git log main --oneline -3` muestra #27; `npm test`.
- **Commit:** ninguno (es una comprobación).

#### T1.1 · `/api/buscar?por-nota=1`
- **Qué:** P1. `Cuaderno.buscar(q, { tope = 60, porNota = false, excluir = () => false } = {})`: con `porNota`, la primera
  línea que coincide de cada nota, hasta 50 notas, saltando `excluir(ruta)` antes de contar, y `cortado`. `servidor.js:163`
  pasa `excluir: oculta` cuando llega `por-nota=1`; sin el parámetro, todo como hoy (también la firma posicional
  `buscar(q, tope)`, si algo la usa).
- **Primero el test:** `tests/cuaderno.test.js`: una nota con 80 líneas que coinciden + otras dos → tres entradas, una por
  nota; 55 notas que coinciden → 50 y `cortado: true`; una nota que `excluir` quita no gasta tope. `tests/rutas.test.js`:
  `?por-nota=1` con una carpeta oculta (`/api/ocultar`) no la devuelve ni la cuenta; sin el parámetro, la respuesta de hoy.
- **Comando:** `npm test && npm run test:cobertura`.
- **Commit:** `feat: /api/buscar?por-nota=1, una línea por nota con las ocultas fuera antes del tope`.

#### T1.2 · Las piezas puras de la búsqueda
- **Qué:** `public/busqueda.js` (P3, P8). No se carga todavía en la página.
- **Primero el test:** `tests/busqueda.test.js`: (1) `ficheros: ['conceptos/capital.md']` + líneas de `capital.md` e
  `inicio.md` → dos filas, `capital` primero con `porNombre`; (2) `> [!comment] Alumno (2026-10-02) · «capital inicial»` →
  `Alumno (2026-10-02) · «capital inicial»`; `- [ ] Repasar [[capital|el capital]]` → `Repasar el capital`; `**negrita**`
  → `negrita`; (3) solo por título: el título de fragmento; solo por carpeta (`conceptos/…` buscando «concep»): «en la
  carpeta conceptos»; (4) `cortado` → `hayMas: true`; (5) `resaltar('Interés', 'interes')` marca «Interés»; (6) `<script>`
  sale escapado.
- **Comando:** `node --test tests/busqueda.test.js && npm test`.
- **Commit:** `feat: piezas de la búsqueda en modal: una fila por nota y el fragmento sin sintaxis`.

#### T1.3 · La modal: abrir, buscar, moverse, abrir la nota, cerrar
- **Qué:**
  - `index.html`: `#busqueda` (`class="modal busqueda" role="dialog" aria-modal="true" aria-label="Buscar" hidden`) con
    `#buscador` (P5), `#busqueda-lista` (`role="listbox"`), `#busqueda-estado` (`role="status"`, oculto a la vista) y el pie
    de pistas («↑ ↓ moverse · ↵ abrir · esc cerrar», teclas con `pista()`). En el lateral, `#btn-buscar` (lupa + «Buscar…» +
    pista de P11; tinta `--tinta-suave`, ≥ 4,5:1: rev-13 #2), escondido sin cuaderno como hoy `#buscador` (`estilo.css:85`).
  - `app.js`: `abrirBusqueda(texto)` (P6, P7) con `abrirModal('#busqueda', '#buscador')` la primera vez; `#busqueda` entra
    en `DIALOGOS`. La abren: `#btn-buscar`; ⌘/Ctrl K (P10: con cuaderno y sin el foco en `#cajon`); **Ctrl/⌘ F y Ctrl/⌘ O
    también en la web** (pedido en el encargo; §9, D1); `ACCIONES_APP.buscar` y `['abrir-nota']`. Al escribir: 120 ms →
    `/api/buscar?por-nota=1` → `Busqueda.filas` → opciones con `id`, la primera nota elegida; ↓/↑ con vuelta, Enter abre
    (`#/n/<ruta>` o `?l=<línea>`), clic abre, Esc o clic en el velo cierran y devuelven el foco. Sin texto: lista vacía y
    el pie. Sin resultados: «Nada con «…»». Respuestas que llegan tarde se descartan (contador de turno). El «+» de hoy se
    pinta en la modal con los mismos textos («Enter añade la tarea: …», «enlazada a …») y escribe como hoy (T1.5 lo amplía).
  - Fuera del lateral: `buscar()` en `#arbol`, `#lateral.buscando` (`estilo.css:140`), `pintarComando` en `#arbol`, los
    tramos. `crearNota` deja de llamar a `buscar('')` (`app.js:99`). El Escape del cajón del menú (`app.js:1017`) no actúa
    con un diálogo abierto.
  - `electron/menu.js`: solo los comentarios de `ATAJOS`.
- **Primero el test:** `tests/navegador/busqueda.test.js`: (1) Ctrl K abre `#busqueda` con `role="dialog"` y
  `aria-modal`, foco en `#buscador`, `#app` inerte; Esc cierra y el foco vuelve a donde estaba; igual desde `#btn-buscar`
  (vuelve a él), con Ctrl F y con Ctrl O; (2) «interes» → la fila de `conceptos/interes.md` elegida con su carpeta;
  «capital» sale **una vez**; ↓ mueve `aria-activedescendant` con el foco en `#buscador`; Enter abre y cierra; (3)
  «zanahoria» → fragmento sin `[[`, `> [!` ni `- [ ]`; Enter abre en la línea (`?l=`); (4) Tab y Mayús Tab no salen; (5)
  Ctrl K dos veces → un diálogo, texto seleccionado, y al cerrar el foco vuelve al elemento de **antes de la primera**
  apertura; (6) foco en la terminal (pty de mentira): Ctrl K no abre y el pty recibe `\x0b`; (7) en `#/cuadernos` sin
  cuaderno, Ctrl K no abre nada; (8) a 390 px, abrir desde el cajón del menú y Esc → la modal se cierra y el foco vuelve
  a `#btn-buscar` (el cajón sigue abierto); (9) la caja mide 620 px a 1280 y no desborda a 390; (10) Nueva nota sigue
  abriendo la nota creada (`uso.test.js:80-90` lo cubre: tiene que seguir en verde).
- **Tests existentes que cambian, y por qué** (cambia *dónde* se busca, por decisión de Roberto; lo que se escribe en el
  cuaderno no cambia): `lectura.test.js:27-38, 60-71` (filas en `#busqueda-lista [role=option]`; los tramos «N notas» / «En
  el texto» y «`.paginas` oculta mientras se busca» se sustituyen por «una fila por nota» y «el lateral no cambia»: los
  tramos desaparecen por la maqueta; «flecha arriba vuelve al buscador» pasa a «el foco nunca sale de `#buscador`», P5);
  `casos.test.js:93-95`; `ficheros.test.js:84-87`; `lateral.test.js:53-55` (Ctrl K con el lateral plegado ya no lo
  despliega: la aserción pasa a «abre la modal y el lateral sigue plegado»); `uso.test.js:91-96` («Nada con…» en la modal;
  Enter sigue sin crear nada); `edicion.test.js:89-92` («e» escrito en el buscador no edita: se abre la modal antes);
  `tareas.test.js:32-55` y `casos.test.js:108-112` (el «+» en la modal; **las regex de `ficheroCumple` no cambian**; las
  pistas `tareas.test.js:34, 36, 53` se leen en `#busqueda-lista` con el mismo texto; «el buscador se vacía» y «`.paginas`
  de vuelta» pasan a «la modal se cierra»); `electron/menu.test.js:71` (la misma pista `(${mod}F)`, ahora en el texto de
  `#btn-buscar` en vez del `placeholder`), `134-153` (`buscar` y `abrir-nota` abren la modal con `[0, 7, 'capital']`
  seleccionado; `nueva-tarea` deja `+ ` en el campo de la modal: misma aserción, otro sitio; `150-151`, igual).
- **Cuaderno de ejemplo:** `busqueda/fragmentos.md` (≤ 40 líneas) y su fila; caso **30** «Buscar en una modal: notas por
  nombre y por texto, una fila por nota con su carpeta y el fragmento limpio; flechas, Enter, Esc» →
  `tests/navegador/busqueda.test.js`, sin kit.
- **Comando:** `npm test && npm run test:navegador`, después `npm run test:electron`.
- **Commit:** `feat: la búsqueda en una modal (⌘K, ⌘F, ⌘O): una fila por nota con su carpeta y el fragmento limpio`.

#### T1.4 · La modal con la recarga en vivo, ocultar y la papelera
- **Qué:** `alCambiarDisco`, `ocultar` y `mandarAPapelera` repintan el árbol siempre (ya no hay búsqueda en el lateral) y,
  con la modal abierta, repiden la consulta conservando texto, fila elegida (por ruta) y foco.
- **Primero el test** (en `busqueda.test.js`): con «capital» escrito, se escribe en el disco otra nota con «capital» →
  aparece su fila sin perder texto ni foco; se oculta (`/api/ocultar`) la carpeta `conceptos` → su fila se va; el árbol
  se repinta con la modal abierta.
- **Comando:** `npm test && npm run test:navegador`.
- **Commit:** `feat: la modal de búsqueda sigue al disco: recarga en vivo, ocultar y papelera`.

#### T1.5 · «Apuntar tarea» y ⌘T
- **Qué:** P9 y la fila fija «Apuntar tarea: «texto»» (oculta con el campo vacío; última opción, nunca elegida sola: P5);
  `apuntarTarea(texto)`; tras apuntar, aviso «Tarea añadida», la modal se cierra **y olvida la consulta** (P7), contadores
  y panel al día. Pie: «⌘↵ tarea» (Ctrl ↵ fuera de Mac). `ACCIONES_APP['nueva-tarea']`: la casilla del panel Tareas si
  está a la vista; si no, `abrirBusqueda('+ ')` con el cursor al final.
- **Primero el test** (en `busqueda.test.js`): (1) leyendo `conceptos/interes.md`, «Releer esto» + Ctrl Enter →
  `tareas.md` termina en `- [ ] Releer esto [[conceptos/interes]]\n` (regex de `tareas.test.js:55`); (2) desde Tareas
  (ninguna nota abierta), «+ Comprar pan» + Enter → `- [ ] Comprar pan\n`; (3) «zanahoria» + flechas hasta la fila de tarea
  + Enter → la tarea; (4) «Pendientes de hoy» (0 resultados) + Enter → `tareas.md` igual byte a byte y la fila de tarea con
  `aria-selected="false"`; (5) tras (2), Ctrl K abre con el campo vacío y Enter no escribe nada.
- **Comando:** `npm test && npm run test:navegador`, después `npm run test:electron`.
- **Commit:** `feat: apuntar una tarea desde la modal de búsqueda (fila, ⌘↵ y «+»), escrita como siempre en tareas.md`.

#### T1.6 · Cierre de PR 1
- **Qué:** `pruebas/capturas-navegacion.js --pr 1` → `docs/capturas/navegacion/` (con y sin resultados, fila de tarea
  elegida, claro y oscuro, 1440 y 390). Crítica de diseño (`design-critique`, comparando con `a2-busqueda-modal-*.png`) en
  `docs/diseno/critica-2026-10-xx-busqueda.md`, objeciones aplicadas (con test si cambian conducta) o razonadas. README
  «Teclado»; plan vivo §0 y §6 («Tareas rápidas», «Teclado»); fila 28 del ejemplo («al buscador» → «a la modal»).
- **Test:** los tres juegos en verde; `ejemplo.test.js`.
- **Commit:** `docs: la modal de búsqueda en el plan vivo, el README y su crítica de diseño`. PR `feat: búsqueda en una
  modal (⌘K, ⌘F, ⌘O) con «Apuntar tarea»`, CI en los tres sistemas, squash.

### PR 2 · Reorganización A2 (8 tareas)

Empieza con PR 1 en `main`. Ids que se conservan (los usan muchos tests): `#btn-guardar`, `#btn-traer`, `#btn-deshacer`,
`#estado-git`, `#nombre-curso`, `#link-inicio`, `#n-tareas`, `#n-comentarios`, `#btn-nueva-nota`, `#btn-terminal`,
`#btn-ajustes`, `#btn-editar`, `#btn-buscar`, `nav.paginas` (la fila de accesos) y **`#miga strong`** (la señal de espera de
`tests/navegador/ayuda.js:67`).

#### T2.1 · La línea del estado, con los casos largos
- **Qué:** `.marca` en dos líneas (`maqueta-a2.js`, `.m-linea1`/`.m-linea2`): nombre + plegar; debajo `#estado-git`
  (`<span>`, `flex: 1 1 0; min-width: 0`, una línea, `ellipsis`) + Guardar (`flex: none`) + Traer + Deshacer (`flex: none`,
  28×28). Texto en `em` (P13), `textoEstado(g)` (P14), Guardar (P15), cajón `max(80vw, 260px)` (P12).
- **Primero el test** (`navegacion.test.js`, «línea del estado»), sobre una copia con `git init`: casos (a) 128 ficheros
  nuevos, (b) último commit de hace 21 días y 0 cambios, (c) los textos literales de Roberto, «128 cambios por guardar» y
  «guardado hace 3 semanas», puestos en `#estado-git`; montajes (i) 1280×800, (ii) el lateral al mínimo real: pantalla de
  320×700 con el cajón abierto (260 px), (iii) `body { font-size: 200% }` a 1280×800, (iv) (ii) y (iii) juntos. En cada
  uno: la línea mide una altura de línea (la misma que con «1 cambio» en ese montaje); el texto desborda con «…» y su
  `title` es el entero; los tres botones tienen el ancho del caso corto del mismo montaje (±0,5 px) y quedan dentro del
  lateral; Guardar es `secundario` a 0 y `primario` con 128; texto ≥ 4,5:1 e iconos ≥ 3:1, claro y oscuro.
- **Tests existentes que cambian, y por qué:** `diseno.test.js:39-40` mira `/\d+ cambios? por guardar/` en el **texto** de
  `#estado-git`; por decisión de Roberto (texto corto, el completo en el tooltip) la misma regex pasa al `title`, y se
  añade que el texto visible es `/^\d+ cambios?$/`. `indice.test.js:119` lee `.marca small`: el selector pasa a
  `#estado-git`, mismo umbral. `lateral.test.js:59-...` (a 760 px, el menú «de siempre»): el cajón mide lo mismo a 760
  (80 % > 260), sin cambio.
- **Comando:** `npm test && npm run test:navegador`.
- **Commit:** `feat: la línea del estado bajo el nombre: texto corto con «…», Guardar destacado solo con cambios`.

#### T2.2 · El selector de cuaderno
- **Qué:** el nombre pasa a `<button id="btn-cuaderno" aria-haspopup="menu" aria-expanded>` con icono, `#nombre-curso` (con
  «…») y chevron (rev-13 #7). `#menu-cuaderno` (`role="menu"`): «Recientes», un `menuitemradio` por reciente (el abierto
  `aria-checked`; los que no existen, `aria-disabled` y `title` «No está en esta ruta»), separador, «Abrir carpeta…» (P16).
  Teclado: ↑↓ con vuelta, Inicio/Fin, Enter/Espacio, Esc cierra y devuelve el foco, Tab y clic fuera cierran. Elegir un
  reciente: `abrirCarpeta(ruta)` (la de la pantalla de Cuadernos) **sin** el aviso «Este servidor ha abierto otro
  cuaderno»: `abrirCarpeta` guarda la ruta pedida y `alCambiarDisco` solo calla si la ruta nueva es esa, y la marca se
  borra al usarla o a los 10 s (recorrido #6a; objeción 10). Datos: `GET /api/cuadernos?sin-git=1` (P2).
- **Primero el test:** `rutas.test.js`: `?sin-git=1` da `ruta`, `nombre`, `existe`, `abiertoAhora` y ninguna clave `git`;
  sin el parámetro, como hoy. `navegacion.test.js` «selector»: con dos recientes, el menú lista los dos con el abierto
  marcado; ↓ + Enter abre el otro, `#nombre-curso` cambia y **no** sale el aviso de otra pestaña; si otra pestaña cambia
  de cuaderno después, **sí** sale; Esc devuelve el foco a `#btn-cuaderno`; en la web «Abrir carpeta…» lleva a
  `#/cuadernos`; con `cuadernoApp` de mentira (`addInitScript`, como `maqueta-a2.js`) llama a `elegirCarpeta`; un reciente
  borrado sale deshabilitado.
- **Tests existentes que cambian:** ninguno (`#nombre-curso` se conserva; los que van a Cuadernos usan `e.ir`).
- **Comando:** `npm test && npm run test:cobertura && npm run test:navegador`.
- **Commit:** `feat: el nombre del cuaderno abre el selector (recientes y «Abrir carpeta…»)`.

#### T2.3 · La fila de accesos con la lupa, y fuera el rótulo del árbol
- **Qué:** `nav.paginas` en una fila: casa (`#link-inicio`, icono, `aria-label`/`title` «Inicio»), lupa (`#btn-buscar` en
  icono de 28 px, `title` «Buscar (…)» con la pista de P11), «Tareas N» y «Comentarios N» (número **sin paréntesis**;
  `aria-label` «Tareas, 1 pendiente» / «Comentarios, 3»: rev-13 #10), «+» al final (`#btn-nueva-nota`, icono `i-mas`, no
  el lápiz: rev-13 #5). `#arbol` con `border-top: 2px solid var(--borde-arbol)` y sin rótulo. La pista en la portada
  **no** se implementa hasta que Roberto elija (§9, D3).
- **Primero el test:** `navegacion.test.js` «accesos»: nombre accesible y `title` en cada uno; la lupa abre la modal y el
  foco vuelve a ella al cerrar; contadores sin paréntesis con `aria-label`; `#btn-nueva-nota` sin `#i-lapiz`; borde de 2
  px y ningún rótulo «Notas»; casa, lupa y «+» ≥ 3:1 en claro y oscuro. Tab hasta la nota ≤ 34 (`diseno.test.js:81`, sin
  tocar el techo).
- **Tests existentes que cambian, y por qué:** `tareas.test.js:45` mira `/^\(8\)$/` en `#n-tareas`; por la maqueta A2
  (contador sin paréntesis) pasa a `/^8$/` y se añade el `aria-label` «Tareas, 8 pendientes». `indice.test.js:116-118`: el
  mismo umbral; la casa sin texto se mide por su icono. `lectura.test.js:22`, `diseno.test.js:56`, `tareas.test.js:24, 93,
  96`: sin cambio.
- **Comando:** `npm test && npm run test:navegador`.
- **Commit:** `feat: fila de accesos (Inicio, Buscar, Tareas, Comentarios, Nueva nota) y el árbol sin rótulo`.

#### T2.4 · El pie: Terminal en icono y Ajustes solo en la web
- **Qué:** `.pie-lateral` en iconos de 30 px con `title` y `aria-label`. Con `window.cuadernoApp`, `#btn-ajustes` no se
  pinta: Ajustes queda en el menú (⌘,). En la web, sigue.
- **Primero el test:** `navegacion.test.js` «pie»: en la web, Terminal y Ajustes con nombre; Terminal abre el cajón y el
  foco vuelve a él; con `cuadernoApp` de mentira, `#btn-ajustes` no visible y la acción `ajustes` abre `#ajustes`.
- **Tests existentes que cambian, y por qué:** `electron/menu.test.js:74` comprueba el `title` de `#btn-ajustes` en la app;
  por decisión de Roberto (Ajustes fuera del lateral en la app) pasa a «no visible, y ⌘, abre Ajustes». Los recorridos de
  navegador que pulsan `#btn-ajustes` corren sin `cuadernoApp`: sin cambio.
- **Comando:** `npm test && npm run test:navegador`, después `npm run test:electron`.
- **Commit:** `feat: pie del lateral en iconos; en la app de escritorio, Ajustes solo en el menú`.

#### T2.5 · La barra superior: Editar sin recuadro y el menú «…» de la nota
- **Qué:** `#miga` pasa a `<nav aria-label="Ruta de la nota">` con el último tramo `<strong aria-current="page">` (rev-13
  #4; **sigue siendo `strong`**) y sin botones; a la derecha `#btn-editar` sin recuadro (icono y texto; solo icono a ≤ 760
  px) y `#btn-mas-nota` («…», `aria-haspopup="menu"`, «Más acciones de la nota») con `#menu-nota`: «Mostrar en el
  Finder/Explorador», «Copiar la ruta», «Ocultar» («solo en la app»), separador, «Mover a la papelera» en `--mal` (no sale
  en una nota `generado`, como `app.js:307`). Cada uno llama a la función que ya existe. Teclado de menú como T2.2. Editar
  y «…» anclados a la derecha (rev-13 #3); la miga encoge con «…».
- **Primero el test:** `navegacion.test.js` «barra superior»: x de Editar igual (±1 px) en portada, `capital.md`,
  `interes.md` y la nota de nombre largo; la miga larga con «…» sin empujar Editar ni «…»; el menú con los cuatro
  elementos en ese orden, la papelera la última en `--mal`; Esc devuelve el foco a «…»; Ocultar saca la nota del árbol;
  sin papelera en `inicio.md`; `#miga` es `NAV` con `aria-current`; con el lateral plegado, `#btn-desplegar` y la miga en el
  mismo eje (±1 px: rev-13 #11).
- **Tests existentes que cambian, y por qué:** `ficheros.test.js:110, 150, 158, 166-169` pulsan `#miga
  button.mostrar|copiar|papelera`; por decisión de Roberto esas acciones se mudan a «…»: abren `#btn-mas-nota` y pulsan el
  elemento. **Lo que comprueban no cambia** (lo lanzado, el portapapeles, el fichero en la papelera, sin papelera en
  `inicio.md`). `ficheros.test.js:137-147` y `diseno.test.js:179` (papelera de la fila del árbol): sin cambio.
- **Cuaderno de ejemplo:** `navegacion/una-nota-con-un-nombre-muy-largo-para-la-barra-superior.md` y su fila.
- **Comando:** `npm test && npm run test:navegador`.
- **Commit:** `feat: barra superior con Editar fijo a la derecha y el menú «…» de la nota (Finder, ruta, ocultar, papelera)`.

#### T2.6 · ‹ › Atrás y Adelante, con un solo criterio de historial
- **Qué:** P17 entero. `location.replace` en las redirecciones (`enrutar` `app.js:1083`, `abrirCarpeta` `app.js:917`,
  `alCambiarDisco`, `mandarAPapelera` `app.js:234`); `state.cuaderno` en cada entrada; `irHistorial(dir)` y `puedeIr(dir)`;
  `.flechas` antes de la miga con `#btn-atras`/`#btn-adelante` («Atrás (⌘[)» / «Adelante (⌘])», Ctrl fuera de Mac), solo si
  `enApp()`, `disabled` según `puedeIr`, recalculado en `currententrychange`; ocultas a ≤ 760 px. `electron/menu.js`:
  Atrás/Adelante pasan a `accion: 'atras'|'adelante'` (`ATAJOS`-como), y `ACCIONES_APP` los atiende con `irHistorial`. Con
  el editor sucio, el `hashchange` de siempre pregunta «¿Descartar lo escrito?».
- **Primero el test:** `navegacion.test.js` «‹ ›», **en una página nueva** (`navegador.newPage()` con `cuadernoApp` de
  mentira) para no heredar entradas de otros recorridos: al cargar la portada, las dos apagadas (la redirección de `/` no
  deja entrada); dos notas → ‹ vuelve a la primera y › a la segunda; ‹ en la primera nota abierta no sale de la app; tras
  cambiar de cuaderno con el selector, ‹ apagada (las entradas del cuaderno viejo no cuentan); editor sucio → ‹ abre
  `#descartar` y «Seguir editando» se queda; en la web no hay flechas, y el Atrás del navegador sigue funcionando (a `/`
  no rebota). `tests/electron-menu.test.js`: Atrás/Adelante mandan `atras`/`adelante`; `tests/electron/menu.test.js`: en
  la primera nota, el elemento Atrás del menú deja la URL en la app (no `arrancando.html`).
- **Tests existentes que cambian, y por qué:** `tests/electron-app.test.js:34` y sus casos de Atrás/Adelante prueban que el
  principal llama a `navigationHistory.goBack` si `canGoBack`; por P17 (un solo criterio, el de la pantalla, que no puede
  ver `arrancando.html` ni otro cuaderno) pasan a probar que el principal manda la acción a la pantalla.
- **Comando:** `npm test && npm run test:cobertura && npm run test:navegador`, después `npm run test:electron`.
- **Commit:** `feat: Atrás y Adelante en la app de escritorio, dentro del cuaderno abierto y sin rebotar a la portada`.

#### T2.7 · Botones laterales del ratón y gesto del trackpad (app)
- **Qué se sabe** (`docs/diseno/referentes-2026-10-13.md` §3): Electron no navega solo con los botones 4/5; en Windows emite
  `app-command`; en macOS el `deslizar` de `BrowserWindow` llega solo si Trackpad › Más gestos › «Deslizar entre páginas»
  está en «con dos o tres dedos»; con la opción por defecto, el gesto llega como rueda horizontal, sin evento propio.
- **Qué se hace:** P18. `app.js`: `mouseup` con `button` 3/4 → `irHistorial` y `preventDefault`, solo con `enApp()`.
  `electron/ventana.js`: `deslizar` `left`/`right` → `webContents.send('accion', 'atras'|'adelante')`.
- **Primero el test:** `navegacion.test.js` «ratón»: con `cuadernoApp` de mentira, dos notas y CDP
  `Input.dispatchMouseEvent` `mouseReleased` con `button: 'back'` → vuelve **una** entrada; `forward` → avanza; en la web,
  el manejador no actúa. `tests/electron-ventana.test.js`: `deslizar` `left` manda `atras`, `right` `adelante`, `up`/`down`
  nada.
- **Lo que no se prueba aquí (se dice, no se rellena):** el ratón real en el Mac de Roberto y en el Windows de su padre, y
  el gesto con la preferencia de tres dedos: paso manual en T2.8 (§10). Si en Windows los botones no navegan, se añade
  `app-command` en `ventana.js` (tarea propia, con su test). **El gesto de dos dedos con la preferencia por defecto no
  entra:** distinguirlo del desplazamiento horizontal de una tabla o un bloque de código exige una heurística sobre la
  rueda y dispararía sin querer; al Inbox del plan vivo con este motivo.
- **Comando:** `npm test && npm run test:cobertura && npm run test:navegador`, después `npm run test:electron`.
- **Commit:** `feat: botones laterales del ratón y deslizar en el trackpad para Atrás y Adelante en la app`.

#### T2.8 · Cierre de PR 2
- **Qué:** `pruebas/capturas-navegacion.js --pr 2` (claro, oscuro, «…», selector, estado largo con el cajón de 260 px,
  letra al 200 %, 760 y 390 px, tooltip de la lupa), comparadas con `a2-*.png`. Crítica (`design-critique`) en
  `docs/diseno/critica-2026-10-xx-navegacion.md`, aplicada o razonada. Prueba en el Mac con Roberto: ratón, gesto con la
  preferencia de tres dedos, ⌘[ en la primera nota; resultado en §10. Plan vivo §0 y §6, README; Inbox: gesto de dos dedos,
  asa del lateral (si D4), rev-13 #1, #6, #9, #12 y recorrido #6b. Filas 31-34 del ejemplo (estado y casos largos;
  selector; barra superior y «…»; ‹ › y ratón). Tras mergear: `npm run instalar` en el checkout principal del Mac y la
  versión que quedó (AGENTS.md).
- **Test:** los tres juegos en verde; CI en los tres sistemas.
- **Commit:** `docs: la reorganización A2 en el plan vivo, el README y su crítica de diseño`. PR `feat: reorganización A2
  de la barra lateral y la barra superior`.

## 6. Tests existentes afectados (resumen)

| Test | Qué toca | Tarea | Cambio |
|---|---|---|---|
| `navegador/lectura.test.js:27-38, 60-71` | buscador en el lateral, tramos, `.paginas` oculta | T1.3 | dónde se busca; tramos → «una fila por nota» (maqueta) |
| `navegador/casos.test.js:93-95, 108-112` | buscador; «+» | T1.3 | en la modal; `tareas.md` igual |
| `navegador/ficheros.test.js:84-87` | buscador | T1.3 | en la modal |
| `navegador/lateral.test.js:53-55` | Ctrl K despliega el lateral | T1.3 | la modal no lo despliega |
| `navegador/uso.test.js:91-96` | «Nada con…» | T1.3 | en la modal; Enter sigue sin crear |
| `navegador/edicion.test.js:89-92` | «e» en el buscador | T1.3 | se abre la modal antes |
| `navegador/tareas.test.js:32-55` (pistas 34, 36, 53) | «+» en el buscador | T1.3 | en la modal; regex del fichero y textos de pista intactos |
| `electron/menu.test.js:71, 134-153` | pista ⌘F, `buscar`, `abrir-nota`, `nueva-tarea` | T1.3 | mismo valor, en `#btn-buscar` y el campo de la modal |
| `navegador/diseno.test.js:39-40` | texto de `#estado-git` | T2.1 | la frase al `title` (decisión de Roberto) |
| `navegador/indice.test.js:119` | `.marca small` | T2.1 | selector `#estado-git`, mismo umbral |
| `navegador/tareas.test.js:45` | `(8)` | T2.3 | `8` (maqueta A2) + `aria-label` |
| `electron/menu.test.js:74` | `title` de Ajustes en la app | T2.4 | Ajustes fuera del lateral en la app |
| `navegador/ficheros.test.js:110, 150, 158, 166-169` | botones de la miga | T2.5 | al menú «…»; mismas comprobaciones |
| `electron-app.test.js:34` y sus casos de historial | Atrás/Adelante en el principal | T2.6 | la acción va a la pantalla (P17) |
| `navegador/diseno.test.js:67-81` | techo de Tab (34) | T2.3, T2.5 | **no se toca**; en la web baja 2 |

Sin cambio (comprobado): `casos.test.js:49-60`, `diseno.test.js:118-147` y `:179`, `ficheros.test.js:137-147`,
`electron/ventana.test.js:134`, `electron/menu.test.js:128-187` (`#link-inicio`), `panel.test.js`, `uso.test.js:80-90`
(Nueva nota; T1.3 quita la llamada a `buscar('')` que la rompería), y todo lo que espera con `#miga strong`.

## 7. Qué resuelve de las auditorías del 2026-10-13 y qué no

- **Resuelve.** rev-13 #2 (T1.3; el campo desaparece en T2.3), #3, #4, #11 (T2.5), #5, #10 (T2.3), #7 (T2.2), #8 (T2.1).
  Recorrido #5 (T2.6 en la app; en la web, el del navegador, que además deja de rebotar a la portada), #6a (T2.2), #10
  (T2.1), #11 (T1.3). Revisión 09 #11 (T1.3).
- **En parte.** Recorrido #6 (el selector evita escribir la ruta; volver a la última nota, #6b, no entra) y #3 (el texto
  corto no explica Aplicar/Guardar/sin subir). Referentes §5: texto en Tareas y Comentarios, casa y lupa solo icono con
  `title`.
- **No resuelve (al Inbox en T2.8).** rev-13 #1, #6, #9, #12; recorrido #7 (Traer y Deshacer siguen en icono, decisión de
  Roberto), #8, #9, #12.

## 8. Foco de revisión

1. **El historial de la app** (‹ ›, ⌘[, ratón, gesto): redirecciones que empujan entradas, `arrancando.html`, cuaderno
   anterior. P17, tests de T2.6.
2. **Apuntar una tarea sin querer**: Enter sin resultados, consulta recordada tras apuntar. P5, P7, tests 4 y 5 de T1.5.
3. **Doble apertura y foco devuelto** (página + acelerador; cajón a ≤ 760 px). P6, tests 5 y 8 de T1.3.
4. **Ctrl K en la terminal y sin cuaderno.** P10, tests 6 y 7 de T1.3.
5. **El tope de la búsqueda con notas largas y ocultas.** P1, tests de T1.1.

## 9. Lo que decide Roberto

**Decidido (2026-10-13).** D1 (Roberto): «en web no se abre, todo lo que hagamos a partir de ahora es en modo app
nativa/Electron». La web queda como banco de pruebas (los recorridos de Playwright corren contra ella, mismo código),
sin diseño propio: ⌘F, ⌘O y ⌘K (Ctrl en Windows) abren la modal en los dos sitios, un solo camino de código.
D2 antes de la ruta; D3 sin pista en la portada; D4 sin asa, suelo de 260; D5 modal primero, A2 después, ambos tras
#27; D6 la pista dice ⌘F; D7 los documentos están en `main` (no en la rama de #27). Pendiente de llevar a la tabla de
decisiones del plan vivo (fila «Plataforma») en el PR 1. Condición de Roberto: «cuidado con perder tiempo en eso; si
es necesario, hay que pasar los tests de Playwright a Electron». Regla: en cuanto la web obligue a trabajo propio (un
caso solo-web, un test que no se puede escribir contra ella), se para y se propone migrar los recorridos a Electron
(Playwright lo soporta con `_electron`), en vez de mantener la web.
Criterio de Roberto: «lo que sea más fiel y barato para nosotros, en ejecución, mantenimiento y desarrollo». Reparto:
la pantalla (mismo código) se prueba en la web; lo que solo existe en la app (menú y atajos, ‹ ›, selector de
cuaderno, sin Ajustes, recargar) se prueba en Electron con `_electron`, sobre la base de `tests/electron-app.test.js`.
Un test va a Electron solo si lo que comprueba no existe en la web.

- **D1 · Ctrl F y Ctrl O en la web.** Si la modal se los queda, en el navegador se pierde «Buscar en la página» en una nota
  larga. **Recomendación: en la web, solo Ctrl K** (el plan de Electron decidió que la web no gana atajos). El plan hace lo
  pedido; si dice que no, en T1.3 se quita una condición y su aserción.
- **D2 · Ubicación de ‹ ›** («pendiente de su sí»): antes de la ruta, como A2. Si no, cambia solo T2.6.
- **D3 · La pista en la portada.** La portada es `inicio.md` y la app no escribe en ella (principio 1); la barra superior
  es de la nota («A, no B»). Opciones: (a) solo el `title` de la lupa y la pista del disparador (ya decidido); (b) una
  línea en el lateral, bajo la fila de accesos, «Buscar: ⌘K», solo en la portada y hasta la primera búsqueda de la sesión.
  **Recomendación: (a)**, porque (b) añade una pieza que hay que quitar y probar para un aviso que la lupa ya da. Si elige
  (b), es una tarea propia en PR 2 con su test y su parada de Tab contada.
- **D4 · ¿Barra lateral que se pueda estrechar** (asa)? Hoy no; el plan solo hace real el suelo de 260 (P12). Si la quiere,
  al Inbox.
- **D5 · Orden de los PR** (§1.3, 1).
- **D6 · La pista en la app: ⌘F (la del menú, como hoy) o ⌘K (la de la maqueta).** Recomendación: ⌘F, por la convención de
  la crítica del 2026-10-10. Una línea.
- **D7 · Los documentos sin seguimiento** (este plan, `referentes-2026-10-13.md`, `maqueta-a2.js` y las `a2-*.png`, más el
  cambio en `navegacion-2026-10-13-roberto.md`) están en el checkout de la rama de #27, donde el autosave hace commits:
  pueden colarse en #27. Recomendación: llevarlos a una rama `docs/navegacion` con su PR antes de seguir.

## 10. Prueba en el Mac (la rellena T2.8)

Sin hacer.

## 11. Abogado del diablo (2026-10-13)

Ronda completa (agente `devils-advocate`) sobre la primera versión de este plan: **10 objeciones (3 altas, 6 medias, 1
baja); 9 aplicadas y 1 aplicada en parte.**

1. **Alta · ‹ › no estarían apagadas al cargar y llevarían al cuaderno anterior** (las redirecciones empujan entradas,
   `app.js:1083, 918, 1100`; `clear()` corría antes de la redirección; los tests heredan entradas). **Aplicada:** P17
   (`location.replace`, cuaderno en cada entrada, un solo criterio en la pantalla, el menú manda la acción), test en página
   nueva y tras cambiar de cuaderno (T2.6).
2. **Alta · «Apuntar tarea» podía escribir sin querer** (fila elegida sola con 0 resultados; la función de hoy exige «+»;
   la consulta recordada repetía la tarea). **Aplicada:** P5, P7, P9 y tests 4 y 5 de T1.5.
3. **Alta · «letra al 200 %» no se probaba y «lateral al mínimo» no existía** (el zoom da los mismos px; `min-width` no
   encoge la columna; `LATERAL = 280` en JS). **Aplicada:** P12 (260 real en el cajón), P13 (texto en `em` y cuerpo al
   200 %), montajes de T2.1.
4. **Media · Guardar con borde de acento a 0 contradice «sin destacar»; la maqueta mal leída.** **Aplicada:** §1.3, 4 y
   P15 (a 0, `secundario` neutro).
5. **Media · Lista incompleta** (`crearNota` → `buscar('')`, la pista ⌘F de la app, pistas de tareas, `#miga strong`, sin
   cuaderno). **Aplicada:** T1.3, P10, P11, D6, ids conservados de PR 2, §6.
6. **Media · El tope de 60 es peor de lo dicho** (ocultas filtradas tras el tope, una nota larga gasta el tope, coincidencia
   por carpeta). **Aplicada:** P1 (`?por-nota=1`, cambio de API justificado) y T1.1; caso de carpeta en P8.
7. **Media · La pista de la portada se implementaba sin decisión y en la barra de la nota.** **Aplicada:** D3 con
   recomendación; nada se implementa hasta su elección.
8. **Media · T1.2 no era la unidad más pequeña; la crítica llegaba tarde.** **En parte:** la modal se parte en T1.1 (API),
   T1.2 (piezas puras), T1.3 (modal, resultados, teclado), T1.4 (disco) y T1.5 (tarea). No se parte más: separar
   resultados y teclado de la modal deja la suite en rojo entre commits (los recorridos migrados usan las flechas). La
   crítica: se declara explícitamente la tanda = el PR, sobre la rama, antes del último commit y del PR (§5, precedente
   T8 de Electron).
9. **Media · #27 y los documentos sin seguimiento.** **Aplicada:** T1.0 y D7. (El abogado no pudo leer #27; este plan sí lo
   leyó en `origin/arreglo/recarga-en-vivo-reconecta`.)
10. **Baja · Foco pisado en la segunda apertura, Escape del cajón a ≤ 760 px, `cambioPropio` booleano.** **Aplicada:** P6,
    T1.3 (Escape del cajón y test 8), T2.2 (marca con la ruta y caducidad, y test del aviso legítimo).

## 12. Seguimiento del PR 1 (2026-10-13)

T1.0 a T1.6 hechas en la rama `navegacion/modal-busqueda`. Diferencias con lo escrito arriba, y por qué:

- **Nota del ejemplo:** `render/fragmentos-de-busqueda.md`, no `busqueda/fragmentos.md`, y sin casilla. Una carpeta nueva subía la parada de Tab a 35 (la medida real era 34, el techo; el plan decía 33) y una casilla movía las cifras del panel Tareas; la casilla con alias se prueba en `tests/busqueda.test.js`. Los contadores de notas de `cuaderno.test.js` y `servidor.test.js` pasan de 21 a 22.
- **Selectores:** el aviso «Nada con…» y las pistas del «+» están en `#busqueda-nada` (no dentro de `#busqueda-lista`, para que el listbox solo lleve opciones); la fila «Apuntar tarea» sí es una opción del listbox.
- **Apertura en la línea:** `?l=` solo en las filas de coincidencia por texto (no en las que coinciden por nombre o título).
- **Título gana a la línea:** si coincide por título y no por nombre, el fragmento es el título aunque haya una línea (p. ej. el frontmatter).
- Con la crítica de diseño: ver `docs/diseno/critica-2026-10-13-modal.md`.
