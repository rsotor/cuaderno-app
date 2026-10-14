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
| Nota larga (unas 700 palabras, 5 secciones): la lectura a 16 px, el texto de ~720 px en la hoja, los caracteres por línea y el índice de la nota | `lectura/mercado-de-la-plaza.md` | `tests/navegador/medida.test.js`, `tests/navegador/indice.test.js` |
| Examen (formulario de preguntas) | `examenes/01-examen.md` | `tests/formulario.test.js`, `tests/navegador/examen.test.js` |
| Tarjetas (flashcards) | `flashcards/01-tarjetas.md` | `tests/tarjetas.test.js`, `tests/navegador/tarjetas.test.js` |
| Ficheros que no son notas: PDF, JSON, CSV, TXT, HTML con script, PNG; enlaces a ellos | `material/` | `tests/navegador/ficheros.test.js` |
| Propiedades de cada tipo (texto, lista, número, booleano, fecha) | `render/propiedades.md` | `tests/navegador/casos.test.js`, `tests/markdown.test.js` |
| Enlaces: por nombre, con ruta y alias, a encabezado, a fichero, relativo, a una web, en tabla | `render/enlaces.md` | `tests/navegador/casos.test.js` |
| Callouts de tipo nota, aviso y plegado; imagen en Markdown y `![[ ]]`; línea `@@` | `render/callouts-e-imagenes.md` | `tests/navegador/casos.test.js` |
| Código en línea y en bloque; fórmulas en línea y en bloque | `render/codigo-y-formulas.md` | `tests/navegador/casos.test.js` |
| Comentarios del alumno: uno viejo sin cita (callout), uno con cita que está (subrayado) y uno con cita que ya no está (callout con aviso) | `comentarios/nota-comentada.md` | `tests/navegador/comentar.test.js` |
| Nombre de fichero con acentos y espacios | `estructura/Nota con acentos y espacios.md` | `tests/navegador/casos.test.js` |
| Dos notas con el mismo título en la misma carpeta (el árbol las nombra por su fichero) | `estructura/repetida-a.md`, `estructura/repetida-b.md` | `tests/navegador/casos.test.js` |
| Carpeta que empieza por `_`: no sale en el árbol | `estructura/_archivo/archivada.md` | `tests/navegador/casos.test.js` |
| Adjuntos: audio con su reproductor, un fichero que la app no sabe enseñar (lleva al Finder), carpeta con solo un `.gitkeep` | `adjuntos/` | `tests/navegador/ficheros.test.js`, `tests/cuaderno.test.js` |
| Tareas que mencionan una nota: por `[[enlace]]`, por `#Etiqueta` con el nombre de la nota, y por `#etiqueta` con el nombre de una carpeta (sale en su `brief.md`) | `personas/ana.md`, `iniciativas/mudanza/brief.md` (reciben), `iniciativas/mudanza/pendientes.md` (las tareas) | `tests/menciones.test.js`, `tests/navegador/menciones.test.js` |
| Fragmento de la búsqueda sin sintaxis: viñeta con wikilink con alias y callout con negrita, con «zanahoria» en cada línea (sin casillas: el panel Tareas cuenta las del cuaderno; la casilla se prueba en `tests/busqueda.test.js`) | `render/fragmentos-de-busqueda.md` | `tests/busqueda.test.js`, `tests/navegador/busqueda.test.js` |
| Barra superior con una ruta larguísima: la miga se corta con «…» y no empuja a «Editar» ni al menú «…» de la nota, que se quedan a la derecha (sin cifras: su nombre es lo que se prueba) | `navegacion/una-nota-con-un-nombre-muy-largo-para-la-barra-superior.md` | `tests/navegador/navegacion.test.js` |
| Imagen con la ruta codificada como la escribe Obsidian (`attachments/Mi%20captura.png`, carpeta `attachments/` junto a la nota) | `insertar-imagen/con-attachments/` | `tests/imagenes.test.js`, `tests/markdown.test.js`, `tests/servidor.test.js`, `tests/navegador/imagenes.test.js` |
| Nota sin carpeta de imágenes junto a ella (la primera imagen que se mete crea `imagenes/`) | `insertar-imagen/sin-carpeta/` | `tests/navegador/imagenes.test.js` |

## Casos de uso y su recorrido

Cada caso de uso de la app (plan vivo §4, más los de después) con el recorrido de navegador que lo usa entero. El
test del índice comprueba que el fichero existe y que tiene un recorrido que empieza por el texto de la columna.
«Modo» dice cómo se monta el cuaderno: la base es sin kit; con kit, solo lo que el kit añade.

| # | Caso de uso | Recorrido | Empieza por | Modo |
|---|---|---|---|---|
| 1 | Abrir el cuaderno: portada y árbol | `tests/navegador/lectura.test.js` | portada: | sin kit |
| 2 | Buscar por nombre y por texto | `tests/navegador/lectura.test.js` | buscar: | sin kit |
| 3 | Leer una nota: propiedades, enlaces, callouts, imágenes, código, fórmulas | `tests/navegador/casos.test.js` | render: | sin kit |
| 4 | Editar la nota | `tests/navegador/edicion.test.js` | editar la nota: | sin kit |
| 5 | Comentar un texto seleccionado | `tests/navegador/comentar.test.js` | comentar una selección: | sin kit |
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
| 21 | Tareas que la mencionan | `tests/navegador/menciones.test.js` | una persona: | con kit |
| 22 | Adjuntos: vídeo, audio, al Finder, carpetas vacías | `tests/navegador/ficheros.test.js` | adjuntos: | sin kit |
| 23 | La hoja (claro, oscuro, estrecho) y el índice de la nota, solo si cabe | `tests/navegador/indice.test.js` | índice: | sin kit |
| 24 | Barra lateral plegable en escritorio: botón, Ctrl+\, recordada | `tests/navegador/lateral.test.js` | barra lateral: | sin kit |
| 25 | La app de escritorio abre el último cuaderno en su ventana y al cerrar no deja nada | `tests/electron/ventana.test.js` | la app de escritorio: | sin kit · **paso propio** (`npm run test:electron`: necesita el binario de Electron) |
| 26 | En la app, un enlace a otra web va al navegador del sistema (la ventana no cambia) y recargar con el editor sucio pregunta antes de descartar | `tests/electron/ventana.test.js` | la app de escritorio: | sin kit · **paso propio** (`npm run test:electron`) |
| 27 | Abrir una carpeta en la app de escritorio: «Elegir carpeta…» (el diálogo del sistema), la carpeta en los argumentos y la de una segunda instancia; en la web no aparece el botón | `tests/electron/carpeta.test.js` | abrir carpeta en la app de escritorio: | sin kit · **paso propio** (`npm run test:electron`); lo puro, en `tests/electron-carpeta.test.js`; que en la web no hay botón, en `tests/navegador/casos.test.js` (pantalla de Cuadernos) |
| 28 | El menú de la app de escritorio en castellano y sus atajos: Guardar (⌘S) hace el commit por `/api/guardar` (con el editor de la nota abierto, Aplicar: escribe la nota); Abrir nota…, Buscar… y Nueva tarea abren la modal de búsqueda; Ajustes…; Abrir carpeta… y Cuadernos recientes cambian de cuaderno y el menú se reconstruye; Ayuda → Diagnóstico (sin el token), Plan vivo y Mostrar registro | `tests/electron/menu.test.js` | el menú de la app de escritorio: | sin kit · **paso propio** (`npm run test:electron`); lo puro, en `tests/electron-menu.test.js` y `tests/electron-app.test.js` |
| 29 | La recarga en vivo sobrevive a un corte del socket de cambios: se reabre sola y recoge lo que cambió en el disco mientras estaba caído (sin nota propia: la prueba crea la suya en el cuaderno temporal, porque lo que se ve es un cambio de fichero, no un formato que pintar) | `tests/navegador/reconexion.test.js` | reconexión: | sin kit |
| 30 | Buscar en una modal: notas por nombre y por texto, una fila por nota con su carpeta y el fragmento limpio; flechas, Enter, Esc | `tests/navegador/busqueda.test.js` | búsqueda en modal: | sin kit |
| 31 | La línea del estado bajo el nombre del cuaderno: texto corto con «…» (el entero, en el title), Guardar destacado solo con cambios, y los casos largos (128 cambios, «guardado hace 3 semanas», lateral de 260 px, letra al 200 %) sin romper la línea | `tests/navegador/navegacion.test.js` | línea del estado: | sin kit |
| 32 | El nombre del cuaderno abre el selector: recientes (el abierto marcado, el ausente deshabilitado) y «Abrir carpeta…» | `tests/navegador/navegacion.test.js` | selector: | sin kit |
| 33 | La barra superior: la miga larga se corta con «…», Editar sin recuadro fijo a la derecha y el menú «…» de la nota (Finder, ruta, Ocultar, papelera) | `tests/navegador/navegacion.test.js` | barra superior: | sin kit |
| 34 | Atrás y Adelante en la app (‹ ›, ⌘[ ⌘], botones laterales del ratón y gesto del trackpad), dentro del cuaderno abierto y sin rebotar a la portada | `tests/navegador/navegacion.test.js` | ‹ ›: | sin kit · en la app, el menú y el gesto: `tests/electron/menu.test.js` (**paso propio**, `npm run test:electron`) y `tests/electron-ventana.test.js` |
