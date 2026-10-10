# El menú de la app de escritorio (plantilla de `electron/menu.js`, 2026-10-10)

Electron no deja capturar el menú nativo bajo Xvfb, así que aquí va la plantilla tal cual la construye `plantillaMenu` (la misma
que instala `instalarMenu` y que comprueba `tests/electron-menu.test.js`), con sus aceleradores: `CmdOrCtrl` es ⌘ en Mac y Ctrl en
Windows y Linux. Los elementos con «rol» son los estándar de Electron (la etiqueta en castellano es nuestra; el comportamiento, el
del sistema). Con un cuaderno reciente de ejemplo en Cuadernos recientes.

## macOS

- Cuaderno
  - Acerca de Cuaderno
  - ───
  - Ajustes…  ·  CmdOrCtrl+,
  - ───
  - Servicios (rol `services`)
  - ───
  - Ocultar Cuaderno (rol `hide`)
  - Ocultar otros (rol `hideOthers`)
  - Mostrar todo (rol `unhide`)
  - ───
  - Salir de Cuaderno (rol `quit`)
- Cuaderno
  - Abrir nota…  ·  CmdOrCtrl+O
  - Buscar…  ·  CmdOrCtrl+F
  - Nueva tarea  ·  CmdOrCtrl+T
  - ───
  - Guardar  ·  CmdOrCtrl+S
  - ───
  - Abrir carpeta…  ·  CmdOrCtrl+Shift+O
  - Cuadernos recientes
    - cuaderno-ejemplo
- Edición
  - Deshacer (rol `undo`)
  - Rehacer (rol `redo`)
  - ───
  - Cortar (rol `cut`)
  - Copiar (rol `copy`)
  - Pegar (rol `paste`)
  - Seleccionar todo (rol `selectAll`)
- Ver
  - Recargar (rol `reload`)
  - ───
  - Acercar (rol `zoomIn`)
  - Alejar (rol `zoomOut`)
  - Tamaño real (rol `resetZoom`)
  - ───
  - Pantalla completa (rol `togglefullscreen`)
- Ventana (rol `windowMenu`: Electron pone Minimizar, Zoom y las ventanas)
- Ayuda (rol `help`)
  - Plan vivo (en GitHub)
  - ───
  - Mostrar registro
  - Diagnóstico

## Windows (y Linux: la misma plantilla)

- Cuaderno
  - Abrir nota…  ·  CmdOrCtrl+O
  - Buscar…  ·  CmdOrCtrl+F
  - Nueva tarea  ·  CmdOrCtrl+T
  - ───
  - Guardar  ·  CmdOrCtrl+S
  - ───
  - Abrir carpeta…  ·  CmdOrCtrl+Shift+O
  - Cuadernos recientes
    - cuaderno-ejemplo
  - ───
  - Ajustes…  ·  CmdOrCtrl+,
  - ───
  - Salir (rol `quit`)
- Edición
  - Deshacer (rol `undo`)
  - Rehacer (rol `redo`)
  - ───
  - Cortar (rol `cut`)
  - Copiar (rol `copy`)
  - Pegar (rol `paste`)
  - Seleccionar todo (rol `selectAll`)
- Ver
  - Recargar (rol `reload`)
  - ───
  - Acercar (rol `zoomIn`)
  - Alejar (rol `zoomOut`)
  - Tamaño real (rol `resetZoom`)
  - ───
  - Pantalla completa (rol `togglefullscreen`)
- Ventana (rol `windowMenu`: Electron pone Minimizar, Zoom y las ventanas)
- Ayuda (rol `help`)
  - Plan vivo (en GitHub)
  - ───
  - Mostrar registro
  - Diagnóstico
  - ───
  - Acerca de Cuaderno

Reservado sin acción: `CmdOrCtrl+K` (la paleta de acciones rápidas, un bloque posterior). Sin `CmdOrCtrl+P`.
