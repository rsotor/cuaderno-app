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
3. **Un kit funciona sin la app.** La app depende del kit; nunca al revés. Si un caso necesita algo que el kit
   no tiene, primero el kit.
4. **Control total de la experiencia.** Render, tema, atajos, paneles: nuestros y configurables.
5. **Nada que esconder.** Repo público desde el diseño: sin secretos, sin tokens, sin rutas de nadie.

## Convenciones (las de profesor-kit)

- **Español en todo:** código, comentarios, tests, docs, commits. Nombres de variables y funciones en español.
- **Node sin build:** CommonJS, sin transpilar, sin bundler. El navegador carga `public/` y `node_modules/` tal cual.
- **Tests con `node --test`** en `tests/*.test.js`; `npm test` los lanza. Un test que falla no se arregla tocando
  el valor esperado.
- **Node 24 o más reciente.** Dependencias: las menos posibles; cada una nueva se justifica en el plan vivo.
- **Commits pequeños** al cerrar cada fase, con mensaje en castellano.
- **Cambios visuales, validados antes del commit:** por tanda de feedback, una ronda de crítica de diseño (agente con
  `design-critique` sobre las capturas del después); sus objeciones se atienden o se razonan en el plan vivo.

## Cuadernos de prueba

Los cuadernos de referencia viven en `ejemplos/`, inventados y sin nada real: `curso-demo/` (un curso con los formatos
del kit) y `vault-demo/` (un vault de trabajo). Son el mock de todo: tests de Node, recorridos de navegador y pruebas a
mano. Nunca se escribe en ellos: tests y sondas los copian a una carpeta temporal antes de tocarlos.

Los cuadernos reales de este ordenador **no se tocan nunca**: antes de arrancar la app o los tests se copian a una
carpeta temporal (fuera del repo o en `cuadernos-prueba/`, ignorada). Sus rutas y su contenido no entran en el
repo ni en las capturas. Si algo del formato de los ficheros no cuadra, la referencia es el AGENTS.md y las
herramientas de `.kit/` del kit, no la memoria.
