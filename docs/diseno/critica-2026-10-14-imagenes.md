# Crítica de diseño · imágenes en el editor (2026-10-14)

Skill `design:design-critique` sobre las capturas de `docs/capturas/imagenes/` (`node pruebas/capturas-imagenes.js`,
cuaderno de ejemplo copiado a un temporal; claro y oscuro, 1100 × 760): vista con una imagen y una rota, Markdown plano,
imagen pendiente, barra con «Imagen» y aviso de error al aplicar. Etapa: pulido final de un bloque pequeño.

**Impresión general.** Encaja con el editor: la imagen ocupa su sitio, el crudo aparece solo en la línea del cursor, el
botón se lee como uno más de la barra y el aviso de error dice qué pasó y que la nota no se escribió. Lo que más
pesaba era un fallo de inserción, no de estilo.

## Objeciones (4: 2 aplicadas, 2 razonadas)

1. **Aplicada (moderada, usabilidad).** Con el cursor al inicio de una línea con texto (`# Nota con captura`), el botón
   «Imagen» pegaba el enlace al `#`: `![…](…)# Nota con captura`; el título dejaba de serlo y el crudo y el título
   quedaban en la misma línea (captura «editor-pendiente», primera versión). Arreglo: `insertarImagenes` abre una línea
   antes y otra después cuando el punto cae en mitad de una línea (`public/live.js`). Test nuevo en
   `tests/navegador/imagenes.test.js` («insertar con el cursor en mitad de una línea…»). Cambia una expectativa:
   el recorrido de soltar dos `captura.png` esperaba `…captura-2.png)Una nota…` (el texto pegado a la imagen, el mismo
   fallo); ahora espera el salto de línea. Es el comportamiento que cambia a propósito, no un valor ajustado para pasar.
2. **Aplicada (menor, consistencia).** En claro, las imágenes con fondo blanco (capturas, gráficos) se funden con el papel
   y no se ve dónde acaban. Arreglo: un filo de 1 px con `--linea` (`box-shadow`, no cambia el tamaño) en
   `#edicion-cm .live-imagen`. En oscuro apenas se nota, que es lo correcto.
3. **Razonada (menor, claridad).** Una imagen pendiente de copiar y una ya en el cuaderno se ven igual. No se marca: el
   plan (§1.1, restricción 4) quiere que se vea «desde donde esté» y la diferencia solo importa al aplicar, donde el
   aviso de error nombra el fichero. Una insignia por imagen sería ruido en cada nota para un estado de segundos; si el
   uso real lo pide, va al Inbox con esa evidencia.
4. **Razonada (menor, accesibilidad).** La caja de la imagen rota enseña solo el texto alternativo y la ruta queda en el
   `title` (invisible con teclado/táctil). Se mantiene: con el cursor en esa línea el crudo ya enseña la ruta completa
   (captura «editor-plano»), y la caja es la misma que usa la lectura. El aviso flotante (invertido respecto al tema, como
   el resto de avisos de la app) mantiene el contraste en ambos temas: se comprueba en las dos capturas, no se toca.

## Lo que funciona
- El botón «Imagen» (icono, 28 px como sus vecinos, foco visible, `aria-label`) sin estado pulsado: no es un formato.
- La imagen respeta `max-width: 100%` y el radio del sistema; el modo plano pinta la imagen y deja el crudo en todas las
  líneas.
- El aviso de error: causa («No se ha podido copiar la imagen «…»»), consecuencia («la nota no se ha escrito») y «Ver
  detalle» plegado.

## Ronda de diseño: 4 objeciones (2 aplicadas, 2 razonadas)
