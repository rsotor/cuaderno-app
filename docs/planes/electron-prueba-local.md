# La app de escritorio en el ordenador de Roberto: guía de la sesión local

**2026-10-10 · para una sesión de Claude Code en el Mac de Roberto, sobre la rama `electron` (PR #24).** Todo lo del
bloque Electron se ha construido y probado en un contenedor Linux sin pantalla (`docs/planes/electron.md`, §5 y §6).
Esta guía es lo que **solo** se puede responder en una máquina real: §5 bis del plan. Cada apartado dice qué hacer, qué
mirar y dónde anotar el resultado. Las respuestas van a `docs/planes/electron.md`, §5 bis («Resultado»), con la fecha, y lo
que falle, al Inbox del plan vivo o a una tarea nueva. Nada de rutas reales ni nombres en lo que se escriba al repo:
`<repo>`, `<cuaderno>`, `~`.

Reglas de siempre (AGENTS.md): los cuadernos reales **no se tocan**: para probar Guardar con kit se copia uno a
`cuadernos-prueba/` (ignorada por git) o a una carpeta temporal fuera del repo. Un test que falla no se arregla tocando el
valor esperado. Commits pequeños en castellano, en la rama `electron` mientras el PR esté abierto.

## 0. Preparar (5 min)

```
git fetch origin && git checkout electron && git pull
npm ci
node node_modules/electron/install.js      # el binario de Electron (~100 MB), una vez
npx playwright install chromium            # si no está: lo usan los recorridos de navegador y el icono
```

Node 24 o más (`node -v`). Si `npm ci` compila `node-pty`, algo va mal: en Mac debe usar el prebuild
(`node_modules/node-pty/prebuilds/darwin-arm64/`).

## 1. La batería en el Mac (10 min)

```
npm run test:cobertura          # 240 tests, suelo 85 %
npm run test:electron           # 14 recorridos, sin xvfb: abren ventanas de verdad y las cierran
npm run test:navegador          # 120 recorridos
```

Qué mirar: que los 14 de Electron pasen con pantalla real (en Linux pasaban bajo Xvfb); si alguno falla por tiempo,
repetirlo solo (`node --test tests/electron/<fichero>.test.js`) antes de darlo por fallo. Anotar tiempos.

## 2. `npm run app` sobre el cuaderno de ejemplo (10 min)

```
cp -R ejemplos/cuaderno-ejemplo cuadernos-prueba/ejemplo && npm run app -- cuadernos-prueba/ejemplo
```

Comprobar, en este orden:

1. **Arranque:** «Abriendo el cuaderno…» con el color de la mesa y la «c», luego la portada. Tiempo a ojo (< 2 s).
2. **El entorno de la shell** (la pregunta P2 del spike que Linux no pudo responder): abrir la terminal del cajón y
   ejecutar `echo $PATH`, `which git`, `which claude`, `which node`. Comparar con lo mismo en Terminal.app. Tienen que
   coincidir (Homebrew, nvm, pyenv…). Después, Ayuda → Diagnóstico: «Entorno de la shell» debe decir el origen
   (`shell` o `shell interactiva`, no `respaldo`) y cuánto tardó. **Si dice `respaldo`**, mirar Ayuda → Mostrar
   registro: la línea del entorno dice por qué (tope de 10 s, sin marcadores, sin PATH).
3. **Qué binario es `process.execPath` dentro del hijo** (abierto en §2 y §10.5 del plan): en Diagnóstico, la línea
   «Ejecutable» (en Linux era el binario principal; en Mac puede ser `Cuaderno Helper`). Anotarlo.
4. **Menú y Dock:** que el primer menú sea «Cuaderno» y el segundo «Archivo» (no dos «Cuaderno»); ⌘O enfoca el
   buscador, ⌘F igual, ⌘T nueva tarea, ⌘N nueva nota, ⌘S guarda, ⇧⌘O abre el diálogo de carpeta, ⌘, Ajustes,
   ⌘[ / ⌘] atrás y adelante; ⌘K no hace nada. El icono en el Dock: tamaño parejo a sus vecinos (crítica 2).
5. **Título de la ventana:** «inicio.md — ejemplo» y cambia al cambiar de nota.
6. **Cerrar con cambios:** editar una nota, ⌘W o ⌘Q → «¿Descartar lo escrito?» → «Seguir editando» deja la app viva y
   **Guardar sigue funcionando** (el fallo 1 de §11 era justo este). Luego «Descartar» cierra.
7. **Cerrar y volver a abrir:** la ventana vuelve al mismo tamaño y sitio; en Actividad no queda ningún proceso
   `Cuaderno` ni `electron`.
8. **Elegir carpeta…** abre el diálogo del sistema; arrastrar una carpeta al icono del Dock la abre.

## 3. Guardar con un kit de verdad (10 min)

Copiar un cuaderno real con kit a una carpeta temporal **con su repo git** (`cp -R` de la carpeta entera, incluido `.git`,
o `git clone` local), abrirlo en la app y pulsar Guardar: la herramienta `guardar.js` del kit corre con el Node de
Electron (`ELECTRON_RUN_AS_NODE=1`). Qué mirar: la salida del kit en pantalla, `git log -1` en la copia, y en
Diagnóstico que `node-pty` cargó. Antes, el `grep` que quedó pendiente, en el repo de **profesor-kit** (no en este):

```
grep -rn "spawn\|exec\|npx\|process.execPath\|versions.electron" .
```

Si alguna herramienta del kit lanza `node`, `npm` o `npx` **por nombre**, dentro de la app no existirán aunque el PATH
esté bien si Node no está instalado; y si alguna mira `process.versions.electron` se confundirá (está definido aunque
corra como Node). Anotar lo que salga en §5 bis; si hay algo, es una tarea del kit, no de la app.

## 4. Empaquetar en el Mac (15 min)

```
npm run empaquetar:instaladores      # .dmg arm64 y x64 en dist-app/ (sin firma de Apple: ad hoc)
codesign -dv --verbose=2 "dist-app/mac-arm64/Cuaderno.app"
```

Qué mirar: `Signature=adhoc` e `Identifier=es.cuaderno.app` (si dice «code object is not signed at all», la firma ad hoc
no se aplicó: electron-builder.js, `mac.identity: "-"`). Tamaño del `.dmg`. Montarlo, arrastrar a Aplicaciones y abrir:
**construido en el propio Mac no lleva cuarentena**, así que debe abrir sin pasar por Gatekeeper. Comprobar que la
terminal funciona en el paquete (`spawn-helper` con permiso de ejecución dentro del bundle) y que Guardar con kit
funciona sin Node del sistema a la vista (`PATH=/usr/bin:/bin` en una Terminal y abrir la app desde ahí, por ejemplo).

## 5. La descarga con cuarentena (10 min, cuando se quiera)

Lanzar `empaquetar.yml` a mano desde Actions (`workflow_dispatch`; en repo privado gasta unos 100 minutos de cuota) o
poner una etiqueta `v0.2.0` de prueba, bajar el `.dmg` del run y abrirlo: aquí sí entra Gatekeeper. Esperado en macOS 15:
«no se puede abrir» → Ajustes del sistema → Privacidad y seguridad → «Abrir de todos modos». Si dice «dañado», la firma
ad hoc no llegó al artefacto. Los pasos son los de `INSTALAR.md`: comprobar que coinciden con lo que pasa y corregir el
texto si no.

## 6. El Windows del padre (cuando toque)

Con el `.exe` del run de CI: SmartScreen («Más información → Ejecutar de todas formas»), la terminal (conpty: Windows 10
1809 o más), un cuaderno con CRLF, Guardar con kit. `INSTALAR.md` igual: comprobar y corregir.

## 7. Al terminar

- §5 bis de `docs/planes/electron.md`: una tabla con cada apartado, sí/no, cifras y lo visto.
- Decisiones de §8 que siguen abiertas: repo público antes de empaquetar en CI; dónde se construye el `.dmg` (lo de §4
  responde si hace falta la CI para el Mac); arranque al iniciar sesión; qué Windows tiene el padre; y si Roberto veta
  alguno de los atajos que añadió la crítica (⌘N, ⌘[ / ⌘], Barra lateral y Terminal en Ver).
- Lo que falle, con su registro (`~/.config/cuaderno/registro.log`), al Inbox del plan vivo o a una tarea con test.
- Commit y push en `electron`; el PR #24 se mergea con la CI en verde en los tres sistemas.
