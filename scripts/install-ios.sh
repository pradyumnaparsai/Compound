#!/usr/bin/env bash
# Build and install the app on a connected iPhone.
#   scripts/install-ios.sh release   standalone build (runs without the Mac); re-run every 7 days (free team)
#   scripts/install-ios.sh debug     dev build that loads JS from Metro (npx expo start --dev-client)
# Installing over the existing app keeps its data (same bundle ID).
set -euo pipefail
cd "$(dirname "$0")/.."

MODE="${1:-release}"
DEVICE_ID="${DEVICE_ID:-00008140-001455C238A2201C}"
BUNDLE_ID="com.productivitybooster.app" # keep: changing it makes iOS treat this as a new app (data lost)
case "$MODE" in
  release) CONFIG=Release ;;
  debug) CONFIG=Debug ;;
  *) echo "usage: $0 [release|debug]" >&2; exit 2 ;;
esac

# Build Expo modules from source. The precompiled ExpoModulesWorklets xcframework links React.framework dynamically,
# but React is not embedded in the app, so it crashes at launch with "Library not loaded: @rpath/React.framework/React".
export EXPO_USE_PRECOMPILED_MODULES=0

[ -d ios ] || npx expo prebuild -p ios --no-install
(cd ios && pod install) # always: picks up newly added native modules (e.g. expo-speech)

WORKSPACE="$(ls -d ios/*.xcworkspace | head -n 1)"
SCHEME="$(basename "$WORKSPACE" .xcworkspace)"
DERIVED="$PWD/ios/build"

# Release builds skip the dSYM (~6 s, only needed for symbolicating crashes from distributed builds).
EXTRA=()
[ "$MODE" = release ] && EXTRA+=(DEBUG_INFORMATION_FORMAT=dwarf)

xcodebuild -workspace "$WORKSPACE" -scheme "$SCHEME" \
  -configuration "$CONFIG" -destination "id=$DEVICE_ID" -derivedDataPath "$DERIVED" \
  -allowProvisioningUpdates ${EXTRA[@]+"${EXTRA[@]}"} build | tail -n 5

APP="$DERIVED/Build/Products/$CONFIG-iphoneos/$SCHEME.app"
xcrun devicectl device install app --device "$DEVICE_ID" "$APP"
xcrun devicectl device process launch --device "$DEVICE_ID" "$BUNDLE_ID" || \
  echo "Installed. Unlock the phone and open the app (launch needs an unlocked device)."
