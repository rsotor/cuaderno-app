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
   - **Preparaciones:** una línea por preparación, en palabras: «Preparándose: clase 03 (desde las 10:42)»,
     «Lista para juntar: clase 03», «Falló: clase 03», «Se cortó: clase 03».
   - **Un botón: «Preparar con el profesor»** (o «Juntar con el profesor» si hay una terminada; «Ver con el profesor»
     si falló o se cortó). Abre al profesor en la terminal del sistema (el mismo `POST /api/terminal` del botón
     Profesor). El profesor ya sabe qué hacer al abrirse.
   - Vacío: «No hay material nuevo. Deja aquí los ficheros de una clase (PDF, Word, PowerPoint, notas, audio
     transcrito) y el profesor la prepara.»
2. **Dejar material desde la app** *(decisión de Roberto, ver abajo)*: botón «Añadir ficheros» y arrastrar sobre la
   página. `POST /api/inbox/subir` copia cada fichero a `estudio/inbox/` tal cual (es material del alumno, no un
   formato de la app): nombre saneado (sin `\ / : * ? " < > |` ni rutas), sin sobrescribir (si existe, «nombre (2)»),
   tope de tamaño por fichero (100 MB). No hace commit: lo guarda el profesor al preparar, o Guardar.
3. **Abrir el material** (el visor que estaba en el Inbox del plan vivo): PDF en un `iframe` del propio navegador;
   `.txt`, `.json`, `.csv` y `.md` de inbox como texto preformateado, solo lectura; lo demás (Word, PowerPoint, audio)
   con **la aplicación del sistema** (`POST /api/abrir-fichero`: `open` en macOS, `start` en Windows, `xdg-open` en
   Linux), igual que la terminal. Vale también fuera de inbox: el árbol empieza a listar PDF y texto (hoy solo `.md`
   y `.html`), con lo que los enlaces del vault demo a `condiciones-reserva.pdf` y `stations-sample.json` funcionan.
4. **Recarga en vivo:** el vigilante ya avisa de cambios en el cuaderno; la página Inbox se repinta como Tareas, y una
   preparación que pasa a «terminada» se ve sin recargar. `.preparacion/` empieza por punto: el vigilante lo ignora,
   así que el estado de una preparación en curso **se consulta cada 30 s solo con la página Inbox abierta**.

## Servidor

- `GET /api/inbox`: ejecuta `estado.js --json` (con el ejecutor de `guardar.js`, `spawnSync`, tope 10 s) y devuelve
  `{ materialNuevo: [{ ruta, tamano, tipo }], preparaciones }`. Sin kit, 404 con «este cuaderno no tiene inbox».
  Si `estado.js` falla, el error tal cual («el kit dice: …»), nunca una lista inventada.
- `POST /api/inbox/subir`: cuerpo binario con el nombre en una cabecera, uno por petición.
- `POST /api/abrir-fichero`: ruta relativa del cuaderno, comprobada con `cuaderno.dentro()`; lanza la aplicación del
  sistema con `spawn` sin shell y separado (el mismo lanzador inyectable de `terminal.js`, para los tests).
- `GET /fichero/...` ya sirve ficheros del cuaderno: el PDF va en `iframe` con `sandbox` como los `.html`.

## Tests

- Node (`tests/inbox.test.js`, con el curso de prueba con kit de `tests/ayuda.js` y un `estado.js` de mentira en su
  `.kit/herramientas/` que devuelve un JSON fijo): la API traduce el JSON; sin kit, 404; con `estado.js` roto, el
  error del kit; subir sanea el nombre, no sobrescribe, rechaza `../`; abrir-fichero rechaza rutas fuera del cuaderno.
- Navegador (`tests/navegador/inbox.test.js`): la página aparece solo con kit; lista el material y las preparaciones
  en palabras; «Preparar con el profesor» lanza al profesor; arrastrar un fichero lo deja en `estudio/inbox/` y sale
  en la lista; un PDF se abre en el visor; un `.docx` pide la aplicación del sistema.

## Pendiente de Roberto

- **¿Entra «Añadir ficheros» desde la app?** Recomendación: sí. Para tu padre, arrastrar el PDF a la página es lo que
  evita abrir el Finder o el Explorador y buscar `estudio/inbox/`.

## Rondas de abogado del diablo

(pendiente la ronda corta)
