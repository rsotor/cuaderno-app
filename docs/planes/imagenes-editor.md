# Imágenes en el editor de la nota · plan de trabajo

**Nació el 2026-10-14** · Camino: arquitectónico (primera vez que la app escribe en el cuaderno un fichero que no es la
nota, y una ruta de la API que recibe bytes) · Rama: `imagenes-editor` (desde `main`) · Estado del repo: `plan-vivo.md`
§0 (este fichero lleva solo el de este bloque) · **Pendiente de aprobación de Roberto: no se toca código hasta su sí.**

## 0. Estado del bloque

**Ahora**
- Bloque hecho (2026-10-14): plan aprobado por Roberto con las respuestas de §9, T1 a T9 hechas; T1 mergeada (#39), el
  resto en el PR de `bloque/imagenes-2`. Crítica de diseño: `docs/diseno/critica-2026-10-14-imagenes.md`. Las capturas
  de T5/T6 se sustituyeron por las de T9 (`pruebas/capturas-imagenes.js`).

**Siguiente (al reanudar, 2026-10-15):** el PR #40 está rojo solo en Windows, por dos recorridos de
  `tests/navegador/imagenes.test.js` (:318 y :346) que comparan el fichero con `\n` y en Windows el cuaderno de ejemplo
  sale con CRLF (`'# Otra cosa\r\n'`). La app conserva el CRLF, que está bien: hay que arreglar la comparación del test
  (normalizar los finales de línea al leer `notaEnDisco`), no el valor esperado. Mirar si otros recorridos ya lo hacen así.
  Después: CI en verde, automerge (ya activado), `npm run instalar` y decir la versión. Ya arreglado (3d39231): un enlace
  simbólico roto con el nombre de la imagen cuenta como ocupado (en Windows, `wx` lo seguía).

**Hecho**
- T1 (2026-10-14): `public/imagenes.js` (`resolver`, `aUrl`), `markdown.js` las usa para `![](…)` y `![[…]]`; ejemplo
  `insertar-imagen/con-attachments/`. Desvíos: `tests/empaquetado.test.js` aprende que un módulo de `public/` lo cubre
  `public/**`; los contadores de notas del recorrido (23 → 24) en `tests/cuaderno.test.js` y `tests/servidor.test.js`.

- T2 (2026-10-14): `enlaceDe`, `limpiarNombre`, `libre`, `EXTENSIONES`, `CARPETAS`, `TOPE_IMAGEN` en `public/imagenes.js`;
  `Cuaderno.destinoImagen` en `cuaderno.js`; `POST /api/imagen/destino` en `servidor.js`. Sin desvíos; ninguna cifra
  existente cambió (el ejemplo no crece en T2).

- T3 (2026-10-14): `Cuaderno.guardarImagen` en `cuaderno.js`; `POST /api/imagen` (en crudo, antes de `leerCuerpo`) con
  `leerBytes`/`rechazar` en `servidor.js`. Desvío de P5: el 413 **no** lleva `connection: close` (con él Node cierra el socket
  con el cliente aún subiendo y le llegaba `EPIPE`/`ECONNRESET`, test intermitente); basta `res.end()` + `req.resume()`
  (sin `req.destroy()`), y el 413 llega siempre. Cobertura: servidor.js ramas 84,50 → 85,30 %.

- T4 (2026-10-14): `rutaDeFichero` en `electron/preload.js` (`webUtils.getPathForFile`). Los tests de las claves del preload ganan la clave nueva y `webUtils` (función nueva, no un valor tocado para que pase). Sin desvíos.

- T5 (2026-10-14): `public/live.js`: widget `Imagen`, `decosImagen`, extensión `imagenesPlano` (la imagen también en «Markdown plano», solo ella), `insertarImagenes`, `pendientes`, `alSoltarFicheros` (por `dataTransfer.types`), `destruir` revoca las URL; `.live-imagen*` en `estilo.css`; ejemplo `insertar-imagen/sin-carpeta/` (contadores de notas 24 → 25 en `cuaderno.test.js` y `servidor.test.js`: nota nueva, no un valor arreglado); recorrido `tests/navegador/imagenes.test.js`. Desvíos: con el crudo (línea del cursor y modo plano) la imagen es un widget de **bloque** tras la línea, no en línea (P7 decía `side: 1`, que se mantiene); `alSoltarFicheros` solo instala `dragover`/`drop` si se le pasa (la app lo pasa en T6; hasta entonces el soltar no cambia). Ningún test existente esperaba «ninguna img» en plano (no había): no se cambió ninguna expectativa. Capturas del después en `docs/capturas/imagenes/` para la crítica de T9.

- T6 (2026-10-14): `public/app.js`: botón «Imagen» (`FORMATOS_BARRA`, quinto campo `accion`: sin `aria-pressed` en `htmlBarra`, fuera de `actualizarBarra` por `button[aria-pressed]`, el clic abre `#imagen-fichero`), `meterImagenes` (extensión y `TOPE_IMAGEN` con aviso, destinos **en serie** sumando a `reservados`, P9 por `origen` o `nombre|tamaño|fecha`, error del destino → `avisarError` y nada insertado), `alSoltarFicheros` en `live.montar`, y `dragover`/`drop` de `document` con `types.includes('Files')` mientras `edicion` (P13); `public/index.html`: `#imagen-fichero`. Recorridos en `tests/navegador/imagenes.test.js` (4 nuevos; el (6) mira `defaultPrevented` de eventos sintéticos sobre `document`). Cambia `tests/navegador/edicion.test.js` (la lista de botones gana `imagen` y el último de la barra, donde da la vuelta el foco, pasa de `codigo` a `imagen`: botón nuevo, no un valor arreglado). Desvío: soltar en la línea del título cae tras el `# ` (posición real de `posAtCoords`), así que el recorrido suelta en la línea del párrafo. Capturas en `docs/capturas/imagenes/despues-barra-imagen-{claro,oscuro}-2026-10-14.png`. Hasta T7, Aplicar aún no copia las pendientes.

- T7 (2026-10-14): `public/app.js`: `escribirConImagenes` (P12), la única que escribe la nota desde el editor (Aplicar y «Sobrescribir»), con guarda de reentrada por `escribiendo`; `soltarSubidas` (papelera de lo subido en un intento fallido, Q1); `api()` acepta un `Blob` y lo manda en crudo. `public/imagenes.js`: `sustituirEnlaces(texto, mapa)` (la pasada única de P12(3), pieza pura con test de Node en `tests/imagenes.test.js`). Caso 35 en el índice del ejemplo; 8 recorridos «imágenes: aplicar…» en `tests/navegador/imagenes.test.js`; test con kit de verdad en `tests/guardar.test.js` (pasa con un curso temporal montado desde profesor-kit). Desvíos: (a) la pendiente guarda un `File` (con el nombre de origen) y Aplicar sube con ese nombre en la carpeta reservada, no con el reservado: con el reservado ocupado, `libre` del servidor daba `captura-2-2.png` y no el `captura-3.png` que piden (3) y (8); (b) `sustituirEnlaces` va en `public/imagenes.js` (P1) y no dentro de `app.js`; (c) la receta del curso con kit de `plan-vivo.md` §0 necesita copiar también `.base-kit/` (sin él, `guardar.js` se niega: `[pieza-ausente] .base-kit`); (d) **pendiente**: las capturas y la ronda de crítica de diseño que §5 T7 pone antes de su commit (no existe `pruebas/capturas-imagenes.js`; T7 no cambia nada visible), al coordinador.
- T8 (2026-10-14): `tests/electron/imagenes.test.js` (4 recorridos) y caso 36 en el índice del ejemplo. **`setInputFiles` en Playwright-Electron sí da ruta con `webUtils.getPathForFile`** (no hizo falta el plan B): la rama «dentro del cuaderno → enlazar» queda probada en la app. Desvío: la app vacía el `<input>` tras leer el fichero, así que la sonda de la ruta se engancha al `change` en captura. (3) de §10 (`defaultPrevented` de `dragover` y `drop` sobre `document` con el editor sucio, la ventana no navega) también en la app. Sin cambios de código de la app.

**Siguiente**
- La ronda de crítica de diseño pendiente de T7 (d).

## 1. Objetivo, enfoque y restricciones

**Objetivo.** Meter una imagen en una nota desde el editor (arrastrándola o con un botón «Imagen») y que, al aplicar, quede
en una carpeta junto a la nota con un enlace Markdown estándar, sin escribir nada en el cuaderno hasta Aplicar.

**Enfoque.** El servidor decide dónde va cada imagen y con qué nombre (una ruta JSON al insertar) y la escribe sin
sobrescribir nunca (una ruta que recibe los bytes en crudo, al aplicar). El editor (`public/live.js`) pinta las imágenes con
un widget y guarda en memoria las pendientes de copiar (los bytes, leídos al insertar, y su URL `blob:`); `public/app.js`
sube las pendientes que el texto sigue enlazando, reescribe el enlace si el nombre cambió y solo entonces escribe la nota;
si algo falla, manda a la papelera lo subido en ese intento y no escribe la nota.

### 1.1 Restricciones (decisiones de Roberto, 2026-10-14, literales)

> 1. Dónde se guarda: en una subcarpeta junto a la nota. Si junto a la nota ya existe una carpeta de imágenes, se reutiliza
>    (nombres conocidos: `attachments`, `adjuntos`, `imagenes`, `images`, `assets`; el workspace real de Roberto usa
>    `attachments/` junto a las notas de cada iniciativa y enlaza en Markdown estándar con la ruta codificada, p. ej.
>    `![Texto](attachments/Mi%20captura.png)`); si no hay ninguna, se crea `imagenes/`.
> 2. Cómo entra: arrastrar una imagen al editor, o un botón «Imagen» en la barra de formato que abre el selector de ficheros
>    del sistema (sirve para Descargas o para el propio cuaderno). Sin pegar con ⌘V.
> 3. Si la imagen elegida ya está dentro del cuaderno: no se copia, se enlaza su ruta relativa a la nota. Si viene de fuera:
>    se copia. Nombre repetido → sufijo `-2`, `-3`…; nunca sobrescribir.
> 4. Mixto: mientras se edita, la imagen se ve desde donde esté (aunque esté en Descargas) y solo se copia a la carpeta al dar
>    a Aplicar. Si se descarta la edición, no queda nada. El texto de la nota lleva desde el principio el enlace definitivo;
>    el editor guarda las imágenes pendientes de copiar.
> 5. Se diseña para la app de escritorio (Electron); la web es banco de pruebas, que no se rompa.

### 1.2 Restricciones del repo (AGENTS.md)

Principio 1 (lo que se escribe es Markdown estándar y ficheros normales en el cuaderno); principio 3 (esto vale en
cualquier cuaderno, con o sin kit: no es lógica del kit); caso nuevo en `ejemplos/cuaderno-ejemplo/` con su fila en
`ejemplos/cuaderno-ejemplo.md` y su recorrido; cada ruta nueva de la API en un test de Node (`tests/rutas.test.js`); suelo
de cobertura del 85 % (`npm run test:cobertura`); crítica de diseño sobre capturas reales por ser cambio visual; sin
dependencias nuevas; un test que falla no se arregla tocando el valor esperado.

## 2. De dónde se parte (hechos del repo, 2026-10-14)

- **El render no resuelve hoy el formato de la decisión 1.** `markdown.js:70-74` (`rutaImagen`) vuelve a codificar con
  `encodeURI` un `src` que markdown-it ya trae codificado; `link_open` decodifica antes (`markdown.js:83`), la regla de
  imagen no (`markdown.js:88`). Comprobado: `![a](attachments/Mi%20captura.png)` en `ini/nota.md` sale como
  `/fichero/ini/attachments/Mi%2520captura.png`; `servirDelCuaderno` decodifica una vez (`servidor.js:190`) y busca
  `Mi%20captura.png` en el disco: 404. **Las notas reales de Roberto con `%20` no enseñan la imagen hoy** (T1).
- **La API solo acepta JSON de hasta 2 MB.** Todo POST pasa por `leerCuerpo` (`servidor.js:129-132`, llamado en
  `servidor.js:192` antes de mirar la ruta): 415 si no es JSON y corta la petición con `req.destroy()` pasados 2e6
  caracteres (el cliente no recibe respuesta, solo un corte). Una imagen en
  base64 dentro de JSON tendría un techo de ~1,5 MB. La ruta de subida lee el cuerpo en crudo y se atiende antes de esa
  línea (T3).
- **`/fichero/` sirve solo lo que está bajo `cu.base`** (`servirDelCuaderno`, `servidor.js:120-127`), no bajo `cu.raiz`: con kit, la base es la
  carpeta de las notas (`cuaderno.js:37-40`). «Dentro del cuaderno» en este plan es **dentro de `cu.base`**: una imagen bajo
  la raíz pero fuera de la base no se podría enseñar con un enlace relativo, así que se copia (P3).
- **El editor deja las imágenes en crudo:** `if (nm === 'Image') return false;` (`public/live.js:159`). Los widgets de
  bloque (`BloqueHtml`, `live.js:69-95`) ya traen el patrón: `estimatedHeight`, `ResizeObserver`, `alPulsar`. `![[x.png]]`
  no es un nodo `Image` del árbol de Lezer.
- **La barra de formato** (`app.js:568-584`): `FORMATOS_BARRA`, un clic llama a `live.formato(id)`; `formatosActivos`
  (`live.js:327-340`) da `aria-pressed`. El recorrido `tests/navegador/edicion.test.js:513-514` fija la lista exacta de
  botones.
- **Dos caminos escriben la nota:** `aplicarEdicion` (`app.js:622-634`, con `escribiendo = true`) y «Sobrescribir» de la
  franja de conflicto (`app.js:688-692`, **sin** `escribiendo`). `aplicarEdicion` no tiene guarda de reentrada.
- **La recarga en vivo** (`cuaderno.js:418-428`): `fs.watch` recursivo sobre la base; cualquier fichero nuevo dispara
  `alCambiarDisco` (`app.js:1309`), que con `escribiendo` no repinta y con el editor abierto llama a `comprobarDisco`.
- **El preload** (`electron/preload.js:17-21`) expone `elegirCarpeta`, `alAccion` y `version`; dos tests fijan esas claves:
  `tests/electron-carpeta.test.js:237` (una regex por clave) y `tests/electron/carpeta.test.js:59` (la lista exacta).
  `webUtils.getPathForFile(file)` existe en el Electron del repo (44.7.0, `node_modules/electron/electron.d.ts:20060`).
- **Soltar un fichero fuera de un sitio que lo atienda navega al fichero.** En la web, Chromium lo abre; en la app,
  `will-navigate` → `tratarEnlace` ignora `file://` (`electron/ventana.js:42-47, 152`), pero el `beforeunload` de
  `app.js:669` salta antes con cambios (y en la app, `will-prevent-unload` pregunta, `electron/ventana.js:154`): no basta
  con fiarse de `will-navigate` (P13).
- **Con kit, Guardar se lleva las imágenes nuevas:** `.kit/herramientas/guardar.js:188` de `rsotor/profesor-kit` hace
  `git add -A` y el `.gitignore` del kit no excluye imágenes, así que un PNG nuevo bajo `estudio/` entra en el commit
  (comprobado por el coordinador en el repo del kit, 2026-10-14). Test con kit en T7.
- **CodeMirror y los ficheros soltados:** su manejador `drop` lee los ficheros como texto y los inserta; un manejador propio
  en `EditorView.domEventHandlers` que devuelva `true` va antes y lo evita.
- **Papelera:** `/api/papelera` (`servidor.js:210-217`) manda un fichero del cuaderno a la papelera del sistema; los
  recorridos la simulan borrando (`tests/navegador/ayuda.js:47`).
- **Casos de uso del índice del ejemplo:** el último es el 34. Este plan usa el 35 (web) y el 36 (app).

## 3. Decisiones de este plan

| # | Decisión | Por qué |
|---|---|---|
| P1 | **Las piezas puras de las rutas de imagen en `public/imagenes.js`** (script clásico: `window.Imagenes` y, si existe `module`, `module.exports`, como `public/busqueda.js`): `resolver(rutaNota, src)` (ruta dentro de la base, decodificada una vez y normalizada, o `null` si es absoluta/URL), `aUrl(rel)` (`/fichero/…` codificando cada tramo con `encodeURIComponent`), `enlaceDe(rutaNota, rel)` (ruta relativa desde la carpeta de la nota, con `../` si hace falta, codificada como en P2), `limpiarNombre(nombre)` y `libre(nombre, existe)` (`x.png`, `x-2.png`, `x-3.png`…). `markdown.js` las usa para las imágenes (`require('./public/imagenes')`) y `live.js` para el widget | Una sola fuente de verdad para el render, el editor y el servidor; se prueba en Node |
| P2 | **El enlace codifica solo lo que rompe un enlace Markdown o una URL:** espacio `%20`, `%` `%25`, `(` `%28`, `)` `%29`, `<` `%3C`, `>` `%3E`, `#` `%23`, `?` `%3F`; los acentos se quedan como están. Forma: `![alt](carpeta/Nombre%20con%20espacios.png)` | Es el formato del workspace de Roberto (decisión 1) y se lee bien en el fichero; markdown-it normaliza el resto al pintar |
| P3 | **«Dentro del cuaderno» = dentro de `cu.base` por su ruta real** (`realpath` de la imagen y de la base, como `servirDelCuaderno`). Dentro → `{ dentro: true, enlace }`, sin copiar. Fuera (incluida la raíz de un kit fuera de la base) → se copia | `/fichero/` solo sirve la base (§2) |
| P4 | **El servidor decide carpeta y nombre**: `POST /api/imagen/destino { nota, nombre, origen, reservados }`. La carpeta: la primera de `attachments`, `adjuntos`, `imagenes`, `images`, `assets` (en ese orden; comparación sin mayúsculas, se usa el nombre real del disco) que exista como carpeta en la carpeta de la nota; si no hay, `imagenes`. El nombre: `limpiarNombre` (quita `\ / : * ? " < > \|`, colapsa espacios, nada que empiece por `.`; vacío → `imagen`) y `libre` contra el disco **y** contra `reservados` (las rutas pendientes de este editor) | El cliente no ve las carpetas ignoradas (`cuaderno.js:40`) ni las ocultas (`servidor.js:161`); el servidor sí |
| P5 | **Subida en crudo:** `POST /api/imagen?nota=<rel>&ruta=<rel>` con `content-type` `application/octet-stream` o `image/*` (si no, 415), cuerpo de **25 MB como mucho** (`TOPE_IMAGEN`, exportado desde `public/imagenes.js`, §9 Q2), atendida **antes** de `leerCuerpo`. El tope: con `content-length` mayor, 413 **antes de leer**; si el cuerpo se pasa leyendo (sin `content-length` o mintiendo), deja de acumular, responde 413 con `res.end()` y no llama a `req.destroy()`; en los dos casos, el resto del cuerpo se drena sin guardarlo (`req.resume()`) y la respuesta lleva `connection: close`, para que el cliente reciba un 413 de verdad y no un `ECONNRESET` a media subida; nada se escribe. El servidor: extensión en la lista `png jpg jpeg gif webp svg avif` (si no, 400); `cu.dentro` sobre la nota y la ruta; la carpeta de destino tiene que ser **hija directa de la carpeta de la nota** (si no, 400); crea solo ese nivel (`mkdirSync` sin `recursive` sobre el padre que ya existe); escribe con `flag: 'wx'` y, si el nombre ya existe (`EEXIST`), prueba `-2`, `-3`… Devuelve `{ ruta, enlace }`, los definitivos | Nunca sobrescribir (decisión 3) lo garantiza el sistema de ficheros, no una comprobación previa; ni escribir fuera del cuaderno ni crear carpetas en otro sitio |
| P6 | **El editor guarda las pendientes** en `live.js`: un `Map` de `enlace` → `{ ruta, blob, url }` (el `blob` hecho con los bytes leídos al insertar, `file.arrayBuffer()`, y `url = URL.createObjectURL(blob)`). `destruir()` revoca todas las URL. Exporta `pendientes()` (las que el texto actual enlaza: el texto contiene `](enlace)` o `](enlace "`) | Decisión 4: la vista previa no depende de que el fichero siga en Descargas, y descartar no deja nada |
| P7 | **El widget de imagen** (sustituye `live.js:159`): fuera de la línea del cursor, el nodo `Image` se cambia por `<img class="live-imagen">`; en la línea del cursor, el crudo **y** la imagen detrás (widget con `side: 1`), para que se vea nada más insertarla. `src`: la URL `blob:` si el enlace está pendiente; si no, `Imagenes.aUrl(Imagenes.resolver(ruta, src))`; si es `http(s):`, tal cual. Sin cargar (404): el `alt` en una caja `live-imagen-rota` con `title` «No se encuentra: <ruta>». Un clic lleva el cursor al nodo (`alPulsar`). `![[x.png]]` sigue en crudo (fuera, §8). **También en el modo «Markdown plano»:** ahí va solo este widget (una extensión `imagenes` aparte de `vistaPrevia`), siempre con el crudo delante, como en la línea del cursor; el resto de la vista previa sigue sin ir en plano | Decisión 4 («la imagen se ve mientras se edita»), en los dos modos |
| P8 | **Insertar:** en el cursor (botón) o en `posAtCoords` del punto de soltar (arrastrar). Una imagen: `![nombre sin extensión](enlace)` en línea; varias: una por línea, separadas por `\n`. Con selección, el botón usa la selección como `alt` de la primera. El foco vuelve al editor. Ficheros que no son imagen (por extensión): se ignoran con aviso «Solo imágenes: png, jpg, gif, webp, svg, avif». Una imagen con `file.size > TOPE_IMAGEN`: se ignora al insertar con aviso «<nombre> pasa de 25 MB». Un soltar sin ficheros (texto arrastrado) sigue como hoy. **Los destinos se piden en serie:** `meterImagenes` llama a `/api/imagen/destino` una imagen tras otra, sumando a `reservados` la ruta que devolvió la anterior (dos `captura.png` soltadas juntas dan `captura.png` y `captura-2.png`, nunca la misma) | Lo de Obsidian; el texto alternativo no se inventa: el nombre del fichero |
| P9 | **La misma imagen dos veces en una edición** (mismo `origen` en la app; en la web, mismo `name` + `size` + `lastModified`) reutiliza la pendiente y su enlace: no hay `-2` por insertarla otra vez | Copiar dos veces el mismo fichero no es lo que se quiere |
| P10 | **La web no sabe la ruta del fichero:** sin `window.cuadernoApp.rutaDeFichero`, `origen` va vacío y toda imagen se trata como de fuera (se copia). La rama «ya está en el cuaderno → enlazar» solo existe en la app; su recorrido va en `tests/electron/` (T8) | Decisión 5: la web es banco de pruebas y no se rompe (copiar no es romper) |
| P11 | **El preload expone `rutaDeFichero: f => webUtils.getPathForFile(f)`** (cadena vacía si el `File` no viene del disco) | El único camino a la ruta en el sandbox; sigue sin `fs` ni más `require` que `electron` |
| P12 | **Una sola función escribe la nota con imágenes:** `escribirConImagenes(ruta, texto, original)` en `app.js`, usada por `aplicarEdicion` **y** por «Sobrescribir». Orden: (1) `escribiendo = true`; (2) sube una a una las `pendientes()` referenciadas; (3) con los enlaces que el servidor cambió, un mapa `viejo → nuevo`, y **una sola pasada** sobre el texto original que sustituye cada `](viejo)`/`](viejo "` por su nuevo (una regex con todas las claves escapadas, alternadas y la función de reemplazo que mira el mapa; nunca reemplazos seguidos: con `captura.png → captura-2.png` y `captura-2.png → captura-3.png`, uno tras otro mandarían las dos a `captura-3.png`); (4) `POST /api/nota/escribir`; (5) si (2) o (4) fallan: cada imagen subida en este intento va a `/api/papelera`, la nota no se escribe, el editor queda como estaba (texto y pendientes) y se dice qué falló (un 409 sigue abriendo la franja). Guarda de reentrada: con `escribiendo`, Aplicar no hace nada | Decisión 4 («si se descarta, no queda nada») también tras un fallo; dos ⌘Enter seguidos no suben dos copias |
| P13 | **Arrastrar fuera del editor no navega:** con el editor abierto, `dragover` y `drop` en `document` hacen `preventDefault` si `e.dataTransfer.types.includes('Files')` (en `dragover` la lista `files` viene vacía por seguridad: no se mira). **Igual en la web y en la app**, con el mismo manejador: en la app no basta `will-navigate`, porque el `beforeunload` de `app.js:669` salta antes (§2). El `dragover` del editor (T5) usa la misma comprobación | Perder la edición por soltar un milímetro fuera |
| P14 | **Botón «Imagen» en la barra**, al final, con `data-formato="imagen"`, icono de imagen, `aria-label="Imagen"`, `title="Imagen (o arrástrala al editor)"`; **no** está en `COMANDOS` ni en `formatosActivos` (no es un formato que se active: sin `aria-pressed`). Va en `FORMATOS_BARRA` con una marca `accion: true`, y las tres piezas que hoy tratan a todos los botones como formato lo saltan explícitamente: `htmlBarra` no le pone `aria-pressed` (`app.js:573`), `actualizarBarra` no lo toca (`app.js:577`) y el clic común no llama a `live.formato` con él (`app.js:582`). Abre un `<input type="file" accept="image/*" multiple hidden>` | Mismo sitio que el resto de lo que se mete en la nota (decisión 2) |

## 4. Ficheros

| Fichero | Qué cambia y de qué es responsable |
|---|---|
| `public/imagenes.js` (nuevo) | P1, P2: `resolver`, `aUrl`, `enlaceDe`, `limpiarNombre`, `libre`, `EXTENSIONES`, `CARPETAS`, `TOPE_IMAGEN` (25 MB). Sin DOM ni `fs` |
| `tests/imagenes.test.js` (nuevo) | Node: las piezas puras |
| `markdown.js` | La regla de imagen y `imagen_wiki` usan `Imagenes.resolver` + `aUrl` (T1). `link_open` no cambia |
| `tests/markdown.test.js`, `tests/servidor.test.js` | T1: `%20`, `#`, `../`, `%` suelto; ida y vuelta por `/fichero/` con espacios |
| `cuaderno.js` | `destinoImagen(nota, nombre, { origen, reservados })` (T2) y `guardarImagen(nota, ruta, bytes)` (T3) |
| `servidor.js` | `POST /api/imagen/destino` (T2); `POST /api/imagen` en crudo antes de `leerCuerpo`, con `leerBytes(req, tope)` (T3) |
| `tests/cuaderno.test.js`, `tests/servidor.test.js` | T2, T3 (las dos rutas salen con `'/api/imagen/destino'` y `'/api/imagen?` en los tests: `tests/rutas.test.js:14-18`) |
| `electron/preload.js` | `rutaDeFichero` (P11); comentario «solo estas tres cosas» → cuatro |
| `tests/electron-carpeta.test.js`, `tests/electron/carpeta.test.js` | La clave nueva (T4: función nueva, no un valor tocado para que pase) |
| `public/live.js` | Widget de imagen (P7), pendientes (P6), `insertarImagenes`, `pendientes`, `alSoltarFicheros` en `montar` (T5) |
| `public/app.js` | Botón e input (P14), `meterImagenes` (P8-P10), arrastrar (P13), `escribirConImagenes` (P12) (T6, T7) |
| `public/index.html` | `<script src="/public/imagenes.js">` antes de `app.js`; icono `i-imagen` si los iconos viven en el `<svg>` de símbolos |
| `public/estilo.css` | `.live-imagen` (máx. el ancho de la hoja, radio y margen como `.nota img`), `.live-imagen-rota` |
| `tests/navegador/imagenes.test.js` (nuevo) | El recorrido del caso 35 |
| `tests/navegador/edicion.test.js` | `:514`, la lista de botones gana `imagen` (T6: botón nuevo) |
| `tests/electron/imagenes.test.js` (nuevo) | El recorrido del caso 36 (T8) |
| `ejemplos/cuaderno-ejemplo/insertar-imagen/` (nuevo) | `con-attachments/nota.md` + `con-attachments/attachments/Mi captura.png` (copia de `material/reparto-50-30-20.png`) y `sin-carpeta/nota.md` |
| `ejemplos/cuaderno-ejemplo.md` | Dos filas de característica y los casos 35 y 36 |
| `pruebas/capturas-imagenes.js` (nuevo) | Capturas reales para la crítica (copia del ejemplo en `cuadernos-prueba/`); fuera de la cobertura |
| `docs/diseno/critica-2026-10-xx-imagenes.md`, `README.md`, `docs/planes/plan-vivo.md` | En la tarea de cierre |

## 5. Tareas

Para todas: rama `imagenes-editor` desde `main`; commit en castellano por tarea con `npm test` en verde; `npm run
test:navegador` si toca `public/`; `npm run test:electron` (en Linux `xvfb-run -a`) si toca `electron/`; **nunca
`test:navegador` y `test:electron` a la vez**; `npm run test:cobertura` si toca `cuaderno.js`, `servidor.js`, `markdown.js`
o `public/imagenes.js`. Cada test nuevo se escribe primero y se ve fallar. Los tests copian el ejemplo a una carpeta
temporal (nunca escriben en `ejemplos/`).

#### T1 · El render enseña `attachments/Mi%20captura.png` (y nace `public/imagenes.js`)
- **Qué:** `public/imagenes.js` con `resolver` y `aUrl` (P1): `resolver` decodifica **una vez** con `decodeURIComponent`
  dentro de `try` (un `%` suelto se deja tal cual) y normaliza `.`/`..` desde la carpeta de la nota. `markdown.js:70-74` y
  `:88`, `:97` usan `aUrl(resolver(...))`; `link_open` (`:79-86`) no cambia. Ejemplo: `insertar-imagen/con-attachments/`
  con `nota.md` (`# Nota con captura` y `![Mi captura](attachments/Mi%20captura.png)`) y la PNG; fila de característica
  en el índice.
- **Primero el test:** `tests/imagenes.test.js`: `resolver('ini/nota.md', 'attachments/Mi%20captura.png')` →
  `ini/attachments/Mi captura.png`; `'../img/a.png'` → `img/a.png`; `'Foto%20%231.png'` → `ini/Foto #1.png`; `'100%.png'`
  → `ini/100%.png`; `'https://x/a.png'` y `'/a.png'` → `null`; `aUrl('ini/Foto #1.png')` → `/fichero/ini/Foto%20%231.png`.
  `tests/markdown.test.js`: el HTML de `![a](attachments/Mi%20captura.png)` en `ini/nota.md` lleva
  `src="/fichero/ini/attachments/Mi%20captura.png"` (hoy `%2520`). `tests/servidor.test.js`: con la copia del ejemplo,
  `GET` del `src` que da el render de `insertar-imagen/con-attachments/nota.md` → 200 e `image/png`.
- **Comando:** `node --test tests/imagenes.test.js tests/markdown.test.js && npm test && npm run test:navegador && npm run test:cobertura`
  (el navegador, por si algún recorrido cuenta ficheros del ejemplo).
- **Commit:** `fix: el render enseña las imágenes con la ruta codificada (%20), como las escribe Obsidian`.

#### T2 · Dónde va la imagen y con qué nombre: `POST /api/imagen/destino`
- **Qué:** en `public/imagenes.js`, `enlaceDe`, `limpiarNombre`, `libre`, `EXTENSIONES`, `CARPETAS`, `TOPE_IMAGEN` (P1, P2, P4, P5). En
  `cuaderno.js`, `destinoImagen(nota, nombre, { origen = '', reservados = [] })`: `dentro(nota)`; extensión de `nombre` en
  `EXTENSIONES` (si no, `ErrorPeticion('solo imágenes: …')`); con `origen` absoluto que existe y cuya ruta real está bajo la
  real de `base` → `{ dentro: true, enlace: enlaceDe(nota, relativa) }`; si no → carpeta (P4) y nombre libre contra el disco
  y `reservados` → `{ dentro: false, ruta, enlace }`. No escribe nada. Ruta en `servidor.js` junto a las de la nota.
- **Primero el test:** `tests/imagenes.test.js`: `enlaceDe('a/n.md', 'a/attachments/Mi captura (1).png')` →
  `attachments/Mi%20captura%20%281%29.png`; `enlaceDe('a/b/n.md', 'img/x.png')` → `../../img/x.png`; `limpiarNombre('../a:b?.png')` → `imagen.png`
  (quitados los prohibidos queda `..ab.png`, que empieza por `.`); `libre('x.png', n => ['x.png','x-2.png'].includes(n))` →
  `x-3.png`; acentos sin codificar. `tests/cuaderno.test.js`: nota con `attachments/` hermana → ruta en `attachments/`;
  con `Adjuntos/` (mayúscula) → `Adjuntos/`; con `imagenes/` y `assets/` → `imagenes/` (orden de P4); sin ninguna →
  `imagenes/` y la carpeta **no** se crea; nombre que existe → `-2`; en `reservados` → `-2`; `origen` dentro de la base →
  `dentro: true` y enlace relativo con `../`; `origen` por un enlace simbólico que sale de la base → copia; con kit
  (`crearCuaderno({ kit: true })`), `origen` bajo la raíz pero fuera de la base → copia; `.pdf` → error.
  `tests/servidor.test.js`: `post('/api/imagen/destino', …)` → 200 con `{ dentro, ruta, enlace }`; `nota: '../x.md'` → 400.
- **Comando:** `node --test tests/imagenes.test.js tests/cuaderno.test.js tests/servidor.test.js && npm test && npm run test:cobertura`.
- **Commit:** `feat: /api/imagen/destino decide la carpeta junto a la nota y un nombre libre para una imagen`.

#### T3 · Escribir la imagen sin sobrescribir: `POST /api/imagen`
- **Qué:** P5. En `servidor.js`, `leerBytes(req, res, tope)` (P5: con `content-length` mayor que `TOPE_IMAGEN`, 413 sin leer; si se pasa leyendo, deja de
  acumular, 413 con `res.end()` y sin `req.destroy()`), y la
  ruta antes de `const b = await leerCuerpo(req)` (`servidor.js:192`). En `cuaderno.js`, `guardarImagen(nota, ruta, bytes)`
  con las comprobaciones de P5, la escritura con `wx` en bucle de `libre` y `invalidar()`. Devuelve `{ ruta, enlace }`.
- **Primero el test:** `tests/cuaderno.test.js`: escribe en `imagenes/` (que crea) y en `attachments/` (que ya existe);
  con el nombre ocupado escribe `-2` y el original sigue con sus bytes; ruta con `..`, absoluta o por un enlace simbólico de
  carpeta que sale de la base → error y nada escrito fuera; carpeta que no es hija directa de la de la nota
  (`otra/x.png`, `imagenes/sub/x.png`) → error; `.html` → error. `tests/servidor.test.js`: `fetch` con
  `'/api/imagen?nota=…&ruta=…'`, cuerpo binario y `content-type: image/png` → 200 y los bytes iguales en el disco; JSON →
  415; `content-length` de 25 MB + 1 → el cliente recibe **una respuesta 413** (no un `ECONNRESET`) y nada en el disco;
  un cuerpo troceado sin `content-length` que pasa del tope → también 413 recibido y nada en el disco; sin cookie → 403; con `Origin` ajeno → 403.
- **Comando:** `node --test tests/cuaderno.test.js tests/servidor.test.js tests/rutas.test.js && npm test && npm run test:cobertura`.
- **Commit:** `feat: /api/imagen escribe una imagen junto a la nota, nunca encima de otra ni fuera del cuaderno`.

#### T4 · La app de escritorio da la ruta del fichero
- **Qué:** P11 en `electron/preload.js` (`webUtils` sale del mismo `require('electron')`).
- **Primero el test:** `tests/electron-carpeta.test.js:237`: `rutaDeFichero` en la lista de claves y
  `webUtils\.getPathForFile` en la fuente. `tests/electron/carpeta.test.js:59`: la lista exacta pasa a
  `['alAccion', 'elegirCarpeta', 'rutaDeFichero', 'version']` (función nueva: se cambia la expectativa porque cambia lo que
  se pide, no para que pase) y `typeof window.cuadernoApp.rutaDeFichero === 'function'`.
- **Comando:** `npm test && npm run test:electron`.
- **Commit:** `feat: la app de escritorio expone la ruta de un fichero elegido o soltado (rutaDeFichero)`.

#### T5 · El editor pinta las imágenes y guarda las pendientes
- **Qué:** en `public/live.js`, P6 y P7: clase `Imagen extends WidgetType` (`eq` por `src` y `alt`; `estimatedHeight` con
  la última altura medida o 120; `ResizeObserver` y `requestMeasure` al cargar; `alPulsar`); en `construir`, el nodo
  `Image` con su `URL` hijo da `src` y el texto entre `![` y `]` da `alt`; `contexto.pendientes`; `insertarImagenes(lista,
  pos)` (`lista`: `[{ enlace, alt, pendiente: { ruta, blob } | null }]`, P8 para el texto que se inserta, `userEvent:
  'input.imagen'`); `pendientes()`; `montar(…, { alSoltarFicheros })` con `domEventHandlers({ dragover, drop })`: en los dos, la
  condición es `e.dataTransfer.types.includes('Files')` (P13); `dragover` hace `preventDefault`; `drop` hace `preventDefault`, `alSoltarFicheros([...files], vista.posAtCoords(e))` y `true`; sin ficheros,
  `false`. El widget va también en modo plano (P7): `montar` añade la extensión `imagenes` con `plano` y sin él.
  `destruir()` revoca las URL. `public/estilo.css`: `.live-imagen`, `.live-imagen-rota`. Ejemplo:
  `insertar-imagen/sin-carpeta/nota.md` (`# Nota sin carpeta de imágenes` y un párrafo) y fila en el índice.
- **Primero el test:** `tests/navegador/imagenes.test.js`, «imágenes: el editor pinta»: editar
  `insertar-imagen/con-attachments/nota.md` con el cursor en otra línea → `.cm-content img.live-imagen` con
  `naturalWidth > 0` y sin el texto `](`; flecha hasta su línea → el crudo `![Mi captura](attachments/Mi%20captura.png)`
  **y** la imagen; con el ajuste «Markdown plano», la `img` también está, con el crudo delante en todas las líneas y sin
  ningún otro widget (ni casillas ni marcadores ocultos); un enlace a `no-existe.png` → `.live-imagen-rota` con el
  `alt`. Insertar desde la página con `live.insertarImagenes` y un `Blob` PNG pendiente → la `img` tiene `src` `blob:`;
  Cancelar/Descartar → `URL.revokeObjectURL` llamado (espía en `page.evaluate`).
- **Comando:** `npm test && npm run test:navegador`.
- **Commit:** `feat: el editor pinta las imágenes (también las pendientes de copiar, desde la memoria)`.

#### T6 · Meter una imagen: botón «Imagen» y arrastrar
- **Qué:** P8, P9, P10, P13, P14 en `public/app.js`: el botón en `FORMATOS_BARRA` con `accion: true`, y fuera de lo que
  es de formato: sin `aria-pressed` en `htmlBarra` (`app.js:573`), saltado en `actualizarBarra` (`app.js:577`) y, en el
  clic de `enlazarBarra` (`app.js:582`), abre `#imagen-fichero` en vez de llamar a `live.formato`; `meterImagenes(files, pos)`: filtra por extensión
  y por `file.size > TOPE_IMAGEN` (aviso), lee los bytes y pide `/api/imagen/destino` **en serie** (con `origen` de
  `rutaDeFichero` si `enApp()`, y `reservados` = rutas de las pendientes más las devueltas ya en esta tanda, P8), reutiliza la pendiente según P9 e inserta con `live.insertarImagenes`; un error del destino → `avisarError`
  y nada insertado. `alSoltarFicheros` en `live.montar`. El `dragover`/`drop` de `document` mientras `edicion`.
  `public/index.html`: el script y el icono.
- **Primero el test:** `tests/navegador/imagenes.test.js`, «imágenes: meter»: (1) `setInputFiles` en `#imagen-fichero` con
  una PNG en una carpeta temporal **fuera** del cuaderno («Mi captura.png») en `con-attachments/nota.md` → el texto lleva
  `![Mi captura](attachments/Mi%20captura-2.png)` (la del ejemplo ocupa el nombre), la imagen se ve y **el disco no ha
  cambiado** (lista de `attachments/` igual); (2) en `sin-carpeta/nota.md` → `![…](imagenes/….png)` y **no** existe
  `sin-carpeta/imagenes/`; (3) borrar la PNG temporal tras insertar → la imagen se sigue viendo; (4) la misma PNG dos
  veces → el mismo enlace dos veces, sin `-3`; (5) soltar con un `DataTransfer` sintético (un `File` PNG) en el editor →
  insertada donde se soltó; un `.txt` soltado → aviso y nada insertado; dos PNG llamadas `captura.png` (de dos carpetas
  temporales) soltadas juntas → `imagenes/captura.png` e `imagenes/captura-2.png`; un `File` de 25 MB + 1 → aviso y nada
  insertado; (6) un `dragover` y un `drop` sintéticos con `types` `['Files']` despachados sobre `document` (fuera del
  editor) → `evento.defaultPrevented === true` en los dos; uno con solo `text/plain` → `false`; (7) Descartar → ni
  `imagenes/` ni ficheros nuevos.
  `tests/navegador/edicion.test.js:514`: la lista gana `imagen` al final (botón nuevo); la barra sigue con una parada de Tab.
- **Comando:** `npm test && npm run test:navegador`.
- **Commit:** `feat: botón «Imagen» y arrastrar al editor: la imagen se ve y el enlace es el definitivo`.

#### T7 · Aplicar copia las pendientes y luego escribe la nota
- **Qué:** P12 en `public/app.js`: `escribirConImagenes`, usada por `aplicarEdicion` y por `franja-sobrescribir`; guarda de
  reentrada. Caso 35 en el índice del ejemplo. **Última tarea visual:** antes de su commit, capturas reales con
  `pruebas/capturas-imagenes.js` (editor con imagen pendiente, en la línea del cursor y fuera; imagen rota; barra con
  «Imagen»; claro y oscuro; 760 px) y ronda de crítica de diseño (agente con `design-critique`); lo que se atienda entra en
  este commit y lo que no, razonado en `docs/diseno/critica-2026-10-xx-imagenes.md`.
- **Primero el test:** `tests/navegador/imagenes.test.js`, recorrido del caso 35, «imágenes: aplicar»: (1) tras el (1) de
  T6, Aplicar → `attachments/Mi captura-2.png` con los bytes de la temporal, la nota con ese enlace y la lectura enseña la
  imagen (`naturalWidth > 0`); (2) `sin-carpeta` → se crea `imagenes/` con la imagen; (3) insertar, crear en el disco un
  fichero con ese mismo nombre y Aplicar → la imagen va a `-3` (o el siguiente libre), la nota enlaza **ese** nombre y el
  fichero creado a mano no cambia; (4) insertar, borrar el enlace del texto, escribir otra cosa y Aplicar → ninguna imagen
  nueva; (5) la subida falla (`page.route` de `/api/imagen?*` a 500 en la segunda de dos) → la nota no cambia en el disco,
  la primera ya no está (papelera simulada), aviso con el error y el editor conserva texto e imágenes; quitar la ruta y
  Aplicar otra vez → las dos escritas; (6) conflicto: cambiar la nota por fuera, Aplicar → franja; «Sobrescribir» → la
  imagen se escribe y la nota también; (7) ⌘/Ctrl Enter dos veces seguidas → un solo fichero; (8) choque encadenado: en
  `sin-carpeta/nota.md`, dos imágenes distintas llamadas `captura.png` (la segunda queda `captura-2.png` en el texto),
  luego aparece `imagenes/captura.png` en el disco y Aplicar → la primera va a `captura-2.png` y la segunda a
  `captura-3.png`; cada enlace de la nota apunta a **su** imagen (bytes comparados con su origen), el fichero de fuera no
  cambia y no queda ningún enlace duplicado.
  `tests/guardar.test.js`, con kit de verdad (`skip` sin `CUADERNO_KIT_PRUEBA`, como el test de `:139`): con
  `Cuaderno` sobre `estudio/`, `guardarImagen` de una PNG junto a una nota, `escribirNota` con su enlace, `guardar` →
  `git show --name-only HEAD` en el curso lista la PNG y la nota; después `deshacer` para dejar el curso como estaba (§2:
  `guardar.js:188` del kit hace `git add -A`).
- **Comando:** `npm test && npm run test:navegador && npm run test:cobertura`; y una vez, con el curso de prueba del kit
  (nunca uno real), `CUADERNO_KIT_PRUEBA=<ruta> node --test tests/guardar.test.js`.
- **Commit:** `feat: Aplicar copia las imágenes pendientes junto a la nota y después escribe la nota`.

#### T8 · En la app: la imagen del cuaderno se enlaza; la de fuera se copia
- **Qué:** `tests/electron/imagenes.test.js` (patrón de `tests/electron/carpeta.test.js`). Caso 36 en el índice.
- **Primero el test:** primero, comprobar que `setInputFiles` en Electron da un `File` con ruta
  (`window.cuadernoApp.rutaDeFichero(input.files[0])` ≠ `''`). Con eso: (1) elegir `material/reparto-50-30-20.png` del
  propio cuaderno desde `insertar-imagen/sin-carpeta/nota.md` → enlace `../../material/reparto-50-30-20.png`, Aplicar → no
  hay `imagenes/` ni copia; (2) una PNG de una carpeta temporal fuera → se copia a `imagenes/`; (3) P13 en la app: un `dragover` y un `drop` sintéticos con `types` `['Files']` sobre
  `document` con el editor sucio → `defaultPrevented` en los dos y la ventana sigue en la nota. **Si `rutaDeFichero` da
  `''` con `setInputFiles`**, la rama «dentro» queda cubierta por los tests de Node de T2 (servidor) y por la prueba a mano
  de T9 en el Mac, y el test se queda con (2) más una comprobación de que `origen` vacío copia; se anota en §0.
- **Comando:** `npm test && npm run test:electron` (en Linux, `xvfb-run -a`).
- **Commit:** `test: en la app, una imagen del cuaderno se enlaza sin copiarla`.

#### T9 · Cierre
- **Qué:** README (cómo se mete una imagen y dónde queda), plan vivo (§0, §5 «Lo que ya está hecho», §6 fila «Imágenes»
  con P2-P5 y P12), este §0; PR con la CI en verde; tras el merge, `npm run instalar` en el checkout principal (AGENTS.md)
  y prueba de Roberto en su Mac: arrastrar desde Descargas, elegir una de una iniciativa con `attachments/`, descartar, y
  una nota real (copiada a `cuadernos-prueba/`) con `%20` que ahora se ve.
- **Test / comando:** `npm test && npm run test:navegador && npm run test:electron && npm run test:cobertura` (por turnos).
- **Commit:** `docs: imágenes en el editor, en el README y el plan vivo`.

## 6. Tests existentes afectados

- `tests/navegador/edicion.test.js:514` (lista de botones de la barra): gana `imagen` (T6).
- `tests/electron-carpeta.test.js:237` y `tests/electron/carpeta.test.js:59` (claves del preload): ganan `rutaDeFichero` (T4).
- `tests/markdown.test.js`: si algún test fija hoy un `src` con `%25`, cambia porque el comportamiento de hoy es el fallo
  de §2; se dice en el commit de T1.

## 7. Foco de revisión

1. **Dos caminos de escritura, la reentrada y los nombres encadenados:** «Sobrescribir» (`app.js:688-692`) escribía sin
   `escribiendo` y sin subir pendientes; dos ⌘Enter seguidos duplicarían la subida; reemplazos de enlace seguidos o
   destinos pedidos en paralelo cruzarían dos imágenes con el mismo nombre. P8, P12; tests (6), (7) y (8) de T7 y (5) de T6.
2. **Fallo a medias deja huérfanos:** imagen subida y nota sin escribir (500 o 409). P12 (papelera de lo subido en el
   intento); test (5) de T7.
3. **Nombres que rompen el enlace o el servidor:** espacios, paréntesis, `#`, `%`, acentos, `../` en el nombre. P2, P4;
   tests de T1 y T2 (`Mi captura (1).png`, `Foto #1.png`, `100%.png`, `../a:b?.png`).
4. **Escribir fuera o encima:** enlace simbólico de carpeta que sale de la base, carpeta de destino que no es hija de la de
   la nota, nombre ocupado entre insertar y aplicar. P3, P5; tests de T3 y (3) de T7.
5. **Soltar donde no toca:** CodeMirror insertando los bytes como texto, o la web navegando al fichero y perdiendo lo
   escrito (también en la app, por `beforeunload`). P13 y el `drop` de T5; tests (5) y (6) de T6 y (3) de T8.

## 8. Fuera

- Pegar con ⌘V (decisión 2).
- `![[imagen.png]]` en el editor: sigue en crudo; el render ya lo pinta (`markdown.js:89-101`).
- Redimensionar, mover o renombrar una imagen desde la app; borrar la imagen al quitar su enlace.
- Imágenes que no pinta Chromium (HEIC: §9 Q3).

## 9. Preguntas abiertas (para Roberto)

**Respondidas (Roberto, 2026-10-14: «vale a las 5, adelante con el plan»):** las cinco, con la respuesta por defecto. Plan aprobado.

Respuestas por defecto (2026-10-14, del coordinador): **pendientes de que Roberto las confirme**. El plan está escrito
con ellas; si Roberto cambia alguna, cambia la decisión que se cita.

- **Q1. Fallo después de subir** → por defecto, **papelera tal cual** (P12): lo subido en un intento fallido va a la
  papelera; si la papelera también falla, la imagen se queda y se avisa con su ruta. La otra opción (lo subido se queda
  y deja de estar pendiente) deja la imagen si luego se descarta.
- **Q2. Tamaño máximo** → por defecto, **25 MB** por imagen (`TOPE_IMAGEN`, P5, P8).
- **Q3. HEIC del iPhone** → por defecto, **fuera, con el aviso** «Solo imágenes: …» (P8). Convertir a JPEG sería una
  dependencia nueva.
- **Q4. Texto alternativo** → por defecto, **el nombre del fichero sin extensión** (P8).
- **Q5. Carpeta vacía** (la subida crea `imagenes/` y luego falla: la carpeta vacía se queda, la papelera es solo para
  ficheros, `servidor.js:213`) → por defecto, **da igual**: se queda.

## 10. Abogado del diablo

**Ronda completa, 2026-10-14: 5 objeciones, 5 aplicadas** (todas aceptadas por el coordinador).

1. **Enlaces cruzados con nombres repetidos:** reemplazos seguidos (`captura → captura-2`, luego `captura-2 → captura-3`)
   y destinos pedidos en paralelo podían mandar dos imágenes al mismo enlace. → P12(3): una sola pasada con un mapa
   `viejo → nuevo`; P8: destinos en serie sumando a `reservados`; T7 (8) y T6 (5) lo prueban.
2. **El tope de 25 MB no llegaba como 413:** `req.destroy()` corta la conexión y el cliente ve un error de red. → P5: 413
   por `content-length` antes de leer y, si se pasa leyendo, 413 con `res.end()` sin `destroy`; T3 comprueba que llega el
   413; `TOPE_IMAGEN` exportado y comprobado al insertar (`file.size`). Corregidas las líneas de §2 (`leerCuerpo`
   `servidor.js:129-132`, `servirDelCuaderno` `servidor.js:120-127`).
3. **Arrastrar fuera:** en `dragover` `files` viene vacía, y en la app `beforeunload` (`app.js:669`) salta antes que
   `will-navigate`. → P13 mira `dataTransfer.types.includes('Files')` y va también en la app; el editor de T5, igual; el
   test mira `defaultPrevented` de eventos sintéticos sobre `document` (T6 (6), T8 (3)).
4. **(a)** En «Markdown plano» la imagen no se veía, contra la decisión 4. → P7: el widget de imagen va también en plano
   (solo él); cambia el test de T5. **(b)** El botón «Imagen» entraba en `aria-pressed`, `actualizarBarra` y el clic
   común. → P14 y T6 lo sacan de `app.js:573`, `:577` y `:582`.
5. **Con kit, Guardar se lleva las imágenes** (`guardar.js:188` del kit, `git add -A`; el `.gitignore` del kit no las
   excluye). → En §2 y test con kit de verdad en T7 (`tests/guardar.test.js`, `CUADERNO_KIT_PRUEBA`).
