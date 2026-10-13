# cuaderno-app · recorrido cognitivo, 2026-10-13

Encargo: `recorrido-2026-10-13-encargo.md` (13 tareas, como alguien que abre la app por primera vez). Va después de la
auditoría de estructura (`revision-2026-10-13.md`, citada como **rev-13 #n**) y antes de la prueba con una persona real.
No se reabre ninguna decisión del plan vivo §0.

**Cómo se hizo.** Chromium con Playwright (uno a la vez), 1440×900 en las 13 tareas y 390×800 táctil en las tareas 1-6.
Dos copias de `ejemplos/cuaderno-ejemplo/` en `cuadernos-prueba/recorrido-2026-10-13/` (ignorada por git; `ejemplos/` y
los cuadernos reales, intactos): `sin-kit/` (tareas 1-11, con `git init` y remoto propio para partir de «guardado hace un
momento», sin cambios) y `con-kit/` (tareas 12-13). Servidor con `node server.js … -n`, token hexadecimal y carpeta de
configuración temporal. Capturas en `docs/diseno/capturas-2026-10-13/recorrido/` (sin rutas ni nombre de usuario: las
pantallas de Cuadernos y de la terminal se descartaron por enseñarlos). Cada hallazgo lleva **[observado]** (lo vi en el
navegador, con evidencia) o **[opinión]** (juicio mío).

**Límites del montaje con kit (importante).**
- El cuaderno de ejemplo **no es un curso válido para el kit real**: `comprobar.js` del profesor-kit da 7 errores y 8
  avisos sobre él (índice, progreso, frontmatter, enlace roto…) y `guardar.js` real se niega a guardar. Para la tarea 12
  copié `.kit/` del profesor-kit (herramientas reales) y las piezas de plantilla, y **sustituí `guardar.js` por un
  sustituto** (git add/commit/push, mismo texto de éxito). `deshacer.js` y `examen.js` son los reales. Lo que sale del
  `guardar.js` real con errores solo se vio con un montaje incompleto (captura `t12-fallo.png`).
- TODO: el camino «Corregir» del examen con un examen revisado y el `guardar.js` real con un curso válido no se
  comprobaron (no hay curso válido a mano; el CI lo salta, `tests/guardar.test.js:138`).

## Resumen

| Tarea | Pasos (1440 px) | ¿Sin ayuda? | Peor atasco |
|---|---|---|---|
| 1 Llegar a un documento en una carpeta | 2 clics (carpeta, nota) | sí | ninguno; la carpeta queda abierta y la nota marcada |
| 2 Pasar a otro documento de otra carpeta | 2 clics | sí | ninguno |
| 3 Volver, saber dónde estás, volver a la portada | atrás: botón del navegador (la app no tiene); portada: 1 clic en «Inicio» | con dudas | no hay «atrás» propio; el título del cuaderno no lleva a la portada sino a «Todos los cuadernos» (#7) |
| 4 Buscar una nota | ⌘K o clic, escribir, Enter o clic: 2-3 | sí | resultados con markdown crudo y la nota repetida (#11) |
| 5 Seguir un enlace y volver | 1 clic; volver con atrás del navegador | con dudas | enlace a nota que no existe: te manda a la portada sin decir nada (#1) |
| 6 Cambiar de cuaderno y volver | título → escribir la ruta → Abrir (3); volver: título → clic en el reciente (2) | con dudas | solo se abre otro cuaderno escribiendo su ruta; al volver cae en la portada, no en la nota (#6) |
| 7 Abrir y cerrar la terminal | abrir 1 clic; cerrar 1 (mismo botón) o 2 | sí | dos «×» distintos; el de la pestaña deja un panel vacío (#8) |
| 8 Crear una nota | 3 (Nueva nota, título, Enter) | sí | la nota nace vacía y en lectura: nada dice «pulsa Editar» (#2) |
| 9 Editar una nota | Editar, escribir, Aplicar: 2 clics | con dudas | el cursor entra al principio: en una nota nueva, lo primero que escribes se pega delante del título (#2) |
| 10 Comentar un trozo | seleccionar, Comentar, escribir, Comentar: 3 | con dudas | nada invita a comentar hasta que seleccionas; la cita sale con un carácter de más (#9) |
| 11 Apuntar una tarea y verla | panel Tareas → escribir → Añadir: 3; o `+` en el buscador: 2 | sí | ninguno |
| 12 Guardar (con kit) | Guardar, Guardar en el diálogo: 2 | con dudas | con el `guardar.js` real no se pudo comprobar (ver límites); con nada que guardar abre el diálogo igual (rev-13 #8) |
| 13 Examen o tarjetas | tarjetas: 3 (abrir, Destapar, 1 o 2); examen: abrir, marcar, botón | tarjetas sí; examen **no** | el examen no revisado deja contestar y avisa al final «pídele que lo revise antes de hacerlo» (#4) |

A 390 px las tareas 1-6 se consiguen igual con un toque más cada una (abrir el menú). El cajón sin salida visible es
rev-13 #1 y no se repite.

## Qué funciona (observado, para no tocarlo)

- Abrir una nota: el árbol deja la carpeta abierta y la fila marcada; recargar con una dirección profunda abre la
  carpeta de la nota; tras buscar y limpiar con Esc el árbol vuelve a enseñar dónde estás.
- Atrás/adelante del navegador recorren las notas y los paneles en orden (comprobado por la dirección y el título de la nota).
- Buscador: ⌘K enfoca, Enter abre el primer resultado, la × y Esc limpian; el texto sin resultados explica qué hacer.
- Apuntar tarea: dos caminos, confirmación «Tarea añadida», y el contador de Tareas sube.
- Comentar: botón flotante junto a la selección, ⌘/Ctrl+Enter envía, aviso «Comentario añadido a la nota», subrayado
  que abre el comentario y entrada en el panel Comentarios.
- Deshacer: enseña antes qué vuelve a como estaba («Esto deshace: Cambios en tareas») y luego lo hace.
- Tarjetas: Destapar, 1 / 2 y siguiente automática; se ve lo que queda en el fichero.
- Nueva nota: el título vacío en «Nueva nota» no es silencioso (validación nativa del navegador).

## Hallazgos, de más a menos grave

### 1 · Un enlace a una nota que no existe te lleva a la portada sin decir nada · Alta · S
- **Tareas.** 5 (y cualquier lectura con `[[nota-que-no-existe]]`).
- **Qué pasa [observado].** En `conceptos/interes.md`, «no-existe» sale en rojo y con borde discontinuo (`.wiki.roto`,
  `estilo.css:175`). Al pulsarlo el hash pasa a `#/n/inicio.md`: portada, sin aviso, sin salir de la nota con un mensaje.
  El enlace es `<a href="#">` (`markdown.js:65`); el único texto es un `title` que solo se ve con el ratón quieto.
  Captura: `t5-roto.png`.
- **Por qué confunde.** Parece que la app «se ha roto» o que el enlace no hacía nada útil; vuelves a la portada sin
  haber elegido ir allí, y el rojo no explica por qué (opinión: un rojo + discontinuo no lo dice por sí solo).
- **Arreglo mínimo.** Que el clic no navegue: aviso «La nota «no-existe» no existe todavía» (con «Crearla», que ya
  existe como Nueva nota). Sitio: `markdown.js:65` (quitar `href="#"`, poner `data-roto`) y un manejador de clic en
  `public/app.js` junto al de `.wiki`.

### 2 · La nota nueva nace vacía y el editor entra con el cursor al principio · Alta · S
- **Tareas.** 8, 9.
- **Qué pasa [observado].** «Nueva nota» crea `# Título` y abre la nota **en lectura**, con solo el título (captura
  `t8-creada.png`; foco en el botón «Nueva nota»). Si pulsas «Editar» y escribes, el cursor está en la posición 0
  (selección en el texto `# `, `public/live.js:364-366`, `app.js:538`): lo escrito entra **delante** de `# Mi primera
  nota`. Resultado en el fichero tras Aplicar: la frase y el `# Mi primera nota` pegado al final de la última línea
  (capturas `t9-editor.png`, `t9-escrito.png`). En una nota con contenido el cursor también entra al principio.
- **Por qué confunde.** Quien crea una nota quiere escribir; el primer gesto lo deja con el título convertido en
  texto suelto y sin pista de qué ha pasado (el editor muestra el título como texto plano sin `#`).
- **Arreglo mínimo.** Para una nota recién creada: abrirla ya en edición con el cursor en una línea nueva tras el
  título (`app.js:97-103`, `crearNota`, y la posición en `live.js:364`). Para el resto, decidir entre principio y
  final: la opinión es «donde estaba la vista o el último clic»; el mínimo, final del documento.

### 3 · «Guardar» significa tres cosas distintas · Media · M
- **Tareas.** 9, 12, 13.
- **Qué pasa [observado].** «Aplicar» escribe la nota en el fichero (toast «Nota escrita»); «Guardar respuestas» (examen)
  escribe las marcas en la nota; «Guardar» (botón grande del lateral) hace el commit y sube. Además la cabecera dice
  «guardado hace un momento, 1 cambio por guardar» justo después de Aplicar, y «1 sin subir» después de guardar con kit.
- **Por qué confunde [opinión].** Quien acaba de pulsar Aplicar cree que ya está guardado; el lateral dice que no. Los
  textos «por guardar» y «sin subir» no explican qué falta (¿local?, ¿remoto?).
- **Arreglo mínimo.** Un solo verbo por nivel: «Aplicar» → «Listo» (la nota ya está escrita) o mantener Aplicar pero
  que el toast diga «Nota escrita. Falta Guardar para subirla»; y la cabecera con «N cambios sin guardar» /
  «N guardados sin subir». Sitios: `app.js` (toast tras aplicar; `pintarEstado`). Decisión de redacción, no de código.

### 4 · El examen se puede contestar entero y solo al final dice que no estaba listo · Media · S
- **Tareas.** 13.
- **Qué pasa [observado].** Con kit, `examenes/01-examen.md` (sin revisión del profesor) enseña el formulario, deja
  marcar y el botón es «Guardar respuestas». La razón («Este examen aún no está revisado por el profesor: pídele que lo
  revise antes de hacerlo») está **debajo del botón**, en gris pequeño (captura `t13-examen.png`). Al pulsar, el diálogo
  dice «Respuestas guardadas en la nota. Este examen aún no está revisado… antes de hacerlo»: se acaba de hacer. No hay
  nota ni corrección. «Se aprueba con 6» aparece dos veces seguidas.
- **Por qué confunde.** Quien viene a «hacer un examen» no encuentra que no se puede hasta haberlo hecho.
- **Arreglo mínimo.** Si no hay revisión, el aviso arriba del formulario (antes de la pregunta 1) y el botón
  «Guardar respuestas» como secundario. Sitio: render del examen en `public/app.js` (buscar «Guardar respuestas»).
  TODO: confirmar el estado «Corregir» con un examen revisado y `examen.js` real.

### 5 · No hay «volver» propio ni forma de saber qué te llevó allí · Media · M
- **Tareas.** 2, 3, 5 (sobre todo en navegador).
- **Qué pasa [observado].** Tras seguir un enlace o abrir un panel (Comentarios, Tareas), la única vuelta es el botón
  Atrás del navegador (funciona, y recupera la nota). En la app de escritorio existe ⌘[ (`electron/menu.js:47`) pero
  nada en pantalla lo dice. El título del cuaderno (arriba a la izquierda) lleva a «Todos los cuadernos» y no a la
  portada (rev-13 #7); a la portada se llega con «Inicio». En móvil, «Inicio» y el nombre del cuaderno solo salen con
  el menú abierto (2 toques).
- **Por qué confunde [opinión].** Quien llega por un enlace no sabe que tiene un atrás; quien pulsa el nombre esperando
  la portada acaba en otra pantalla.
- **Arreglo mínimo.** Pista de «Atrás» solo si hay historial (botón `‹` en la barra superior) o, como mínimo, listar
  los atajos en Ajustes. Sitio: barra superior, `public/index.html:80`.

### 6 · Cambiar de cuaderno exige escribir una ruta y no te devuelve a donde estabas · Media · M
- **Tareas.** 6.
- **Qué pasa [observado].** La pantalla de Cuadernos tiene un campo «Ruta de la carpeta» y los recientes; en el
  navegador no hay selector de carpeta. Al abrir otro cuaderno aterrizas en su portada y sale el aviso «Este servidor
  ha abierto otro cuaderno: con-kit. Esta pestaña pasa a él.» (`app.js:1100`), que también aparece cuando eres tú quien
  lo ha pedido. Al volver al primero también cae en la portada, no en la nota que leías (`t6-vuelta.png`). Mientras
  estás en Cuadernos, el lateral sigue enseñando el árbol del cuaderno anterior y la miga dice «Cuadernos» dos veces
  (miga y título).
- **Por qué confunde.** Hay que saber la ruta de memoria; el aviso suena a que otra persona lo hizo; el contexto no
  vuelve.
- **Arreglo mínimo.** (a) Aviso solo si el cambio lo ha provocado otra pestaña. (b) Recordar la última nota por
  cuaderno. (c) En Electron ya hay «Abrir carpeta» en el menú; en el navegador, texto de ayuda con ejemplo de ruta (ya
  tiene placeholder `~/cur…`).

### 7 · «Aplicar», «Guardar», «Traer» y «Deshacer»: solo iconos en Traer y Deshacer · Baja · S
- **Tareas.** 12.
- **Qué pasa [observado].** `Traer` (flecha abajo) y `Deshacer` (flecha curva) no llevan texto; solo `title`. En un
  móvil o con táctil no hay `title`. El resultado de Traer dice «Ya tenías todo lo que hay en GitHub» (texto del kit,
  también para un remoto que no es GitHub).
- **Arreglo mínimo.** Texto corto junto al icono si cabe, o `aria-label` + etiqueta visible a ≥ 1100 px. Sitio:
  `public/index.html` (botones del lateral).

### 8 · Terminal: dos «×», Esc no cierra, el atajo solo está en el tooltip · Baja · S
- **Tareas.** 7.
- **Qué pasa [observado].** Con la terminal abierta hay un «×» en la pestaña «Terminal» y otro arriba a la derecha. El
  de la pestaña cierra la sesión pero deja el panel abierto con «Sin terminales abiertas: + abre una»
  (`t7-sin-sesiones.png`); el otro cierra el panel. Esc va al shell (no cierra). ⌘/Ctrl+` abre y cierra, pero solo se
  dice en el `title` del botón. El botón «Terminal» vuelve a cerrarlo (alterna) sin estado visible de «abierto» más que
  un borde.
- **Arreglo mínimo.** Que cerrar la última pestaña cierre el panel, o que el texto vacío diga «cierra con la ×».
  Sitio: `public/index.html:87` y la lógica de sesiones en `app.js` (~840).

### 9 · Comentar: no se descubre y la cita puede salir con un carácter extra · Baja · S
- **Tareas.** 10.
- **Qué pasa [observado].** Sin seleccionar, nada en la nota dice que se puede comentar; solo el texto del panel
  Comentarios vacío y la tecla C. Con selección el botón «Comentar» aparece (bien). Seleccionando «que pones. » (con el
  espacio final) la caja cita «que pones. E» y el comentario guarda `«l precio del dinero. C»`: un carácter más de
  lo seleccionado (`t10-caja.png`). La cita se amplía por unicidad (`public/comentar.js:44-58`); TODO: confirmar por
  qué añade una letra con el espacio final.
- **Por qué confunde.** Una cita cortada a media palabra se lee como un fallo.
- **Arreglo mínimo.** Recortar espacios del final de la selección antes de decidir la cita (`comentar.js:137-149`) y
  completar a palabra entera.

### 10 · La cabecera del lateral cambia de altura y empuja todo · Baja · S
- **Tareas.** 8, 9, 10, 12.
- **Qué pasa [observado].** «guardado hace un momento» pasa a «guardado hace un momento, 1 cambio por guardar» y se
  parte en dos líneas: «Guardar», el buscador y el árbol bajan ~20 px (`t8-creada.png`, antes `t1-capital.png`). Pasa
  tras crear una nota, aplicar, comentar o añadir una tarea.
- **Arreglo mínimo.** Reservar siempre dos líneas o acortar el texto («1 sin guardar»). Sitio: `app.js` `pintarEstado`.

### 11 · Buscador: la nota sale dos veces y se enseña markdown crudo · Baja · S
- **Tareas.** 4.
- **Qué pasa [observado].** Buscar «capital» da «1 nota» (Capital) y luego «En el texto» con Capital otra vez, más
  líneas con `> [!comment] Alumno (2026-10-02) · «capital inicial»`, `[[capital]]` y `- [ ] Repasar…` tal cual
  (`t4-busca-capital.png`). Mientras hay búsqueda se esconden Inicio, Tareas y Nueva nota (el lateral solo enseña
  resultados), y Enter deja la búsqueda puesta hasta que pulsas Esc o la ×.
- **Arreglo mínimo.** No repetir en «En el texto» la nota ya listada arriba, y limpiar sintaxis (`[[ ]]`, `> [!…]`) en
  el extracto. Lo de esconder los atajos no lo veo como fallo, solo lo anoto.

### 12 · Tarjetas: pequeñas faltas de lenguaje y sin cierre · Baja · S
- **Tareas.** 13.
- **Qué pasa [observado].** «2 tarjetas: 1 sabidas, 0 falladas» (plural fijo, `app.js:452`); «Caja 1 de 5 · te toca el
  3/10» no dice qué es la caja ni qué es el 3/10; al contestar la última tarjeta no hay cierre («has terminado») ni
  vuelta; «Ver como nota» no dice a qué vuelve.
- **Arreglo mínimo.** Plural correcto, texto de fin y una línea de ayuda de «Caja» (Leitner) en lugar de la fecha
  cruda.

## Lo que no pude comprobar (TODO)

- Camino «Corregir» del examen con un examen revisado y `examen.js` real (hay un test con herramienta falsa:
  `tests/navegador/examen.test.js:40`).
- `guardar.js` real con un curso válido (el ejemplo da 7 errores en `comprobar.js`; el éxito se probó con un sustituto).
- Mensaje de validación del título vacío en español: el navegador de la prueba lo da en inglés; depende del idioma del
  navegador.
- Teclado de Mac real: Playwright no emula bien ⌘↓ / Ctrl+Fin dentro del editor; el hallazgo 2 se reprodujo con clic y
  ⌘↓ y con foco recién abierto, no con teclas de salto.
- Tareas 7-13 a ≤ 760 px: no pedido.

## Ya anotado en otras auditorías y que aparece aquí

- Cajón del menú sin salida (a 390 px el flujo de las tareas 1-6 pasa por él): rev-13 #1.
- Título del cuaderno como enlace a «Todos los cuadernos» sin pista: rev-13 #7.
- «Guardar» nunca refleja que no hay nada que guardar (se confirmó con kit: abre el diálogo y propone «Sesión de
  estudio»): rev-13 #8.
- Mismo icono (lápiz) para «Nueva nota» y «Editar», visibles a la vez en la portada: rev-13 #5.
- Botones de fila ocultos hasta el ratón (se ven con el foco; en la tarea 13 el examen mostró los tres): rev-13 #6.
