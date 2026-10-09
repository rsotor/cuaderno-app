# Edición y comentarios · auditoría de accesibilidad (tarea 9)

Fecha: 2026-10-09 · Estándar: WCAG 2.1 AA · Una ronda, con la skill `design:accessibility-review` (agente `general-purpose`, sonnet) **midiendo con Playwright/Chromium sobre la app corriendo** (cuaderno de ejemplo copiado a temporal, sin kit, editor «con vista»; ningún cuaderno real). Referencia: la parte 2 de `critica-2026-10-09-edicion-comentarios.md` (auditoría del spike) y `critica-2026-10-09-editor.md` / `-comentar.md`.

Resumen: **11 hallazgos: 0 críticos, 3 mayores, 5 medios, 3 menores.** Aplicados 7, 1 en parte, 3 razonados. Pasa: contraste de texto y de foco en claro y oscuro (todo ≥ 4,5:1; anillo de foco 5,8 a 10,6:1), foco inicial, Esc, trampa e `inert` del diálogo de descartar, barra con flechas, roles y nombres. No medido (queda a mano): ver al final.

Medido (claro / oscuro): texto del editor sobre la hoja 16,6 / 13,4; «#» de título en la línea activa 5,5 / 5,6; botón de la barra 6,3 / 6,7 (pulsado 6,0 / 7,5); subrayado: texto sobre el rotulador 13,5 / 7,0, enlace dentro del rotulador 5,6 / 4,8, subrayado inferior contra la hoja 6,3 / 6,7; «Editando» 5,1 / 7,1; botón flotante 7,1 / 10,1; caja e hilo 13,4 a 16,6.

| # | Hallazgo (dato medido) | Severidad | Decisión | Por qué |
|---|---|---|---|---|
| 1 | Elegir un fragmento para comentar no se podía con teclado: con el bloque enfocado, Mayús + flechas dejaba la selección vacía (el navegador solo amplía una selección que ya existe). 2.1.1 | Mayor | **Aplicada** | Mayús + → / ← sobre un bloque enfocado sin selección la crea (desde el principio o desde el final del bloque) y desde ahí las flechas siguen; `c` comenta el fragmento. Recorrido «selección solo con teclado» en `comentar.test.js` |
| 2 | En `forced-colors`, el botón de la barra pulsado (`aria-pressed`) se veía idéntico al no pulsado: el estado solo iba por color. 1.4.1 / 1.4.11 | Mayor | **Aplicada** | Borde de 3 px y `Highlight`/`HighlightText` en `forced-colors`; recorrido en `edicion.test.js` («accesibilidad…») |
| 3 | Tras comentar con Ctrl/⌘ Enter el foco se perdía en el `body` (la nota se repinta). 2.4.3 | Mayor | **Aplicada** | Tras repintar, el foco va al texto comentado o, sin cita, al bloque. Comprobado en el recorrido «comentar con el teclado» |
| 4 | Las casillas del editor se llamaban solo «Casilla», tenían `tabindex -1` y se marcan con ratón. 4.1.2 / 2.1.1 | Medio | **En parte** | Aplicado el nombre: «Casilla: texto de la tarea». El `tabindex -1` se queda: con teclado se cambia el `[ ]` de la línea activa, donde se ve el Markdown crudo (y el modo plano lo enseña siempre); hacerlas parada de Tab llenaría el orden de foco de una nota con muchas tareas |
| 5 | «Editando» aparecía sin anunciarse (span sin rol ni `aria-live`). 4.1.3 | Medio | **Aplicada** | Región `role="status"` oculta visualmente (`#editando-aviso`) con «Editando: hay cambios sin aplicar», vacía al deshacer o salir |
| 6 | En `forced-colors`, el diálogo «¿Descartar lo escrito?» sin borde ni sombra: se fundía con la página. 1.4.11 | Medio | **Aplicada** | Borde de 2 px `CanvasText` en `forced-colors` |
| 7 | Borde del textarea de la caja de comentar contra su fondo: 1,20 / 1,36. 1.4.11 | Medio | **Aplicada** | Borde con `--tinta-suave` (6,3:1 / 6,7:1) |
| 8 | Objetivos táctiles a 390 px: barra de formato 34×32, Aplicar y Cancelar 40 de alto, subrayado 26, casillas 16. Pasan 2.5.8 (24 px) pero no los 44 que apunta el plan. | Menor | **Aplicada** (barra y pie) | `@media (pointer: coarse)`: 44 px en la barra y en Aplicar/Cancelar. El subrayado y las casillas son texto en línea y casillas nativas: su altura es la de la línea |
| 9 | Botones de la barra no pulsados y «Cancelar»: borde 1,29 / 1,24 contra el fondo. 1.4.11 | Menor | **Razonada** | El icono o el texto del botón (6,3:1) lo identifica y el borde no es lo único que lo delimita; subir todos los bordes de botón de la app es otra tanda (token común), no de este bloque |
| 10 | «Ocultar el hilo» (×) y «Cerrar comentario» podrían confundirse; propone «Resolver». 2.4.6 | Menor | **Razonada** | «Cerrar» es palabra de Roberto (plan §3): el comentario es una pregunta del alumno y él decide cuándo sobra. La × ya dice «Ocultar el hilo»; «Resuelto» sin borrar está en el Inbox del bloque |
| 11 | Un bloque ya comentado «no admite» comentar otro texto: sin aviso. | Menor | **Razonada** | Lo que no admite es seleccionar dentro del callout del propio comentario (no se comenta un comentario); el párrafo comentado sí admite más comentarios (recorrido «dos comentarios en el mismo párrafo») |

## Prueba a mano de Roberto

Lo que solo puede probar una persona con VoiceOver (⌘ F5 en Mac) o con el ratón: no se midió.

Con una copia del cuaderno de ejemplo (`cp -R ejemplos/cuaderno-ejemplo cuadernos-prueba/ejemplo` y abrir esa carpeta; nunca un cuaderno real), en Safari o Chrome:

1. **Editor en modo plano.** Ajustes → «Editor: Markdown plano». Abre `render/propiedades.md`, pulsa **Editar** (o `e`). Con VoiceOver: ¿anuncia «Editor de la nota, área de texto»? Recorre el texto con las flechas, línea a línea: ¿lee el Markdown tal cual (`#`, `**`, `- [ ]`)? Pulsa Tab: ¿llega la barra de formato como «Formato, barra de herramientas» con un solo Tab, y las flechas cambian de botón con su estado «activado/desactivado»?
2. **Editor con vista.** Ajustes → «Con vista». Abre `render/codigo-y-formulas.md` y entra a editar. Recorre con las flechas: ¿cómo suenan los marcadores ocultos, la fórmula, el bloque de código y las propiedades de arriba (¿se leen como tabla y se saltan con el cursor)? Cambia una palabra y mira si anuncia «Editando: hay cambios sin aplicar». Esc: ¿pregunta «¿Descartar lo escrito?», con el foco en «Seguir editando»?
3. **Comentar por selección.** En lectura (sin editar), abre `comentarios/nota-comentada.md`. Selecciona «interés cada año» con el cursor de VoiceOver (o con Mayús + flechas sobre el párrafo enfocado). ¿Se anuncia o se alcanza el botón flotante «Comentar»? Si no, pulsa `c`: ¿se abre la caja con el foco en «Tu comentario»? Escribe, Ctrl/⌘ Enter: ¿el foco vuelve al texto comentado y se anuncia «Comentario añadido a la nota»?
4. **Hilo.** Tab hasta el texto subrayado («capital inicial»): ¿se lee como botón dentro de la frase? Enter: ¿se abre «Comentario» con la cita, el autor y el texto? Esc: ¿el foco vuelve al subrayado? «Cerrar comentario»: ¿se anuncia «Comentario cerrado · Deshacer»? Pulsa Deshacer en los 5 segundos.
5. **Conflicto.** Con el editor abierto y texto escrito, cambia la nota desde otra aplicación y guarda: ¿se anuncia la franja «La nota cambió en el disco» sin pisar otros avisos?

Además, sin medir: zoom al 200 %, reflow a 320 px, espaciado de texto (1.4.12), el teclado virtual sobre la caja fija en el móvil y el movimiento reducido.
