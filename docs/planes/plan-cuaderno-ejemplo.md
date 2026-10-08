# Plan · un solo cuaderno de ejemplo, la app sin kit como base y el kit como capa

**2026-10-09 · estado: hecho** (T1 a T6 en los PR #8 a #13; además T7, a petición de Roberto: suelo del 85 % de cobertura y un test por ruta de la API, PR #14). Decisiones de Roberto en la conversación del 2026-10-09 (literal o casi):
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

## Modos: dos para probar, y el curso del kit sin motor como caso del modo con kit

| Lo que cambia | Base (sin kit) | Con kit |
|---|---|---|
| Dónde están las notas | la raíz | `estudio/` |
| Guardar, Traer, Deshacer | git directo | `guardar.js` y `deshacer.js` del kit |
| Terminal / asistente | el comando de Ajustes | el del adaptador del kit |
| Examen | el formulario se pinta y guarda las respuestas en la nota (es Markdown); sin botón «Corregir» | además, «Corregir» con `examen.js --corregir` |
| Panel Tareas | solo `tareas.md` | todas las casillas, salvo examen y tarjetas |

**«Sin motor» se queda, como un caso del modo con kit, no como un tercer modo** (ronda completa, objeción 1): el kit
lo contempla («un curso a medio reparar puede no tener motor.json», `profesor-kit/.kit/herramientas/guardar.js`), y
tratarlo como carpeta haría git directo sobre un curso del kit, saltándose las comprobaciones de su `guardar.js`
(remoto privado, no el repo del kit, secretos). Sigue igual: notas en `estudio/`, Guardar desactivado con su motivo.
Un solo test lo cubre: ahí no se hace commit.

## El cuaderno, por elementos (no por uso)

Un tema inventado y neutro (finanzas personales, el del curso de hoy), notas de 5 a 30 líneas:

| Elemento | Qué cubre | Dónde |
|---|---|---|
| Nota y su render | títulos, párrafos, listas, tablas, código, fórmulas, callouts de cada tipo, imágenes (Markdown y `![[ ]]`), `@@` | 3–4 notas cortas |
| Frontmatter | strings, listas, números, booleanos, fechas, `tipo` | repartido en las mismas notas |
| Enlaces | `[[nota]]`, `[[ruta/nota\|alias]]`, `[[nota#Encabezado]]`, alias escapado en tabla, enlace a nota que no existe, enlace relativo Markdown, enlace a fichero con extensión, backlinks | repartido |
| Casillas y tareas | `tareas.md`, casillas en otras notas, etiquetas, enlaces en tareas | `tareas.md` y 1–2 notas |
| Formatos del kit | examen (formulario), tarjetas, nota que regenera el profesor (`> Lo genera tu profesor`) | 3 notas |

Decisión explícita (objeción 7, palabras de Roberto: «el examen es lógica de un kit; si acaso es un botón que aparece
en un examen»): **pintar** un examen o unas tarjetas es render de un formato de Markdown y vale en cualquier cuaderno;
**corregir** es del kit y solo aparece con kit (principio 2).
| Ficheros que no son notas | PDF, JSON, JSON roto, CSV, TXT, HTML con script, PNG | carpeta `material/` (la de hoy) |
| Estructura | carpetas anidadas, carpeta `_archive` (oculta por empezar por `_`), dos notas con el mismo título, nombre con acentos y espacios | carpetas |
| Ignorados | `node_modules/`, fichero oculto, `.gitignore`, `.obsidianignore` | lo crea la ayuda (como hoy) |

El índice vive **fuera** del cuaderno, en `ejemplos/cuaderno-ejemplo.md` (objeción 4): dentro saldría en el árbol, el
buscador, los conteos y los backlinks, y llevaría nombres de tests a un cuaderno que se abre a mano. Es la tabla
característica → nota → test que la prueba.

## Regla nueva en AGENTS.md (Convenciones)

> **Cada desarrollo trae su caso al cuaderno de ejemplo.** Lo que la app aprende a pintar o hacer se añade a
> `ejemplos/cuaderno-ejemplo/`, **en una nota o carpeta nueva** (no se tocan las que ya tienen tests con cifras
> exactas), con su fila en `ejemplos/cuaderno-ejemplo.md` y un test o recorrido que lo use. Así la CI lo cubre. Nunca se escribe en `ejemplos/`: tests y pruebas lo copian.

## Tareas

### T1 · Principio, regla y plan vivo (solo documentos)

- `AGENTS.md`: principio 3 nuevo; sección «Cuadernos de prueba» reescrita (un cuaderno, dos modos, copias en
  `cuadernos-prueba/` para probar a mano); la regla nueva en Convenciones.
- `docs/planes/plan-vivo.md` §6: fila nueva «Cuaderno de ejemplo» y la decisión de los dos modos.
- Sin tests. Commit: `docs: la app como lector de cualquier carpeta y el kit como capa; un solo cuaderno de ejemplo`.

### T2 · El cuaderno de ejemplo

- `ejemplos/cuaderno-ejemplo/` desde `curso-demo` (notas, examen, tarjetas, tareas, `material/`) y lo que aporta
  `vault-demo` (frontmatter variado, variantes de enlace, alias en tabla, enlace a nota que no existe, `@@`,
  `_archive`, imágenes, adjunto PDF), reescrito a notas cortas sobre el mismo tema. `ejemplos/cuaderno-ejemplo.md` con todas
  las filas de la tabla de arriba.
- Test primero, `tests/ejemplo.test.js`: cada nota o fichero que cita el índice existe; ninguna nota pasa de 40
  líneas (que «cada fila tiene un test que la usa» se comprueba en T4, cuando los tests ya leen este cuaderno); no hay nombres reales (lista corta de comprobación: sin `@` de correo, sin
  rutas de usuario).
- Comando: `npm test`. Commit: `test: cuaderno-ejemplo, un solo cuaderno de referencia con su índice`.

### T3 · La ayuda de los tests: base o con kit

- `tests/ayuda.js`: `crearCuaderno({ kit: false | true | 'sin-motor', crlf, ignorar, obsidianignore })` (el texto
  `'sin-motor'` para el único caso de curso sin motor; objeción 2); sin kit, el cuaderno en
  la raíz; con kit, en `estudio/` más `.kit/motor.json`, `.kit/adaptadores/claude-code.json` y `config/`.
  `NOTAS` lee `cuaderno-ejemplo`. `tests/navegador/ayuda.js`: `arrancar({ kit })`, **por defecto sin kit**.
- Todos los tests pasan a la ayuda nueva **sin cambiar lo que comprueban**; los que cuentan notas, resultados o
  líneas se ajustan uno a uno, con un comentario que dice de dónde sale el número nuevo.
- Comando: `npm test && npm run test:navegador`. Commit: `test: la ayuda monta el cuaderno de ejemplo sin kit o con kit`.

### T4 · Cada modo prueba lo suyo

- Los recorridos generales (lectura, buscador, tarjetas, ficheros, ocultar, árbol, panel) corren **sin kit**.
- `tareas.test.js` se parte (objeción 5): **sin kit**, añadir con «+», marcar y desmarcar en `tareas.md`, filtros por
  etiqueta y estado; **con kit**, agrupar por nota (el grupo «1.1 La sesión») y el filtro por nota, porque sin kit
  el panel solo lee `tareas.md`.
- El test de `ejemplo.test.js` añade: cada fila del índice nombra un test que existe y la usa.
- Con kit, solo: notas en `estudio/` (árbol y portada), Guardar/Traer/Deshacer con las herramientas del kit (el test
  real ya existe con `CUADERNO_KIT_PRUEBA`), corregir examen con `examen.js`, el comando del asistente del adaptador,
  Tareas con todas las casillas.
- Comando: `npm test && npm run test:navegador`. Commit: `test: lo general sin kit; con kit, solo lo que añade el kit`.

### T5 · El curso sin motor, un caso del modo con kit

- Sin cambios de código. Tests (objeción 6): los dos de `servidor.test.js` que usaban `'salida-sin-motor'` para
  probar otra cosa (abrir desde «sin cuaderno», recientes, configuración, `/api/olvidar`; el formulario sin kit)
  pasan a `kit: false` y solo cambian la aserción del tipo; se queda **uno** con `'sin-motor'`: Guardar, Traer y
  Deshacer no hacen commit ni lanzan nada y dicen por qué. `formulario.test.js` y `guardar.test.js` lo mismo: lo que
  probaban del formulario o de git, sin kit; lo del sin motor, en ese único test.
- Comando: `npm test && npm run test:navegador`. Commit: `test: el curso sin motor, un solo test en el modo con kit`.

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
5. **Un curso del kit sin motor que reciba git directo** → T5: el único test de ese caso afirma que no hay commit.

## Rondas de abogado del diablo

- 2026-10-09, ronda completa sobre el plan: 7 objeciones, las 7 aplicadas. La que cambia el plan: «sin motor» no se quita (el kit lo contempla y tratarlo como carpeta haría git directo sobre un curso del kit); queda como un caso del modo con kit con un solo test. Además: el orden de tareas no deja la CI en rojo (la ayuda acepta `'sin-motor'`); el índice fuera del cuaderno; la regla pide nota o carpeta nueva, no tocar las que ya tienen cifras; `tareas.test.js` partido entre los dos modos; los tests que usaban «sin motor» para otra cosa se quedan; pintar un examen vale en cualquier cuaderno, corregir solo con kit.
