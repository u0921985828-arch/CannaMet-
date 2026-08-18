# Sacar el APK

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

## Por qué no se construye aquí

El entorno de esta sesión no llega a `dl.google.com` ni a `expo.dev`: la
política de red del contenedor responde 403 a los dos. Sin el SDK de Android no
hay compilación local, y sin `expo.dev` no hay build en la nube. La build sale
de tu máquina, no de aquí.
