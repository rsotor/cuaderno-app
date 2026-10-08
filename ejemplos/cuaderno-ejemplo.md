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
| Examen (formulario de preguntas) | `examenes/01-examen.md` | `tests/formulario.test.js`, `tests/navegador/examen.test.js` |
| Tarjetas (flashcards) | `flashcards/01-tarjetas.md` | `tests/tarjetas.test.js`, `tests/navegador/tarjetas.test.js` |
| Ficheros que no son notas: PDF, JSON, CSV, TXT, HTML con script, PNG; enlaces a ellos | `material/` | `tests/navegador/ficheros.test.js` |
| Propiedades de cada tipo (texto, lista, número, booleano, fecha) | `render/propiedades.md` | TBD (T4) |
| Enlaces: por nombre, con ruta y alias, a encabezado, a fichero, relativo, a una web, en tabla | `render/enlaces.md` | TBD (T4) |
| Callouts de tipo nota, aviso y plegado; imagen en Markdown y `![[ ]]`; línea `@@` | `render/callouts-e-imagenes.md` | TBD (T4) |
| Código en línea y en bloque; fórmulas en línea y en bloque | `render/codigo-y-formulas.md` | TBD (T4) |
| Nombre de fichero con acentos y espacios | `estructura/Nota con acentos y espacios.md` | TBD (T4) |
| Dos notas con el mismo título en la misma carpeta | `estructura/repetida-a.md`, `estructura/repetida-b.md` | TBD (T4) |
| Carpeta que empieza por `_`: no sale en el árbol | `estructura/_archivo/archivada.md` | TBD (T4) |
