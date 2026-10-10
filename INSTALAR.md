# Instalar Cuaderno (la app de escritorio)

La app no va firmada ni notarizada (es para uso propio; `docs/planes/electron.md`, §2): el sistema avisa la
primera vez. Es un aviso, no un fallo. Los instaladores salen de `npm run empaquetar:instaladores` en un Mac
(`.dmg`) o en un Windows (`.exe`), o de la CI cuando la hay (T7 del plan).

## Mac

1. Abre el `.dmg` y arrastra **Cuaderno** a Aplicaciones.
2. El primer arranque dice que no se puede abrir porque no se ha podido verificar. Ve a **Ajustes del Sistema →
   Privacidad y seguridad**, baja hasta el aviso sobre Cuaderno y pulsa **«Abrir de todos modos»**. Solo la
   primera vez (en macOS 15 ya no vale Control + clic → Abrir).
3. Si sale **«está dañado y no se puede abrir»**, el paquete no lleva firma ad hoc (`codesign -dv --verbose=2
   /Applications/Cuaderno.app` debería decir `Signature=adhoc`): avísalo. Es un fallo del empaquetado, no del Mac.

**Alternativa sin avisos:** construirla en el propio Mac. Lo que se construye en el ordenador no lleva la marca de
cuarentena de las descargas y Gatekeeper no lo detiene:

```
git clone <el repo> && cd cuaderno-app
npm ci
npm run empaquetar          # dist-app/mac-arm64/Cuaderno.app (o mac/ en Intel): arrástrala a Aplicaciones
```

Los `.dmg` van por arquitectura: `arm64` para los Mac con chip Apple, `x64` para los Intel.

## Windows

1. Ejecuta `Cuaderno Setup <versión>.exe`. Se instala para el usuario actual, sin pedir administrador, y pone un
   acceso directo en el menú Inicio y en el escritorio.
2. SmartScreen dice «Windows protegió su PC»: pulsa **«Más información»** y después **«Ejecutar de todas
   formas»**. Pasa con cada versión nueva.
3. Hace falta **Windows 10 versión 1809 o más reciente** (o Windows 11): la terminal de la app usa ConPTY, que
   no existe antes.

## Actualizar sin instalador: `npm run instalar`

La app no se actualiza sola. En un ordenador con el repo clonado, `npm run instalar` deja instalada la última versión
de `main`: la construye allí mismo (en Mac sin `.dmg`, en Windows con el instalador NSIS), cierra Cuaderno sin
forzarla, la sustituye y la abre. Si Cuaderno no se cierra (por ejemplo, pregunta si descartas lo escrito), para
sin instalar nada. `npm run instalar -- --simular` enseña los pasos sin ejecutar ninguno.

**Preparación de una vez en el Windows del padre** (la hace quien le ayude, no hace falta repetirla):

1. Instala **Node 24 o más reciente** (nodejs.org, instalador para Windows) y **git** (git-scm.com).
2. Crea en GitHub un **token de acceso personal de grano fino** (Ajustes → Developer settings → Fine-grained tokens)
   con acceso **solo a este repositorio** y el permiso **Contents: solo lectura**. El repo es privado y sin token
   `git pull` no entra. El token no se guarda en ningún fichero del repo ni se pega en un chat.
3. Clona el repo con el Administrador de credenciales de Windows (viene con git): al pedir usuario y contraseña, el
   usuario es el de GitHub y la contraseña es el token; git lo guarda en el Administrador de credenciales y no vuelve a
   preguntar.
   ```
   git clone <el repo> && cd cuaderno-app
   ```
4. Instala las dependencias y el binario de Electron (una vez; `npm run instalar` lo repite solo si cambian):
   ```
   npm ci
   node node_modules/electron/install.js
   ```
5. Primera instalación: `npm run instalar`. SmartScreen puede avisar la primera vez (arriba, en Windows).

Desde ahí, cada actualización es `npm run instalar` en esa carpeta, con la app cerrada o abierta sin cambios sin
guardar. Se instala por usuario, sin administrador, en `%LOCALAPPDATA%\Programs\Cuaderno`.

## Dónde mira cuando algo falla

- **Ayuda → Mostrar registro** abre `registro.log`, en la carpeta de configuración de la app (la misma que usa
  la versión web): `~/.config/cuaderno/registro.log` en Mac y Linux, `%APPDATA%\cuaderno\registro.log` en Windows.
  Ahí van el arranque, el entorno de la shell que encontró, el puerto y cualquier fallo del servidor.
- **Ayuda → Diagnóstico** enseña las versiones, el puerto, el `PATH` resuelto y si la terminal (`node-pty`) ha cargado.

## La versión web sigue

La app es la misma pantalla con su servidor dentro. Sin instalar nada, con Node 24 o más reciente:

```
npm ci
node server.js <carpeta-del-cuaderno>      # o npm start; abre http://localhost:7331
```

Web y app comparten la configuración (tema, cuadernos recientes): se puede ir y volver sin perder nada.
