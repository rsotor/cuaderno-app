# Propuestas de logo (2026-10-09)

Roberto: el icono actual (`public/icono.svg`, libreta azul rellena) «es un poco plof». Tres direcciones, todas en
`viewBox` 64x64, `currentColor` más el amarillo rotulador `#ffe45c`, sin degradados ni texto. Vista previa a
16/32/128/512 px en claro y oscuro: abrir `vista.html` con doble clic.

| # | Dirección | Pro | Contra |
|---|-----------|-----|--------|
| 1 | Hoja con franja de rotulador sobre una línea | Cuenta lo que hace la app (leer y subrayar) y enlaza con la «hoja» | Es la más genérica: «documento con líneas» lo usan muchas apps |
| 2 | Cuaderno abierto en un solo contorno, con un toque de rotulador | Dice «cuaderno» a la primera | Se parece a iconos de «libro/lectura»; a 16 px el amarillo casi desaparece |
| 3 | «c» gruesa sobre subrayado de rotulador | La más propia y la que mejor aguanta a 16 px (dos formas grandes) | Depende de que la «c» se asocie a «cuaderno»; más marca que símbolo |

Recomendación: la 3 (ver la intención en `vista.html`).

## Cómo sustituir `public/icono.svg`

1. Copiar la propuesta elegida sobre `public/icono.svg`.
2. **Favicon:** en `<link rel="icon">` el SVG no hereda color, así que `currentColor` sale negro, también en modo
   oscuro. Antes de copiar, añadir dentro del SVG un `<style>` con `:root{color:#1b1b1f}` y
   `@media (prefers-color-scheme:dark){:root{color:#e6e6e6}}`. Para el icono de escritorio (512 px), fijar el
   color a mano.
3. Referencias (`grep -rn icono public/ servidor.js tests/`, sin contar las clases CSS `.icono` de la interfaz):
   - `public/index.html:7`: `<link rel="icon" type="image/svg+xml" href="/public/icono.svg">`
   - `tests/servidor.test.js:193-197`: comprueba ese enlace y que `/public/icono.svg` se sirve como SVG.
   - `servidor.js`: sin referencias directas (sirve `public/` tal cual).
   Si se mantiene el nombre del fichero, no hay que tocar nada más.

## Crítica (2026-10-09, una ronda, `design-critique` sobre capturas a 16 y 512 px)

Aplicado: marca de la 1 centrada y con dos líneas (la tercera se emborronaba a 16 px); la línea sobre el amarillo
de la 1 va en `#1b1b1f` fijo (en oscuro, gris claro sobre amarillo desaparecía: es la única excepción a
«un solo color»); en la 3, barra más fina y corta, sin solapar el arco; marca de la 2 más ancha.

Anotado sin aplicar (gusto):
- La 2 es la menos distintiva: se parece al icono de «libro abierto» de cualquier librería. Candidata a descartar.
- La 3 como «c» aislada puede leerse como «cargar» o copyright; vale más como marca de la app que como símbolo.
- El amarillo `#ffe45c` sobre papel claro tiene ~1,2:1: solo se sostiene con el trazo encima (1) o como subrayado
  grande (3). Opción: un amarillo más hondo (`#f5c800`) en claro; añadiría un tono.
- El crítico prefiere la 1 por coherencia con la app; yo recomiendo la 3 por 16 px y distintividad.
