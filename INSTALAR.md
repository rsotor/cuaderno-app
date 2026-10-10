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
