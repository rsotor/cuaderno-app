# cuaderno-app

**Tu cuaderno de estudio, en una ventana propia o en el navegador.** Abre la carpeta de notas de un curso montado con
[profesor-kit](https://github.com/rsotor/profesor-kit) y la pinta como lo que es: notas con enlaces, exámenes,
flashcards, tareas y una terminal para hablar con tu profesor. Sustituye a Obsidian; todo lo que escribe es
Markdown en tus propios ficheros.

## Arrancar

**La app de escritorio:** una ventana propia con el servidor dentro, sin terminal abierta ni dirección que recordar.

```
npm install
node node_modules/electron/install.js    # una vez: Electron 44 no baja su binario al instalar (unos 100 MB)
npm run app                              # o npm run app -- <carpeta-del-cuaderno>
```

Abre el último cuaderno que usaste (o la pantalla de cuadernos, con «Elegir carpeta…» para abrir otro con el diálogo del
sistema; arrastrar una carpeta al icono también vale). El menú va en castellano y trae los atajos de la app (la tabla, en
[Teclado](#teclado)). Si algo falla, Ayuda →
«Mostrar registro» abre `registro.log` (en la carpeta de configuración) y «Diagnóstico» dice versiones, puerto, `PATH` y si
la terminal ha cargado. Los instaladores (`.dmg` y `.exe`, sin firma: el sistema avisa la primera vez) y cómo instalarlos:
[`INSTALAR.md`](INSTALAR.md). El plan y lo decidido: `docs/planes/electron.md`.

**Actualizar la app instalada:** `npm run instalar`, desde el checkout en `main` y sin cambios. Trae `main`, construye la
app para tu máquina, cierra Cuaderno sin forzarla (si no se deja, para y no instala nada), la sustituye (en Mac, la
anterior va a la Papelera) y la vuelve a abrir. Mac y Windows; `-- --simular` enseña los pasos sin ejecutar ninguno.

**La web,** la misma pantalla en tu navegador:

```
npm install
node server.js [carpeta-del-cuaderno]    # -e: elegir cuaderno en vez de abrir el último
```

Sin carpeta, abre el último cuaderno que usaste (si su carpeta sigue ahí; con `-e`, o si no hay ninguno, arranca en la
pantalla de cuadernos: los recientes y una casilla para abrir otra carpeta). Los ajustes
(tema, letra, fuente) son tuyos, iguales para todos tus cuadernos, y los comparten la web y la app. Un `cuaderno.json` opcional en la raíz de un
cuaderno le da nombre y portada (`{ "nombre": "Finanzas", "portada": "inicio.md" }`).

La web vive siempre en `http://localhost:7331`: guárdala en marcadores. Al arrancar abre una pestaña ya dentro (con
`-n`, no: imprime la dirección de la primera vez). Esa pestaña entra con un código que se crea la primera vez y se
guarda en tu carpeta de configuración; el navegador lo recuerda un año y no lo ves, y ninguna otra web abierta en el
navegador puede hablar con tu cuaderno. Para probar sin un cuaderno propio, `ejemplos/cuaderno-ejemplo/` trae uno inventado que cubre
todo lo que la app sabe hacer (`ejemplos/cuaderno-ejemplo.md` dice qué hay en cada nota); cópialo antes de escribir
en él. Necesita Node 24 o más reciente.

La última versión solo web, de antes de la app de escritorio, es la etiqueta `web-0.1.0` sobre `main`
(puesta el 2026-10-10): `git clone --branch web-0.1.0` la trae y GitHub da su zip en Code → Tags.

`npm test` lanza los tests. `npm run test:navegador` lanza los recorridos de navegador (Playwright con Chromium headless;
en un ordenador normal hace falta `npx playwright install chromium` una vez, o la variable `CUADERNO_CHROMIUM` con la ruta
de otro Chromium). `npm run test:electron` lanza los recorridos de la app de escritorio (necesita el binario de Electron;
sin pantalla, `xvfb-run -a npm run test:electron`). `node pruebas/recorrido.js <carpeta>` recorre un cuaderno y lista los
enlaces rotos.

## Teclado

Los atajos de la app de escritorio (⌘ en Mac; Ctrl en Windows y Linux, salvo donde se dice Ctrl, que es Ctrl en los tres).
La búsqueda es una modal: ⌘K, ⌘F y ⌘O la abren, en la app y en la web (Ctrl en Windows y en la web; con el foco en la terminal, Ctrl K es del shell y no la abre). Dentro: ↑ ↓ eligen, Enter abre la nota, ⌘↵ (Ctrl ↵) apunta lo escrito como tarea y Esc cierra. En la web, los demás atajos de la página siguen igual (Ctrl \ barra lateral, Ctrl ` terminal, E editar, C comentar).

| Atajo | Menú | Qué hace |
|---|---|---|
| ⌘N | Archivo → Nueva nota | el diálogo de nueva nota |
| ⌘T | Archivo → Nueva tarea | la casilla «Nueva tarea» si estás en Tareas; si no, la modal de búsqueda con «+ » (Enter la apunta) |
| ⌘O | Archivo → Abrir nota… | la modal de búsqueda con la última consulta seleccionada: nombre de nota o carpeta, Enter abre |
| ⌘F | Archivo → Buscar… | la modal de búsqueda (hoy, lo mismo que ⌘O) |
| ⌘S | Archivo → Guardar | guardar en el repositorio del cuaderno |
| ⇧⌘O | Archivo → Abrir carpeta… | cambiar de cuaderno con el diálogo del sistema |
| — | Archivo → Cuadernos recientes | los últimos cuadernos abiertos |
| ⌘, | Archivo → Ajustes… (en Mac, Cuaderno → Ajustes…) | Ajustes |
| ⌘[ / ⌘] | Ver → Atrás / Adelante | el historial de la ventana |
| Ctrl \ | Ver → Barra lateral | plegar y desplegar la barra lateral |
| Ctrl ` | Ver → Terminal | abrir y cerrar la terminal |
| ⌘R, ⌘+, ⌘−, ⌘0 | Ver → Recargar, Acercar, Alejar, Tamaño real | los del sistema |
| ⌘K | — | reservada: será la paleta de acciones rápidas |

## Estado

En desarrollo. El plan, lo decidido y lo que falta están en [`docs/planes/plan-vivo.md`](docs/planes/plan-vivo.md).

## Principios

1. La app es la ventana; el cuaderno es la verdad. Sin base de datos, sin formatos propios.
2. La lógica del curso no es de la app: corregir, calcular progreso o guardar lo hacen las herramientas del kit.
3. Un kit funciona sin la app. La app depende del kit; nunca al revés.
4. Control total de la experiencia: render, tema, atajos y paneles son nuestros y configurables.
5. Nada que esconder: repo público, sin secretos ni rutas de nadie.

Licencia MIT.
