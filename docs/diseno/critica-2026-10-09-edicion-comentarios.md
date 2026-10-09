# Live preview y comentarios por selección · crítica de diseño + accesibilidad

Fecha: 2026-10-09 · Etapa: spike (refinamiento temprano) · Estándar: WCAG 2.1 AA
Material: 5 capturas de live preview, 1 del prototipo plano, código de `proto-live` (`live.js`, `app.js` ~290-375 y 903, `estilo.css`), revisión previa 2026-10-09.
Límites: no he ejecutado el prototipo; lo que sale del código lo marco «(código)» y lo que sale de capturas «(captura)». Los comentarios no están en el spike: se critica el diseño descrito. Nada con lector de pantalla real (VoiceOver/NVDA): esa parte es inferencia y hay que probarla.

Severidades: Crítico (pierde datos o bloquea) · Mayor · Medio · Menor.

## Resumen

29 hallazgos: **2 críticos, 14 mayores, 4 medios, 9 menores** (parte 1: 13; parte 2: 16; A14 repite D1 desde el teclado).

---

# Parte 1 · Crítica de diseño

## Impresión general

El live preview acierta en lo difícil: en la captura 01 la hoja en edición es casi idéntica a la lectura (misma columna de 800 px, misma tipografía, tabla, callout y fórmula pintados), y los marcadores solo aparecen en la línea del cursor (captura 03). La entrada es coherente con la revisión previa: «Editar» a la derecha de la miga acaba donde acaba el texto, y Aplicar/Cancelar quedan justo donde estaba ese botón. Lo que falta no es estética, es **seguridad al editar**: hoy salir (Esc, Cancelar, otra nota, una recarga en vivo) tira lo escrito sin avisar, y el flujo de comentar mezcla un botón «Cerrar» que borra con un objetivo que es que el profesor lo lea.

## Primera impresión (2 s)

- Lo primero que ve el ojo es la barra de siete botones del mismo peso, y después «Aplicar» (azul). Correcto: la acción principal gana, pero los siete botones de formato compiten con el título de la nota. Captura 01: en lectura el título está a y=105; en edición, a y=247.
- No hay señal de «estás editando» más allá de la barra: la hoja, el borde y el fondo son los de lectura (ver D3).

## Hallazgos

| # | Hallazgo | Sev. | Arreglo mínimo |
|---|----------|------|----------------|
| D1 | **Salir descarta sin avisar y no hay estado «sin aplicar».** `salirEdicion()` destruye el editor y vuelve a leer la nota (código `app.js`, `salirEdicion`); Esc y Cancelar lo llaman directos. Tampoco hay guardia al clicar otra nota del árbol ni `beforeunload`. Escenario: Roberto escribe 3 párrafos, pulsa Esc para cerrar un menú del navegador y los pierde. | Crítico | Marca `sucia` al primer cambio. Esc y Cancelar con cambios piden confirmación («Descartar los cambios» / «Seguir editando»); sin cambios salen directo. Mismo control al navegar y en `beforeunload`. Indicador en la barra: «Cambios sin aplicar». |
| D2 | **La recarga en vivo pisa el editor.** El manejador del WebSocket (`app.js:903`) llama a `abrirNota(rutaActual)` si `#editor` (el diálogo de bloque) está oculto; no mira `edicion`. En edición de nota entera el `#nota.innerHTML` se reescribe mientras `edicion` sigue puesto (código; el commit f584c92 ya apunta a recargas que desprendían el bloque; no reproducido). Es el hallazgo 1 de la revisión previa, ahora con todo el fichero en juego. Además el autosave del repo toca ficheros. | Crítico | Con `edicion` activa, el manejador no repinta esa nota: muestra una franja fija «La nota ha cambiado en el disco» con «Ver cambios» / «Seguir con mi versión». El 409 de Aplicar ya deja el editor abierto (bien): el aviso debe ser persistente, no el toast de 2,2 s. |
| D3 | **Sin señal de modo edición.** Hoja idéntica a lectura (capturas 01 y 05); el botón «Editar» desaparece y aparece la barra. Con `outline:none` y sin línea activa resaltada, el único indicador de foco es un cursor de 1 px (captura 03). Escenario: Roberto vuelve a la pestaña y no sabe si está leyendo o editando. | Mayor | Borde superior de 2 px en `--acento` en la hoja o fondo de barra distinto; la miga dice «Editando»; la línea del cursor con fondo `--acento-suave`. Coherente con el patrón de la hoja de la dirección A. |
| D4 | **Entrar no conserva el sitio y el orden difiere de lectura.** (captura 05 vs 01) En lectura las propiedades van **debajo** del título; en live, el frontmatter es el primer bloque del fichero y queda **encima** (capturas 01/03). El título baja 142 px (barra 57 px más el orden). `editarNota()` solo mapea scroll si viene `lineaBloque`; con el botón o `e` no hay mapeo (código), así que lo de «el mismo punto de scroll» hoy no se cumple. | Mayor | Al entrar, guardar el bloque visible (por `data-desde`) y llevar el cursor y el scroll a esa línea, como ya hace con `lineaBloque`. Decidir un orden único: o live reordena (no, rompe «el fichero es la verdad»), o lectura enseña las propiedades arriba. Recomiendo lo segundo y es lo que ya hace el fichero. |
| D5 | **«Cerrar» borra el comentario.** Para quien lo escribe «cerrar» es descartar o resolver; el plan dice que el profesor lo recoge en la siguiente sesión. Si el alumno lo «cierra» antes, el profesor nunca lo lee, y no hay deshacer. Contradice el principio 1 (la nota es la verdad): un borrado sin rastro. | Mayor | Dos acciones con nombres distintos: «Marcar como resuelto» (queda, atenuado, y lo recoge el profesor) y «Borrar» (confirmación o toast con «Deshacer»). Quién puede resolver (alumno, profesor, ambos) hay que decidirlo antes. |
| D6 | **El flujo de comentar es largo y solo con ratón; en edición no existe.** Seleccionar, botón flotante, escribir, «Comentar» son 4 pasos; el comentario de bloque de hoy eran 2 (icono, escribir). Dentro del live preview la selección es del editor y el botón flotante no está definido; con la nota abierta para editar, un comentario recién escrito dispara el 409 (el propio plan dice «un comentario recién escrito» recarga la nota, `app.js:268`) y el plan vivo sigue sin decidir si los comentarios viven en la nota o en un fichero. | Mayor | Decidir **dónde viven los comentarios** antes de construir; si es en la nota, no se puede comentar con edición abierta (dilo en la UI: «Aplica o cancela para comentar»). Atajo: con texto seleccionado `c` comenta esa cita (no solo el bloque) y `Ctrl Enter` envía. |
| D7 | **Ancla de la cita frágil.** El texto que se subraya es el *renderizado* (negrita, fórmula KaTeX, enlace, tabla) pero el fichero guarda Markdown. Seleccionar «5 %» dentro de `$…$` o a través de dos bloques no tiene equivalente directo en la fuente. «La cita ya no está» saltará con cualquier retoque de formato. Es previsible y no se ha dicho. | Mayor | Guardar cita (texto plano) + línea del bloque + 20 caracteres de contexto; reanclar por contexto y por bloque antes de rendirse. Limitar la v1: selección dentro de un solo bloque de texto; en fórmula, tabla o código, comentar el bloque. En el panel, el huérfano lleva etiqueta «cita perdida» y se puede reubicar. |
| D8 | **Pérdidas de coherencia con la lectura** (capturas 01 vs 05): (a) el enlace roto `no-existe` es rojo con subrayado discontinuo en lectura y azul normal en live (`live-wiki` no sabe si existe), así se pierde el estado de error; (b) las `#etiquetas` de la tarea son píldora en live y texto en lectura; (c) las viñetas están sin sangría (x=470 vs 485) y son más pequeñas; (d) la tabla y el callout salen de `/api/render`, el resto no, y por eso difieren por diseño. | Medio | (a) pasar a `live.js` el mapa de títulos que ya tiene la app y pintar el roto en rojo; (b) una sola regla visual; (c) igualar sangría; (d) si se mantiene la excepción, anotarla en el plan. |
| D9 | **Los bloques en crudo no se pueden editar bien.** Captura 04: la fórmula abierta es `$$ I\|= C \cdot i \cdot t $$` en la fuente proporcional, sin vista previa; una tabla en crudo serán pipes desalineados. El callout plegado (flecha ▸) no se puede leer sin entrar en su fuente (el `mousedown` va al cursor, no abre el `<details>`). | Medio | Bloques crudos en mono y con fondo `rgba(127,127,127,.08)` (ya tienes `live-codigo`); en fórmula, mantener la vista previa debajo mientras el cursor está dentro. Callout: que la flecha lo abra sin mover el cursor. |
| D10 | **Barra de formato: no alterna, no enseña atajos, Aplicar siempre activo.** `formato()` siempre antepone (`## ` dos veces sobre un título, `**` sobre algo ya en negrita); los atajos (Ctrl B, Ctrl I) solo están en `title`; solo texto (lectura usa iconos). | Medio | Alternar (quitar si ya está); atajos visibles en un hint de la barra; Aplicar deshabilitado y «Sin cambios» si el texto no ha cambiado. |
| D11 | **Estados que faltan.** Vacío: una nota en blanco enseña una hoja sin ninguna pista. Carga: la primera entrada hace un `import()` dinámico de CodeMirror sin indicador, y cada widget pide su HTML a `/api/render` (`estimatedHeight` 60 px, «…» hasta que llega): en una nota larga el scroll saltará al llegar las alturas reales. Error: si falla un render, el bloque enseña su Markdown sin aviso. | Medio | Vacío: placeholder «Escribe aquí…». Carga: «Abriendo el editor…» en la barra. Reservar altura por tipo de bloque y precargar al entrar (como el cache por texto). Error de render: borde discontinuo y «No se pudo pintar; se ve el Markdown». |
| D12 | **Amarillo rotulador ajeno al sistema y ambiguo.** La paleta es sobria (azul acento, ocre de aviso `#7a4a00`) y el amarillo vivo se convierte en el elemento más llamativo de la hoja: con varios comentarios la nota deja de leerse. Además «subrayado amarillo» se leerá como «resaltar», una función que la app podría añadir luego. | Menor | Más suave (color-mix del amarillo al 35 % sobre papel) y subrayado inferior de 2 px además del fondo; una marca numerada en el margen. Reservar el amarillo para comentarios. |
| D13 | **Dos superficies para lo mismo** (popover del subrayado y panel Comentarios) y «hilo» sin respuestas. | Menor | O el popover es el hilo con respuestas, o se llama «comentario». Decidirlo con el profesor-kit, no solo la app. |

## Jerarquía

- **Qué atrae primero:** la barra de formato. Correcto en edición, pero compite con el título; con la nota larga la barra es sticky (`top:44px`) y quita 57 px de la pantalla (hoy, 900 px de alto: 6 %).
- **Lectura:** miga, barra, propiedades, título. El orden propiedades-antes-que-título solo en live (D4) rompe el patrón.
- **Énfasis:** «Aplicar» azul y «Cancelar» neutro: bien. «Editar» como botón secundario en la miga: correcto, no compite con el texto.

## Qué funciona

- Entrada explícita por botón o `e`, sin doble clic: evita editar por accidente (era la queja del hallazgo 4 de la revisión previa).
- Marcadores solo en la línea del cursor: la lectura sigue siendo lectura (captura 03).
- Mismo sitio para «Editar» y «Aplicar»: el ojo no busca.
- La hoja de edición reutiliza los tokens de color de la app, claro y oscuro funcionan sin cambios (capturas 01 y 02).
- El 409 ya no cierra el editor (código `aplicarEdicion`: sale solo si va bien); es lo que pedía el hallazgo 1.

---

# Parte 2 · Auditoría de accesibilidad WCAG 2.1 AA

## Contraste (calculado)

Fórmula WCAG 2.1 de luminancia relativa sobre los tokens de `estilo.css`.

| Elemento | Texto | Fondo | Ratio | Mín. | ¿Pasa? |
|---|---|---|---|---|---|
| Claro · texto normal sobre amarillo | `#1b1b1f` | `#ffe45c` | **13,49:1** | 4,5 | Sí |
| Claro · enlace (acento) sobre amarillo | `#1e5a96` | `#ffe45c` | **5,58:1** | 4,5 | Sí |
| Claro · texto suave (tareas hechas, citas) sobre amarillo | `#5a5e66` | `#ffe45c` | **5,11:1** | 4,5 | Sí |
| Oscuro · texto normal sobre ocre | `#e6e6e6` | `#6b5a00` | **5,45:1** | 4,5 | Sí |
| Oscuro · enlace (acento) sobre ocre | `#8cc8f0` | `#6b5a00` | **3,77:1** | 4,5 | **No** |
| Oscuro · texto suave sobre ocre | `#a0a4ab` | `#6b5a00` | **2,72:1** | 4,5 | **No** |
| Claro · amarillo frente a la hoja (no texto) | `#ffe45c` | `#fbfbfc` | **1,23:1** | 3 | **No** (si es el único indicio) |
| Oscuro · ocre frente a la hoja (no texto) | `#6b5a00` | `#1c1e23` | **2,45:1** | 3 | **No** (si es el único indicio) |
| Claro · selección del editor frente a la hoja | `#e3ecfa` | `#fbfbfc` | **1,15:1** | 3 | No |
| Oscuro · selección del editor frente a la hoja | `#22303c` | `#1c1e23` | **1,26:1** | 3 | No |
| Texto sobre la selección (claro / oscuro) | | | 14,43 / 10,81 | 4,5 | Sí |

Dentro de un subrayado, el texto normal pasa en los dos temas; fallan, en oscuro, los enlaces y el texto atenuado que caigan dentro del subrayado (muy probable: «Ver [[capital]]» o una tarea hecha comentadas).

## Hallazgos

### Perceptible

| # | Hallazgo | Criterio | Sev. | Arreglo mínimo |
|---|---|---|---|---|
| A1 | **Oscuro: enlaces (3,77:1) y texto suave (2,72:1) dentro del subrayado fallan.** | 1.4.3 | Mayor | Un ocre más oscuro (probar `#4a3f00`, comprobar ≥4,5 con `--acento` y `--tinta-suave`) o, mejor, mantener el fondo del tema y marcar con subrayado inferior grueso en ocre claro (no depende del contraste del fondo). |
| A2 | **El subrayado amarillo es el único indicio** de que hay un comentario: solo color (1,23:1 y 2,45:1 frente a la hoja) y desaparece en modo de alto contraste, donde el navegador quita los fondos. | 1.4.1, 1.4.11 | Mayor | Añadir `text-decoration: underline 2px` (con `text-decoration-style: wavy` o sólido) y una marca en el margen (número o icono); `@media (forced-colors: active) { .comentado { background: Mark; color: MarkText; } }`. |
| A3 | **Selección del editor a 1,15:1 y 1,26:1** (`--acento-suave`). Es lo que ve quien va a negrita o comentar. El foco del editor es solo un cursor de 1 px. | 1.4.11, 2.4.7 | Menor | Selección en un tono con ≥3:1 frente a la hoja manteniendo ≥4,5:1 con el texto; comprobar con la misma fórmula. |
| A4 | **Estructura perdida para el lector en el live preview.** Los títulos son `div.cm-line` con clase (no `h1`/`h2`), los enlaces son `span` (no `a`), las listas no son listas, y los marcadores ocultos con `Decoration.replace` ya no están en el DOM, así que el lector no oye «título nivel 1» ni «enlace». La tabla y el callout (widgets `contenteditable=false`) sí conservan su estructura. Inferencia por el código; sin probar con VoiceOver. | 1.3.1, 4.1.2 | Mayor | Etiquetar el editor (`EditorView.contentAttributes.of({'aria-label':'Nota en Markdown'})`) y ofrecer **«Editar en Markdown plano»** (CodeMirror sin decoraciones del live, o un textarea) como alternativa de primera clase, recordada en Ajustes. La lectura sigue siendo la versión accesible. |
| A5 | **La casilla del live se llama «Casilla»** (`aria-label` genérico) y mide 16×16 px; no dice qué tarea marca. En lectura es la misma queja (hallazgo 10). | 4.1.2, 2.5.5/2.5.8 | Menor | `aria-label` con el texto de la tarea; ampliar el objetivo con padding (24×24 mínimo). |
| A6 | **Reflow no verificado:** tabla y callout son widgets con `white-space: normal` en una hoja de 800 px; con zoom 400 % (equivale a 320 px) la tabla de tres columnas puede forzar scroll horizontal dentro del editor. | 1.4.10 | Menor | Probarlo; si desborda, `overflow-x: auto` en `.live-tabla` con `tabindex=0` y nombre. |

### Operable

| # | Hallazgo | Criterio | Sev. | Arreglo mínimo |
|---|---|---|---|---|
| A7 | **Sin indicador de foco en el editor:** `.cm-focused { outline: none }` y no se pinta otro; el foco es el cursor de 1 px (captura 03). | 2.4.7 | Mayor | Contorno de 2 px `--acento` en `#edicion-live:focus-within`, o la línea activa con fondo. |
| A8 | **El foco no vuelve al salir.** `salirEdicion()` → `abrirNota()` reescribe `#nota.innerHTML`: el elemento enfocado se destruye y el foco cae en `body`. Quien usa teclado vuelve a empezar desde el principio de la página. Tampoco se anuncia el cambio de modo al entrar (la barra aparece, el foco salta al editor). | 2.4.3, 4.1.3 | Mayor | Tras salir, foco al botón «Editar» (o al bloque de donde se partió). Al entrar, `role="status"` oculto: «Editando la nota. Esc cancela, Ctrl Enter aplica.» |
| A9 | **Atajos de una sola tecla `e` y `c`.** Con la regla 2.1.4 deben poder desactivarse o remapearse, o estar activos solo con el foco en el componente. `c` por bloque enfocado cumple; `e` («Editar la nota entera (tecla E)») es global y hay que asegurar que no salta dentro de `.cm-content`, del textarea de comentario, del buscador ni de ningún `input`. No he visto ese filtro en el spike. | 2.1.4 | Mayor | Ignorar si `e.target` es editable (`input, textarea, [contenteditable]`) o lleva modificadores; limitar `e` a la zona de la nota; opción en Ajustes «Atajos de una tecla» para apagarlos. |
| A10 | **Comentar sin ratón no es posible.** Seleccionar texto en lectura exige ratón (sin modo cursor del navegador no hay selección con teclado) y el botón flotante nace en `mouseup`. `c` comenta el bloque sin cita: pierde precisión. | 2.1.1 | Mayor | Con el bloque enfocado, `Mayús+→/←` extiende una selección propia (o `c` con selección activa usa esa cita); el botón flotante aparece en `selectionchange`, es alcanzable con Tab y tiene atajo (`Ctrl Alt M`); Esc lo cierra y devuelve el foco al texto. |
| A11 | **El subrayado y su cajita no son operables.** Si es `<mark>` con un clic, no es focusable ni tiene rol. La cajita (textarea + «Comentar») debe recibir el foco al abrir, retenerlo (los diálogos de la revisión previa ya dejaban escapar el foco: hallazgo 8), cerrar con Esc y devolver el foco al subrayado. | 2.1.1, 2.4.3, 4.1.2 | Mayor | `<mark><button class="comentado" aria-haspopup="dialog" aria-label="Comentario sobre «…»"></button></mark>` o `role=button tabindex=0`; popover con `role="dialog"` no modal, `aria-labelledby`, foco al textarea, Esc cierra y devuelve foco; `inert` si es modal. El textarea con etiqueta visible o `aria-label="Tu comentario"`. |
| A12 | **Objetivos táctiles.** Barra de formato: `min-height: 28px` (cumple 24 px de 2.5.8 de WCAG 2.2, no los 44 px de 2.5.5, AAA en 2.1). Casilla: 16 px. Botón flotante: sin medidas definidas; al seleccionar con el dedo, los controles del sistema (copiar, buscar, compartir) aparecen justo ahí y lo tapan. | 2.5.5 (AAA), 2.5.8 (2.2) | Menor | Flotante ≥ 44×44 px en táctil, con 12 px de separación de la selección y fuera del hueco del menú del sistema (debajo de la selección); en táctil, además, el botón «Comentar» fijo en la barra. |
| A13 | **`role="toolbar"` sin navegación por flechas** (patrón ARIA de toolbar: un solo Tab y flechas entre botones). Con 7 + 2 botones son 9 paradas de Tab antes del texto. Los atajos solo viven en `title`. | 2.1.1, 1.4.13, 4.1.2 | Menor | O quitar `role=toolbar` o implementar flechas (roving tabindex); `aria-keyshortcuts="Control+B"` y hint visible. |
| A14 | **Esc descarta** (ver D1): para quien usa teclado y lector, Esc es la tecla «salir de modo» y se pulsa por reflejo. | 2.1.1 (uso), 3.3.4 no aplica | Mayor (con D1) | Misma salida de D1: confirmar solo si hay cambios. |
| A15 | **El cursor revela y oculta marcadores al moverse** (cambia la línea). Con lupa o con lectura por línea el texto «salta»; widgets `ignoreEvent` con enlaces dentro de tablas y callouts pueden dar paradas de Tab inesperadas dentro de una zona editable. Tab sale del editor porque `defaultKeymap` no lo liga (bien: no hay trampa de teclado) pero tampoco sangra listas. | 2.1.2 (cumple), 3.2.2 | Menor | Probar; `tabindex=-1` en lo interactivo de widgets; Tab para sangrar solo si se ofrece una salida (Esc luego Tab). |

### Comprensible / Robusto

| # | Hallazgo | Criterio | Sev. | Arreglo mínimo |
|---|---|---|---|---|
| A16 | **Mensajes de estado.** «Nota escrita» sale con `role=status` (bien). Los errores usan `role=alert`, pero el conflicto (409) y «la cita ya no está» deben quedarse hasta que se atiendan; hoy los toasts duran 2,2 s. Falta anunciar «Comentario añadido» y el cambio del contador del panel. | 4.1.3, 2.2.1 | Menor | Errores persistentes con botón de cierre; `aria-live="polite"` en el contador de Comentarios. |

## Teclado: tabla de comportamientos

| Elemento | Tab | Enter/Espacio | Esc | Flechas |
|---|---|---|---|---|
| Botón «Editar» | Sí (miga) | Entra en edición | n/a | n/a |
| Editor (CodeMirror) | Una parada; **sale con Tab** (no hay trampa) | Salto de línea | **Descarta todo sin avisar** (D1) | Mueven el cursor y revelan los marcadores |
| Barra de formato | 7 paradas, sin flechas (A13) | Aplica el formato (no alterna: D10) | Descarta | n/a |
| Cancelar / Aplicar | Sí | Cancelar descarta; Aplicar escribe | Descarta | n/a |
| Ctrl Enter | n/a | Aplica | n/a | n/a |
| Casilla del live | Sí (dentro de zona editable) | Espacio marca | n/a | n/a |
| Botón flotante «Comentar» (propuesta) | **No definido** | n/a | n/a | n/a |
| Subrayado de comentario (propuesta) | **No definido** | n/a | n/a | n/a |
| `c` en bloque enfocado | n/a | Comenta el bloque | n/a | n/a |

## Lector de pantalla (inferido, sin probar)

| Elemento | Se anuncia como | Problema |
|---|---|---|
| Editor | «cuadro de edición, multilínea» (sin nombre propio salvo el `role=group` «Nota en Markdown») | Falta `aria-label` en el propio `.cm-content` (A4) |
| Título en live | Texto plano | Sin nivel de título (A4) |
| Enlace en live | Texto plano | Sin «enlace» (A4) |
| Marcadores ocultos | No se oyen | Aceptable fuera de la línea activa; en la línea activa se leen en crudo |
| Casilla | «Casilla, casilla de verificación, marcada» | No dice qué tarea (A5) |
| Tabla / callout | Estructura conservada | Dentro de zona editable: el modo de navegación del lector puede no entrar (probar) |
| Subrayado de comentario | Texto plano | Sin indicio de que hay comentario (A11) |

---

# Para el plan (8 puntos, por importancia)

1. **Proteger lo escrito (D1, D2, A14).** Estado «sin aplicar»; confirmar solo al descartar con cambios (Esc, Cancelar, navegar, `beforeunload`); con la edición abierta, la recarga en vivo no repinta esa nota y enseña una franja persistente de conflicto.
2. **Decidir antes de construir dónde viven los comentarios y cómo se ancla la cita (D6, D7).** Cita + línea + contexto; v1 solo dentro de un bloque de texto; si viven en la nota, no se comenta con la edición abierta.
3. **«Cerrar» deja de borrar (D5).** «Resuelto» (queda, lo recoge el profesor) y «Borrar» (con deshacer); quién puede cada cosa.
4. **Comentar sin ratón (A10, A11, A9).** `c` con selección usa la cita; botón flotante en `selectionchange`, alcanzable y con atajo; subrayado como botón; foco al textarea, Esc devuelve el foco; `e` y `c` ignoran lo editable y se pueden apagar.
5. **Foco y estructura del editor (A7, A8, A4).** Contorno visible, foco de vuelta al botón «Editar» al salir, anuncio de modo, `aria-label` en el editor, y **«Editar en Markdown plano»** como alternativa para lector de pantalla (probar con VoiceOver antes de cerrar la fase).
6. **El subrayado no depende solo del color (A1, A2, D12).** Subrayado inferior más marca en el margen, ocre oscuro corregido (enlaces 3,77:1 y suave 2,72:1 fallan), `forced-colors`; amarillo más suave.
7. **Entrar sin salto y con lectura coherente (D4, D8, D3).** Mapear scroll al bloque visible, propiedades en el mismo sitio que en lectura, enlace roto en rojo, señal de «Editando» (borde, miga, línea activa).
8. **Cuidar los bloques en crudo y los estados (D9, D10, D11, A12).** Mono y vista previa en fórmula, callout que se abre, formato que alterna, placeholder de nota vacía, altura reservada de widgets, objetivos de 44 px en táctil.

Para los puntos 1-4 conviene una ronda de `devils-advocate` antes de escribir código; el 5 se cierra solo con una prueba con lector real.
