# Navegación y accesos — lo que ve Roberto (2026-10-13)

Dicho después de la auditoría (`revision-2026-10-13.md`), a propósito, para no condicionarla. Zonas confirmadas con la captura marcada de Roberto
(de un cuaderno real: no se copia al repo); equivalen a `capturas-2026-10-13/claro-1440-nota.png`.

| Zona | Qué es | Lo que ve Roberto | Postura de Claude |
|---|---|---|---|
| Rojo | Nombre del cuaderno + estado | Se ve poco; Guardar ocupa más. El nombre debería llevar al inicio y hace falta un acceso rápido para cambiar de cuaderno | Sí: nombre → inicio, selector de cuaderno al lado (recientes + «Abrir carpeta…»). Guardar, Descargar y Deshacer suben aquí en iconos (son del cuaderno); Guardar destaca solo con cambios (en oscuro hoy es lo que más pesa de la pantalla) |
| Morado | Barra superior entera, hasta el hueco sobre el índice «En esta nota» | Desequilibrada: pesa Editar, el título poco. ¿Llevar aquí acciones rápidas en iconos a la derecha (guardar, buscar…)? | Sí a iconos fijos a la derecha, sobre el hueco del índice, y a quitar el recuadro a Editar (resuelve rev-13 #3). No a Guardar aquí: esta barra es de la nota, Guardar es del cuaderno. Papelera a un menú «…» |
| Verde | Guardar, Descargar, Deshacer, buscador, Inicio, Tareas, Comentarios, Nueva nota | Ocupa mucho; podría ser iconos en un sitio más reducido (¿morado o naranja?) | Guardar y compañía suben al rojo; buscador se queda (se analiza con Abrir); fila de iconos con contador y tooltip para Tareas, Comentarios y «+»; Inicio sobra si el nombre lleva al inicio |
| Azul | Árbol de carpetas | Se junta con el verde, poca separación | Se resuelve casi solo si el verde se compacta; si no, aire o rótulo «Notas» |
| Naranja | Terminal y Ajustes (abajo) | Con la app nativa sobra Ajustes (menú + atajo). Terminal ocupa mucho; meterla con lo del verde | Ajustes fuera solo con `window.cuadernoApp` (la web no tiene menú: principio 3). Terminal a icono |

Después: analizar Buscar y Abrir.

Siguiente: cruzar con el recorrido cognitivo (`recorrido-2026-10-13.md`) y la auditoría en una propuesta única de
reorganización → skill `plan` + ronda de abogado del diablo antes de tocar código.

## Decidido (Roberto, 2026-10-13)

- **Guardar, Descargar y Deshacer van a la línea del estado**, bajo el nombre del cuaderno: `1 cambio por guardar
  [Guardar] ⤓ ↶`. Con 0 cambios, «guardado hace 3 h» y Guardar sin destacar. Descartado: en la línea del nombre (no
  cabe en ~280 px, lo vio Roberto) y abajo, en el hueco de Terminal/Ajustes (lejos de la vista; con kit es la acción
  principal).
- **Cuidado (Roberto): el texto no puede romper la línea.** El texto encoge y se corta con «…» (texto completo en el
  tooltip); los botones no encogen nunca. Texto corto («1 cambio», «guardado · 3 h»). Test de navegador con los casos
  largos: «128 cambios por guardar», «guardado hace 3 semanas», barra lateral al mínimo y letra al 200 %.
- **Atrás / Adelante visibles (propuesta de Roberto, 2026-10-13; pendiente de su sí a la ubicación).** Hoy existen
  solo en el menú de la app con ⌘[ / ⌘] (`electron/menu.js:45-48`); la web los tiene en el navegador. Propuesta:
  flechas ‹ › al principio de la barra superior, antes de la ruta (sitio de Obsidian, Notion, VS Code), apagadas sin
  historial y solo con `window.cuadernoApp` (principio 3). TODO: comprobar si funcionan los botones laterales del
  ratón y el gesto de dos dedos del trackpad.

## Tras ver las maquetas (Roberto, 2026-10-13)

- **A, no B** (B mezcla lo del cuaderno con lo de la nota en la barra superior).
- **Fuera el rótulo «NOTAS»**: en su lugar, un borde superior algo más grueso entre los accesos y el árbol.
- **Inicio con icono de casa** en la fila de accesos (el nombre del cuaderno abre el selector, como en Notion/Linear).
- **«…» de la nota = lo que ya hay**: Mostrar en el Finder, Copiar la ruta, Ocultar (sí, Roberto), Mover a la papelera (al final, en rojo).
  La maqueta añadió «Mover», que no existe: fuera.
- **Buscar: icono que abre una modal tipo Obsidian** (Roberto: la búsqueda en modal es más funcional, así que en la
  barra pierde peso). Objeción de Claude retirada: el campo pasa a ser solo un disparador. Para que se descubra:
  tooltip con el atajo y una pista en la portada. La modal (buscar notas + «+ tarea») se diseña en el análisis de
  Buscar y Abrir.
- **Inbox:** favoritos u ordenar carpetas (función nueva; dónde se guarda, sin romper el principio 1).

## Orden (Roberto, 2026-10-13)

1. PR 1 — reorganización A2 (selector, línea de Guardar, accesos, barra superior con ‹ › y «…», Ajustes/Terminal),
   con el buscador aún como campo. Antes: skill `plan` + ronda de abogado del diablo, cuando Roberto dé A2 por buena.
2. Análisis de Buscar y Abrir, con maqueta de la modal (parte del boceto de A2).
3. PR 2 — la modal; el campo pasa a lupa.
Aparte, ya en marcha: PR de reconexión de la recarga en vivo.

## Orden revisado (Roberto, 2026-10-13, más tarde)

La modal ya tiene diseño validado (a2-busqueda-modal-*): **PR 1 = modal** (⌘F, ⌘O y ⌘K la abren; el campo actual
solo la abre), **PR 2 = reorganización A2** (el campo pasa a lupa). Dos PR seguidos, no uno (Roberto propuso uno; se
quedan dos para que cada uno se revise y se revierta solo). Ambos empiezan tras mergear #27. Plan:
`docs/planes/navegacion.md`.
