# cuaderno-app

Una app local en el navegador para trabajar con un **cuaderno**: la carpeta de notas Markdown de un curso montado
con profesor-kit. El plan vivo, las decisiones y el estado están en `docs/planes/plan-vivo.md`: léelo antes de
tocar nada y mantenlo al día mientras trabajas (su §0 es el fichero de estado de este repo).

## Principios (no se negocian)

1. **La app es la ventana; el cuaderno es la verdad.** Todo lo que la app escribe es Markdown en los ficheros
   del cuaderno, en el formato que ya tienen. Sin base de datos, sin formatos propios.
2. **La lógica del curso no es de la app.** Corregir, calcular progreso, decidir si se puede guardar: lo hacen
   las herramientas del kit. La app las lanza y enseña su salida. Nada de git a mano en un cuaderno con kit:
   se usa su `guardar.js` (y `deshacer.js`).
3. **La app funciona sola con cualquier carpeta de notas; con un kit, añade lo del kit.** Un kit funciona sin la
   app y la app no le pide nada que no tenga: si un caso del kit necesita algo, primero el kit. Pintar un formato
   (un examen, unas tarjetas) vale en cualquier cuaderno; corregir, guardar con sus reglas o abrir al profesor es
   del kit y solo aparece con kit.
4. **Control total de la experiencia.** Render, tema, atajos, paneles: nuestros y configurables.
5. **Nada que esconder.** Repo público desde el diseño: sin secretos, sin tokens, sin rutas de nadie.

## Convenciones (las de profesor-kit)

- **Español en todo:** código, comentarios, tests, docs, commits. Nombres de variables y funciones en español.
- **Node sin build:** CommonJS, sin transpilar, sin bundler. El navegador carga `public/` y `node_modules/` tal cual.
- **Tests con `node --test`** en `tests/*.test.js`; `npm test` los lanza. Un test que falla no se arregla tocando
  el valor esperado.
- **Node 24 o más reciente.** Dependencias: las menos posibles; cada una nueva se justifica en el plan vivo.
- **Commits pequeños, y todo entra por PR** (squash con el título del PR, la CI en verde antes de mergear; §6 del
  plan vivo), con mensaje en castellano.
- **Cada desarrollo trae su caso al cuaderno de ejemplo.** Lo que la app aprende a pintar o hacer se añade a
  `ejemplos/cuaderno-ejemplo/` en una nota o carpeta nueva (no se tocan las que ya tienen tests con cifras exactas),
  con su fila en el índice `ejemplos/cuaderno-ejemplo.md` y un test o recorrido que lo use. Así la CI lo cubre.
- **Cambios visuales, validados antes del commit:** por tanda de feedback, una ronda de crítica de diseño (agente con
  `design-critique` sobre las capturas del después); sus objeciones se atienden o se razonan en el plan vivo.

## Cuadernos de prueba

Un solo cuaderno de referencia, inventado y sin nada real: `ejemplos/cuaderno-ejemplo/`, con su índice
`ejemplos/cuaderno-ejemplo.md` (qué característica cubre cada nota o fichero, y qué test la prueba). Es el mock de
todo: tests de Node, recorridos de navegador y pruebas a mano. Los tests lo montan de dos formas: **sin kit** (la
base: lo general se prueba aquí) y **con kit** (solo lo que el kit añade; incluido el curso sin motor, un solo
test). Nunca se escribe en `ejemplos/`: tests y sondas lo copian a una carpeta temporal, y para probarlo a mano se
copia a `cuadernos-prueba/` (ignorada por git).

Los cuadernos reales de este ordenador **no los tocan nunca los tests ni las pruebas de Claude**: antes de arrancar la app o los tests se copian a una
carpeta temporal (fuera del repo o en `cuadernos-prueba/`, ignorada). Sus rutas y su contenido no entran en el
repo ni en las capturas. Si algo del formato de los ficheros no cuadra, la referencia es el AGENTS.md y las
herramientas de `.kit/` del kit, no la memoria.
