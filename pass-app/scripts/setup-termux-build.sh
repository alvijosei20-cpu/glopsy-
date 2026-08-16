#!/data/data/com.termux/files/usr/bin/bash
# setup-termux-build.sh
#
# Corrige la incompatibilidad de arquitectura del Android SDK en Termux (aarch64).
# El SDK estándar de Google descarga binarios linux-x86_64 (aapt2, cmake, ninja),
# que fallan en un dispositivo ARM64 con errores tipo:
#   "aapt2: syntax error: unexpected '('"
#   "cmake: syntax error: unexpected ')'"
#
# Instala los binarios aarch64 de Termux y los usa en lugar de los del SDK.
# Es idempotente: los binarios originales del SDK se respaldan con extensión .x86_64.

set -euo pipefail

PREFIX="/data/data/com.termux/files/usr"
ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}"

echo "==> Instalando herramientas aarch64 de Termux..."
pkg install -y aapt2 cmake ninja

CMAKE_VERSION="3.22.1"
SDK_CMAKE_DIR="$ANDROID_HOME/cmake/$CMAKE_VERSION/bin"

if [ ! -d "$SDK_CMAKE_DIR" ]; then
  echo "No se encontró el cmake del SDK en $SDK_CMAKE_DIR."
  echo "Revisa ANDROID_HOME o la versión de cmake en android/app/build.gradle."
  exit 1
fi

echo "==> Reemplazando binarios x86_64 del SDK por los de Termux (aarch64)..."
for tool in cmake cpack ctest ninja; do
  target="$SDK_CMAKE_DIR/$tool"
  src="$PREFIX/bin/$tool"
  if [ -e "$src" ]; then
    if [ -e "$target" ] && [ ! -e "$target.x86_64" ]; then
      cp "$target" "$target.x86_64"
    fi
    cp "$src" "$target"
    chmod +x "$target"
    echo "    $target <- $src"
  fi
done

AAPT2_SRC="$PREFIX/bin/aapt2"
if [ -x "$AAPT2_SRC" ]; then
  echo "==> El plugin de config añade android.aapt2FromMavenOverride en el prebuild."
  echo "    Si ya tienes android/ generado, ejecuta: npx expo prebuild -p android"
fi

echo "==> Listo. Reconstruye con: cd android && ./gradlew :app:assembleDebug"
