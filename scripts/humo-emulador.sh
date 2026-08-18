#!/usr/bin/env bash
# Prueba de humo en el emulador: instalar, abrir y comprobar que sigue en pie.
#
# Vive en un fichero y no dentro del `script:` del workflow porque
# android-emulator-runner pasa ese bloque a `sh -c` linea a linea, y un `if`
# multilinea se parte por la mitad.
set -euo pipefail

APK="${1:-MATCH.apk}"
PAQUETE=com.match.app
ESPERA=25

adb install -r "$APK"
adb logcat -c
adb shell am start -n "$PAQUETE/.MainActivity"
sleep "$ESPERA"
adb exec-out screencap -p > pantalla.png

REGISTRO=$(adb logcat -d)

if grep -qE "FATAL EXCEPTION|AndroidRuntime: Process: $PAQUETE" <<<"$REGISTRO"; then
  echo "::error::excepcion fatal al arrancar"
  tail -80 <<<"$REGISTRO"
  exit 1
fi

# La pantalla roja de React Native no lanza excepcion: sin esto el test pasaria
# con la app rota y una captura en rojo que nadie mira.
if grep -qiE "Unable to load script|Could not connect to development server" <<<"$REGISTRO"; then
  echo "::error::el bundle de JavaScript no cargo"
  tail -80 <<<"$REGISTRO"
  exit 1
fi

if ! adb shell dumpsys activity activities | grep -q "$PAQUETE"; then
  echo "::error::la actividad no esta en primer plano"
  exit 1
fi

echo "MATCH arranca y se mantiene en primer plano."
