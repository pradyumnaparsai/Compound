# Installing on an iPhone without a paid Apple Developer account

This is the free-account route: the app is signed with a **free Apple ID** (a "Personal Team")
and re-signed **on the phone** by [SideStore](https://docs.sidestore.io) every few days, so the Mac
is only needed to build the IPA and to recover a broken setup.

It is intended for a handful of personal devices (family, a second phone) where a $99/year
membership is not justified. If the devices matter, buy the membership: it removes every
limitation below.

Tested with: Xcode 27.2 · iOS 26.6.1 · SideStore 0.7.0 · Compound 1.23.0.

## What you get, and what you give up

| | Free Apple ID + SideStore | Paid Apple Developer Program |
|---|---|---|
| Signature lifetime | **7 days**, re-signed on-device | 1 year |
| Devices per account | 3 | 100 |
| Apps per device | 3 (SideStore counts as one) | unlimited |
| HealthKit | ❌ **not available** | ✅ |
| App Groups (widgets) | ❌ not available | ✅ |
| Push / background delivery | ❌ | ✅ |
| Needs a computer | once per device, and again if SideStore itself lapses | no |
| Cost | $0 | $99/year |

**HealthKit is the important one.** A free Personal Team cannot register the HealthKit
capability, so a SideStore-signed build gets a provisioning profile containing only
`application-identifier`, `team-identifier`, `keychain-access-groups` and `get-task-allow`.
On a real device this shows up as `Missing com.apple.developer.healthkit entitlement`.
Compound handles this gracefully (`src/services/health.ts` catches the failure), but
**steps/workout sync with Apple Health does not work** on this route.

Everything else works: routines, todos, calendar, body/weight, workouts logged in the app,
meals (photo, barcode, AI estimate), Atomic voice, SQLite storage, Supabase backup.

## How it works

1. A computer installs **SideStore** onto the phone once, using the phone's own Apple ID.
   This also writes a **pairing file** — device-specific credentials SideStore needs later.
2. SideStore asks an **anisette server** for spoofed-Mac data, gets a certificate and a
   7-day provisioning profile from Apple for that Apple ID, signs the IPA, and installs it
   through a **local VPN** (`LocalDevVPN`) that lets it talk to the device's installer.
3. Every refresh repeats step 2. Nothing is extended — the clock is simply reset.
4. If an app is not refreshed within 7 days, iOS refuses to launch it. The app and its data
   are **not deleted**; refreshing brings it back.

The app is installed under a rewritten bundle ID: `com.productivitybooster.app.<TEAMID>`.
iOS treats that as a different app from a normally signed build, so its container starts empty.

## Prerequisites

Per device:

- An Apple ID with two-factor authentication. A **dedicated Apple ID per device** is strongly
  recommended (3-device limit; losing one account shouldn't take everything down).
- iOS 16.4 or newer (the app's minimum).
- One computer (macOS, Windows or Linux) with a USB cable, for the initial setup only.
- Wi-Fi for the refresh (LocalDevVPN needs to be connected).

Maintainer: macOS with Xcode 26+, Node 20+, CocoaPods, and the device UDID.

---

## Part A — build the IPA (maintainer, once per native change)

The IPA must be **unsigned**. Do not build it with Xcode's automatic signing: a signed build
carries the HealthKit entitlement, which the free profile cannot satisfy, and SideStore will
fail with "invalid entitlements".

```bash
npm ci

# Precompiled Expo modules link React.framework dynamically and crash on this app.
export EXPO_USE_PRECOMPILED_MODULES=0

npx expo prebuild -p ios --no-install
(cd ios && pod install)

xcodebuild -workspace ios/Compound.xcworkspace -scheme Compound \
  -configuration Release -sdk iphoneos -destination 'generic/platform=iOS' \
  -derivedDataPath ios/build \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" \
  build

rm -rf /tmp/ipa && mkdir -p /tmp/ipa/Payload
cp -R ios/build/Build/Products/Release-iphoneos/Compound.app /tmp/ipa/Payload/
(cd /tmp/ipa && zip -qry Compound.ipa Payload)
```

Add `"updates": { "enabled": false }` to the `expo` section of `app.json` (and set
`EXUpdatesEnabled` to `false` in the generated `ios/Compound/Supporting/Expo.plist`) unless
you **own** the EAS project referenced by `updates.url`. Otherwise the build on the phone
checks that project and can download and run somebody else's JavaScript bundle.

See "Updating the app" below for what has to be rebuilt.

## Part B — install SideStore (once per device, needs a computer)

1. On the iPhone, install **LocalDevVPN** from the App Store (free).
2. Connect the iPhone to the computer by USB, unlock it and tap **Trust**.
3. Run [iloader](https://github.com/nab138/iloader) on the computer:
   - sign in with the phone's Apple ID (case-sensitive) and complete 2FA;
   - select the device;
   - choose **Install SideStore (Stable)** — not "LiveContainer + SideStore".
4. On the iPhone:
   - Settings → General → **VPN & Device Management** → tap the Apple ID → **Trust**;
   - Settings → Privacy & Security → **Developer Mode** → On → restart.
5. Open **LocalDevVPN** and connect.
6. Open **SideStore** → sign in with the same Apple ID → My Apps → tap the **7 DAYS** counter
   next to SideStore → accept the certificate prompts. Refreshing SideStore first is required
   for a clean install.

If sign-in fails (`503`, `-22406`, "The data couldn't be read"), update SideStore/iloader first,
then try Settings → **Anisette Servers** and pick an official server. Old, widely shared
anisette servers are also a known cause of Apple ID lockouts.

## Part C — install Compound

1. Put `Compound.ipa` on the phone (AirDrop, iCloud Drive, or any file transfer).
2. **SideStore → My Apps → +** → select the IPA (or share the file to SideStore).
3. Wait 30–60 seconds while it is signed; "Compound" appears on the home screen.

Data: the install is a new container (`…<TEAMID>`). If you are moving from a normally signed
build, export your data first (Supabase backup) and restore it inside the app.

## Part D — verify

- [ ] The app launches and the tabs work (routines, todos, meals, body).
- [ ] The Health screen reports unavailable — this is expected, not a bug.
- [ ] SideStore shows ~7 days next to Compound.
- [ ] Tapping the counter and refreshing resets it to 7 days.
- [ ] Data survives a refresh (add a todo, refresh, force-quit, reopen).
- [ ] Refreshing works with the Mac **asleep** and the phone on cellular.

---

## Part E — keeping it alive

The 7-day clock is not removable. What is removable is the manual work.

### Manual (always works)

Open **SideStore → My Apps → tap the day counter**. That is the whole job, and it revives an
app that has already expired (as long as SideStore itself still opens).

**Refresh every 3–4 days, not every 7.** The dangerous failure is SideStore itself expiring:
at that point no app on the phone can renew anything, and you need iloader and a cable again.

### Automatic (best effort)

SideStore 0.7 exposes a **Refresh All Apps** action to Shortcuts, and iOS Shortcuts can switch
the VPN that LocalDevVPN installs.

Create a *Time of Day* automation (Shortcuts → Automation → +), ideally two per day:

1. **Set VPN** → LocalDevVPN → On (if LocalDevVPN is not listed, open the app instead and leave
   its auto-connect enabled)
2. **Wait** 8 seconds
3. **Refresh All Apps** (search "SideStore" in the action list)
4. **Wait** 60 seconds
5. Optionally **Set VPN** → Off

Set **Ask Before Running → Off**. Keep Background App Refresh on and Low Power Mode off.

Known limits, all confirmed upstream:

- **The phone must be unlocked.** On iOS 26/27 a refresh that fires while the screen is locked
  fails with `RemotePairingError 1016` ("device has not been unlocked recently") or
  `ADI -45061 (Device not provisioned)`. Schedule it for a time the phone is normally in use.
- **Only one VPN can be active.** LocalDevVPN and Tailscale (or any other VPN) cannot run at the
  same time. If you depend on Tailscale, toggle it in the same automation instead of leaving
  either one connected permanently.
- Background refresh is throttled by iOS. Treat the automation as a nudge and keep the weekly
  tap as the fallback.

### If something is broken

| Symptom | Cause | Fix |
|---|---|---|
| "Untrusted Developer" | certificate not trusted | Settings → VPN & Device Management → Trust |
| "App is no longer available" / icon greys out | profile expired | open SideStore → refresh |
| SideStore won't open | SideStore's own profile expired | iloader + cable again |
| Refresh fails only when locked | iOS 26/27 restriction | unlock, retry |
| Refresh fails with `-45061` / `1016` | known SideStore/iOS 26+ bugs | update SideStore, unlock, retry manually |
| "Maximum number of apps" | 3-app limit | delete an app |
| Sign-in `503` / `-22406` / format error | Apple sign-in change or anisette | update SideStore, switch anisette server |
| Pairing file invalid | passcode change, iOS update, reset | regenerate with iloader |
| Apple ID locked | shared/old anisette server | unlock at iforgot.apple.com; use a v3 server |
| "invalid entitlements" at install | IPA was signed with HealthKit/App Groups | rebuild unsigned |

## Updating the app

JS-only changes can go over the air **if** you own an EAS project and keep `updates` enabled.
Otherwise:

1. Rebuild the IPA (Part A).
2. Send it to the phone and install it through SideStore again.

The bundle ID is unchanged, so iOS installs over the existing app and **data is preserved**.
Changing the bundle ID makes it a new app with an empty container.

Native changes (new native module, config plugin, permission, icon) always require a rebuild.

## Security notes

- The **pairing file contains credentials for the device**. Keep it private, never commit it,
  and don't paste it into bug reports.
- Use a **dedicated Apple ID per device**, with 2FA, stored in a shared password manager.
  Do not reuse a personal iCloud account.
- The anisette server never receives the Apple ID password; it only supplies spoofed-Mac data.
- The free account's 3-device limit is per Apple ID, so separate Apple IDs also separate the limit.

## Optional: what a homelab can and cannot do

A Linux server cannot sign or install iOS apps: that requires macOS/Xcode plus a local
USB/Wi-Fi pairing with the device. It can, however:

- run `anisette-v3-server` in Docker to avoid shared public servers (note the VPN-slot conflict
  above: reach it over a public HTTPS endpoint, not Tailscale, if LocalDevVPN stays connected);
- host the IPA and a SideStore source JSON so updates are one tap;
- monitor **its own** services — it cannot see the phones or renew anything on them.

## Reference commands (maintainer)

```bash
xcrun devicectl list devices                     # UDIDs, connection state
ideviceinstaller -u <UDID> list                  # installed apps (no Xcode needed)
ideviceprovision -u <UDID> list                  # installed provisioning profiles
ideviceprovision -u <UDID> copy <UUID> <dir>     # pull a profile
security cms -D -i <dir>/<UUID>.mobileprovision  # inspect entitlements/expiry
```

Check the expiry and entitlements after any refresh:

```bash
security cms -D -i profile.mobileprovision | plutil -p - | grep -A8 Entitlements
```

A healthy free-tier profile shows `application-identifier`, `team-identifier`,
`keychain-access-groups`, `get-task-allow`, and an **empty** `application-groups` array.
