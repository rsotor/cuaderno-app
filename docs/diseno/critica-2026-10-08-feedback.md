# cuaderno-app · crítica de diseño, tanda de feedback con contenido real, 2026-10-08

**Alcance:** los cuatro puntos de Roberto tras usar la app con su contenido: (1) los bloques ya no cambian de fondo al pasar el ratón y editar / comentar son dos iconos en el margen izquierdo; (2) las carpetas que empiezan por `_` no salen en el árbol ni en el buscador; (3) las imágenes salen en el árbol y tienen visor; (4) botón de papelera en cada fichero del árbol y en la miga, sin confirmar. Las tres decisiones de Roberto (sin fondo, iconos en el margen, papelera sin confirmar) no se discuten: se critica la ejecución. Tema claro y oscuro, 1280 px. Método: `design-critique` sobre `antes-` y `despues-{bloque-hover,bloque-hover-oscuro,arbol-fila-hover,imagen,vault-arbol}-2026-10-08.png` y `public/estilo.css`.

## Objeciones (por impacto) y qué se hizo

**1. Los iconos del bloque no estaban a la altura de su primera línea.** El lápiz quedaba 14 px por encima de la primera casilla y el bocadillo entre dos líneas; en un `h2` habrían flotado en el hueco de encima. Causa: `top` se medía desde el borde del bloque y el texto empieza tras el margen de su primer hijo (el relleno de 1 px del bloque impedía que ese margen saliera fuera).
→ **Aplicada.** El bloque ya no tiene relleno arriba ni abajo: el margen de su primer hijo sale fuera y el bloque empieza en su primera línea; los iconos a `top: -1px`, centrados en una línea de 24 px. Efecto de paso: los márgenes de dos bloques seguidos ya no se suman (antes, 30 px entre dos párrafos; ahora 15, lo normal en Markdown), en la línea de la nota de Roberto del 2026-10-07 sobre el aire entre titulares. El recorrido de navegador comprueba que el lápiz está a la altura de la primera línea.

**2. El árbol cortaba los nombres aunque no hubiera ratón encima.** El sitio de los dos botones (60 px) se reservaba en todas las filas: «Flashcards · 01-01-01-…», «Panel de estación e…».
→ **Aplicada.** El nombre ocupa la fila entera; el sitio de los botones solo se reserva con la fila bajo el ratón o con el foco, y siempre en pantallas táctiles.

**3. La papelera, pegada al botón del Finder, sin confirmar.** Dos dianas de 26 px sin hueco: un fallo de un píxel manda el fichero a la papelera.
→ **Aplicada.** 6 px entre los dos botones de la fila y 10 px en la miga. El rojo al pasar el ratón se queda (≈4,5:1 sobre el gris del hover).

**4. El visor de imagen redondeaba las esquinas de la imagen.** `border-radius: 8px` sobre el propio `<img>` se come las esquinas del contenido.
→ **Aplicada.** 2 px.

## Lo que el crítico da por bueno

Sin fondo y fuera del texto, como se pidió; contraste de los iconos ≈6:1 en claro y ≈7,5:1 en oscuro; el bloque se alarga hacia el margen para que el ratón llegue a los iconos sin perderlos. `_meta` y `_archive` fuera del árbol del vault, que se lee más limpio. Imágenes en el árbol con el mismo trato que el resto de ficheros. Sugerencia sin cambio: iconos del bloque a 15 px; se quedan como los de la miga.
