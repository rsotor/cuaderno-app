# Vault demo — Rodando (caso inventado)

Vault de prueba para el cuaderno. Reproduce la forma de trabajar de un Product Owner con iniciativas, puntos por persona y borradores de tickets, sobre un producto inventado: **Rodando**, una app de bicis compartidas de una ciudad. Nada de esto es real: personas, equipos, claves de ticket y enlaces son ficticios.

## Estructura

| Carpeta | Qué es |
| --- | --- |
| `people/` | Una nota por persona con los puntos pendientes de hablar con ella (checkboxes). |
| `initiatives/<nombre>/` | Una carpeta por iniciativa: `brief.md`, `_meta/status.md`, borradores de tickets, notas de reunión y `attachments/`. |
| `initiatives/_archive/` | Iniciativas cerradas; se siguen pudiendo enlazar por nombre. |

## Qué ejercita del editor

- Frontmatter YAML (properties) en briefs y tickets: strings, listas, números, booleanos, fechas.
- Wikilinks: `[[nota]]`, `[[ruta/nota|alias]]`, `[[nota#Encabezado]]`, enlaces a notas que no existen todavía (ghost) y, dentro de tablas, el alias escapado `[[ruta\|alias]]`.
- Embeds de imagen: Markdown (`![alt](attachments/x.png)`) y wiki (`![[x.png]]`).
- Callouts `> [!INFO]`, `> [!WARNING]`, `> [!NOTE]`.
- Checkboxes abiertos `- [ ]` y cerrados `- [x]`.
- Notas de revisión inline con el prefijo `@@` al principio de línea (el autor las deja para el asistente; nunca deben llegar a publicarse).
- Tablas, bloques de código, listas anidadas, emojis en encabezados.
- Párrafos largos en una sola línea (sin saltos manuales): el editor debe hacer el wrap.
- Backlinks: las personas enlazan a iniciativas y las iniciativas a personas y entre ellas.

## Fuera a propósito

- Tareas, todo y notas diarias: se gestionan en otra herramienta.
- `findings/` y `patterns/`: en el vault real son JSON de conocimiento que usa el asistente, no notas para leer. Si el cuaderno algún día los muestra, basta con una vista de solo lectura.
