# cuaderno-app

**Tu cuaderno de estudio, en el navegador.** Abre la carpeta de notas de un curso montado con
[profesor-kit](https://github.com/rsotor/profesor-kit) y la pinta como lo que es: notas con enlaces, exámenes,
flashcards, tareas y una terminal para hablar con tu profesor. Sustituye a Obsidian; todo lo que escribe es
Markdown en tus propios ficheros.

## Arrancar

```
npm install
node server.js [carpeta-del-cuaderno]
```

Sin carpeta, arranca en la pantalla de cuadernos: los recientes y una casilla para abrir otra carpeta. Los ajustes
(tema, letra, fuente) son tuyos, iguales para todos tus cuadernos. Un `cuaderno.json` opcional en la raíz de un
cuaderno le da nombre y portada (`{ "nombre": "Finanzas", "portada": "inicio.md" }`).

La terminal imprime la dirección que hay que abrir. Lleva un código que se crea la primera vez y se guarda en tu
carpeta de configuración: la dirección no cambia entre arranques, y ninguna otra web abierta en el navegador puede
hablar con tu cuaderno. Para probar sin un cuaderno propio, `ejemplos/cuaderno-ejemplo/` trae uno inventado que cubre
todo lo que la app sabe hacer (`ejemplos/cuaderno-ejemplo.md` dice qué hay en cada nota); cópialo antes de escribir
en él. Necesita Node 24 o más reciente.

`npm test` lanza los tests. `npm run test:navegador` lanza los recorridos de navegador (Playwright con Chromium headless;
en un ordenador normal hace falta `npx playwright install chromium` una vez, o la variable `CUADERNO_CHROMIUM` con la ruta
de otro Chromium). `node pruebas/recorrido.js <carpeta>` recorre un cuaderno y lista los enlaces rotos.

## Estado

En desarrollo. El plan, lo decidido y lo que falta están en [`docs/planes/plan-vivo.md`](docs/planes/plan-vivo.md).

## Principios

1. La app es la ventana; el cuaderno es la verdad. Sin base de datos, sin formatos propios.
2. La lógica del curso no es de la app: corregir, calcular progreso o guardar lo hacen las herramientas del kit.
3. Un kit funciona sin la app. La app depende del kit; nunca al revés.
4. Control total de la experiencia: render, tema, atajos y paneles son nuestros y configurables.
5. Nada que esconder: repo público, sin secretos ni rutas de nadie.

Licencia MIT.
