# Fase 10 · inbox y preparación de clases nuevas: diseño

**2026-10-08 · estado: diseño para aprobar.** Caso de uso 11 del plan vivo: «Deja una clase nueva | Ve el inbox y lo
que aún no está preparado; "Preparar con el profesor"». El `TBD` de §4b («cómo se lanza desde la app») se cierra aquí.

## Lo que dice el kit (leído hoy en profesor-kit, no de memoria)

- **Material nuevo** = un fichero de `estudio/inbox/` que ninguna sesión cita en su `fuente:` (`lib/material.js`).
- `node .kit/herramientas/estado.js --json` da `materialNuevo` (rutas desde `estudio/`, ya sin lo que se está
  preparando) y `preparaciones` (`id`, `ficheros`, `resultado`: `en-curso`, `terminada`, `fallida`, `interrumpida`).
- **La preparación la lanza el profesor, en la conversación**, no una herramienta suelta: antes pregunta el id de la
  sesión y las dudas del material que solo sabe el alumno, con dos clases o más va de una en una, y al terminar junta
  con `--juntar` (`.kit/guias/segundo-plano.md`). Y al abrirse sin que le pidan nada, el profesor ya mira
  `estado.js` y propone «preparar lo nuevo» (AGENTS.md, «Al empezar cada sesión»).

**Consecuencia (principio 2):** la app no lanza `preparar.js` ni elige ids. Enseña lo que dice `estado.js` y su botón
abre al profesor, que hace el resto.

## Diseño

1. **Página «Inbox»** en la barra lateral, debajo de Comentarios, **solo en cursos con kit** (en un vault sin kit no
   existe el concepto). Con contador cuando hay material nuevo o una preparación que pide atención.
   - **Material nuevo:** lista de ficheros con nombre, tipo y tamaño. Cada uno se abre (punto 3).
   - **Preparaciones:** una línea por preparación, sin jerga del kit: «Preparándose la clase 03 (desde las 10:42)»,
     «La clase 03 ya está preparada; falta añadirla al curso», «La preparación de la clase 03 no salió bien»,
     «La preparación de la clase 03 se interrumpió; hay que retomarla».
   - **Un botón: «Preparar con el profesor»** («Añadirla al curso con el profesor» si hay una terminada; «Verlo con el
     profesor» si falló o se interrumpió). Debajo, una línea fija: «Se abre una ventana aparte donde hablas con el
     profesor; él te pregunta lo que necesite.» Abre al profesor en la terminal del sistema (el mismo
     `POST /api/terminal` del botón Profesor). El profesor ya sabe qué hacer al abrirse.
   - Vacío: «No hay material nuevo. Deja aquí los ficheros de una clase (PDF, Word, PowerPoint, notas, audio
     transcrito) y el profesor la prepara.»
2. **Dejar material: «Abrir la carpeta del inbox»** (decisión de Roberto, 2026-10-08: la app no sube ficheros).
   Abre `estudio/inbox/` en el gestor de archivos del sistema (Finder, Explorador, el de Linux) para arrastrar ahí
   los ficheros; si la carpeta no existe, se crea vacía antes. `POST /api/abrir-carpeta-inbox`, sin parámetros (la
   ruta la pone el servidor): `open <carpeta>` en macOS, `explorer <carpeta>` en Windows, `xdg-open <carpeta>` en
   Linux, con el lanzador de `terminal.js`. Abrir una carpeta no ejecuta nada. La página Inbox se repinta sola cuando
   llegan los ficheros (el vigilante los ve).
3. **Abrir el material** (el visor que estaba en el Inbox del plan vivo): PDF en un `iframe` del propio navegador;
   `.txt`, `.json`, `.csv` y `.md` de inbox como texto preformateado, solo lectura; los documentos con **la aplicación
   del sistema** (`POST /api/abrir-fichero`: `open` en macOS, `start` en Windows, `xdg-open` en Linux), igual que la
   terminal, **solo con una lista blanca de extensiones de documento**: `pdf doc docx odt rtf ppt pptx odp key xls
   xlsx ods numbers pages epub mp3 m4a wav ogg mp4 mov png jpg jpeg gif webp heic`. Cualquier otra (`.command`, `.sh`,
   `.bat`, `.app`, `.jar`, `.webloc`, `.html`, `.svg`…) dice «este tipo de fichero no se abre desde aquí; ábrelo tú si
   te fías de él» y no lanza nada: abrir con la app del sistema un fichero dejado en la carpeta (un `.command` que vino en un zip) sería ejecutar lo que traiga. Vale también fuera de inbox: el árbol empieza a listar PDF y texto (hoy solo `.md`
   y `.html`), con lo que los enlaces del vault demo a `condiciones-reserva.pdf` y `stations-sample.json` funcionan.
4. **Recarga en vivo:** el vigilante ya avisa de cambios en el cuaderno; la página Inbox se repinta como Tareas, y una
   preparación que pasa a «terminada» se ve sin recargar. `.preparacion/` empieza por punto: el vigilante lo ignora,
   así que el estado de una preparación en curso **se consulta cada 30 s solo con la página Inbox abierta y la
   pestaña visible** (`document.visibilityState`), y solo si hay una preparación en curso.

## Servidor

- `GET /api/inbox`: ejecuta `estado.js --json` **en asíncrono** (`execFile`, tope 10 s; `spawnSync` pararía el
  servidor, la recarga en vivo incluida, mientras dura), con una caché de 5 s y sin dos ejecuciones a la vez
  (la segunda petición espera a la primera); la primera tarea mide cuánto tarda en una copia del curso de prueba
  con kit. Devuelve
  `{ materialNuevo: [{ ruta, tamano, tipo }], preparaciones }`. Sin kit, 404 con «este cuaderno no tiene inbox».
  Si `estado.js` falla, el error tal cual («el kit dice: …»), nunca una lista inventada.
- `POST /api/abrir-carpeta-inbox`: crea `estudio/inbox/` si falta y la abre con el gestor de archivos del sistema.
- `POST /api/abrir-fichero`: ruta relativa del cuaderno, comprobada con `cuaderno.dentro()` **y con la ruta real**
  (`fs.realpathSync`, por si un enlace simbólico la saca del cuaderno), extensión en la lista blanca; lanza la
  aplicación del sistema con `spawn` sin shell y separado (el lanzador inyectable de `terminal.js`, para los tests).
- **`GET /fichero/...` endurecido (afecta a todo el cuaderno, no solo al inbox):** hoy sirve cualquier fichero
  con el origen de la app; un `.html` o `.svg` abierto en una pestaña, no en el iframe, correría con la cookie y
  podría llamar a `/api/terminal`. Desde esta fase: `X-Content-Type-Options: nosniff` siempre;
  `Content-Security-Policy: sandbox allow-scripts allow-forms` (sin `allow-same-origin`: origen opaco, sin cookie
  ni API) en todo `.html`; los `.html` y `.svg` de `inbox/` como `text/plain`. Primera tarea: comprobar que los
  exámenes `.html` del kit siguen funcionando con esa cabecera y que el visor de PDF de Chromium, Safari y Firefox
  pinta dentro del `iframe` (si un `sandbox` estricto lo deja en blanco, el PDF va sin `sandbox`: no ejecuta
  código de la página). Se apunta en §6 del plan vivo (Seguridad del servidor local).

## Tests

- Node (`tests/inbox.test.js`, con el curso de prueba con kit de `tests/ayuda.js` y un `estado.js` de mentira en su
  `.kit/herramientas/` que devuelve un JSON fijo): la API traduce el JSON; sin kit, 404; con `estado.js` roto, el
  error del kit; abrir-carpeta-inbox crea la carpeta y lanza el gestor de archivos con su ruta; abrir-fichero rechaza rutas fuera del cuaderno, un
  enlace simbólico que sale y `x.command`; `/fichero` manda `nosniff`, el `sandbox` en `.html` y `text/plain` para un
  `.svg` de inbox; dos `GET /api/inbox` a la vez lanzan `estado.js` una sola vez.
- Navegador (`tests/navegador/inbox.test.js`): la página aparece solo con kit; lista el material y las preparaciones
  en palabras (sin «juntar» ni «fallida»); un examen `.html` del curso de prueba sigue corrigiéndose; «Preparar con el profesor» lanza al profesor; «Abrir la carpeta del inbox» lanza el gestor de archivos; un
  fichero copiado a `estudio/inbox/` aparece en la lista sin recargar; un PDF se abre en el visor; un `.docx` pide la aplicación del sistema.

## Decisiones de Roberto

- 2026-10-08: no se suben ficheros desde la app; un botón abre la carpeta del inbox en el gestor de archivos del sistema.

## Rondas de abogado del diablo

- 2026-10-08, ronda corta sobre el diseño: 5 objeciones, las 5 aplicadas. Las graves: `/fichero` servía `.html` y `.svg` con el origen de la app (ahora `sandbox` por cabecera y `nosniff`), y abrir con la app del sistema un fichero subido era ejecutarlo (ahora lista blanca de documentos y ruta real). Además: la subida (que pedía streaming, tope real y nombres saneados para Windows) sale entera por decisión de Roberto; `estado.js` en asíncrono con caché; textos sin jerga y aviso antes de abrir la ventana del profesor. El crítico pide ronda completa sobre §6 (seguridad) antes de implementar: se hace sobre el plan por tareas.
