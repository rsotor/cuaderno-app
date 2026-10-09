# El editor con widgets · crítica de diseño (tarea 4)

Fecha: 2026-10-09 · Etapa: refinamiento · Material: 4 capturas del editor sobre el cuaderno de ejemplo copiado a temporal (claro y oscuro, con el cursor en el título y con el cursor dentro de la tabla): `docs/capturas/despues-editor-2026-10-09-{claro,oscuro}-{widgets,cursor-en-tabla}.png`. Referencia: `critica-2026-10-09-edicion-comentarios.md` (la del spike).
Una ronda, con la skill `design:design-critique` (agente `general-purpose`, sonnet). El contraste del modo oscuro es estimación a ojo del agente, no medido.

Resumen: **8 objeciones: 5 aplicadas, 1 aplicada en parte, 2 razonadas.** Lo que seguía sin atender de la crítica del spike: D4 (propiedades arriba, objeción 2), D8c (sangrías de viñetas, 6), D10 (Aplicar siempre activo, 8) y A3 (línea activa demasiado suave, 4).

| # | Objeción | Decisión | Por qué |
|---|---|---|---|
| 1 | Entrar en la tabla cambia su altura (widget ~100 px, Markdown crudo ~95 px) y sube lo de debajo; el cursor queda pegado a la primera `\|` | **Razonada** | Que con el cursor dentro se vea el crudo es la decisión del plan (§3, «Widgets»). Mantener la vista previa debajo mientras se escribe es otro diseño y cuesta más; se decide con uso real. El salto es de unos píxeles y solo ocurre al entrar |
| 2 | Las propiedades van antes del título (en lectura, debajo) y parecen editables | **Razonada** | El frontmatter es lo primero del fichero y el editor no reordena el documento; moverlo bajo el título sería otro widget que no corresponde a su posición. Sí es solo lectura de verdad (el cursor las salta y no se escribe en ellas: recorrido «propiedades»). Si con uso confunde, la etiqueta «solo lectura» es una línea de CSS; queda anotado como duda para Roberto |
| 3 | Ritmo vertical desigual: ~80 px del párrafo al H2, huecos de ~38 px entre bloques | **Aplicada** | Las líneas en blanco son un renglón entero: ahora llevan `live-vacia` (0,7 em) salvo la del cursor; `.live-h2` baja a 14 px de relleno y el widget a 4 px |
| 4 | Oscuro: casilla pendiente gris sobre gris, barra de la cita y línea activa casi invisibles | **Aplicada** | Borde de la casilla y barra de la cita con `--tinta-suave`; la línea activa pasa a `color-mix(--tinta 7%)`, que sigue al tema (en claro y oscuro se ve igual) |
| 5 | El `#` del título pesa lo mismo que el título | **Aplicada** | Cuando se ve (línea activa) lleva `live-marca`: `--tinta-suave` y peso normal. El «salto de 2 px» al activar la línea no lo he podido comprobar y no lo toco |
| 6 | Viñeta y casillas con distinta sangría | **Aplicada** | Viñeta de 1,5 em; casilla de 16 px + 0,5 em de margen: el texto empieza en la misma x |
| 7 | El marco de foco queda a 5 px del texto | **Aplicada** | `outline-offset` de 12 px dentro del aire de la hoja |
| 8 | La pista «⌘ Enter aplica» queda a medias del pie y Aplicar no dice si hay cambios | **En parte** | Aplicada la pista: la clase global `.pista` lleva `margin-right:auto` y la dejaba a medias; ahora va a la derecha. Razonado «Aplicar sin estado»: el indicador «sin aplicar» y el diálogo de descartar son de la tarea 5 |
