# Sacar el APK

## Ya hay uno compilado

Cada push a la rama dispara `.github/workflows/build-apk.yml`, que compila en un
runner de GitHub y publica el resultado:

- **Descarga directa:** https://github.com/u0921985828-arch/CannaMet-/releases/download/apk/CannaMet.apk
- También queda en **Actions ▸ el run ▸ Artifacts**.

Va firmado con la clave de depuración: sirve para instalar y probar, no para
publicar en Play. Para instalarlo hay que permitir «Instalar apps desconocidas»
en el móvil, o `adb install -r CannaMet.apk` por USB.

El `.env` no se sube al repositorio, así que **una build sin `env` en `eas.json`
arranca y muere en la primera pantalla** con «Faltan EXPO_PUBLIC_SUPABASE_URL o
EXPO_PUBLIC_SUPABASE_ANON_KEY». Los tres perfiles ya llevan las dos variables.
La clave es la publicable: es segura en cliente, toda la protección vive en RLS.

## APK instalable (el que quieres para probar)

```bash
npm install -g eas-cli
eas login                 # cuenta de Expo, gratis
eas init                  # crea el proyecto y escribe extra.eas.projectId en app.json
eas build --platform android --profile preview
```

`preview` produce un **APK** con `distribution: internal`. Al terminar, EAS da
un enlace de descarga y un QR. Tarda entre diez y veinticinco minutos según la
cola de la capa gratuita.

`eas init` es también lo que hace que funcionen los avisos push: sin
`extra.eas.projectId` la app no pide token y lo dice en el log.

## AAB para Google Play

```bash
eas build --platform android --profile production
```

Play no acepta APK para aplicaciones nuevas: pide el App Bundle que genera este
perfil.

## Avisos push en una build real

1. `eas credentials` → Android → subir la clave del servicio de FCM V1 desde la
   consola de Firebase.
2. En iOS, EAS genera la clave de APNs solo si le dejas.
3. Sin esto la app funciona igual; simplemente no llega ningún aviso.

## Por qué la build va por CI y no en local

El entorno de la sesión de Claude no llega a `dl.google.com` ni a `expo.dev`: la
política de red responde 403 a los dos, así que allí no hay SDK de Android ni
build en la nube de EAS. Un runner de Actions sí llega, y de ahí sale el APK.

Lo que sí se puede comprobar sin el SDK, y conviene hacer antes de gastar una
vuelta de CI de cinco minutos:

```bash
npx expo export --platform android
```

Eso ejecuta Metro entero. Los dos primeros intentos de build murieron ahí y ese
comando los habría cazado en local.
