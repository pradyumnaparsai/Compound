# Deploying to your iPhone (free Apple ID, no cable)

Two separate things happen, on two different schedules:

| What | How often | Command |
|---|---|---|
| **Publish JS/asset changes** (OTA) | every feature | `npm run update -- --message "what changed"` |
| **Re-sign the app** (Apple's free-account 7-day limit) | every ~6 days, or after any native change | `scripts/install-ios.sh release` |

## How OTA works

1. The app on the phone is a standalone **Release** build with `expo-updates` inside.
   It was built locally by Xcode (`scripts/install-ios.sh release`).
2. On launch it asks `updates.url` (Expo's server, project in `app.json`) for the newest update on
   channel `main` (the `expo-channel-name` header in `app.json`) that matches its **runtime version**.
   `runtimeVersion` is a fixed string (`"1"` in `app.json`), NOT the fingerprint policy: with a local
   `ios/` folder the fingerprint never matched between the Xcode build and `eas update`.
   Only change it (e.g. to `"2"`) when you make a native change, then rebuild with the install script.
3. `npm run update` bundles your JS + assets and uploads them to that channel.
4. The phone downloads the update in the background on launch and applies it on the **next** launch
   (open the app, close it fully, open it again).

Only JS and assets travel over the air. The signature that Apple puts on the app cannot be renewed
by OTA, so the 7-day re-install is still needed.

## One-time setup

```bash
# put your phone's UDID in ~/.zshrc so the script always finds it (xcrun devicectl list devices)
export DEVICE_ID=<your-iphone-udid>
```

Wireless installs: connect the phone by cable once, unlock it, then in Xcode open
Window > Devices and Simulators (Shift+Cmd+2), select the phone and tick "Connect via network".
Check it worked by unplugging and running `xcrun devicectl list devices` (phone shows `available (paired)`).
Mac and phone must be on the same Wi-Fi, phone unlocked.

## Every feature change (JS/TS/assets only)

```bash
npm test && npx tsc --noEmit && npx expo lint
npm run bump -- minor        # minor = new feature, patch = fix, major = big UI overhaul
npm run update -- --message "short description"
```

Then open the app on the phone twice (first launch downloads, second applies). The Routines tab
footer shows `v<version> · Updated <time>`: the version should match the one you bumped to.
The printed **Runtime version** must be `1` (same as the installed build).

## Every ~6 days (or after the app stops opening)

```bash
scripts/install-ios.sh release
```

Installs over the existing app (same bundle ID), so your data stays. Works over Wi-Fi once paired.
Phone must be unlocked.

## Needs a rebuild (not OTA)

New native module/library, config plugin or native `app.json` changes (permissions, plugins, icon,
`ios.*`). Do:

```bash
npx expo prebuild -p ios --no-install && (cd ios && pod install)   # only if native config changed
scripts/install-ios.sh release
```

## Troubleshooting

- **Update not showing:** the update's runtime version must equal the installed build's.
  If you changed anything native, bump `runtimeVersion`, rebuild with the install script, then publish.
- **App won't open ("unable to verify"):** the 7 days expired. Run the install script.
- **Nothing downloads:** `npx eas-cli whoami` (must be logged in to publish); phone needs internet.
- **Mac asleep / different Wi-Fi:** wireless install fails. Use a cable.
