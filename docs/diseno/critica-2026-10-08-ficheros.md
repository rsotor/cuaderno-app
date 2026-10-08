# cuaderno-app · crítica de diseño, fase 10 (ficheros que no son notas), 2026-10-08

**Alcance:** árbol con PDF, JSON, CSV, TXT y HTML; visores por tipo; botón «Mostrar en el Finder» en la fila y en la miga. Tema claro, 1280 px. Método: `design-critique` (usabilidad, jerarquía, consistencia, accesibilidad) sobre `despues-ficheros-{nota,html,pdf,json,csv}-2026-10-08.png`; los valores salen de `public/estilo.css:89-108`. Usuario final: alumno no técnico, persona mayor, en Windows. No repite lo ya decidido en `critica-2026-10-08.md`.

## Objeciones (por impacto)

**1. Usabilidad · «Finder» no existe en Windows y el icono va solo, escondido hasta pasar el ratón.**
Se ve: una carpeta de 15-16 px sin texto, con `opacity: 0` hasta `:hover` (`estilo.css:94,99`) en el árbol; en la miga sí está siempre, pero también sin texto. El nombre «Mostrar en el Finder» es el de macOS.
Por qué importa: en Windows se llama Explorador; para un alumno mayor un icono mudo que aparece solo al pasar por encima no se descubre, y si lo descubre, la palabra «Finder» no le dice nada. Es la única vía para abrir un PDF o un CSV fuera de la app.
Arreglo mínimo: texto según sistema («Mostrar en el Explorador» / «en el Finder» / «en la carpeta») en `title` y `aria-label`; en la miga, icono + palabra visible «Abrir carpeta» (`#miga .mostrar` con texto de 13 px); en el árbol puede seguir escondido porque la miga ya cubre el caso.

**2. Usabilidad · el CSV y el JSON se enseñan en crudo.**
Se ve: `gastos-octubre.csv` como `concepto,categoria,importe` en monoespaciada 13 px (`estilo.css:107`); el JSON, 30 líneas de llaves y comillas.
Por qué importa: el alumno ve el fichero de datos, no los datos. Una coma no es una columna para quien no programa, y la app ya tiene tablas con estilo en las notas.
Arreglo mínimo: el CSV, como `<table>` con el estilo de las tablas de `#nota` (primera fila como cabecera), con la vista en crudo bajo un «Ver como texto». El JSON puede quedarse con sangría (es lo que decidió la fase) pero con una línea de ayuda encima: «Fichero de datos: se muestra tal cual».

**3. Jerarquía · en PDF y HTML la miga no se alinea con el contenido.**
Se ve: la miga empieza en x≈421 y el visor en x≈321 (100 px de diferencia) en `despues-ficheros-pdf` y `-html`; en nota, JSON y CSV sí coinciden. Causa: `#nota.ancha { max-width: none }` (`estilo.css:105`) sin tocar la miga.
Por qué importa: es la misma objeción 4 de la crítica de hoy, ahora en dos tipos de fichero; al saltar de una nota a un PDF el título «se mueve» 100 px.
Arreglo mínimo: con `.ancha`, igualar el relleno izquierdo de la miga al del visor (`#miga` con `padding-left` del `#nota.ancha`) o centrar el visor con el mismo margen izquierdo que la columna de lectura.

**4. Consistencia · el gris dice «desactivado» y el tipo de fichero no se ve.**
Se ve: `#arbol .hoja.fichero .nombre { color: var(--tinta-suave) }` (`estilo.css:104`): `apuntes-de-clase.txt`, `extracto-octubre.pdf` y los demás salen más pálidos que las notas, mezclados por orden alfabético con ellas. La página HTML sale como «Calculadora 50/30/20», sin extensión ni marca, y en la miga aparece con su nombre de fichero (`calculadora-50-30-20.html`).
Por qué importa: en una interfaz el gris suele significar «no disponible»; una persona mayor puede no pulsarlos. Y el mismo fichero tiene dos nombres (árbol y miga). Contraste de `--tinta-suave` sobre el fondo del lateral: TODO medirlo (no medido aquí; el mínimo es 4,5:1).
Arreglo mínimo: nombre en tinta normal (`var(--tinta)`) y que el tipo lo diga la extensión en `small` a la derecha (`PDF`, `CSV`, `Página`), en gris como el `small` de las hojas (`estilo.css:108`); en la miga de una página HTML, el `<title>` y no el nombre del fichero.

**5. Usabilidad · el hover pesa más que la fila seleccionada.**
Se ve: en las cinco capturas la fila de `extracto-octubre.pdf` (ratón encima) está en gris oscuro y la seleccionada en azul muy pálido; con dos filas resaltadas, la que domina no es la actual. En el PDF, la fila gris se parece a un panel desactivado.
Por qué importa: el alumno no sabe en qué fichero está; lo que más pesa debe ser «dónde estoy». (El hover pegado puede ser un efecto de la captura, pero la jerarquía hover > selección es real en el CSS.)
Arreglo mínimo: hover más suave que la selección (`rgba(127,127,127,.08)` frente al azul actual) y selección con una barra de 3 px a la izquierda en `--acento`, que no depende solo del color.

## Lo que está bien y no se toca
- PDF a todo el ancho y alto (`calc(100vh - 70px)`) y HTML a todo el alto: no hay doble scroll ni marco inútil.
- JSON/CSV/TXT con mono, `pre-wrap` y `overflow-wrap: anywhere`: no hay scroll horizontal.
- Botón de la miga siempre visible y con foco visible (`focus-visible` pone `opacity: 1`); en táctil, también en el árbol (`@media (hover: none)`).
- Las notas siguen teniendo prioridad visual sobre los ficheros en la jerarquía general del árbol; el árbol conserva la sangría de 16 px.

## Nota, no objeción
El visor de PDF del navegador es oscuro dentro de una app clara (barra y miniaturas). No se controla desde la app y cambia según navegador; se acepta.

## Veredicto
**Cerrar con arreglos antes del commit: la 1** (texto según sistema y palabra visible en la miga; es lo que más puede bloquear a un alumno en Windows) **y la 4** (cambio de dos líneas de CSS). La 2, la 3 y la 5 pueden entrar en esta tanda si cuestan poco o ir al Inbox sin bloquear.

## Qué se hizo con cada objeción (2026-10-08)

1. **No se cambia; razonada.** El texto ya depende del sistema: «Mostrar en el Finder» en macOS, «en el Explorador» en Windows y «en la carpeta» en Linux (`GESTOR` en `public/app.js`, con `aria-label` y `title`). Roberto pidió un icono que puede salir al pasar el ratón; en la miga está siempre visible y en pantallas táctiles también.
2. **Aplicada en parte.** El CSV sale como tabla (cifras alineadas a la derecha) con «Ver como texto» debajo. El JSON se queda con sangría y sin línea de ayuda: es material de referencia y Roberto pidió que «se renderice bien», no que se explique.
3. **Aplicada.** Con un PDF o una página HTML, la miga empieza donde empieza el visor (`.miga-barra.ancha`); un recorrido lo mide.
4. **Aplicada.** Los ficheros van con la tinta normal (la extensión ya dice el tipo) y la miga de una página HTML usa su `<title>`, como el árbol.
5. **No se cambia; al Inbox.** El peso del hover frente a la fila seleccionada es del árbol entero, no de esta fase; se revisa con la próxima ronda del árbol.
