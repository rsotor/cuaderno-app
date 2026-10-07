# cuaderno-app

**Tu cuaderno de estudio, en el navegador.** Abre la carpeta de notas de un curso montado con
[profesor-kit](https://github.com/rsotor/profesor-kit) y la pinta como lo que es: notas con enlaces, exámenes,
flashcards, tareas y una terminal para hablar con tu profesor. Sustituye a Obsidian; todo lo que escribe es
Markdown en tus propios ficheros.

## Arrancar

```
npm install
node server.js <carpeta-del-cuaderno>
```

La terminal imprime la dirección que hay que abrir (lleva un código que cambia en cada arranque: así ninguna otra
web abierta en el navegador puede hablar con tu cuaderno). Necesita Node 24 o más reciente.

`npm test` lanza los tests. `node pruebas/recorrido.js <carpeta>` recorre un cuaderno y lista los enlaces rotos.

## Estado

En desarrollo. El plan, lo decidido y lo que falta están en [`docs/planes/plan-vivo.md`](docs/planes/plan-vivo.md).

## Principios

1. La app es la ventana; el cuaderno es la verdad. Sin base de datos, sin formatos propios.
2. La lógica del curso no es de la app: corregir, calcular progreso o guardar lo hacen las herramientas del kit.
3. Un kit funciona sin la app. La app depende del kit; nunca al revés.
4. Control total de la experiencia: render, tema, atajos y paneles son nuestros y configurables.
5. Nada que esconder: repo público, sin secretos ni rutas de nadie.

Licencia MIT.
