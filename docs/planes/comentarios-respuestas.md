# Bloque 2 · Respuestas en los comentarios

**Estado:** diseño tras la ronda completa del abogado del diablo (2026-10-28), pendiente de la aprobación de Roberto.
Nada construido.

## Qué pide Roberto (sus palabras, 2026-10-28)

- «respuestas en los comentarios, que me digas el cambio y no se pierdan por si requieres debate»
- «si es una nota en el contenido se borra pero si es un comentario se deja»

## Lo que hay hoy

- La app escribe un comentario como un callout, justo después del bloque comentado (`cuaderno.js:416`):
  `> [!comment] Alumno (2026-10-28) · «cita»` y el cuerpo en líneas `> …`. Un callout es un mensaje, sin
  respuestas. «Cerrar comentario» lo borra (`cuaderno.js:438`, `/api/comentario/cerrar`) y la app ofrece Deshacer.
- La regla 11 del bloque de base-kit (`rules/block.md:12`) trata igual las dos vías: líneas `@@` y callouts
  `[!comment]`, «delete once handled». Ese borrado es también lo que garantiza «Never publish one».
- profesor-kit solo conoce `@@` (skill `dudas`, `marcador_dudas`); no lee los `[!comment]`. No se toca.

## Diseño

### 1. Formato del hilo (lo comparten la app y la regla)

Las respuestas van **dentro del mismo callout**, cada una tras una línea `>` vacía y con su cabecera:

```markdown
> [!comment] Alumno (2026-10-28) · «capital inicial»
> ¿Es lo mismo que el principal?
>
> **Claude (2026-10-28):** Sí. Lo he dicho en el párrafo: «el capital inicial (o principal)».
>
> **Alumno (2026-10-29):** Vale, pero ¿y en el ejemplo de abajo?
```

- **Cabecera de mensaje:** una línea `> **Alumno (AAAA-MM-DD):**` o `> **Claude (AAAA-MM-DD):**` justo después de una
  línea `>` vacía. Solo esos dos autores; cualquier otra línea en negrita es cuerpo. El primer mensaje es el título
  del callout, como hoy (compatible con todos los comentarios que ya existen).
- **Turno:** si el último mensaje es de Claude y no hay texto después, el hilo espera a Roberto. Si alguien añadió
  texto sin cabecera tras la respuesta de Claude (a mano, en el editor de nota entera o en Obsidian), cuenta como un
  mensaje de Roberto: turno de Claude.
- El callout sigue siendo un solo bloque: cerrarlo borra todo el hilo, con el código de hoy.

Alternativas descartadas:
- *Callout anidado* (`> > [!reply] Claude (fecha)`): Obsidian lo pinta, pero es más difícil de escribir a mano y de
  partir sin romper el cuerpo; no aporta nada que la cabecera no dé.
- *Callout aparte después del original*: el hilo deja de ser un bloque; cerrar o detectar el turno pide emparejar
  callouts.

### 2. base-kit: opción por proyecto, no cambio de la regla base

La regla 11 **no cambia** para nadie que no lo pida. Se añade una clave en `config/base-kit.json`,
`reviewNotes.keepComments` (nombre exacto, en base-kit), apagada por defecto. Con ella encendida, `SessionStart` añade
una línea, igual que ya hace con un marcador distinto de `@@` (`docs/contracts.md:202`):

- los `[!comment]` no se borran: se contesta dentro con `> **Claude (AAAA-MM-DD):** <qué cambió, o la respuesta>`;
  los cierra la persona;
- **un hilo abierto bloquea publicar**: antes de sacar el fichero a un destino externo (Jira, Confluence, commit en
  un repo público), los hilos se cierran o se quitan; así se mantiene «Never publish one».

Las líneas `@@` siguen igual en todos los casos. El texto del bloque no crece (el tope de palabras no se toca); la
línea de `SessionStart` y el contrato llevan el detalle. Va primero en base-kit, con su ronda allí.

### 3. La app

- **Leer (`cuaderno.js`, `comentarios()`):** cada comentario devuelve además `mensajes: [{ autor, fecha, texto }]` y
  `turno: 'tuyo' | 'claude'`. **`texto` pasa a ser solo el primer mensaje** (lo usan la etiqueta accesible y el
  resumen del panel, `public/app.js:878`); `original` no cambia (lo usa cerrar).
- **Pintar el hilo (`public/comentar.js`):** el popover del subrayado enseña los mensajes en orden, con autor y
  fecha, y un campo **Responder** que añade `>` vacía y `> **Alumno (fecha):** …` al final del callout
  (`POST /api/comentario/responder`, con la misma comprobación del original que cerrar: 409 si cambió).
- **El turno solo se enseña si el cuaderno tiene `reviewNotes.keepComments` encendida.** Sin ella (un curso con
  profesor-kit, una carpeta cualquiera) la app pinta el hilo pero no promete que alguien conteste, y el panel conserva
  su texto de hoy. Con ella, el panel dice de quién es el turno y pone arriba los que esperan a Roberto.

### 4. Pruebas

- Cuaderno de ejemplo: nota nueva `ejemplos/cuaderno-ejemplo/comentarios/hilo.md` (no se toca `nota-comentada.md`,
  que tiene cifras exactas), con un hilo con turno de Claude y otro con turno de Roberto; fila en
  `ejemplos/cuaderno-ejemplo.md`.
- Node, `tests/cuaderno.test.js`: partir mensajes; turno; comentario viejo sin respuestas; `texto` = primer mensaje
  con un hilo de dos; texto sin cabecera tras la respuesta de Claude = turno de Claude; una línea
  `**Nota (2026-10-01):**` en el cuerpo no parte el mensaje; respuesta separada por una línea en blanco sin `>`
  (queda fuera del callout: el test fija lo que pasa).
- Node, `tests/rutas.test.js`: `/api/comentario/responder` (ok, 409, vacío); turno con y sin la clave.
- Navegador, `tests/navegador/comentar.test.js`: «abrir el hilo, leer la respuesta de Claude, responder, cerrar».
- Crítica de diseño sobre las capturas del después (popover y panel).

## Pendiente de decidir (Roberto)

- ¿Se enciende `keepComments` en workspace? Allí los borradores acaban en Jira; con la clave, un hilo abierto
  bloquea publicar. TBD.
- Nombre del autor de Roberto: hoy `Alumno`. Recomendado: dejarlo. TBD.

## Rondas

- 2026-10-28, ronda completa (devils-advocate): 5 objeciones, las 5 atendidas.
  1. La regla cambiaba para todos los proyectos y rompía «Never publish one» (workspace → Jira) → opción por
     proyecto apagada por defecto y un hilo abierto bloquea publicar (§2).
  2. Formato ambiguo (texto sin cabecera, negrita en el cuerpo, línea en blanco sin `>`) → cabecera fija con dos
     autores tras `>` vacía, turno por el último texto, tres tests (§1, §4).
  3. El tope de palabras del bloque no daba para partir la regla → el bloque no crece; va en `SessionStart` y el
     contrato (§2).
  4. En cursos nadie contesta los `[!comment]` y el turno mentiría → el turno solo con la clave encendida (§3).
  5. `texto` cambiaba con el hilo aunque el diseño dijera que no → `texto` = primer mensaje, con test (§3, §4).
