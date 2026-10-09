# Cuaderno de ejemplo: qué cubre cada nota

El cuaderno `cuaderno-ejemplo/` es la referencia de todos los tests, recorridos y pruebas a mano (AGENTS.md,
«Cuadernos de prueba»). Esta tabla dice qué característica cubre cada nota o fichero y qué test la prueba. Un caso
nuevo entra en una nota o carpeta nueva, con su fila aquí y su test. Las rutas son relativas a `cuaderno-ejemplo/`.

| Característica | Dónde | Test |
|---|---|---|
| Título, párrafos, listas, casillas con su línea | `sesiones/01-01-01-sesion.md` | `tests/cuaderno.test.js`, `tests/navegador/lectura.test.js` |
| Callout plegado, enlace a nota que no existe | `conceptos/interes.md` | `tests/markdown.test.js`, `tests/cuaderno.test.js` |
| Nota mínima, destino de enlaces y del buscador | `conceptos/capital.md` | `tests/cuaderno.test.js`, `tests/navegador/lectura.test.js` |
| Portada que regenera el profesor (`> Lo genera tu profesor`), alias escapado en tabla | `inicio.md` | `tests/navegador/lectura.test.js`, `tests/navegador/ficheros.test.js` |
| Tareas propias, etiquetas, enlaces en una tarea | `tareas.md` | `tests/navegador/tareas.test.js` |
| Nota larga (unas 700 palabras, 5 secciones): la lectura a 18 px, la columna de ~800 px y los caracteres por línea | `lectura/nota-larga.md` | `tests/navegador/medida.test.js` |
| Examen (formulario de preguntas) | `examenes/01-examen.md` | `tests/formulario.test.js`, `tests/navegador/examen.test.js` |
| Tarjetas (flashcards) | `flashcards/01-tarjetas.md` | `tests/tarjetas.test.js`, `tests/navegador/tarjetas.test.js` |
| Ficheros que no son notas: PDF, JSON, CSV, TXT, HTML con script, PNG; enlaces a ellos | `material/` | `tests/navegador/ficheros.test.js` |
| Propiedades de cada tipo (texto, lista, número, booleano, fecha) | `render/propiedades.md` | `tests/navegador/casos.test.js`, `tests/markdown.test.js` |
| Enlaces: por nombre, con ruta y alias, a encabezado, a fichero, relativo, a una web, en tabla | `render/enlaces.md` | `tests/navegador/casos.test.js` |
| Callouts de tipo nota, aviso y plegado; imagen en Markdown y `![[ ]]`; línea `@@` | `render/callouts-e-imagenes.md` | `tests/navegador/casos.test.js` |
| Código en línea y en bloque; fórmulas en línea y en bloque | `render/codigo-y-formulas.md` | `tests/navegador/casos.test.js` |
| Nombre de fichero con acentos y espacios | `estructura/Nota con acentos y espacios.md` | `tests/navegador/casos.test.js` |
| Dos notas con el mismo título en la misma carpeta (el árbol las nombra por su fichero) | `estructura/repetida-a.md`, `estructura/repetida-b.md` | `tests/navegador/casos.test.js` |
| Carpeta que empieza por `_`: no sale en el árbol | `estructura/_archivo/archivada.md` | `tests/navegador/casos.test.js` |
| Adjuntos: audio con su reproductor, un fichero que la app no sabe enseñar (lleva al Finder), carpeta con solo un `.gitkeep` | `adjuntos/` | `tests/navegador/ficheros.test.js`, `tests/cuaderno.test.js` |
| Tareas que mencionan una nota: por `[[enlace]]`, por `#Etiqueta` con el nombre de la nota, y por `#etiqueta` con el nombre de una carpeta (sale en su `brief.md`) | `personas/ana.md`, `iniciativas/mudanza/brief.md` (reciben), `iniciativas/mudanza/pendientes.md` (las tareas) | `tests/menciones.test.js`, `tests/navegador/menciones.test.js` |

## Casos de uso y su recorrido

Cada caso de uso de la app (plan vivo §4, más los de después) con el recorrido de navegador que lo usa entero. El
test del índice comprueba que el fichero existe y que tiene un recorrido que empieza por el texto de la columna.
«Modo» dice cómo se monta el cuaderno: la base es sin kit; con kit, solo lo que el kit añade.

| # | Caso de uso | Recorrido | Empieza por | Modo |
|---|---|---|---|---|
| 1 | Abrir el cuaderno: portada y árbol | `tests/navegador/lectura.test.js` | portada: | sin kit |
| 2 | Buscar por nombre y por texto | `tests/navegador/lectura.test.js` | buscar: | sin kit |
| 3 | Leer una nota: propiedades, enlaces, callouts, imágenes, código, fórmulas | `tests/navegador/casos.test.js` | render: | sin kit |
| 4 | Editar un bloque | `tests/navegador/lectura.test.js` | editar un bloque: | sin kit |
| 5 | Comentar un bloque y verlo en Comentarios | `tests/navegador/casos.test.js` | comentar un bloque: | sin kit |
| 6 | Marcar una sesión como estudiada | — | — | **no implementado** en la app |
| 7 | Repasar tarjetas | `tests/navegador/tarjetas.test.js` | modo tarjeta: | sin kit |
| 8 | Hacer y corregir un examen | `tests/navegador/examen.test.js` | con examen.js en el kit: | con kit |
| 9a | Tareas: solo `tareas.md` y «+» | `tests/navegador/casos.test.js` | Tareas sin kit: | sin kit |
| 9b | Tareas: todas las casillas por nota, filtros | `tests/navegador/tareas.test.js` | panel Tareas: | con kit |
| 10 | Terminal dentro de la app (y el profesor) | `tests/navegador/panel.test.js` | un solo botón, Terminal; | con kit |
| 11 | Ver el material: PDF, JSON, CSV, TXT, HTML, imágenes | `tests/navegador/ficheros.test.js` | PDF: | sin kit |
| 12a | Guardar, Traer y Deshacer con git | `tests/navegador/casos.test.js` | Guardar, Traer y Deshacer | sin kit |
| 12b | Guardar y Deshacer con las herramientas del kit | `tests/guardar.test.js` | guardar y deshacer con el kit de verdad | con kit · **se salta en la CI** (necesita un curso con kit: `CUADERNO_KIT_PRUEBA`) |
| 13 | Varios cuadernos: recientes, abrir, quitar | `tests/navegador/casos.test.js` | pantalla de Cuadernos: | sin kit |
| 14 | Crear una nota | `tests/navegador/uso.test.js` | nota nueva: | sin kit |
| 15 | Árbol plegado y carpetas | `tests/navegador/uso.test.js` | árbol: las carpetas salen plegadas | sin kit |
| 16 | Ajustes: tema y fuente | `tests/navegador/uso.test.js` | ajustes: | sin kit |
| 17 | Ocultar en la app | `tests/navegador/ocultar.test.js` | ocultar una carpeta | sin kit |
| 18 | Mostrar en el Finder, copiar la ruta, papelera | `tests/navegador/ficheros.test.js` | mostrar en el Finder: | sin kit |
| 19 | Aviso de app desactualizada | `tests/navegador/ocultar.test.js` | aviso de reinicio: | sin kit |
| 20 | Un curso del kit sin motor no guarda | `tests/guardar.test.js` | salida del kit sin motor: | con kit (sin motor) |
