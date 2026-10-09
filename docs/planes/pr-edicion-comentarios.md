# feat: editor de la nota en live preview y comentarios por selección

(Texto de la PR, temporal: no se commitea. Título arriba; cuerpo debajo.)

## Qué entra

El bloque «edición y comentarios» (`docs/planes/edicion-comentarios.md`), en 9 tareas y un commit cada una:

1. **Servidor, escribir la nota entera y pintar Markdown:** `escribirNota` (conserva el final de línea, el BOM y el salto final; 409 si el original difiere; 422 con finales mezclados), `POST /api/nota/escribir` y `POST /api/render` (el mismo render que la lectura).
2. **CodeMirror 6 sin bundler:** seis paquetes con versión exacta y un import map en `index.html`; editor en modo plano; botón «Editar» en la miga y tecla `e`; Aplicar, Cancelar, Ctrl/⌘ Enter y Esc; ajuste «Editor: con vista / Markdown plano»; `tests/importmap.test.js` y Dependabot agrupado. Se va el icono de editar por bloque.
3. **Live preview de lo inline:** marcadores ocultos salvo en la línea del cursor, títulos, énfasis, enlaces, wikilinks, etiquetas, viñetas, citas y casillas (checkbox real).
4. **Widgets de bloque y propiedades:** fórmula, callout, tabla y código con el HTML de `/api/render` (caché, altura reservada, crudo con el cursor dentro); el frontmatter como tabla de solo lectura. Corrige el clic que caía unas líneas más abajo del spike. Crítica de diseño.
5. **Lo escrito no se pierde:** estado «sin aplicar», diálogo «¿Descartar lo escrito?», `beforeunload`, franja de conflicto con el disco y con el 409 (Sobrescribir / Copiar mi texto y recargar).
6. **Barra de formato y atajos:** negrita, cursiva, título, lista, casilla, enlace y código; Ctrl/⌘ B e I; `role="toolbar"` con flechas y `aria-pressed`.
7. **Servidor, comentarios con cita:** `comentar()` con cita, `comentarios()` con autor, fecha y cita, y `POST /api/comentario/cerrar`, que deja el fichero byte a byte como antes de comentar.
8. **Comentar por selección:** botón flotante y caja (popover no modal), subrayado, hilo, cierre con Deshacer, panel con cita; se van el icono de comentar por bloque y el diálogo `#editor`; carpeta `comentarios/` en el cuaderno de ejemplo. Crítica de diseño.
9. **Accesibilidad, plan vivo y cierre:** auditoría medida con Playwright (7 arreglos aplicados), plan vivo actualizado (§0, §5, §6, §8) con la dependencia CodeMirror justificada (unos 365 KB gzip, solo al pulsar «Editar»).

## Decisiones de Roberto

- El editor es la nota entera en live preview, no un WYSIWYG: el documento es el fichero y nada se re-serializa. Se entra con un botón (o `e`), nunca con doble clic.
- Las propiedades (frontmatter) no se editan en el contenido: se ven arriba como tabla de solo lectura, donde están en el fichero.
- Los comentarios llevan la cita del texto seleccionado en el título del callout (afloja el principio 1 solo para ellos); un comentario con subrayado no pinta su callout.
- «Cerrar comentario» borra el callout y la línea en blanco anterior, nunca la posterior; el alumno decide cuándo sobra.
- La caja de comentar es un popover no modal; el techo de Tab hasta la nota sube a 34.

## Documentos

- Plan y estado: `docs/planes/edicion-comentarios.md`; plan vivo: `docs/planes/plan-vivo.md`.
- Críticas de diseño: `docs/diseno/critica-2026-10-09-edicion-comentarios.md` (spike), `critica-2026-10-09-editor.md` y `critica-2026-10-09-comentar.md`.
- Accesibilidad: `docs/diseno/accesibilidad-2026-10-09-edicion-comentarios.md` (con la «Prueba a mano de Roberto»).

## Cómo probarlo

1. `npm test && npm run test:navegador` (y `npm run test:cobertura`, suelo del 85 %).
2. A mano, con una copia del cuaderno de ejemplo (`cuadernos-prueba/`), nunca uno real: abre `render/codigo-y-formulas.md`, pulsa «Editar» y prueba la barra, Ctrl/⌘ B e I, la tabla de propiedades y Esc con cambios.
3. En `comentarios/nota-comentada.md`: selecciona un texto y comenta; pulsa el subrayado para abrir el hilo; ciérralo y pulsa «Deshacer».
4. Pendiente antes de mergear: la prueba con VoiceOver de la lista del documento de accesibilidad y la CI en verde en los tres sistemas.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_013XD1QXkHe6LHAtYDXbcK3a
