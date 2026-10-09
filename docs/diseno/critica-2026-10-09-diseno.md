# Crítica de diseño · tandas 1 y 2 de la revisión de 2026-10-09

**Qué se revisa:** la lectura a 16 px, la hoja (dirección A), la barra lateral apagada y el índice de la nota (dirección C), junto a los arreglos de la tanda 1. **Cómo:** `design-critique` (marco: primera impresión, usabilidad, jerarquía, consistencia, accesibilidad) sobre las capturas del después en claro, oscuro y 390 px: `docs/capturas/despues-diseno-2026-10-09-{claro,oscuro,390}-{nota-larga-indice,nota-con-cajon,tareas,buscador}.png`, hechas sobre una copia temporal del cuaderno de ejemplo. **Etapa:** pulido. Máximo 5 objeciones.

## Primera impresión

La nota se lee: la hoja da un plano claro al texto, la barra lateral deja de competir y el índice cabe sin tocar la hoja. En oscuro la hoja se distingue de la mesa con claridad. Lo que más falla no es la hoja sino lo que la rodea (el buscador y el cajón).

## Contraste medido (WCAG 2.1 AA)

| Par | Claro | Oscuro |
|---|---|---|
| Texto de la nota sobre la hoja | 16,6:1 | 13,4:1 |
| Texto de la barra lateral (tinta suave) sobre la mesa | 5,3:1 | 7,7:1 |
| Azul de la app sobre la hoja | 6,9:1 | 9,2:1 |
| Azul de la app sobre la mesa | 5,8:1 | 10,6:1 |

El azul ya pasa AA con holgura en los dos temas: **no se cambia** (decisión 3 de Roberto: solo si mejora). Los tests (`tests/navegador/indice.test.js`) vigilan el texto de la hoja, la barra lateral, la miga y el índice a ≥ 4,5:1.

## Objeciones

1. **El resultado del buscador perdió su jerarquía** (`despues-…-buscador.png`, claro y oscuro). La barra apagada pintaba el título de cada resultado en tinta suave, igual que el fragmento de debajo: título y contexto se leían del mismo peso. **Aplicada:** `#arbol .resultado` vuelve a tinta; el fragmento sigue en suave.
2. **En oscuro, el cajón de la terminal se funde con la mesa** (`despues-…-oscuro-nota-con-cajon.png`). La mesa (#0e0f12) y el fondo del cajón (#0f1014) son casi el mismo negro y el borde era `#000`: no había límite que ver. **Aplicada:** el borde del cajón pasa a ser la línea del tema en oscuro (`--borde-cajon`); en claro sigue en negro.
3. **El índice solo aparece con la ventana de 1368 px o más** (hoja 832 + hueco + índice + márgenes + barra lateral de 280): en un portátil de 1280 o 1440 con el cajón abierto no se ve, y nada dice que existe. **No se aplica:** es la regla de Roberto («solo si cabe, sin encoger la hoja»); bajar el ancho de la hoja o del índice para que quepa antes la rompe. Alternativa si se echa en falta tras el primer uso: plegar la barra lateral (no existe hoy a anchos grandes) para dejar sitio.
4. **A 390 px una nota larga no tiene ninguna forma de saltar de sección** (`despues-…-390-nota-larga-indice.png`): sin índice, solo scroll. **No se aplica:** un índice en móvil es otro diseño (desplegable bajo la miga), no un arreglo; entra a la Inbox del plan vivo para decidirlo con uso real.
5. **La barra lateral apagada deja la carpeta abierta y la nota activa distinguidas solo por el azul y el chevron** (`despues-…-claro-nota-larga-indice.png`: `lectura` abierta con el mismo tono que las cerradas). **No se aplica:** pasa los 4,5:1 y la nota activa se ve; subir el peso de las carpetas abiertas es un retoque del árbol que ya está en la Inbox («la fila al pasar el ratón pesa más que la seleccionada»), y se decide con ese bloque.

## Lo que funciona

- Texto a 16 px con 96 caracteres de mediana por línea (80 es la referencia de WCAG 1.4.8, no se cumple por decisión de Roberto; el test pone techo en 105).
- La hoja se funde con el fondo a ≤ 760 px sin márgenes que roben sitio (sin scroll horizontal a 390).
- Los paneles (Tareas, Comentarios) llevan la misma hoja: una sola regla visual, y sin hoja en PDF, HTML, examen y tarjetas solo donde el contenido ya es otro objeto (PDF y HTML); examen y tarjetas sí la llevan, sin índice.
