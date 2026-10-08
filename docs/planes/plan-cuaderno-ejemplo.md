# Plan · un solo cuaderno de ejemplo, la app sin kit como base y el kit como capa

**2026-10-09 · estado: para aprobar.** Decisiones de Roberto en la conversación del 2026-10-09 (literal o casi):
«podemos unificarlo en uno grande que cubra todos los casos de uso y que nos sirva para todos los test»; «cualquier
nuevo desarrollo debe meter algo nuevo para poder validarlo así en la CI»; «yo no ordenaría el contenido por uso:
sesiones, conceptos e iniciativas son lo mismo»; «tampoco hace falta tener una nota súper grande»; «el examen es una
lógica de un kit, no del curso»; «estamos montando todo para que dependa de un kit». Nombre: `cuaderno-ejemplo`.

## Objetivo

Un único cuaderno de ejemplo, `ejemplos/cuaderno-ejemplo/`, que usan todos los tests de Node, todos los recorridos de
navegador y las pruebas a mano, ordenado por lo que la app sabe pintar o hacer; la app probada primero como lector de
cualquier carpeta de notas, y el kit probado solo en lo que añade.

## Enfoque

Hoy el ejemplo de los tests es un curso del kit (`curso-demo`) y el vault de trabajo (`vault-demo`) no lo usa ningún
test: sus casos (tipos de frontmatter, variantes de enlace, enlaces a notas que no existen, alias en tablas, imágenes,
callouts, `@@`, `_archive`) solo se han probado a mano. Se juntan en un cuaderno pequeño de notas cortas, cada una
con unas pocas características, y un índice (`INDICE.md` del propio cuaderno) con una fila por característica y la
nota que la cubre. El kit deja de ser contenido: la ayuda de los tests monta el mismo cuaderno **sin kit** (base) o
**con kit** (añade `.kit/` con su motor y adaptador y `config/`, y mueve las notas a `estudio/`).

## Cambio de principio (señalado a Roberto una vez)

Principio 3 hoy: «Un kit funciona sin la app. La app depende del kit; nunca al revés.» Pasa a:

> 3. **La app funciona sola con cualquier carpeta de notas; con un kit, añade lo del kit.** Un kit funciona sin la
>    app y la app no le pide nada que no tenga: si un caso del kit necesita algo, primero el kit.

El principio 2 (la lógica del curso es del kit) no cambia.

## Modos: dos, no tres

| Lo que cambia | Base (sin kit) | Con kit |
|---|---|---|
| Dónde están las notas | la raíz | `estudio/` |
| Guardar, Traer, Deshacer | git directo | `guardar.js` y `deshacer.js` del kit |
| Terminal / asistente | el comando de Ajustes | el del adaptador del kit |
| Corregir un examen | guarda las respuestas | `examen.js --corregir` |
| Panel Tareas | solo `tareas.md` | todas las casillas, salvo examen y tarjetas |

**Sale «salida del kit sin motor»** (`estudio/` y `config/` sin `.kit/motor.json`): sin lógica ni tests propios, se
abre como cualquier carpeta (base: la raíz). Hoy lo usan `kit.js`, `guardar.js` (`sinMotor`), `servidor.js`
(comentario de tareas), `public/app.js` (botones de guardar desactivados) y 4 tests.

## El cuaderno, por elementos (no por uso)

Un tema inventado y neutro (finanzas personales, el del curso de hoy), notas de 5 a 30 líneas:

| Elemento | Qué cubre | Dónde |
|---|---|---|
| Nota y su render | títulos, párrafos, listas, tablas, código, fórmulas, callouts de cada tipo, imágenes (Markdown y `![[ ]]`), `@@` | 3–4 notas cortas |
| Frontmatter | strings, listas, números, booleanos, fechas, `tipo` | repartido en las mismas notas |
| Enlaces | `[[nota]]`, `[[ruta/nota\|alias]]`, `[[nota#Encabezado]]`, alias escapado en tabla, enlace a nota que no existe, enlace relativo Markdown, enlace a fichero con extensión, backlinks | repartido |
| Casillas y tareas | `tareas.md`, casillas en otras notas, etiquetas, enlaces en tareas | `tareas.md` y 1–2 notas |
| Formatos del kit | examen (formulario), tarjetas, nota que regenera el profesor (`> Lo genera tu profesor`) | 3 notas |
| Ficheros que no son notas | PDF, JSON, JSON roto, CSV, TXT, HTML con script, PNG | carpeta `material/` (la de hoy) |
| Estructura | carpetas anidadas, carpeta `_archive` (oculta por empezar por `_`), dos notas con el mismo título, nombre con acentos y espacios | carpetas |
| Ignorados | `node_modules/`, fichero oculto, `.gitignore`, `.obsidianignore` | lo crea la ayuda (como hoy) |

`INDICE.md` (en la raíz del cuaderno, y nota como cualquier otra) es la tabla característica → nota → test que la
prueba. Es la referencia para saber qué hay y dónde añadir.

## Regla nueva en AGENTS.md (Convenciones)

> **Cada desarrollo trae su caso al cuaderno de ejemplo.** Lo que la app aprende a pintar o hacer se añade a
> `ejemplos/cuaderno-ejemplo/` (una línea en una nota existente o una nota corta nueva), con su fila en `INDICE.md` y
> un test o recorrido que lo use. Así la CI lo cubre. Nunca se escribe en `ejemplos/`: tests y pruebas lo copian.

## Tareas

### T1 · Principio, regla y plan vivo (solo documentos)

- `AGENTS.md`: principio 3 nuevo; sección «Cuadernos de prueba» reescrita (un cuaderno, dos modos, copias en
  `cuadernos-prueba/` para probar a mano); la regla nueva en Convenciones.
- `docs/planes/plan-vivo.md` §6: fila nueva «Cuaderno de ejemplo» y la decisión de los dos modos.
- Sin tests. Commit: `docs: la app como lector de cualquier carpeta y el kit como capa; un solo cuaderno de ejemplo`.

### T2 · El cuaderno de ejemplo

- `ejemplos/cuaderno-ejemplo/` desde `curso-demo` (notas, examen, tarjetas, tareas, `material/`) y lo que aporta
  `vault-demo` (frontmatter variado, variantes de enlace, alias en tabla, enlace a nota que no existe, `@@`,
  `_archive`, imágenes, adjunto PDF), reescrito a notas cortas sobre el mismo tema. `INDICE.md` con todas las filas de
  la tabla de arriba.
- Test primero, `tests/ejemplo.test.js`: cada nota o fichero que cita `INDICE.md` existe; cada fila tiene nota y
  test; ninguna nota pasa de 40 líneas; no hay nombres reales (lista corta de comprobación: sin `@` de correo, sin
  rutas de usuario).
- Comando: `npm test`. Commit: `test: cuaderno-ejemplo, un solo cuaderno de referencia con su índice`.

### T3 · La ayuda de los tests: base o con kit

- `tests/ayuda.js`: `crearCuaderno({ kit: false | true, crlf, ignorar, obsidianignore })`; sin kit, el cuaderno en
  la raíz; con kit, en `estudio/` más `.kit/motor.json`, `.kit/adaptadores/claude-code.json` y `config/`.
  `NOTAS` lee `cuaderno-ejemplo`. `tests/navegador/ayuda.js`: `arrancar({ kit })`, **por defecto sin kit**.
- Todos los tests pasan a la ayuda nueva **sin cambiar lo que comprueban**; los que cuentan notas, resultados o
  líneas se ajustan uno a uno, con un comentario que dice de dónde sale el número nuevo.
- Comando: `npm test && npm run test:navegador`. Commit: `test: la ayuda monta el cuaderno de ejemplo sin kit o con kit`.

### T4 · Cada modo prueba lo suyo

- Los recorridos generales (lectura, buscador, tareas, tarjetas, ficheros, ocultar, árbol, panel) corren **sin kit**.
- Con kit, solo: notas en `estudio/` (árbol y portada), Guardar/Traer/Deshacer con las herramientas del kit (el test
  real ya existe con `CUADERNO_KIT_PRUEBA`), corregir examen con `examen.js`, el comando del asistente del adaptador,
  Tareas con todas las casillas.
- Comando: `npm test && npm run test:navegador`. Commit: `test: lo general sin kit; con kit, solo lo que añade el kit`.

### T5 · Fuera «sin motor»

- `kit.js`: `detectar` devuelve `kit` o `carpeta`; `guardar.js` sin `sinMotor`; `public/app.js` sin el caso de
  botones desactivados; `servidor.js` sin el comentario. Tests: los 4 que lo usan se borran o pasan a «una carpeta con
  `estudio/` y `config/` sin motor se abre como carpeta» (uno, en `tests/kit.test.js`).
- Comando: `npm test && npm run test:navegador`. Commit: `refactor: fuera el modo «salida del kit sin motor»`.

### T6 · Fuera los ejemplos viejos

- Borrar `ejemplos/curso-demo/` y `ejemplos/vault-demo/` (a la Papelera no: están en git, se recuperan del
  historial); referencias en README, `docs/` y plan vivo; `pruebas/sonda-navegador.js` al ejemplo nuevo.
- `grep -rn "curso-demo\|vault-demo" --exclude-dir=node_modules .` sin resultados salvo el diario del plan vivo.
- Comando: `npm test && npm run test:navegador`. Commit: `chore: fuera curso-demo y vault-demo`.

Cada tarea va en su PR, con la CI en verde antes de mergear.

## Qué revisar

1. **Un test que deja de comprobar algo al mudarse** (por ejemplo, uno que pasaba por casualidad con el kit) → T3:
   el número de tests y de comprobaciones antes y después, por fichero, en la descripción del PR.
2. **Un caso del vault que se pierde al reescribir** → T2: el test de `INDICE.md` y una lista, en el PR, de cada
   cosa que cita el README de `vault-demo` con su fila del índice.
3. **CRLF:** hoy se prueba con el curso; con el cuaderno nuevo, `crlf: true` sigue cubriendo escrituras → T3, el test
   de CRLF de `cuaderno.test.js` sigue igual.
4. **El CI de Windows y macOS** con el cuaderno nuevo (rutas con acentos y espacios) → T2 añade una nota así; la CI de
  los tres sistemas en el PR de T3.
5. **Un cuaderno real abierto como carpeta que antes era «sin motor»** → T5: el test de `kit.test.js`.

## Rondas de abogado del diablo

(pendiente la ronda completa)
