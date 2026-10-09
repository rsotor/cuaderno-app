# cuaderno-app · crítica de diseño, tanda «feedback de uso», 2026-10-09

**Alcance:** (1) aviso fijo «La app se ha actualizado…» con ×; (2) árbol por nombre de fichero, «Vacía» y todos los ficheros; (3) páginas de fichero que la app no enseña (`adjuntos/presupuesto.xlsx`) y de audio (`adjuntos/nota-de-voz.wav`); (4) «Tareas que la mencionan». Tema claro y oscuro a 1280×800 y una a 390 px, con el aviso forzado (`hidden=false`). Método: `design-critique` (impresión, usabilidad, jerarquía, consistencia, accesibilidad) con medidas hechas en el navegador sobre `public/estilo.css:59-63`, `:204-208`, `:336`. Capturas: `docs/capturas/despues-feedback-uso-2026-10-09-*.png`. Usuario final: alumno no técnico.

## Objeciones (por gravedad)

**1. Accesibilidad · en tema oscuro el aviso es casi ilegible: texto blanco sobre ámbar, 2,26:1.**
Se ve: `despues-feedback-uso-2026-10-09-nota-menciones-oscuro.png`. `#aviso-reinicio` usa `background: var(--aviso)` y `color: #fff` fijo (`estilo.css:60`); en oscuro `--aviso` es `#e0a040`. Medido: claro 7,48:1 (bien), oscuro 2,26:1 (mínimo 4,5). Además es el único aviso que dice que la app puede dejar de funcionar.
Escenario: el alumno con tema oscuro lee «Reiníciala para que todo funcione» con esfuerzo y se salta el `Ctrl C` / `run-cuaderno-app`, que son lo accionable.
Arreglo mínimo: `color: var(--sobre-acento)` (en oscuro `#141518` sobre `#e0a040`, ~8:1; en claro sigue siendo blanco) y los fondos de `code`/`kbd` con `color-mix` o `rgba` según tema.

**2. Usabilidad · el aviso tapa la cabecera de la app en lugar de empujarla, y a 390 px se come 93 px.**
Se ve: `…-nota-menciones-claro.png` y `…-nota-menciones-movil.png`. `position: fixed; top: 0` (`:60`) cubre 48 px: en 1280 oculta la marca/nombre del cuaderno y la miga (`#miga`), y deja el título «Ana» pegado al borde del aviso; a 390 px son 93 px (el 12 % de la pantalla) con tres líneas y el × colgando al final de la última.
Escenario: mientras el aviso está (y solo se va si se pulsa ×), el alumno no ve en qué nota está ni el botón de menú; al cerrarlo, todo salta.
Arreglo mínimo: que ocupe sitio (`position: sticky; top: 0` dentro del flujo, o `padding-top` del `body` con la altura del aviso) y el × `position: absolute; right: 8px` para que el texto no lo arrastre.

**3. Consistencia · «Tareas que la mencionan» sale con el estilo de un título de sección, no con el que `.menciones` declara.**
Se ve: `…-nota-menciones-claro.png` / `…-brief-menciones-claro.png`. `.menciones h2` pide 14 px, gris suave y sin borde (`:205`), pero `#nota h2` (`:149`, con id) gana: medido, 21 px, borde inferior y 40 px de margen. Resultado: dos filas bajo la línea de «Enlazan aquí» (la `border-top` de la sección y el borde del h2) y un encabezado más grande que el contenido de las tareas (15 px); la sección secundaria pesa más que el cuerpo de la nota («Mi hermana…», una línea).
Escenario: en una nota corta, lo más llamativo de la pantalla es la lista de tareas de otras notas, no la nota.
Arreglo mínimo: subir especificidad (`#nota .menciones h2`) para que valgan sus 14 px y el `border: 0`, y quitar el margen de 40 px.

**4. Accesibilidad · el × mide 23×32 px: por debajo de 24 de ancho, con un glifo de 18 px.**
Se ve: cualquier captura, esquina derecha del aviso. `#aviso-cerrar` (`:61`): `padding: 0 6px`, sin ancho mínimo. Medido: 22,9×32 px. Con el hover (fondo `rgba(0,0,0,.2)`) queda un rectángulo estrecho y alto.
Escenario: en táctil o con trackpad impreciso se falla el × y se pulsa el `code` de al lado (inerte), sin saber si se ha cerrado.
Arreglo mínimo: `min-width: 32px; min-height: 32px` y `border-radius: 50%`, que de paso da el hover redondo.

**5. Consistencia · «Vacía» tiene poco contraste (≈3:1) y está 4 px a la izquierda de sus hermanos; y una carpeta vacía plegada no se distingue de una con contenido.**
Se ve: `…-arbol-claro.png`. `.carpeta-vacia` usa `var(--tenue, #888)` (`:336`): `--tenue` no existe, cae a `#888` sobre `#eaecef`, ~3:1 con 13 px (mínimo 4,5), y empieza en x = 46 px mientras los ficheros de esa carpeta empiezan en 50. Plegada (`adjuntos/vacia`), tiene el mismo chevron que cualquier otra.
Escenario: el alumno abre «vacia» esperando algo y solo entonces lee «Vacía» en un gris que apenas se ve.
Arreglo mínimo: `color: var(--tinta-suave)` (5,9:1) y `margin-left: 26px`; opcional, atenuar el nombre de la carpeta vacía plegada.

## Lo que está bien y no se toca
- La página de fichero desconocido (`…-xlsx-claro.png`): título, una frase que dice qué pasa y un botón «Mostrar en el Finder» de 185×38 px, único y claro. La de audio (`…-audio-claro.png`) pone el reproductor nativo bajo el título sin más, sin competir.
- El árbol con nombres reales y sin `.md`: `presupuesto.xlsx` y `nota-de-voz.wav` se reconocen a la primera.
- Las menciones: casilla, texto y origen a la derecha (`Agenda de pendientes`) con filas de ~43 px; a 390 px el origen no se rompe y no hay scroll horizontal (`scrollWidth` 390).
- Alineación del aviso con la columna: centrado a pantalla completa, sin competir con el contenido a 1280.

## Veredicto
**Atender antes del commit: la 1** (contraste, una línea de CSS) **y la 3** (especificidad; bug visible en la primera nota con menciones). **La 2, la 4 y la 5** son pequeñas y entran en esta tanda si cuestan poco; si no, al Inbox sin bloquear. La 2 es la que más cambia la sensación de uso.

## Atendidas
Las 5, 2026-10-09. Capturas del después (copia temporal del ejemplo): `despues-feedback-uso-2026-10-09-aviso-{claro,oscuro}-atendido.png` y `…-menciones-{claro,oscuro}-atendido.png`.

1. **Contraste del aviso, hecha.** `color: var(--sobre-acento)` (el token que ya existe) en lugar de `#fff`; el fondo de `code`/`kbd` sale de `color-mix` con el color del texto. Medido: claro 7,48:1, oscuro 8,06:1 (antes 2,26:1).
2. **Aviso empuja la cabecera, hecha.** Sale del `position: fixed`: va en el flujo (`position: relative`) y, mientras está a la vista, el `body` pasa a columna y `#app` ocupa el resto (sin scroll de página: 800 de 800 px). El × va `position: absolute` a la derecha, con `padding-right` en el aviso para que el texto no lo pise.
3. **Estilo de «Tareas que la mencionan», hecha.** `#nota .menciones h2` (gana a `#nota h2`): 14 px, sin borde ni margen superior (medido 14 px / 0 / 0). Cambio de Roberto encima: se quita el enlace de cada tarea a su nota y queda un solo «Ver en Tareas» junto al título, a `#/tareas?nota=<nombre>`; el selector Nota del panel añade ese valor si ninguna tarea la enlaza directamente (las que entran solo por etiqueta o carpeta), para que no salga «Todas» con el filtro puesto.
4. **×, hecha.** 32×32 px (medido) y `border-radius: 50%`; el hover redondo sale de `color-mix`.
5. **«Vacía», hecha.** `var(--tinta-suave)` (5,50:1 sobre el fondo del lateral) y `margin-left: 26px`: empieza en x = 50, como sus hermanos. Opcional sin hacer: atenuar el nombre de la carpeta vacía plegada (no cambia nada que el alumno necesite para actuar).
