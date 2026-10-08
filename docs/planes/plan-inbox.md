# Fase 10 · ver cualquier fichero del cuaderno y abrir su carpeta: diseño

**2026-10-08 · estado: hecho el mismo día** (Roberto pidió un ejemplo de cada tipo con sus recorridos: `ejemplos/curso-demo/material/` y `tests/navegador/ficheros.test.js`). Roberto recortó la fase (2026-10-08): nada de página Inbox ni de
añadir documentos; preparar una clase se hace hablando con el profesor. Lo que entra:

1. **El árbol enseña también PDF, JSON y texto.** Hoy solo lista `.md` y `.html`, así que una carpeta como
   `estudio/inbox/` con PDFs ni aparece. Desde ahora el índice lista `.md`, `.html`, `.pdf`, `.json`, `.txt` y `.csv`.
   Lo demás (Word, audio…) sigue sin salir en el árbol.
2. **Cada tipo se ve bien al pulsarlo:**
   - `.md`: como hoy.
   - `.html`: como hoy (en un `iframe` con `sandbox`).
   - `.pdf`: el visor del propio navegador, dentro de la columna de la nota (`iframe` a `/fichero/…`).
   - `.json`: formateado con sangría (si no es JSON válido, tal cual), en letra de código, solo lectura.
   - `.txt` y `.csv`: texto tal cual, en letra de código, solo lectura.
   Los enlaces desde una nota (`[[condiciones-reserva.pdf]]`, `[mapa](stations-sample.json)`) abren el mismo visor.
3. **Icono «Abrir en el Finder»** (Explorador en Windows, gestor de archivos en Linux):
   - en el **árbol**, al pasar el ratón por una carpeta o un fichero, a la derecha de la fila;
   - en la **miga** (la ruta de arriba de la nota), siempre visible, para la nota abierta.
   Sobre una carpeta, la abre; sobre un fichero, abre su carpeta con el fichero señalado (`open -R` en macOS,
   `explorer /select,` en Windows, `xdg-open <carpeta>` en Linux). `POST /api/mostrar-en-carpeta` con la ruta
   relativa, comprobada dentro del cuaderno; lanzado con el mismo lanzador inyectable de `terminal.js`. Mostrar una
   carpeta no ejecuta nada.

## Cómo, para que no rompa lo demás (ronda corta)

- **Notas y ficheros, separados.** El índice distingue *notas* (`.md`, `.html`) de *ficheros* (`.pdf`, `.json`,
  `.txt`, `.csv`). Los ficheros salen en el árbol, **en el buscador por su nombre** (Roberto, 2026-10-08: «si
  buscamos ficheros, ¿por qué no incluirlos?»; sin conflicto) y como destino de un enlace con su extensión
  (`[[stations-sample.json]]`). La búsqueda *dentro* del texto, los backlinks, las tareas y la portada siguen
  mirando solo notas (leer un PDF como texto daría basura).
- **Un fichero no pasa por `/api/nota`** (hoy lo leería entero como texto y lo pintaría como Markdown). La vista
  sale de su extensión: el PDF va en `iframe` directo a `/fichero/…`; JSON, TXT y CSV se piden a `/fichero/…` con un
  tope de 1 MB, y si pasa, se enseña el principio y un enlace «verlo entero en otra pestaña». La recarga en vivo
  no relee un PDF.
- **`/fichero` comprueba la ruta real** (`realpath`) además de que esté dentro del cuaderno: hoy un enlace
  simbólico dentro de la carpeta podría servir un fichero de fuera. Y un `.svg` se sirve con
  `Content-Security-Policy: sandbox`, como ya se aísla un `.html` en su `iframe`. Dos líneas; se apunta en §6.
- **El icono es un botón aparte del enlace** (no dentro), con `aria-label` («Mostrar <nombre> en el Finder»):
  se ve al pasar el ratón, al llegar con el teclado, y siempre en pantallas táctiles.

## Tests

- Node: el índice lista `.pdf`, `.json`, `.txt` y `.csv` y no `.docx`, pero el buscador y los backlinks no los cuentan; `[[x.json]]` resuelve y `[[x]]` no; `/fichero` rechaza un enlace simbólico que sale del cuaderno y manda `sandbox` en un `.svg`; `/api/mostrar-en-carpeta` lanza el comando
  correcto por sistema (macOS, Windows, Linux), rechaza rutas fuera del cuaderno.
- Navegador (con un PDF, un JSON y un TXT añadidos al cuaderno de prueba): salen en el árbol; el PDF abre en un
  `iframe` a `/fichero/…`; el JSON sale con sangría; un JSON roto sale tal cual sin error; el icono aparece al pasar
  el ratón y lanza el gestor de archivos con la ruta; el de la miga también.

## Rondas de abogado del diablo

- 2026-10-08, ronda corta sobre el diseño recortado: 5 objeciones; 4 aplicadas (notas y ficheros separados, los ficheros fuera de `/api/nota` y con tope, `realpath` y `sandbox` del `.svg` en `/fichero`, el icono como botón accesible) y 1 sin objeto (hablaba de abrir ficheros con su aplicación, que ya no entra).
