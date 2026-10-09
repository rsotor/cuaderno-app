# Edición y comentarios · plan del bloque

**Nació el 2026-10-09** · Camino: arquitectónico · Rama: `edicion-comentarios` (desde `main`, tras la PR #18) · Estado del repo: `plan-vivo.md` §0 (este fichero lleva solo el estado de este bloque, §0).

## 0. Estado del bloque

**Ahora**
- **Bloque hecho en la rama (9 tareas, commits del `0cba29c` al de la tarea 9); pendiente: prueba a mano de Roberto con VoiceOver (`docs/diseno/accesibilidad-2026-10-09-edicion-comentarios.md`) y PR.**
  Historia de lo hecho, tarea a tarea:
  - Plan aprobado por Roberto (2026-10-09). **Tarea 1 hecha** (rama `edicion-comentarios`): `escribirNota`, `POST /api/nota/escribir`, `POST /api/render`, tests de Node. **Tarea 2 hecha** (rama `edicion-comentarios`): CodeMirror con import map, `live.js` en modo plano, Editar/Aplicar, test del import map, Dependabot. **Tarea 3 hecha** (rama `edicion-comentarios`): live preview inline (marcadores, títulos, énfasis, enlaces, etiquetas, casillas). **Tarea 4 hecha** (rama `edicion-comentarios`): widgets de fórmula, callout, tabla y código; propiedades como widget de solo lectura; clic bajo widget corregido; crítica de diseño `docs/diseno/critica-2026-10-09-editor.md` (8 objeciones: 5 aplicadas, 1 en parte, 2 razonadas). **Tarea 5 hecha** (rama `edicion-comentarios`): estado sin aplicar, diálogo de descartar, `beforeunload`, franja de conflicto (disco y 409) con Sobrescribir / Copiar y recargar. **Tarea 6 hecha** (rama `edicion-comentarios`): barra de formato (`role=toolbar`, flechas, `aria-pressed`), comandos rodear/quitar, Ctrl/⌘ B e I, deshacer con widgets comprobado. **Tarea 8 hecha** (rama `edicion-comentarios`): comentar por selección con cita decidida sobre el DOM, subrayado, hilo, cierre con deshacer, panel con cita; fuera el icono por bloque y `#editor`; ejemplo `comentarios/nota-comentada.md`; crítica `docs/diseno/critica-2026-10-09-comentar.md` (8 objeciones: 4 aplicadas, 2 en parte, 2 razonadas). **Tarea 7 hecha** (rama `edicion-comentarios`, en paralelo con la 5 en un worktree): `comentar` con cita normalizada, `cerrarComentario`, `comentarios()` con cita, `/api/comentario` con `cita` y `/api/comentario/cerrar`. Decisión (Roberto, 2026-10-09): cerrar quita el callout y la línea en blanco anterior, nunca la posterior (no pega bloques; un bloque pegado al siguiente sin línea en blanco queda con una de más). Rondas: abogado del diablo sobre el diseño (2026-10-09, 5
    objeciones, las 5 asumidas, §3); crítica de diseño + auditoría de accesibilidad sobre el spike (2026-10-09, 29
    hallazgos: 2 críticos, 14 mayores, 4 medios, 9 menores; sus 8 puntos «para el plan» están repartidos en las
    tareas, §5); abogado del diablo sobre el plan escrito (2026-10-09, 5 objeciones, las 5 aplicadas: comentar no se
    rompe entre las tareas 2 y 8; ancla y cierre con dos comentarios en el mismo párrafo y fichero byte a byte; BOM y
    finales mezclados; la unicidad de la cita la decide la app sobre el DOM; la franja de conflicto compara el texto, no
    el nombre que llega por `/cambios`).

**Después:** PR `feat: editor de la nota en live preview y comentarios por selección` cuando Roberto dé el ok tras VoiceOver.

**Inbox del bloque** (fuera de v1, con uso real se decide)
- Rebasar automáticamente lo escrito sobre la nota nueva cuando los cambios no se solapan (hoy: franja + «Sobrescribir» o «Copiar mi texto y recargar»).
- Ficheros con finales de línea mezclados: conservar el de cada línea (hoy: 422 y no se edita desde la app).
- Nota siempre editable (sin modo lectura). Primero el modo explícito, que es lo que pidió Roberto.
- Comentarios que cruzan varios bloques, hilos con respuestas del profesor dentro del callout, estado «resuelto» que
  no borra.
- Que el profesor del kit recoja los comentarios: issue en profesor-kit con el formato de §4 cuando Roberto confirme
  (ya estaba en el Inbox del plan vivo).
- Navegar con clic en un wikilink desde el editor; imágenes, listas ordenadas y resaltado de sintaxis dentro de los
  bloques de código en el live preview.
- Paleta de comandos (Ctrl K) con «Editar», «Comentar» y los demás cuando haya varios comandos (Inbox del plan vivo).
- Formulario de propiedades (frontmatter) con su propia edición: tipos lista, texto, fecha; fuera del contenido.
- Salido en las tareas, quedó fuera de v1: Mayús + flechas sin selección previa solo funciona sobre un bloque enfocado
  (la app crea la selección, tarea 9); con el cursor sin selección en otro sitio es cosa de Chrome. El checkbox de una casilla
  en el editor es solo de ratón (`tabindex -1`; con teclado se edita el `[ ]` de la línea activa). Vista previa mientras se
  escribe dentro de una tabla (hoy, al entrar el cursor, la tabla se ve en crudo y lo de debajo se mueve unos píxeles).
  Resaltado de sintaxis dentro de los bloques de código del editor. Cerrar un comentario de un bloque que estaba pegado al
  siguiente sin línea en blanco deja una de más (nunca pega bloques: `cerrarComentario`). Un solo borde común para los botones
  secundarios (contraste 1,3:1 del borde; el texto sí pasa).

**Contexto:** spikes guardados en ramas locales sin push: `prototipo-editor-nota` (`cfad72f`, editor plano en un
textarea) y `prototipo-live-preview` (`873da86`, CodeMirror 6 sin bundler, live preview con widgets; `public/live.js`,
import map en `index.html`, `POST /api/render`). Capturas en `docs/capturas-prototipo/editor-nota-2026-10-09-*` y
`live-preview-2026-10-09-*`. Crítica de diseño y accesibilidad del spike: `docs/diseno/critica-2026-10-09-edicion-comentarios.md`
(ya copiada).

## 1. Objetivo

Editar una nota entera viéndola pintada mientras se escribe, y comentar un texto seleccionado como en Confluence, sin
que ninguna de las dos cosas cambie una sola línea del fichero que no haya tocado el alumno.

## 2. Enfoque

La vista de lectura sigue siendo la de siempre. Una acción explícita («Editar» en la miga, o la tecla `e`) convierte la
hoja en un editor CodeMirror 6 en *live preview*: el documento es el texto del fichero tal cual, y unas decoraciones
sobre el árbol Markdown esconden los marcadores salvo en la línea del cursor y pintan los bloques pesados con el mismo
render que la lectura. «Aplicar» escribe el fichero entero con comprobación del original. En lectura, seleccionar texto
ofrece «Comentar»: el comentario queda en la nota como el callout de hoy, con la cita del texto en su título, y la app
la subraya.

**Constraints, con las palabras de Roberto (2026-10-09):**
- «que sea una acción que debamos marcar para entrar en modo edición»
- «me da igual Obsidian si uso esta herramienta, me da igual como renderice o si lo entiende […] una cosa es que lea
  bien el documento y otra cosa funcionalidad añadida»
- «este prototipo lo guardamos pero vamos a máximos»
- «arranca el plan con esas cinco [objeciones] y […] debemos revisarlo bien con los plugins de diseño»
- Las de AGENTS.md: el cuaderno es la verdad y «editar desde la app da el mismo fichero que a mano» (§9 del plan
  vivo); Node sin build; dependencias justificadas; toda funcionalidad con recorrido de navegador y cada ruta con test
  de Node; suelo del 85 % en el servidor; cada desarrollo trae su caso al cuaderno de ejemplo; cambios visuales con
  crítica de diseño antes del commit.

## 3. Decisiones (cerradas con las rondas del 2026-10-09)

| Tema | Decisión | Por qué / de dónde sale |
|---|---|---|
| Editor | Live preview con CodeMirror 6, sin re-serializar: el documento es el fichero. Un textarea no, un WYSIWYG (Milkdown, TipTap) no | Un WYSIWYG reescribe el fichero (normaliza `*`/`-`, escapes, no conoce callouts, wikilinks ni los formatos del kit). Spike: diff solo con las líneas tocadas, montaje 30-50 ms, tecla 1-2 ms con 58 KB |
| Cambio del plan vivo | §6 «Editor: por bloques, sin WYSIWYG» pasa a «nota entera, live preview sobre el texto»; §8 saca «editor WYSIWYG» de Fuera y mete «WYSIWYG que re-serialice». La tarea 9 lo escribe | Decisión de Roberto, 2026-10-09 |
| Entrar y salir | Botón «Editar» en la miga (fija) y tecla `e` con la nota enfocada. **Sin doble clic**: es el gesto nativo para seleccionar una palabra y comentarla | Objeción 3 de la ronda |
| Scroll | Al entrar, el editor se coloca en el mismo bloque que estaba visible; al salir, igual | Roberto: «tengo que volver a subir para editar el último párrafo?» |
| Escritura | El editor carga el texto con `GET /fichero/<ruta>` (lo que ya usa `textoFichero`, `app.js:24`; el navegador quita el BOM al decodificar). Ruta nueva `POST /api/nota/escribir {ruta, texto, original}`: compara `original` con el fichero **sin BOM en los dos lados** y normalizando solo CRLF→LF; 409 si no coincide. Escribe el texto tal cual con el fin de línea del fichero, conserva el BOM si lo había y no toca el salto final (el texto manda). Fichero con finales mezclados: se rechaza con 422 «la nota tiene saltos de línea mezclados» (hoy `finDeLinea` lo pasaría entero a CRLF; conservarlos línea a línea va al Inbox) | Objeción 2 de la ronda 1 y objeción 3 de la ronda 2 |
| Lo escrito no se pierde | Estado «sin aplicar»; Esc, Cancelar y navegar con cambios piden confirmación en un diálogo propio; `beforeunload`. Con el editor abierto la recarga en vivo **no repinta**: al llegar un cambio por `/cambios`, la app vuelve a pedir el texto de la nota y lo compara con el `original`; **solo si difiere** enseña la franja fija «La nota cambió en el disco» con «Seguir editando» y «Recargar (pierdes lo escrito)» (el mensaje de `/cambios` trae un solo fichero por lote y en Windows con `\`: no sirve para filtrar). Un 409 al aplicar conserva el editor y ofrece «Sobrescribir» (vuelve a pedir la nota y escribe con ese original) o «Copiar mi texto y recargar» | Objeción 1 de la ronda 1, hallazgo 1 de la revisión, críticos D1/D2 de la crítica, objeción 5 de la ronda 2 |
| Propiedades | El frontmatter **no se edita en el contenido** (Roberto, 2026-10-09: «más tipo formulario que tiene su propia edición, no dentro del contenido»): en el editor se ve como la tabla de propiedades de lectura, el cursor la salta (`atomicRanges`) y un filtro de transacciones impide escribir en ella; el fichero viaja entero, así `Aplicar` la deja byte a byte. El formulario de propiedades va al Inbox | Decisión de Roberto, 2026-10-09 |
| Widgets | Fórmula `$$`, callout, tabla y bloques del kit se pintan como widget con el HTML de `POST /api/render {texto, ruta}` (el mismo render que la lectura; `ruta` para que imágenes y enlaces relativos resuelvan), cacheado por texto; con el cursor dentro se ve el crudo | Un solo render para lectura y editor; lo que el kit añada se pinta una vez |
| Markdown plano | Ajuste «Editor: con vista / Markdown plano». Plano = el mismo CodeMirror sin decoraciones (letra de la app, sin mono). Es la alternativa para lector de pantalla y para quien prefiera ver el Markdown | A4/A8 de la auditoría. El prototipo del textarea queda como rama guardada, no se usa |
| Import map | Versiones exactas de los 6 paquetes directos (`@codemirror/state`, `view`, `language`, `lang-markdown`, `commands` y `@lezer/markdown`, que el spike importa para GFM); un test de Node recorre los `import` de cada ESM servido y comprueba que está en el mapa, que el fichero existe y que no hay copias anidadas de `@codemirror`/`@lezer`; `.github/dependabot.yml` con los dos ámbitos agrupados | Objeción 5 |
| Comentarios: formato | Tras el bloque, como hoy: `> [!comment] Alumno (2026-10-09) · «cita»` + cuerpo. La cita: texto visible de la selección, una sola línea, espacios colapsados, sin `«»` dentro, máximo 120 caracteres. **La unicidad la decide `comentar.js` sobre el DOM** (el mismo texto donde luego se busca: alias de wikilink, MathML de KaTeX, casillas; el servidor no lo ve igual): si la cita aparece más de una vez en el bloque se amplía con las palabras siguientes hasta ser única, y si no se consigue se comenta el bloque sin cita. El servidor solo normaliza el formato. Los comentarios viejos (sin cita) siguen valiendo y se pintan como ahora | Objeción 4 de la ronda 1 y 4 de la ronda 2. Afloja el principio 1 («sin formatos propios») para los comentarios: decisión de Roberto, 2026-10-09 («una cosa es que lea bien el documento y otra funcionalidad añadida») |
| Comentarios: ancla | La app busca la cita en el texto visible del **primer bloque por encima del callout que no sea un callout `comment`** (dos comentarios del mismo párrafo quedan uno tras otro: `comentar()` inserta justo detrás del bloque, `cuaderno.js:315`). Si no está, el hilo se ve igual, con «la cita ya no está» | Objeción 4 de la ronda 1 y 2 de la ronda 2 |
| Comentar | Solo en lectura (con el editor abierto no hay selección de lectura). Selección con ratón o con teclado (Shift+flechas) → botón flotante «Comentar» (nace en `selectionchange`, 44 px en táctil) → caja con textarea, «Comentar» desactivado sin texto, Esc devuelve el foco. Tecla `c`: con selección, comenta con cita; sin ella, comenta el bloque enfocado (como hoy) | A9/A10/A11 y el menor «comentar con la caja vacía» |
| Subrayado | Amarillo rotulador y subrayado inferior en tinta (no solo color), marca en el margen, `forced-colors`. Oscuro: ocre que pase 4,5:1 con el texto y el enlace (el `#6b5a00` no pasa: enlace 3,77:1). El subrayado es un botón: foco, Enter abre el hilo | A1/A2/D12. El amarillo es solo para lo comentado; el buscador no lo usa |
| Hilo | Popover junto al subrayado: cita, autor, fecha, texto, «Cerrar». **Un comentario con subrayado no pinta su callout** (sigue en el fichero): en lectura solo se ve el subrayado y la marca del margen, y el hilo al pulsar. El callout se pinta solo cuando no hay ancla (comentario viejo sin cita, o cita que ya no está). El panel Comentarios lista cita + texto y salta al subrayado abriendo el hilo | Roberto, 2026-10-09: la card del callout debajo del hilo «ocupa mucho» |
| Cerrar | Ruta nueva `POST /api/comentario/cerrar {ruta, linea, original}` que quita el callout **y las líneas en blanco que `comentar()` añadió** (`cuaderno.js:313-314`), de modo que el fichero queda byte a byte como antes de comentar (con `/api/bloque` y texto vacío quedarían 2-3 líneas en blanco de más). «Deshacer» en el aviso vuelve a comentar. Git guarda la historia; el profesor borra igual al recoger. «Resuelto» sin borrar va al Inbox | D5 de la crítica, decidido en contra: el comentario es una pregunta del alumno, y el alumno decide cuándo sobra. Objeción 2 de la ronda 2 |
| Lo que se va | El icono de editar por bloque y `/api/bloque` como vía de edición desde la pantalla (tarea 2). El icono de comentar y el diálogo `#editor` **se quedan, solo para comentar, hasta la tarea 8**, que los sustituye por la selección y la caja: así comentar funciona y sus recorridos están en verde en todas las tareas intermedias. `/api/bloque`, `/api/comentario` y `/api/casilla` se quedan (las casillas y la tecla `c` sin cita los usan) | Objeción 1 de la ronda 2 |

## 4. Ficheros

| Fichero | Responsable de |
|---|---|
| `cuaderno.js` | `escribirNota(rel, texto, original)` (nuevo: texto tal cual, EOL, salto final, BOM, 409, 422 si mezclado); `comentar()` con cita opcional y su normalización de formato; `cerrarComentario(rel, linea, original)` (nuevo); `comentarios()` devuelve también `cita` |
| `servidor.js` | `POST /api/nota/escribir`, `POST /api/render` (nuevo: `{texto, ruta}` → HTML con el render de lectura), `POST /api/comentario` con `cita`, `POST /api/comentario/cerrar` |
| `markdown.js` | Nada nuevo salvo que el render exponga lo que `/api/render` necesita (comprobar) |
| `public/index.html` | Import map de CodeMirror; botón «Editar» en la miga; franja de conflicto; diálogo propio «¿Descartar lo escrito?»; caja de comentar; plantilla del hilo; ajuste «Editor» en Ajustes; el diálogo `#editor` se va en la tarea 8 |
| `public/live.js` (nuevo, ESM) | Todo lo de CodeMirror: montar/destruir, tema con los tokens de la app, decoraciones inline (marcadores, títulos, énfasis, código, enlaces, wikilinks, etiquetas, casillas), widgets por `/api/render` con caché, modo plano, barra de formato (comandos sobre el estado), atajos Ctrl/⌘ B, I, Enter |
| `public/app.js` | Entrar y salir del modo edición (botón, `e`, foco de vuelta, scroll al bloque visible), estado «sin aplicar», franja de conflicto, 409, `beforeunload`, recarga en vivo que no repinta con el editor abierto (pide la nota y compara); quitar el icono de editar (tarea 2) y `abrirEditor` (tarea 8); ajuste del editor |
| `public/comentar.js` (nuevo, script clásico) | Selección → botón flotante → caja → `POST /api/comentario` con cita (unicidad y ampliación decididas aquí, sobre el DOM); subrayado de las citas al pintar la nota (ancla: primer bloque de encima que no sea callout `comment`); hilo; cerrar con deshacer; tecla `c`; panel Comentarios con cita y salto |
| `public/estilo.css` | `.cm-editor` con la hoja (claro y oscuro), barra de formato, franja, botón flotante, subrayado (`--rotulador`, `--rotulador-tinta`, `forced-colors`), hilo |
| `tests/cuaderno.test.js`, `tests/servidor.test.js`, `tests/rutas.test.js` | Escribir nota (4 casos de fin de fichero + 409), render, comentar con cita (normalización, unicidad, formato viejo), rutas nuevas |
| `tests/importmap.test.js` (nuevo) | El mapa cubre todos los `import` de los ESM servidos, sin copias anidadas |
| `tests/navegador/edicion.test.js` (nuevo) | Recorridos del editor (§5) |
| `tests/navegador/comentar.test.js` (nuevo) | Recorridos de comentar (§5) |
| `tests/navegador/lectura.test.js`, `casos.test.js`, `diseno.test.js` | Adaptar los que prueban editar bloque, iconos de margen, `#editor` y `c` sin cita (lista en la tarea 2) |
| `ejemplos/cuaderno-ejemplo/comentarios/` (nueva) + `ejemplos/cuaderno-ejemplo.md` | Una nota con comentario viejo (sin cita) y uno nuevo (con cita, y otro con cita que ya no está); filas 4 y 5 de la tabla de casos reescritas y las nuevas |
| `package.json`, `package-lock.json`, `.github/dependabot.yml` | CodeMirror con versiones exactas; Dependabot agrupado |
| `docs/planes/plan-vivo.md` | §0, §6 (Editor, Anotar, Teclado), §8, dependencia justificada |

## 5. Tareas

Cada tarea: su test primero, `npm test` y `npm run test:navegador` en verde, un commit en castellano, PR al final del bloque
(o una PR por tarea si Roberto quiere revisarlas por separado; §6 del plan vivo).

### 1 · Servidor: escribir la nota entera y pintar Markdown
- `cuaderno.js`: `escribirNota(rel, texto, original)`. Lee el fichero, quita el BOM a los dos lados y normaliza solo
  CRLF→LF (nada más: ni blancos finales) para comparar `original` con el contenido actual; 409 si no coincide; 422
  si el fichero tiene finales mezclados (hay `\r\n` y `\n` sueltos); escribe `texto` convirtiendo `\n` al EOL del
  fichero; vuelve a poner el BOM si lo había; no añade ni quita el salto final (el texto manda).
- `servidor.js`: `POST /api/nota/escribir`; `POST /api/render {texto, ruta}` → `{html}` con el render de lectura
  (la `ruta` resuelve imágenes y enlaces relativos como en `/api/nota`).
- Tests de Node en `tests/cuaderno.test.js` y `tests/servidor.test.js`: fichero sin salto final que sigue sin él; con dos
  líneas en blanco al final que se conservan; CRLF que vuelve CRLF; BOM que vuelve BOM **con el `original` sin BOM,
  como lo manda el navegador**; mezclado → 422; 409 con original distinto; render de un callout, una fórmula y una
  imagen relativa igual que `/api/nota`.
- Comando: `npm test`. Commit: `feat: escribir la nota entera y pintar Markdown por la API`.

### 2 · CodeMirror sin bundler, editor plano y entrada/salida
- `npm install --save-exact` de `@codemirror/state`, `view`, `language`, `lang-markdown`, `commands` y `@lezer/markdown`
  (justificación en el plan vivo, tarea 9). Import map en `index.html` con las rutas reales (`dist/index.js`; `style-mod` `src/`,
  `@marijn/find-cluster-break` `src/index.js`, `w3c-keyname` y `crelt` `index.js`).
- `tests/importmap.test.js`: lee el import map de `index.html`, recorre los `import … from '…'` de cada fichero mapeado
  (recursivo) y comprueba que todo especificador está en el mapa, que el fichero existe y que no hay
  `node_modules/@codemirror` ni `@lezer` anidados. `.github/dependabot.yml`: npm semanal, grupos `codemirror`
  (`@codemirror/*`, `@lezer/*`) y el resto.
- `public/live.js`: `montar(contenedor, texto, { plano })` y `destruir()`, tema con los tokens de la app (letra de la hoja,
  16 px, 800 px, sin números de línea, contorno de foco visible en `.cm-editor:focus-within`), `aria-label` «Editor de
  la nota». En esta tarea solo el modo plano (sin decoraciones).
- `app.js`: botón «Editar» en la miga y tecla `e` (ignorando campos editables); al entrar, el editor se coloca en el
  bloque que estaba visible y el cursor en su primera línea; «Cancelar» y «Aplicar» (Ctrl/⌘ Enter, Esc); Aplicar escribe
  con `/api/nota/escribir`, repinta y devuelve el foco al botón «Editar»; el aviso dice «Nota escrita». Pistas con ⌘ en
  Mac (`GESTOR`). Se quita **solo el icono de editar** por bloque y su rama en `abrirEditor`; el icono de comentar, la
  tecla `c` y el diálogo `#editor` siguen como hoy hasta la tarea 8 (comentar no deja de funcionar en ninguna tarea).
  Ajuste «Editor: con vista / Markdown plano» en Ajustes (por ahora los dos hacen lo mismo).
- Recorridos en `tests/navegador/edicion.test.js`: «editar la nota: Editar abre el editor en el bloque visible, Aplicar
  escribe el fichero tal cual y vuelve a lectura» (comprueba el fichero con `diff` de líneas); «editar con el teclado: e
  entra, Esc sale, el foco vuelve a Editar». Adaptar: `lectura.test.js:44` (editar una lista → ahora desde el editor de la
  nota), `:76` (editar un bloque → editar la nota), `:91` (solo queda el icono de comentar), `diseno.test.js:27` (la
  parte de editar pasa al editor de la nota; la de comentar, `:42-48`, sigue), `:96` (E abre el editor de la nota; C
  sigue), `:117` (el diálogo de comentar sigue reteniendo el foco; el de descartar entra en la tarea 5). Fila 4 del
  índice de casos → «Editar la nota».
- Comando: `npm test && npm run test:navegador`. Commit: `feat: editor de la nota entera con CodeMirror, sin iconos por bloque`.

### 3 · Live preview: lo inline
- `live.js`: decoraciones sobre el árbol de `lang-markdown`: marcadores ocultos salvo en la línea del cursor (`#`, `**`,
  `*`, `~~`, `` ` ``, `[`/`](…)`, `[[`/`]]`, `- [ ]`); títulos con el tamaño de la hoja; negrita, cursiva, tachado,
  código; enlaces y wikilinks en azul (alias incluido); `#etiquetas`; viñetas; citas; casilla como checkbox real que
  cambia `[ ]`/`[x]` en el texto; señal de línea activa discreta. Modo plano = sin esta extensión.
- Recorridos: «live preview: los marcadores solo se ven en la línea del cursor y un título se pinta como título»;
  «live preview: marcar una casilla desde el editor cambia el texto y Aplicar deja solo esa línea cambiada»;
  «Markdown plano: con el ajuste, el editor enseña los marcadores siempre».
- Commit: `feat: live preview de títulos, énfasis, enlaces y casillas en el editor`.

### 4 · Live preview: widgets y crítica de diseño
- `live.js`: `StateField` de decoraciones de bloque sobre `$$…$$`, callouts, tablas y bloques de código; el frontmatter como
  widget de solo lectura (tabla de propiedades, `atomicRanges` y filtro de transacciones: el cursor lo salta y no se escribe en él);
  widget con el HTML de `/api/render` (caché por texto, «…» mientras llega, altura reservada para que no salte), crudo
  cuando el cursor entra, `white-space: normal` dentro. Callout plegable que se abre al clic en el widget. **Fallo visto
  en la demo del spike (2026-10-09):** con widgets de bloque encima, el clic del ratón cae unas líneas más abajo de
  donde se pulsa (clic en un párrafo, cursor en la cabecera de la tabla): el widget tiene que declarar su altura
  (`estimatedHeight` y medida tras pintar) y hay un recorrido que clica en un párrafo bajo una tabla y comprueba la
  línea del cursor. Frontmatter
  pintado como la tabla de propiedades de lectura, en el mismo sitio, sin poder entrar.
- Recorridos: «widgets: fórmula, callout y tabla se ven pintados y el cursor dentro enseña el crudo»; «propiedades: se
  ven como tabla, Ctrl+Inicio deja el cursor en la primera línea del cuerpo y escribir no las cambia»;
  medida: montar la nota larga del ejemplo y una sintética de 60 KB por debajo de 150 ms (`medida.test.js`).
- Crítica de diseño (agente con `design:design-critique`) sobre las capturas del después, claro y oscuro: objeciones
  aplicadas o razonadas en `docs/diseno/critica-<fecha>-editor.md`. Capturas en `docs/capturas/despues-editor-<fecha>-*`.
- Commit: `feat: widgets de fórmula, callout, tabla y propiedades en el editor`.

### 5 · Lo escrito no se pierde
- `app.js`: estado «sin aplicar» (el botón Aplicar se activa con cambios; la miga dice «Editando»); Esc, Cancelar,
  cambiar de nota o de pantalla con cambios abren el diálogo propio «¿Descartar lo escrito?» (Descartar / Seguir
  editando; retiene el foco, `inert` fuera); `beforeunload` con cambios. Recarga en vivo con el editor abierto: no
  repinta; vuelve a pedir el texto de la nota y, **solo si difiere del `original`**, enseña la franja «La nota cambió
  en el disco» con «Seguir editando» y «Recargar (pierdes lo escrito)»; `api()` no recarga la nota cuando hay un 409
  del editor. 409 al aplicar: el editor sigue con el texto; franja con
  «Sobrescribir» (pide la nota de nuevo y escribe con ese original) y «Copiar mi texto y recargar».
- Recorridos: «conflicto: cambiar el fichero desde fuera con el editor abierto no borra lo escrito; Sobrescribir lo
  escribe»; «otra nota cambia en el disco mientras editas: ninguna franja»; «descartar: Esc con cambios pregunta, sin
  cambios sale»; «navegar con cambios pregunta». Adaptar
  `diseno.test.js:117` (el diálogo de descartar retiene el foco).
- Commit: `feat: el editor no pierde lo escrito ante conflictos, recargas y salidas`.

### 6 · Barra de formato y atajos
- `live.js`: Negrita, Cursiva, Título, Lista, Casilla, Enlace, Código como comandos de CodeMirror (rodear o quitar,
  por línea en listas); Ctrl/⌘ B e I; la barra es `role="toolbar"` con flechas entre botones y `aria-pressed`; fija
  bajo la miga. Deshacer con widgets comprobado.
- Recorridos: «formato: Negrita rodea la selección y volver a pulsar la quita; Ctrl Z lo deshace con un widget en la nota».
- Commit: `feat: barra de formato y atajos del editor`.

### 7 · Servidor: comentarios con cita
- `cuaderno.js`: `comentar(rel, desde, hasta, texto, original, { cita })`: normaliza el formato de la cita (una
  línea, espacios colapsados, recorta a 120, quita `«»`) y escribe el título `Alumno (fecha) · «cita»`; la unicidad no
  es suya (la decide la app sobre el DOM, tarea 8). `cerrarComentario(rel, linea, original)`: quita el callout de esa
  línea y las líneas en blanco que `comentar()` añadió, comprobando el original del callout; el fichero queda como
  antes de comentar. `comentarios()` devuelve `{ruta, linea, titulo, autor, fecha, cita, texto}` para los dos formatos.
- `servidor.js`: `POST /api/comentario` acepta `cita`; `POST /api/comentario/cerrar {ruta, linea, original}`.
- Tests de Node: cita normal; cita con `«` y con saltos de línea; cita de más de 120; comentario viejo sin cita que
  sigue saliendo; comentar y cerrar dejan el fichero byte a byte como estaba (sin salto final, con salto final, con
  el bloque seguido de otro); dos comentarios del mismo bloque y cerrar el primero; `/api/comentario` con `cita` y
  `/api/comentario/cerrar` con 409.
- Commit: `feat: comentarios con la cita del texto seleccionado`.

### 8 · Comentar por selección, hilo y panel
- `comentar.js`: al pintar la nota, por cada callout `comment` con cita, busca la cita en el texto visible del primer
  bloque por encima que no sea un callout `comment` y la envuelve en `<button class="comentado">` (subrayado) **y oculta el callout** (el hilo lo sustituye); si no
  está, el callout se pinta con «la cita ya no está». `selectionchange` en lectura dentro de un bloque de texto → botón
  flotante «Comentar» junto al final de la selección (44 px en táctil); clic o `c` → caja con textarea («Comentar»
  desactivado sin texto, Esc cierra y devuelve el foco al bloque); antes de enviar decide la cita sobre el DOM: si
  aparece más de una vez en el bloque la amplía con las palabras siguientes hasta que sea única, y si no lo consigue
  manda el comentario sin cita; envía `cita` y el tramo del bloque. Clic o Enter en el subrayado → hilo (popover: cita,
  autor, fecha, texto, «Cerrar»); «Cerrar» llama a `/api/comentario/cerrar` y avisa «Comentario cerrado · Deshacer»
  (5 s, vuelve a comentar con la misma cita y texto). `c` sin selección comenta el bloque enfocado como hoy. Esta tarea
  retira el icono de comentar por bloque, el diálogo `#editor` y `abrirEditor`.
- Panel Comentarios: cita en cursiva + texto; clic salta a la nota, enfoca el subrayado y abre el hilo.
- Estilo: `--rotulador` (claro `#ffe45c`) y oscuro un ocre medido ≥ 4,5:1 con `--tinta` y `--acento`; subrayado inferior
  de 2 px en `--tinta-suave`; marca de 3 px en el margen izquierdo del bloque; `@media (forced-colors: active)` con
  `text-decoration` y borde del sistema; `:focus-visible` del botón.
- Ejemplo: carpeta `ejemplos/cuaderno-ejemplo/comentarios/` con `nota-comentada.md` (un comentario viejo, uno con cita,
  uno con cita que ya no está); filas en las dos tablas del índice; fila 5 de casos → «Comentar un texto seleccionado».
- Recorridos en `tests/navegador/comentar.test.js`: «comentar una selección: queda el callout con la cita tras el
  bloque, el texto sale subrayado y el panel lo lista con la cita»; «comentar con el teclado: Shift+flechas y c»;
  «hilo: clic en el subrayado lo abre, Cerrar deja el fichero byte a byte como antes de comentar y Deshacer lo
  devuelve»; «dos comentarios en el mismo párrafo: los dos subrayados apuntan bien»; «cita repetida en el párrafo: la
  app la amplía y el subrayado cae en la frase elegida»; «cita que es el alias de un wikilink»; «cita perdida: el hilo
  se ve con el aviso»; «comentario viejo sin cita se pinta como antes»; «comentario con subrayado: el callout no se ve en lectura y sí en el fichero». Adaptar `casos.test.js:33` (el bloque sin cita
  sigue valiendo con `c`, ahora por la caja nueva), `diseno.test.js:42-48`, `:113` y `:135` (el diálogo `#editor` ya
  no existe: la caja de comentar retiene el foco).
- Crítica de diseño sobre las capturas del después (claro, oscuro, 390 px); objeciones en `docs/diseno/critica-<fecha>-comentar.md`.
- Commit: `feat: comentar un texto seleccionado, con hilo, panel y cierre con deshacer`.

### 9 · Accesibilidad, plan vivo y cierre
- Auditoría con `design:accessibility-review` sobre la app corriendo (editor y comentar): contrastes medidos, teclado,
  foco; objeciones aplicadas o razonadas. Prueba a mano de Roberto con VoiceOver en modo plano y con vista (lo único
  que el agente no puede hacer).
- `plan-vivo.md`: §0 (Ahora/Después), §6 filas Editor, Anotar, Teclado (`e` editar la nota, `c` comentar, Ctrl/⌘ B e
  I, Esc), §8, dependencia CodeMirror justificada (sin bundler, 5 paquetes exactos, ~360 KB gzip, test del import map),
  §9 sin cambios; cobertura del servidor comprobada (`npm run test:cobertura`).
- Comando: `npm run test:cobertura && npm run test:navegador`. Commit: `docs: edición y comentarios en el plan vivo`.
  PR con título `feat: editor de la nota en live preview y comentarios por selección`, CI en verde en los tres sistemas.

## 6. Foco de revisión (lo que el bloque implica y ninguna tarea probaba; ya repartido)

1. Un fichero CRLF editado en el live preview vuelve CRLF, y uno sin salto final sigue sin él → tarea 1.
2. La nota cambia en el disco mientras el editor está abierto y el alumno sigue escribiendo → tarea 5.
3. Un `@codemirror/state` anidado por una subida de versión rompe el editor solo en el navegador → tarea 2.
4. La cita seleccionada es el alias de un wikilink o está dos veces en el párrafo → tarea 7.
5. Editar una nota de examen o de tarjetas (formatos del kit) desde el editor: el widget pinta el formato y Aplicar
   escribe el texto tal cual; el formulario sigue en su vista → se añade a la tarea 4 un recorrido con la nota de examen
   del ejemplo (abrir el editor, no tocar, Aplicar: el fichero no cambia).
