# cuaderno-app

**Tu cuaderno de estudio, en el navegador.** Abre la carpeta de notas de un curso montado con
[profesor-kit](https://github.com/rsotor/profesor-kit) y la pinta como lo que es: notas con enlaces, exámenes,
flashcards, tareas y una terminal para hablar con tu profesor. Sustituye a Obsidian; todo lo que escribe es
Markdown en tus propios ficheros.

## Arrancar

```
npm install
node server.js [carpeta-del-cuaderno]    # -e: elegir cuaderno en vez de abrir el último
```

Sin carpeta, abre el último cuaderno que usaste (si su carpeta sigue ahí; con `-e`, o si no hay ninguno, arranca en la
pantalla de cuadernos: los recientes y una casilla para abrir otra carpeta). Los ajustes
(tema, letra, fuente) son tuyos, iguales para todos tus cuadernos. Un `cuaderno.json` opcional en la raíz de un
cuaderno le da nombre y portada (`{ "nombre": "Finanzas", "portada": "inicio.md" }`).

La app vive siempre en `http://localhost:7331`: guárdala en marcadores. Al arrancar abre una pestaña ya dentro (con
`-n`, no: imprime la dirección de la primera vez). Esa pestaña entra con un código que se crea la primera vez y se
guarda en tu carpeta de configuración; el navegador lo recuerda un año y no lo ves, y ninguna otra web abierta en el
navegador puede hablar con tu cuaderno. Para probar sin un cuaderno propio, `ejemplos/cuaderno-ejemplo/` trae uno inventado que cubre
todo lo que la app sabe hacer (`ejemplos/cuaderno-ejemplo.md` dice qué hay en cada nota); cópialo antes de escribir
en él. Necesita Node 24 o más reciente.

**La app de escritorio** (en desarrollo; plan en `docs/planes/electron.md`): `npm run app` abre el mismo cuaderno en
una ventana propia, con el servidor dentro. Electron 44 no descarga su binario al instalar: la primera vez,
`node node_modules/electron/install.js` (unos 100 MB). Lo que falle queda en `registro.log`, en la carpeta de
configuración.

`npm test` lanza los tests. `npm run test:navegador` lanza los recorridos de navegador (Playwright con Chromium headless;
en un ordenador normal hace falta `npx playwright install chromium` una vez, o la variable `CUADERNO_CHROMIUM` con la ruta
de otro Chromium). `npm run test:electron` lanza el recorrido de la app de escritorio (necesita el binario de Electron;
sin pantalla, `xvfb-run -a npm run test:electron`). `node pruebas/recorrido.js <carpeta>` recorre un cuaderno y lista los
enlaces rotos.

## Estado

En desarrollo. El plan, lo decidido y lo que falta están en [`docs/planes/plan-vivo.md`](docs/planes/plan-vivo.md).

## Principios

1. La app es la ventana; el cuaderno es la verdad. Sin base de datos, sin formatos propios.
2. La lógica del curso no es de la app: corregir, calcular progreso o guardar lo hacen las herramientas del kit.
3. Un kit funciona sin la app. La app depende del kit; nunca al revés.
4. Control total de la experiencia: render, tema, atajos y paneles son nuestros y configurables.
5. Nada que esconder: repo público, sin secretos ni rutas de nadie.

Licencia MIT.
